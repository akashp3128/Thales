/**
 * Base Agent Class
 *
 * Implements the core observe-think-act loop for AI agents.
 * All specialized agents extend this class.
 */

const { v4: uuidv4 } = require('uuid');
const { OllamaClient } = require('./ollama');

// Agent states
const AgentState = {
  IDLE: 'idle',
  OBSERVING: 'observing',
  THINKING: 'thinking',
  ACTING: 'acting',
  PAUSED: 'paused',
  ERROR: 'error',
  STOPPED: 'stopped'
};

class Agent {
  constructor(options = {}) {
    this.id = options.id || uuidv4();
    this.name = options.name || 'Agent';
    this.role = options.role || 'general';
    this.model = options.model || 'mistral:7b-instruct-v0.3-q4_K_M';

    this.state = AgentState.IDLE;
    this.ollama = new OllamaClient({ model: this.model });

    // Agent memory
    this.shortTermMemory = [];
    this.maxMemorySize = options.maxMemorySize || 20;

    // Task queue
    this.taskQueue = [];
    this.currentTask = null;

    // Configuration
    this.loopInterval = options.loopInterval || 5000;
    this.maxActionsPerLoop = options.maxActionsPerLoop || 3;

    // Callbacks
    this.onStateChange = options.onStateChange || null;
    this.onAction = options.onAction || null;
    this.onError = options.onError || null;
    this.onLog = options.onLog || console.log;

    // Loop control
    this._loopTimer = null;
    this._running = false;

    // System prompt
    this.systemPrompt = options.systemPrompt || this._defaultSystemPrompt();
  }

  _defaultSystemPrompt() {
    return `You are ${this.name}, an AI agent working in a collaborative multiplayer computer environment called Thales.

Your role: ${this.role}

You have access to a shared workspace where multiple humans and AI agents collaborate. You can:
- Read and write files in /workspace
- Execute shell commands
- Interact with the virtual desktop (take screenshots, click, type)
- Communicate with other agents and humans

When given a task, break it down into steps and execute them one at a time.
Always explain your reasoning before taking actions.
Be concise but thorough.

Respond with JSON in this format:
{
  "thought": "Your reasoning about what to do next",
  "action": "The action type: read_file, write_file, execute, screenshot, click, type, done, or ask",
  "parameters": { /* action-specific parameters */ }
}`;
  }

  /**
   * Start the agent loop
   */
  start() {
    if (this._running) return;

    this._running = true;
    this._setState(AgentState.IDLE);
    this._log(`Agent ${this.name} started`);

    this._runLoop();
  }

  /**
   * Stop the agent loop
   */
  stop() {
    this._running = false;
    if (this._loopTimer) {
      clearTimeout(this._loopTimer);
      this._loopTimer = null;
    }
    this._setState(AgentState.STOPPED);
    this._log(`Agent ${this.name} stopped`);
  }

  /**
   * Pause the agent
   */
  pause() {
    this._setState(AgentState.PAUSED);
    this._log(`Agent ${this.name} paused`);
  }

  /**
   * Resume the agent
   */
  resume() {
    if (this.state === AgentState.PAUSED) {
      this._setState(AgentState.IDLE);
      this._log(`Agent ${this.name} resumed`);
    }
  }

  /**
   * Assign a task to the agent
   */
  assignTask(task) {
    const taskObj = {
      id: uuidv4(),
      description: task,
      status: 'pending',
      createdAt: new Date().toISOString(),
      steps: [],
      result: null
    };

    this.taskQueue.push(taskObj);
    this._log(`Task assigned: ${task}`);

    return taskObj.id;
  }

  /**
   * Main agent loop
   */
  async _runLoop() {
    while (this._running) {
      try {
        if (this.state === AgentState.PAUSED) {
          await this._sleep(1000);
          continue;
        }

        // Get next task if idle
        if (!this.currentTask && this.taskQueue.length > 0) {
          this.currentTask = this.taskQueue.shift();
          this.currentTask.status = 'in_progress';
          this.currentTask.startedAt = new Date().toISOString();
          this._log(`Starting task: ${this.currentTask.description}`);
        }

        if (this.currentTask) {
          await this._executeTaskStep();
        } else {
          // No tasks, idle observation
          await this._idleObserve();
        }

      } catch (error) {
        this._setState(AgentState.ERROR);
        this._log(`Error in loop: ${error.message}`);
        if (this.onError) this.onError(error);
        await this._sleep(5000);
      }

      await this._sleep(this.loopInterval);
    }
  }

