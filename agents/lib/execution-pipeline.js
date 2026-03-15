/**
 * Execution Pipeline for Thales Phase 4
 *
 * Orchestrates: Verify → Register → Stake → Execute → Record → Settle
 */

const { ethers } = require('ethers');
const { VerificationLoop } = require('./specialized-agents');
const { ExecutorAgent } = require('./executor');
const { EthereumClient } = require('./ethereum-client');

class ExecutionPipeline {
  constructor(options = {}) {
    this.verificationLoop = options.verificationLoop || null;
    this.executor = options.executor || new ExecutorAgent();
    this.blockchain = options.blockchain || new EthereumClient();

    this.onProgress = options.onProgress || null;
    this.history = [];
  }

  /**
   * Initialize the pipeline
   */
  async initialize() {
    await this.blockchain.initialize();
    console.log('[Pipeline] Initialized');
  }

  /**
   * Run the full execution pipeline
   * Verify → Register → Stake → Execute → Record → Settle
   */
  async run(task, context = {}) {
    const startTime = Date.now();
    const pipelineId = this._generateId();

    this._emit('start', { pipelineId, task });

    try {
      // ==================== STAGE 1: VERIFY ====================
      this._emit('stage', { stage: 'verifying', pipelineId });

      if (!this.verificationLoop) {
        return this._failure(pipelineId, 'verification', 'VerificationLoop not configured', startTime);
      }

      const verifyResult = await this.verificationLoop.verify(task, context);

      if (!verifyResult.success || verifyResult.decision !== 'VERIFIED') {
        return this._failure(
          pipelineId,
          'verification',
          verifyResult.error || `Proposal rejected: ${verifyResult.decision}`,
          startTime,
          { verification: verifyResult }
        );
      }

      this._emit('verified', { pipelineId, verifyResult });

      // ==================== STAGE 2: REGISTER ON-CHAIN ====================
      this._emit('stage', { stage: 'registering', pipelineId });

      const proposalId = this.blockchain.generateProposalId(
        verifyResult.proposal.description,
        Date.now()
      );

      await this.blockchain.registerProposal(
        proposalId,
        verifyResult.proposal.description,
        verifyResult.proposal.risk
      );

      await this.blockchain.markVerified(proposalId);

      this._emit('registered', { pipelineId, proposalId });

      // ==================== STAGE 3: STAKE ====================
      this._emit('stage', { stage: 'staking', pipelineId });

      const stakeResult = await this.blockchain.stake(
        proposalId,
        verifyResult.proposal.risk
      );

      this._emit('staked', { pipelineId, stakeResult });

      // ==================== STAGE 4: EXECUTE ====================
      this._emit('stage', { stage: 'executing', pipelineId });

      const execResult = await this.executor.execute(verifyResult);

      this._emit('executed', { pipelineId, execResult });

      // ==================== STAGE 5: RECORD EXECUTION ====================
      this._emit('stage', { stage: 'recording', pipelineId });

      const resultHash = ethers.keccak256(
        ethers.toUtf8Bytes(JSON.stringify(execResult))
      );

      await this.blockchain.recordExecution(
        proposalId,
        execResult.success,
        resultHash
      );

      this._emit('recorded', { pipelineId, resultHash });

      // ==================== STAGE 6: SETTLE STAKE ====================
      this._emit('stage', { stage: 'settling', pipelineId });

      let settlementResult;
      if (execResult.success) {
        settlementResult = await this.blockchain.releaseStake(proposalId);
        this._emit('stakeReleased', { pipelineId, settlementResult });
      } else {
        settlementResult = await this.blockchain.slashStake(proposalId);
        this._emit('stakeSlashed', { pipelineId, settlementResult });
      }

      // ==================== COMPLETE ====================
      const result = {
        success: execResult.success,
        pipelineId,
        task,
        proposalId,
        verification: {
          decision: verifyResult.decision,
          score: verifyResult.critique?.score,
          confidence: verifyResult.verification?.confidence
        },
        proposal: verifyResult.proposal,
        execution: {
          success: execResult.success,
          actions: execResult.actions,
          results: execResult.results,
          durationMs: execResult.durationMs
        },
        stake: {
          amount: stakeResult.amount,
          released: execResult.success,
          slashed: !execResult.success
        },
        onChain: {
          proposalId,
          resultHash
        },
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };

      this.history.push(result);
      this._emit('complete', result);

      return result;

    } catch (error) {
      return this._failure(pipelineId, 'pipeline', error.message, startTime);
    }
  }

  /**
   * Run execution only (skip verification, use pre-verified proposal)
   */
  async executeOnly(verificationResult) {
    const startTime = Date.now();
    const pipelineId = this._generateId();

    try {
      await this.blockchain.initialize();

      const proposalId = this.blockchain.generateProposalId(
        verificationResult.proposal.description,
        Date.now()
      );

      // Register and mark verified
      await this.blockchain.registerProposal(
        proposalId,
        verificationResult.proposal.description,
        verificationResult.proposal.risk
      );
      await this.blockchain.markVerified(proposalId);

      // Stake
      const stakeResult = await this.blockchain.stake(
        proposalId,
        verificationResult.proposal.risk
      );

      // Execute
      const execResult = await this.executor.execute(verificationResult);

      // Record
      const resultHash = ethers.keccak256(
        ethers.toUtf8Bytes(JSON.stringify(execResult))
      );
      await this.blockchain.recordExecution(proposalId, execResult.success, resultHash);

      // Settle
      if (execResult.success) {
        await this.blockchain.releaseStake(proposalId);
      } else {
        await this.blockchain.slashStake(proposalId);
      }

      return {
        success: execResult.success,
        pipelineId,
        proposalId,
        execution: execResult,
        stake: {
          amount: stakeResult.amount,
          released: execResult.success,
          slashed: !execResult.success
        },
        durationMs: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        pipelineId,
        error: error.message,
        durationMs: Date.now() - startTime
      };
    }
  }

  /**
   * Get pipeline history
   */
  getHistory() {
    return this.history;
  }

  /**
   * Get pipeline stats
   */
  getStats() {
    const successful = this.history.filter(r => r.success).length;
    const failed = this.history.filter(r => !r.success).length;
    const totalSlashed = this.history.filter(r => r.stake?.slashed).length;
    const avgDuration = this.history.length > 0
      ? this.history.reduce((sum, r) => sum + r.durationMs, 0) / this.history.length
      : 0;

    return {
      total: this.history.length,
      successful,
      failed,
      slashed: totalSlashed,
      successRate: this.history.length > 0 ? successful / this.history.length : 0,
      avgDurationMs: Math.round(avgDuration)
    };
  }

  _generateId() {
    return `pipe_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  _failure(pipelineId, stage, error, startTime, extra = {}) {
    const result = {
      success: false,
      pipelineId,
      failedStage: stage,
      error,
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      ...extra
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
}

module.exports = { ExecutionPipeline };
