/**
 * Thales Agent API Routes
 *
 * Provides HTTP endpoints for the multi-agent verification loop
 * and Phase 4 execution pipeline.
 */

const {
  OllamaClient,
  ProposerAgent,
  CriticAgent,
  VerifierAgent,
  VerificationLoop,
  ExecutorAgent,
  EthereumClient,
  ExecutionPipeline
} = require('./lib');

// Configuration - use same model for all agents to avoid model swapping delays
const DEFAULT_MODEL = process.env.AGENT_MODEL || 'mistral:7b-instruct-v0.3-q4_K_M';
const MODELS = {
  proposer: process.env.PROPOSER_MODEL || DEFAULT_MODEL,
  critic: process.env.CRITIC_MODEL || DEFAULT_MODEL,
  verifier: process.env.VERIFIER_MODEL || DEFAULT_MODEL
};

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://ollama:11434';

// Singleton instances
let verificationLoop = null;
let agents = [];
let executionPipeline = null;
let ethereumClient = null;

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

  // ==================== PHASE 4: EXECUTION PIPELINE ====================

  // Initialize execution pipeline
  async function initializePipeline() {
    if (executionPipeline) return executionPipeline;

    const loop = await initializeAgents();
    ethereumClient = new EthereumClient();
    await ethereumClient.initialize();

    executionPipeline = new ExecutionPipeline({
      verificationLoop: loop,
      executor: new ExecutorAgent(),
      blockchain: ethereumClient,
      onProgress: (event) => console.log('[Pipeline] Progress:', event.event, event.stage || '')
    });

    console.log('[Pipeline] Initialized');
    return executionPipeline;
  }

  // Full execution pipeline: verify -> stake -> execute -> record
  app.post('/api/execute', async (req, res) => {
    try {
      const { task, context } = req.body;

      if (!task) {
        return res.status(400).json({ error: 'task is required' });
      }

      const pipeline = await initializePipeline();
      const result = await pipeline.run(task, context || {});

      res.json(result);
    } catch (error) {
      console.error('[Execute] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get pipeline history
  app.get('/api/execute/history', async (req, res) => {
    try {
      const pipeline = await initializePipeline();
      res.json({
        history: pipeline.getHistory(),
        stats: pipeline.getStats()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== PHASE 4: CONTRACT ENDPOINTS ====================

  // Contract status and addresses
  app.get('/api/contracts/status', async (req, res) => {
    try {
      if (!ethereumClient) {
        ethereumClient = new EthereumClient();
      }
      const health = await ethereumClient.isHealthy();
      res.json({
        ...health,
        addresses: ethereumClient.getAddresses(),
        signer: ethereumClient.getSignerAddress()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get token balance
  app.get('/api/contracts/balance/:address', async (req, res) => {
    try {
      if (!ethereumClient) {
        ethereumClient = new EthereumClient();
        await ethereumClient.initialize();
      }
      const balance = await ethereumClient.getBalance(req.params.address);
      res.json(balance);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Claim faucet tokens
  app.post('/api/contracts/faucet', async (req, res) => {
    try {
      if (!ethereumClient) {
        ethereumClient = new EthereumClient();
        await ethereumClient.initialize();
      }
      const result = await ethereumClient.claimFaucet();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get proposals from registry
  app.get('/api/contracts/proposals', async (req, res) => {
    try {
      if (!ethereumClient) {
        ethereumClient = new EthereumClient();
        await ethereumClient.initialize();
      }
      const offset = parseInt(req.query.offset) || 0;
      const limit = parseInt(req.query.limit) || 10;
      const result = await ethereumClient.getProposals(offset, limit);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== PHASE 4: STAKE ENDPOINTS ====================

  // Get required stake for risk level
  app.get('/api/stake/required/:risk', async (req, res) => {
    try {
      if (!ethereumClient) {
        ethereumClient = new EthereumClient();
        await ethereumClient.initialize();
      }
      const stake = await ethereumClient.getRequiredStake(req.params.risk);
      res.json(stake);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  console.log('[Agents] API routes registered (Phase 4 enabled)');
}

module.exports = { registerAgentRoutes, initializeAgents };
