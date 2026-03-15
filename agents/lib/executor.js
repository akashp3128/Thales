/**
 * Executor Agent for Thales Phase 4
 *
 * Parses verified proposals into executable actions and runs them
 */

const { OllamaClient } = require('./ollama');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WORKSPACE_PATH = process.env.WORKSPACE_PATH || '/workspace';
const COMPUTER_USE_URL = process.env.COMPUTER_USE_URL || 'http://computer-use:5001';

class ExecutorAgent {
  constructor(options = {}) {
    this.ollama = new OllamaClient(options);
    this.workspacePath = options.workspacePath || WORKSPACE_PATH;
    this.computerUseUrl = options.computerUseUrl || COMPUTER_USE_URL;
    this.model = options.model || 'mistral:7b-instruct-v0.3-q4_K_M';
  }

  /**
   * Parse a verified proposal into executable actions
   */
  async parseProposal(proposal) {
    const prompt = `Given this task, output the exact actions needed to complete it.

TASK: ${proposal.description}
RISK LEVEL: ${proposal.risk}

Available actions:
- write_file: Create or overwrite a file. Parameters: {path: string, content: string}
- read_file: Read a file. Parameters: {path: string}
- execute: Run a shell command. Parameters: {command: string}
- screenshot: Take a screenshot. Parameters: {}
- click: Click mouse. Parameters: {x: number, y: number}
- type: Type text. Parameters: {text: string}
- key: Press a key. Parameters: {key: string}

Respond with JSON only:
{"actions": [{"action": "action_name", "parameters": {...}}, ...]}`;

    try {
      const response = await this.ollama.generate(prompt, {
        system: 'You are an action parser. Convert task descriptions to executable actions. Output JSON only.',
        temperature: 0.2
      });

      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          success: true,
          actions: parsed.actions || []
        };
      }

      // Fallback: simple heuristics
      return this._heuristicParse(proposal);
    } catch (error) {
      console.error('[Executor] Parse error:', error.message);
      return this._heuristicParse(proposal);
    }
  }

  /**
   * Fallback heuristic parser for common tasks
   */
  _heuristicParse(proposal) {
    const desc = proposal.description.toLowerCase();
    const actions = [];

    // File creation patterns
    const createMatch = desc.match(/create\s+(?:a\s+)?(?:file\s+)?(?:called\s+)?["\']?([^\s"']+)["\']?\s+(?:with|containing)\s+(?:content\s+)?["\']?(.+)["\']?/i);
    if (createMatch) {
      actions.push({
        action: 'write_file',
        parameters: {
          path: createMatch[1],
          content: createMatch[2]
        }
      });
    }

    // Command execution patterns
    const runMatch = desc.match(/(?:run|execute)\s+(?:the\s+)?(?:command\s+)?["\']?(.+)["\']?/i);
    if (runMatch) {
      actions.push({
        action: 'execute',
        parameters: { command: runMatch[1] }
      });
    }

    // Read file patterns
    const readMatch = desc.match(/read\s+(?:the\s+)?(?:file\s+)?["\']?([^\s"']+)["\']?/i);
    if (readMatch) {
      actions.push({
        action: 'read_file',
        parameters: { path: readMatch[1] }
      });
    }

    // Default to a simple file creation if nothing matched
    if (actions.length === 0) {
      actions.push({
        action: 'write_file',
        parameters: {
          path: 'output.txt',
          content: `Task: ${proposal.description}\nCompleted at: ${new Date().toISOString()}`
        }
      });
    }

    return { success: true, actions };
  }

  /**
   * Execute a single action
   */
  async executeAction(action, parameters) {
    const startTime = Date.now();

    try {
      let result;

      switch (action) {
        case 'write_file':
          result = await this._writeFile(parameters.path, parameters.content);
          break;

        case 'read_file':
          result = await this._readFile(parameters.path);
          break;

        case 'execute':
          result = await this._execute(parameters.command);
          break;

        case 'screenshot':
          result = await this._screenshot();
          break;

        case 'click':
          result = await this._click(parameters.x, parameters.y, parameters.button);
          break;

        case 'type':
          result = await this._type(parameters.text);
          break;

        case 'key':
          result = await this._key(parameters.key);
          break;

        default:
          result = { success: false, error: `Unknown action: ${action}` };
      }

      return {
        action,
        parameters,
        ...result,
        durationMs: Date.now() - startTime
      };
    } catch (error) {
      return {
        action,
        parameters,
        success: false,
        error: error.message,
        durationMs: Date.now() - startTime
      };
    }
  }

  /**
   * Execute all actions for a proposal
   */
  async execute(verificationResult) {
    const startTime = Date.now();
    const results = [];

    // Parse proposal into actions
    const parseResult = await this.parseProposal(verificationResult.proposal);
    if (!parseResult.success) {
      return {
        success: false,
        error: 'Failed to parse proposal',
        results: [],
        durationMs: Date.now() - startTime
      };
    }

    // Execute each action sequentially
    let allSucceeded = true;
    for (const actionDef of parseResult.actions) {
      const result = await this.executeAction(actionDef.action, actionDef.parameters);
      results.push(result);

      if (!result.success) {
        allSucceeded = false;
        break; // Stop on first failure
      }
    }

    return {
      success: allSucceeded,
      actions: parseResult.actions,
      results,
      durationMs: Date.now() - startTime
    };
  }

  // ==================== Action Implementations ====================

  async _writeFile(filePath, content) {
    const fullPath = this._resolvePath(filePath);
    const dir = path.dirname(fullPath);

    // Create directory if needed
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content, 'utf8');
    return {
      success: true,
      result: { path: fullPath, bytesWritten: content.length }
    };
  }

  async _readFile(filePath) {
    const fullPath = this._resolvePath(filePath);

    if (!fs.existsSync(fullPath)) {
      return { success: false, error: `File not found: ${filePath}` };
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    return {
      success: true,
      result: { path: fullPath, content, size: content.length }
    };
  }

  async _execute(command) {
    try {
      const output = execSync(command, {
        cwd: this.workspacePath,
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024,
        encoding: 'utf8'
      });

      return {
        success: true,
        result: { command, stdout: output.trim() }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        result: { command, stderr: error.stderr }
      };
    }
  }

  async _screenshot() {
    try {
      const response = await fetch(`${this.computerUseUrl}/screenshot?format=base64`);
      const data = await response.json();
      return {
        success: true,
        result: { format: data.format, width: data.width, height: data.height }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async _click(x, y, button = 1) {
    try {
      const response = await fetch(`${this.computerUseUrl}/mouse/click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x, y, button })
      });
      const data = await response.json();
      return { success: data.success !== false, result: data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async _type(text) {
    try {
      const response = await fetch(`${this.computerUseUrl}/keyboard/type`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await response.json();
      return { success: data.success !== false, result: data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async _key(key) {
    try {
      const response = await fetch(`${this.computerUseUrl}/keyboard/key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
      });
      const data = await response.json();
      return { success: data.success !== false, result: data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Resolve a file path relative to workspace
   */
  _resolvePath(filePath) {
    if (path.isAbsolute(filePath)) {
      // Security: ensure it's within workspace
      if (!filePath.startsWith(this.workspacePath)) {
        return path.join(this.workspacePath, path.basename(filePath));
      }
      return filePath;
    }
    return path.join(this.workspacePath, filePath);
  }
}

module.exports = { ExecutorAgent };
