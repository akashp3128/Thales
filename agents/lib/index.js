/**
 * Thales Agent Library
 *
 * Exports all agent-related modules for use in the web server.
 */

const { Agent, AgentState } = require('./agent');
const { AgentRegistry } = require('./registry');
const { OllamaClient } = require('./ollama');
const {
  ProposerAgent,
  CriticAgent,
  VerifierAgent,
  VerificationLoop
} = require('./specialized-agents');

// Phase 4 additions
const { ExecutorAgent } = require('./executor');
const { EthereumClient } = require('./ethereum-client');
const { ExecutionPipeline } = require('./execution-pipeline');

module.exports = {
  // Core
  Agent,
  AgentState,
  AgentRegistry,
  OllamaClient,
  // Specialized agents
  ProposerAgent,
  CriticAgent,
  VerifierAgent,
  VerificationLoop,
  // Phase 4: Execution
  ExecutorAgent,
  EthereumClient,
  ExecutionPipeline
};
