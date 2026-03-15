/**
 * Thales Agent API Routes
 *
 * Provides HTTP endpoints for the multi-agent verification loop.
 */

const {
  OllamaClient,
  ProposerAgent,
  CriticAgent,
  VerifierAgent,
  VerificationLoop
} = require('./lib');

// Configuration - use Docker-available models by default
const MODELS = {
  proposer: process.env.PROPOSER_MODEL || 'mistral:7b-instruct-v0.3-q4_K_M',
  critic: process.env.CRITIC_MODEL || 'mistral:7b-instruct-v0.3-q4_K_M',
  verifier: process.env.VERIFIER_MODEL || 'codellama:7b-code-q4_K_M'
};

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://ollama:11434';

// Singleton instances
let verificationLoop = null;
let agents = [];

/**
 * Initialize the agent system
 */
async function initializeAgents() {
  if (verificationLoop) return verificationLoop;

  // Set env for OllamaClient
  process.env.OLLAMA_URL = OLLAMA_URL;

  // Create specialized agents with options objects
  const proposer = new ProposerAgent({ id: 'proposer-1', model: MODELS.proposer });
  const critic = new CriticAgent({ id: 'critic-1', model: MODELS.critic });
  const verifier = new VerifierAgent({ id: 'verifier-1', model: MODELS.verifier });

  agents = [proposer, critic, verifier];

  // Create verification loop with options object
  verificationLoop = new VerificationLoop({
    proposer,
    critic,
    verifier,
    onProgress: (event) => console.log('[Agents] Progress:', event.stage || event.type)
  });

  console.log('[Agents] Initialized with models:', MODELS);
  return verificationLoop;
}

/**
 * Register agent API routes on Express app
 */
function registerAgentRoutes(app) {

  // Health check for agent system
  app.get('/api/agents/health', async (req, res) => {
    try {
      const client = new OllamaClient({ baseUrl: OLLAMA_URL });
      const models = await client.listModels();
      res.json({
        status: 'ok',
        ollama: OLLAMA_URL,
        models: models,
        configured: MODELS
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        error: error.message
      });
    }
  });

  // List available models
  app.get('/api/agents/models', async (req, res) => {
    try {
      const client = new OllamaClient({ baseUrl: OLLAMA_URL });
      const models = await client.listModels();
      res.json({ models });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Run verification loop
  app.post('/api/agents/verify', async (req, res) => {
    try {
      const { task, context, maxRounds } = req.body;

      if (!task) {
        return res.status(400).json({ error: 'task is required' });
      }

      const loop = await initializeAgents();
      const result = await loop.verify(task, context || {});

      res.json({
        success: result.success,
        status: result.decision || result.status,
        proposal: result.proposal,
        critique: result.critique,
        verification: result.verification,
        failedStage: result.failedStage,
        error: result.error,
        durationMs: result.durationMs
      });
    } catch (error) {
      console.error('[Agents] Verification error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Simple single-agent query
  app.post('/api/agents/query', async (req, res) => {
    try {
      const { prompt, model, role } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: 'prompt is required' });
      }

      const client = new OllamaClient({ baseUrl: OLLAMA_URL });
      const selectedModel = model || MODELS.proposer;

      const response = await client.generate(prompt, {
        model: selectedModel,
        system: role || 'You are a helpful AI assistant.'
      });

      res.json({
        model: selectedModel,
        response: response.text
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get agent registry status
  app.get('/api/agents/registry', async (req, res) => {
    try {
      await initializeAgents();
      res.json({
        agents: agents.map(a => ({
          id: a.id,
          name: a.name,
          role: a.role,
          state: a.state,
          model: a.model
        }))
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  console.log('[Agents] API routes registered');
}

module.exports = { registerAgentRoutes, initializeAgents };
