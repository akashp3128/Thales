/**
 * Agent Registry
 *
 * Manages the lifecycle of multiple agents and provides
 * coordination between them.
 */

const { Agent, AgentState } = require('./agent');
const { OllamaClient } = require('./ollama');
const fs = require('fs');
const path = require('path');

class AgentRegistry {
  constructor(options = {}) {
    this.agents = new Map();
    this.ollama = new OllamaClient();
    this.workspacePath = options.workspacePath || '/workspace';
    this.computerUseUrl = options.computerUseUrl || 'http://computer-use:5001';

    // Event handlers
    this.onAgentStateChange = options.onAgentStateChange || null;
    this.onAgentAction = options.onAgentAction || null;
    this.onAgentLog = options.onAgentLog || null;

    // Action queue for processing
    this.actionQueue = [];
    this._processingActions = false;
  }

  /**
   * Create and register a new agent
   */
  createAgent(options = {}) {
    const agent = new Agent({
      ...options,
      onStateChange: (data) => {
        if (this.onAgentStateChange) this.onAgentStateChange(data);
      },
      onAction: (data) => {
        this._queueAction(data);
        if (this.onAgentAction) this.onAgentAction(data);
      },
      onLog: (message) => {
        if (this.onAgentLog) this.onAgentLog(message);
      }
    });

    this.agents.set(agent.id, agent);
    return agent;
  }

  /**
   * Get an agent by ID
   */
  getAgent(agentId) {
    return this.agents.get(agentId);
  }

