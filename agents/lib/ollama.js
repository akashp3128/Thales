/**
 * Ollama Client Wrapper
 *
 * Provides a clean interface for interacting with the local Ollama server.
 * Handles model inference, streaming responses, and error handling.
 */

class OllamaClient {
  constructor(options = {}) {
    // Read env at construction time for flexibility
    const defaultUrl = process.env.OLLAMA_URL || 'http://ollama:11434';
    this.baseUrl = options.baseUrl || defaultUrl;
    this.defaultModel = options.model || 'mistral:7b-instruct-v0.3-q4_K_M';
    this.timeout = options.timeout || 300000; // 5 minutes for complex prompts
  }

  /**
   * Generate a completion from the model
   */
  async generate(prompt, options = {}) {
    const model = options.model || this.defaultModel;
    const system = options.system || '';
    const temperature = options.temperature ?? 0.7;
    const maxTokens = options.maxTokens || 2048;

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        system,
        stream: false,
        options: {
          temperature,
          num_predict: maxTokens,
        }
      }),
      signal: AbortSignal.timeout(this.timeout)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama generate failed: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return {
      text: data.response,
      model: data.model,
      totalDuration: data.total_duration,
      evalCount: data.eval_count,
    };
  }

  /**
   * Generate with streaming response
   */
  async *generateStream(prompt, options = {}) {
    const model = options.model || this.defaultModel;
    const system = options.system || '';
    const temperature = options.temperature ?? 0.7;

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        system,
        stream: true,
        options: { temperature }
      }),
      signal: AbortSignal.timeout(this.timeout)
    });

    if (!response.ok) {
      throw new Error(`Ollama stream failed: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          yield data.response;
          if (data.done) return;
        } catch (e) {
          // Skip malformed JSON
        }
      }
    }
  }

  /**
   * Chat completion with message history
   */
  async chat(messages, options = {}) {
    const model = options.model || this.defaultModel;
    const temperature = options.temperature ?? 0.7;

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: { temperature }
      }),
      signal: AbortSignal.timeout(this.timeout)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama chat failed: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return {
      message: data.message,
      model: data.model,
      totalDuration: data.total_duration,
    };
  }

  /**
   * List available models
   */
  async listModels() {
    const response = await fetch(`${this.baseUrl}/api/tags`);
    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.status}`);
    }
    const data = await response.json();
    return data.models || [];
  }

  /**
   * Check if a model is available
   */
  async hasModel(modelName) {
    const models = await this.listModels();
    return models.some(m => m.name === modelName || m.name.startsWith(modelName));
  }

  /**
   * Pull a model (download)
   */
  async pullModel(modelName, onProgress = null) {
    const response = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: true })
    });

    if (!response.ok) {
      throw new Error(`Failed to pull model: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (onProgress) onProgress(data);
          if (data.status === 'success') return true;
        } catch (e) {
          // Skip malformed JSON
        }
      }
    }

    return true;
  }

  /**
   * Health check
   */
  async isHealthy() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch (e) {
      return false;
    }
  }
}

module.exports = { OllamaClient };
