/**
 * Specialized Agents for Thales Verification Loop
 *
 * Three-stage verification: Proposer → Critic → Verifier
 * Output feeds directly into Phase 4 staking/proposal contracts
 */

const { Agent, AgentState } = require('./agent');

/**
 * ProposerAgent - Generates proposals for actions
 * Takes a task and outputs a structured Proposal
 */
class ProposerAgent extends Agent {
  constructor(options = {}) {
    super({
      ...options,
      name: options.name || 'Proposer',
      role: 'proposer',
      systemPrompt: `You are a Proposer Agent in Thales, a collaborative multiplayer computer.

Your job is to analyze tasks and generate structured PROPOSALS for actions.
Each proposal must be concrete, actionable, and include clear success criteria.

When given a task, respond with JSON:
{
  "thought": "Your analysis of the task",
  "proposal": {
    "id": "<8-char-hex-hash>",
    "type": "file_write|file_read|execute|screenshot|click|type|compound",
    "description": "Human-readable description",
    "actions": [
      {"action": "action_type", "parameters": {...}}
    ],
    "successCriteria": "How to verify this succeeded",
    "riskAssessment": "low|medium|high",
    "riskReason": "Why this risk level"
  }
}`
    });
  }

  async generateProposal(task, context = {}) {
    const prompt = this._buildProposalPrompt(task, context);

    try {
      const response = await this.ollama.generate(prompt, {
        system: this.systemPrompt,
        temperature: 0.4
      });

      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          success: true,
          proposal: {
            ...parsed.proposal,
            proposerId: this.id,
            proposerModel: this.model,
            timestamp: new Date().toISOString(),
            originalTask: task
          },
          thought: parsed.thought
        };
      }

      return { success: false, error: 'Could not parse proposal JSON' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  _buildProposalPrompt(task, context) {
    let prompt = `TASK: ${task}\n\n`;

    if (context.workspaceFiles) {
      prompt += `WORKSPACE FILES:\n${context.workspaceFiles.join('\n')}\n\n`;
    }
    if (context.recentActions) {
      prompt += `RECENT ACTIONS:\n${JSON.stringify(context.recentActions, null, 2)}\n\n`;
    }

    prompt += `Generate a structured proposal for this task. Include risk assessment.`;
    return prompt;
  }
}

/**
 * CriticAgent - Reviews proposals and provides critique
 * Scores proposals 0-100 and identifies issues
 */
class CriticAgent extends Agent {
  constructor(options = {}) {
    super({
      ...options,
      name: options.name || 'Critic',
      role: 'critic',
      systemPrompt: `You are a Critic Agent in Thales, a collaborative multiplayer computer.

Your job is to REVIEW proposals from the Proposer Agent.
Be thorough but fair. Identify real issues, not hypotheticals.

For each proposal, respond with JSON:
{
  "thought": "Your critical analysis",
  "critique": {
    "score": 0-100,
    "issues": [
      {"severity": "critical|major|minor", "description": "Issue description"}
    ],
    "strengths": ["What's good about this proposal"],
    "recommendation": "approve|revise|reject",
    "revisionSuggestions": ["If revise, what changes needed"]
  }
}`
    });
  }

  async critiqueProposal(proposal, context = {}) {
    const prompt = this._buildCritiquePrompt(proposal, context);

    try {
      const response = await this.ollama.generate(prompt, {
        system: this.systemPrompt,
        temperature: 0.3
      });

      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          success: true,
          critique: {
            ...parsed.critique,
            criticId: this.id,
            criticModel: this.model,
            proposalId: proposal.id,
            timestamp: new Date().toISOString()
          },
          thought: parsed.thought
        };
      }

      return { success: false, error: 'Could not parse critique JSON' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  _buildCritiquePrompt(proposal, context) {
    let prompt = `PROPOSAL TO REVIEW:\n${JSON.stringify(proposal, null, 2)}\n\n`;

    if (context.systemState) {
      prompt += `CURRENT SYSTEM STATE:\n${JSON.stringify(context.systemState, null, 2)}\n\n`;
    }

    prompt += `Critique this proposal. Be thorough but fair. Score 0-100.`;
    return prompt;
  }
}

/**
 * VerifierAgent - Makes final VERIFIED/REJECTED decision
 * Decision is deterministic and feeds into ledger
 */
class VerifierAgent extends Agent {
  constructor(options = {}) {
    super({
      ...options,
      name: options.name || 'Verifier',
      role: 'verifier',
      systemPrompt: `You are a Verifier Agent in Thales, a collaborative multiplayer computer.

Your job is to make the FINAL decision on proposals.
You receive both the proposal and the critic's review.
Your decision MUST be deterministic - same inputs = same output.

Decision rules:
- VERIFIED: Score >= 70 AND no critical issues AND recommendation is approve
- REJECTED: Score < 50 OR any critical issue OR recommendation is reject
- Otherwise: Use your judgment based on risk assessment

Respond with JSON:
{
  "thought": "Your reasoning (be specific)",
  "decision": "VERIFIED|REJECTED",
  "confidence": 0-100,
  "reason": "One-line explanation",
  "conditions": ["Any conditions for execution, if VERIFIED"]
}`
    });
  }

