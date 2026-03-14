/**
 * Quick test of the multi-agent verification loop
 */

const {
  OllamaClient,
  ProposerAgent,
  CriticAgent,
  VerifierAgent,
  VerificationLoop
} = require('./lib');

const OLLAMA_URL = 'http://localhost:11434';
process.env.OLLAMA_URL = OLLAMA_URL;  // Set env for OllamaClient default

async function test() {
  console.log('=== THALES VERIFICATION LOOP TEST ===\n');

  // Initialize
  const client = new OllamaClient({ baseUrl: OLLAMA_URL });

  // Check models
  console.log('Checking Ollama connection...');
  const models = await client.listModels();
  console.log('Available models:', models.map(m => m.name).join(', '));

  // Create agents (using Docker-available models)
  const proposer = new ProposerAgent({ id: 'proposer-test', model: 'mistral:7b-instruct-v0.3-q4_K_M' });
  const critic = new CriticAgent({ id: 'critic-test', model: 'mistral:7b-instruct-v0.3-q4_K_M' });
  const verifier = new VerifierAgent({ id: 'verifier-test', model: 'codellama:7b-code-q4_K_M' });

  console.log('\nAgents created:');
  console.log(`  - Proposer: ${proposer.model}`);
  console.log(`  - Critic: ${critic.model}`);
  console.log(`  - Verifier: ${verifier.model}`);

  // Create verification loop
  const loop = new VerificationLoop({
    proposer,
    critic,
    verifier,
    onProgress: (event) => console.log(`[Progress] ${event.stage || event.type}`)
  });

  // Run simple test
  const task = 'Write a simple Python function that adds two numbers';
  console.log(`\nRunning verification for task: "${task}"\n`);
  console.log('---');

  let result;
  try {
    result = await loop.verify(task, {});
    console.log('\nRaw result:', JSON.stringify(result, null, 2).substring(0, 1000));
  } catch (err) {
    console.error('Loop error:', err);
    result = { status: 'ERROR', error: err.message };
  }

  console.log('\n=== RESULT ===');
  console.log(`Status: ${result.status}`);
  console.log(`Verdict: ${result.verdict}`);
  console.log('\n--- Proposal ---');
  console.log(result.proposal?.substring(0, 500) || 'N/A');
  console.log('\n--- Verification Summary ---');
  console.log(result.verification?.summary?.substring(0, 300) || JSON.stringify(result.verification || 'N/A').substring(0, 300));

  console.log('\n=== TEST COMPLETE ===');
  return result.verdict || result.status;
}

test()
  .then(status => {
    console.log(`\nFinal status: ${status}`);
    process.exit(status === 'VERIFIED' ? 0 : 1);
  })
  .catch(err => {
    console.error('Test failed:', err.message);
    process.exit(1);
  });