  /**
   * Remove an agent
   */
  removeAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.stop();
      this.agents.delete(agentId);
      return true;
    }
    return false;
  }

  /**
   * Start all agents
   */
  startAll() {
    this.agents.forEach(agent => agent.start());
    this._startActionProcessor();
  }

  /**
   * Stop all agents
   */
  stopAll() {
    this.agents.forEach(agent => agent.stop());
    this._processingActions = false;
  }

  /**
   * Get status of all agents
   */
  getAllStatus() {
    const statuses = [];
    this.agents.forEach(agent => {
      statuses.push(agent.getStatus());
    });
    return statuses;
  }

  /**
   * Assign a task to a specific agent
   */
  assignTask(agentId, task) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }
    return agent.assignTask(task);
  }

  /**
   * Assign a task to the best available agent
   */
  assignTaskAuto(task, preferredRole = null) {
    let bestAgent = null;
    let minQueueSize = Infinity;

    this.agents.forEach(agent => {
      if (agent.state === AgentState.STOPPED) return;
      if (preferredRole && agent.role !== preferredRole) return;

      const queueSize = agent.taskQueue.length + (agent.currentTask ? 1 : 0);
      if (queueSize < minQueueSize) {
        minQueueSize = queueSize;
        bestAgent = agent;
      }
    });

    if (!bestAgent) {
      // Fall back to any available agent
      this.agents.forEach(agent => {
        if (agent.state !== AgentState.STOPPED && !bestAgent) {
          bestAgent = agent;
        }
      });
    }

    if (!bestAgent) {
      throw new Error('No available agents');
    }

    return bestAgent.assignTask(task);
  }

  /**
   * Queue an action for processing
   */
  _queueAction(actionData) {
    this.actionQueue.push(actionData);
  }

  /**
   * Start the action processor
   */
  _startActionProcessor() {
    this._processingActions = true;
    this._processActions();
  }

  /**
   * Process queued actions
   */
  async _processActions() {
    while (this._processingActions) {
      if (this.actionQueue.length > 0) {
        const actionData = this.actionQueue.shift();
        await this._executeAction(actionData);
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Execute an action on behalf of an agent
   */
  async _executeAction(actionData) {
    const { action, parameters, agentId } = actionData;
    const agent = this.agents.get(agentId);

    if (!agent) return { error: 'Agent not found' };

    try {
      let result;

      switch (action) {
        case 'read_file':
          result = await this._readFile(parameters.path);
          break;

        case 'write_file':
          result = await this._writeFile(parameters.path, parameters.content);
          break;

        case 'list_files':
          result = await this._listFiles(parameters.path || '');
          break;

        case 'execute':
          result = await this._executeCommand(parameters.command);
          break;

        case 'screenshot':
          result = await this._takeScreenshot();
          break;

        case 'click':
          result = await this._click(parameters.x, parameters.y, parameters.button);
          break;

        case 'type':
          result = await this._type(parameters.text);
          break;

        case 'key':
          result = await this._pressKey(parameters.key);
          break;

        case 'ask':
          result = { question: parameters.question, status: 'pending_human_response' };
          break;

        case 'done':
          result = { completed: true, result: parameters.result };
          break;

        default:
          result = { error: `Unknown action: ${action}` };
      }

      // Store result in agent memory
      agent._addToMemory({
        type: 'action_result',
        content: `${action}: ${JSON.stringify(result).slice(0, 500)}`
      });

      // Update the current task step with actual result
      if (agent.currentTask && agent.currentTask.steps.length > 0) {
        const lastStep = agent.currentTask.steps[agent.currentTask.steps.length - 1];
        lastStep.result = result;
      }

      return result;

    } catch (error) {
      const errorResult = { error: error.message };
      agent._addToMemory({
        type: 'action_error',
        content: `${action} failed: ${error.message}`
      });
      return errorResult;
    }
  }

  /**
   * File operations
   */
  async _readFile(filePath) {
    const fullPath = path.join(this.workspacePath, filePath);

    // Security check
    if (!fullPath.startsWith(this.workspacePath)) {
      return { error: 'Access denied: path outside workspace' };
    }

    if (!fs.existsSync(fullPath)) {
      return { error: 'File not found' };
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    return { path: filePath, content, size: content.length };
  }

  async _writeFile(filePath, content) {
    const fullPath = path.join(this.workspacePath, filePath);

    // Security check
    if (!fullPath.startsWith(this.workspacePath)) {
      return { error: 'Access denied: path outside workspace' };
    }

    // Create directory if needed
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content, 'utf-8');
    return { path: filePath, written: true, size: content.length };
  }

  async _listFiles(dirPath) {
    const fullPath = path.join(this.workspacePath, dirPath);

    // Security check
    if (!fullPath.startsWith(this.workspacePath)) {
      return { error: 'Access denied: path outside workspace' };
    }

    if (!fs.existsSync(fullPath)) {
      return { error: 'Directory not found' };
    }

    const items = fs.readdirSync(fullPath).map(name => {
      const itemPath = path.join(fullPath, name);
      const stats = fs.statSync(itemPath);
      return {
        name,
        type: stats.isDirectory() ? 'directory' : 'file',
        size: stats.size
      };
    });

    return { path: dirPath, items };
  }

  /**
   * Command execution
   */
  async _executeCommand(command) {
    const { execSync } = require('child_process');
    try {
      const output = execSync(command, {
        cwd: this.workspacePath,
        timeout: 30000,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024
      });
      return { command, output, exitCode: 0 };
    } catch (error) {
      return {
        command,
        output: error.stdout || '',
        stderr: error.stderr || error.message,
        exitCode: error.status || 1
      };
    }
  }

  /**
   * Computer-use operations
   */
  async _takeScreenshot() {
    const response = await fetch(`${this.computerUseUrl}/screenshot?format=base64`);
    if (!response.ok) {
      return { error: `Screenshot failed: ${response.status}` };
    }
    const data = await response.json();
    return { image: data.image, format: data.format };
  }

  async _click(x, y, button = 1) {
    const response = await fetch(`${this.computerUseUrl}/mouse/click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x, y, button })
    });
    return await response.json();
  }

  async _type(text) {
    const response = await fetch(`${this.computerUseUrl}/keyboard/type`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    return await response.json();
  }

  async _pressKey(key) {
    const response = await fetch(`${this.computerUseUrl}/keyboard/key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    });
    return await response.json();
  }

  /**
   * Check if Ollama is ready with required models
   */
  async checkOllamaReady() {
    try {
      const healthy = await this.ollama.isHealthy();
      if (!healthy) return { ready: false, reason: 'Ollama not responding' };

      const models = await this.ollama.listModels();
      const hasModels = models.length > 0;

      return {
        ready: hasModels,
        models: models.map(m => m.name),
        reason: hasModels ? 'Ready' : 'No models installed'
      };
    } catch (error) {
      return { ready: false, reason: error.message };
    }
  }
}

module.exports = { AgentRegistry };