  async verifyProposal(proposal, critique, context = {}) {
    const prompt = this._buildVerifyPrompt(proposal, critique, context);

    try {
      const response = await this.ollama.generate(prompt, {
        system: this.systemPrompt,
        temperature: 0.1  // Very low for determinism
      });

      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        // Normalize decision to exactly VERIFIED or REJECTED
        const decision = parsed.decision?.toUpperCase().includes('VERIFIED')
          ? 'VERIFIED'
          : 'REJECTED';

        return {
          success: true,
          verification: {
            decision,
            confidence: parsed.confidence || 0,
            reason: parsed.reason || 'No reason provided',
            conditions: parsed.conditions || [],
            verifierId: this.id,
            verifierModel: this.model,
            proposalId: proposal.id,
            criticScore: critique.score,
            timestamp: new Date().toISOString()
          },
          thought: parsed.thought
        };
      }

      return { success: false, error: 'Could not parse verification JSON' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  _buildVerifyPrompt(proposal, critique, context) {
    return `PROPOSAL:\n${JSON.stringify(proposal, null, 2)}

CRITIC'S REVIEW:\n${JSON.stringify(critique, null, 2)}

Make your final decision: VERIFIED or REJECTED.
Be deterministic. Same proposal + critique = same decision.`;
  }
}

/**
 * VerificationLoop - Orchestrates the three-agent verification process
 */
class VerificationLoop {
  constructor(options = {}) {
    this.proposer = options.proposer || new ProposerAgent(options.proposerOptions);
    this.critic = options.critic || new CriticAgent(options.criticOptions);
    this.verifier = options.verifier || new VerifierAgent(options.verifierOptions);

    this.onProgress = options.onProgress || null;
    this.history = [];
  }

  /**
   * Run full verification loop on a task
   * Returns a complete VerificationResult ready for ledger
   */
  async verify(task, context = {}) {
    const startTime = Date.now();

    // Stage 1: Propose
    this._emit('stage', { stage: 'proposing', task });
    const proposalResult = await this.proposer.generateProposal(task, context);

    if (!proposalResult.success) {
      return this._failure('proposal_failed', proposalResult.error, startTime);
    }

    this._emit('proposal', proposalResult);

    // Stage 2: Critique
    this._emit('stage', { stage: 'critiquing', proposal: proposalResult.proposal });
    const critiqueResult = await this.critic.critiqueProposal(proposalResult.proposal, context);

    if (!critiqueResult.success) {
      return this._failure('critique_failed', critiqueResult.error, startTime);
    }

    this._emit('critique', critiqueResult);

    // Stage 3: Verify
    this._emit('stage', { stage: 'verifying', critique: critiqueResult.critique });
    const verifyResult = await this.verifier.verifyProposal(
      proposalResult.proposal,
      critiqueResult.critique,
      context
    );

    if (!verifyResult.success) {
      return this._failure('verification_failed', verifyResult.error, startTime);
    }

    this._emit('verification', verifyResult);

    // Build final result
    const result = {
      success: true,
      task,
      proposal: proposalResult.proposal,
      proposerThought: proposalResult.thought,
      critique: critiqueResult.critique,
      criticThought: critiqueResult.thought,
      verification: verifyResult.verification,
      verifierThought: verifyResult.thought,
      decision: verifyResult.verification.decision,
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };

    this.history.push(result);
    this._emit('complete', result);

    return result;
  }

  _failure(stage, error, startTime) {
    const result = {
      success: false,
      failedStage: stage,
      error,
      decision: 'REJECTED',
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };
    this.history.push(result);
    this._emit('error', result);
    return result;
  }

  _emit(event, data) {
    if (this.onProgress) {
      this.onProgress({ event, ...data });
    }
  }

  getHistory() {
    return this.history;
  }

  getStats() {
    const verified = this.history.filter(r => r.decision === 'VERIFIED').length;
    const rejected = this.history.filter(r => r.decision === 'REJECTED').length;
    const avgDuration = this.history.length > 0
      ? this.history.reduce((sum, r) => sum + r.durationMs, 0) / this.history.length
      : 0;

    return {
      total: this.history.length,
      verified,
      rejected,
      verificationRate: this.history.length > 0 ? verified / this.history.length : 0,
      avgDurationMs: Math.round(avgDuration)
    };
  }
}

module.exports = {
  ProposerAgent,
  CriticAgent,
  VerifierAgent,
  VerificationLoop
};
