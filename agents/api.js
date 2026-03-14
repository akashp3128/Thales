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
  VerificationLoop,
  AgentRegistry
} = require('./lib');

// Configuration
const MODELS = {
  proposer: process.env.PROPOSER_MODEL || 'qwen3:14b',
  critic: process.env.CRITIC_MODEL || 'qwen3:8b',
  verifier: process.env.VERIFIER_MODEL || 'qwen2.5-coder:7b'
};

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

// Singleton instances
let ollamaClient = null;
let registry = null;
let verificationLoop = null;

/**
 * Initialize the agent system
 */
async function initializeAgents() {
  if (verificationLoop) return verificationLoop;

  ollamaClient = new OllamaClient(OLLAMA_URL);
  registry = new AgentRegistry();

  // Create specialized agents
  const proposer = new ProposerAgent('proposer-1', ollamaClient, MODELS.proposer);
  const critic = new CriticAgent('critic-1', ollamaClient, MODELS.critic);
  const verifier = new VerifierAgent('verifier-1', ollamaClient, MODELS.verifier);

  // Register agents
  registry.register(proposer);
  registry.register(critic);
  registry.register(verifier);

  // Create verification loop
  verificationLoop = new VerificationLoop(proposer, critic, verifier);

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
      const client = new OllamaClient(OLLAMA_URL);
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
      const client = new OllamaClient(OLLAMA_URL);
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
      const result = await loop.run(task, context || '', maxRounds || 3);

      res.json({
        status: result.status,
        proposal: result.proposal,
        critique: result.critique,
        verification: result.verification,
        rounds: result.rounds,
        history: result.history
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

      const client = new OllamaClient(OLLAMA_URL);
      const selectedModel = model || MODELS.proposer;

      const response = await client.generate(selectedModel, prompt, {
        system: role || 'You are a helpful AI assistant.'
      });

      res.json({
        model: selectedModel,
        response: response
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get agent registry status
  app.get('/api/agents/registry', async (req, res) => {
    try {
      await initializeAgents();
      const agents = registry.listAll();
      res.json({
        agents: agents.map(a => ({
          id: a.id,
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