  /**
   * Execute one step of the current task
   */
  async _executeTaskStep() {
    // Observe
    this._setState(AgentState.OBSERVING);
    const observation = await this._observe();

    // Think
    this._setState(AgentState.THINKING);
    const decision = await this._think(observation);

    // Act
    this._setState(AgentState.ACTING);
    const result = await this._act(decision);

    // Record step
    this.currentTask.steps.push({
      observation: observation.summary,
      thought: decision.thought,
      action: decision.action,
      result: result,
      timestamp: new Date().toISOString()
    });

    // Check if task is complete
    if (decision.action === 'done') {
      this.currentTask.status = 'completed';
      this.currentTask.completedAt = new Date().toISOString();
      this.currentTask.result = decision.parameters?.result || 'Task completed';
      this._log(`Task completed: ${this.currentTask.description}`);
      this.currentTask = null;
    }

    this._setState(AgentState.IDLE);
  }

  /**
   * Observe the environment
   */
  async _observe() {
    const observation = {
      timestamp: new Date().toISOString(),
      task: this.currentTask?.description,
      previousSteps: this.currentTask?.steps.slice(-3) || [],
      environment: {}
    };

    // Can be overridden by subclasses to add specific observations
    observation.summary = this._summarizeObservation(observation);

    return observation;
  }

  _summarizeObservation(obs) {
    let summary = `Current task: ${obs.task || 'None'}\n`;
    if (obs.previousSteps.length > 0) {
      summary += `Previous steps:\n`;
      obs.previousSteps.forEach((step, i) => {
        summary += `  ${i + 1}. ${step.action}: ${JSON.stringify(step.result).slice(0, 100)}\n`;
      });
    }
    return summary;
  }

  /**
   * Think about what to do next
   */
  async _think(observation) {
    const prompt = this._buildThinkPrompt(observation);

    try {
      const response = await this.ollama.generate(prompt, {
        system: this.systemPrompt,
        temperature: 0.3
      });

      // Parse JSON response
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const decision = JSON.parse(jsonMatch[0]);
        this._addToMemory({ type: 'thought', content: decision.thought });
        return decision;
      }

      // Fallback if no valid JSON
      return {
        thought: response.text,
        action: 'done',
        parameters: { result: 'Could not parse action' }
      };

    } catch (error) {
      this._log(`Think error: ${error.message}`);
      return {
        thought: `Error occurred: ${error.message}`,
        action: 'done',
        parameters: { error: error.message }
      };
    }
  }

  _buildThinkPrompt(observation) {
    let prompt = `OBSERVATION:\n${observation.summary}\n\n`;

    if (this.shortTermMemory.length > 0) {
      prompt += `RECENT MEMORY:\n`;
      this.shortTermMemory.slice(-5).forEach(mem => {
        prompt += `- [${mem.type}] ${mem.content.slice(0, 200)}\n`;
      });
      prompt += '\n';
    }

    prompt += `Based on the observation, decide what action to take next.\n`;
    prompt += `Respond with JSON: {"thought": "...", "action": "...", "parameters": {...}}`;

    return prompt;
  }

  /**
   * Execute an action
   */
  async _act(decision) {
    const { action, parameters } = decision;

    this._log(`Action: ${action} - ${JSON.stringify(parameters || {}).slice(0, 100)}`);

    if (this.onAction) {
      this.onAction({ action, parameters, agentId: this.id });
    }

    // Actions are implemented by the AgentRunner which has access to tools
    // Return a placeholder - actual execution happens via the runner
    return { action, parameters, status: 'pending' };
  }

  /**
   * Idle observation when no tasks
   */
  async _idleObserve() {
    // Can be overridden by subclasses
    this._setState(AgentState.IDLE);
  }

  /**
   * Add to short-term memory
   */
  _addToMemory(item) {
    this.shortTermMemory.push({
      ...item,
      timestamp: new Date().toISOString()
    });

    // Trim memory if too large
    if (this.shortTermMemory.length > this.maxMemorySize) {
      this.shortTermMemory = this.shortTermMemory.slice(-this.maxMemorySize);
    }
  }

  /**
   * Set agent state
   */
  _setState(newState) {
    const oldState = this.state;
    this.state = newState;

    if (this.onStateChange && oldState !== newState) {
      this.onStateChange({ agentId: this.id, oldState, newState });
    }
  }

  /**
   * Log message
   */
  _log(message) {
    const logEntry = `[${this.name}] ${message}`;
    if (this.onLog) this.onLog(logEntry);
  }

  /**
   * Sleep helper
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get agent status
   */
  getStatus() {
    return {
      id: this.id,
      name: this.name,
      role: this.role,
      model: this.model,
      state: this.state,
      currentTask: this.currentTask ? {
        id: this.currentTask.id,
        description: this.currentTask.description,
        status: this.currentTask.status,
        stepsCompleted: this.currentTask.steps.length
      } : null,
      queuedTasks: this.taskQueue.length,
      memorySize: this.shortTermMemory.length
    };
  }

  /**
   * Serialize agent state
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      role: this.role,
      model: this.model,
      state: this.state,
      taskQueue: this.taskQueue,
      currentTask: this.currentTask,
      shortTermMemory: this.shortTermMemory
    };
  }
}

module.exports = { Agent, AgentState };
