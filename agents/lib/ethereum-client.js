/**
 * Ethereum Client for Thales Phase 4
 *
 * Provides interface to interact with deployed Thales contracts
 */

const { ethers } = require('ethers');
const contractConfig = require('../config/contracts');
const { ThalesTokenABI, ActionRegistryABI, StakeManagerABI } = require('../config/abis');

class EthereumClient {
  constructor(options = {}) {
    this.rpcUrl = options.rpcUrl || contractConfig.rpcUrl;
    this.addresses = options.addresses || contractConfig.addresses;
    this.privateKey = options.privateKey || contractConfig.deployer.privateKey;

    this.provider = null;
    this.signer = null;
    this.contracts = {};
    this._initialized = false;
  }

  /**
   * Initialize provider, signer, and contract instances
   */
  async initialize() {
    if (this._initialized) return;

    this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
    this.signer = new ethers.Wallet(this.privateKey, this.provider);

    // Initialize contract instances
    this.contracts.token = new ethers.Contract(
      this.addresses.token,
      ThalesTokenABI,
      this.signer
    );

    this.contracts.registry = new ethers.Contract(
      this.addresses.registry,
      ActionRegistryABI,
      this.signer
    );

    this.contracts.stakeManager = new ethers.Contract(
      this.addresses.stakeManager,
      StakeManagerABI,
      this.signer
    );

    this._initialized = true;
    console.log('[EthereumClient] Initialized with signer:', this.signer.address);
  }

  /**
   * Check if connected to blockchain
   */
  async isHealthy() {
    try {
      await this.initialize();
      const blockNumber = await this.provider.getBlockNumber();
      return { healthy: true, blockNumber };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }

  // ==================== Token Operations ====================

  /**
   * Get token balance for an address
   */
  async getBalance(address) {
    await this.initialize();
    const balance = await this.contracts.token.balanceOf(address);
    return {
      raw: balance.toString(),
      formatted: ethers.formatEther(balance)
    };
  }

  /**
   * Get signer's token balance
   */
  async getMyBalance() {
    return this.getBalance(this.signer.address);
  }

  /**
   * Approve spender to use tokens
   */
  async approve(spender, amount) {
    await this.initialize();
    const tx = await this.contracts.token.approve(spender, amount);
    const receipt = await tx.wait();
    return { txHash: receipt.hash, success: true };
  }

  /**
   * Claim tokens from faucet
   */
  async claimFaucet() {
    await this.initialize();
    const hasClaimed = await this.contracts.token.hasClaimed(this.signer.address);
    if (hasClaimed) {
      return { success: false, error: 'Already claimed' };
    }
    const tx = await this.contracts.token.claimFaucet();
    const receipt = await tx.wait();
    return { txHash: receipt.hash, success: true };
  }

  // ==================== Registry Operations ====================

  /**
   * Generate a proposal ID from description and timestamp
   */
  generateProposalId(description, timestamp = Date.now()) {
    return ethers.keccak256(
      ethers.toUtf8Bytes(`${description}:${timestamp}`)
    );
  }

  /**
   * Register a new proposal on-chain
   */
  async registerProposal(proposalId, description, risk, proposer = null) {
    await this.initialize();
    const riskLevel = this._riskToInt(risk);
    const proposerAddr = proposer || this.signer.address;

    const tx = await this.contracts.registry.registerProposal(
      proposalId,
      description,
      riskLevel,
      proposerAddr
    );
    const receipt = await tx.wait();
    return { txHash: receipt.hash, proposalId, success: true };
  }

  /**
   * Mark a proposal as verified
   */
  async markVerified(proposalId) {
    await this.initialize();
    const tx = await this.contracts.registry.markVerified(proposalId);
    const receipt = await tx.wait();
    return { txHash: receipt.hash, success: true };
  }

  /**
   * Mark a proposal as rejected
   */
  async markRejected(proposalId, reason) {
    await this.initialize();
    const tx = await this.contracts.registry.markRejected(proposalId, reason);
    const receipt = await tx.wait();
    return { txHash: receipt.hash, success: true };
  }

  /**
   * Record execution result
   */
  async recordExecution(proposalId, success, resultHash) {
    await this.initialize();
    const tx = await this.contracts.registry.recordExecution(
      proposalId,
      success,
      resultHash
    );
    const receipt = await tx.wait();
    return { txHash: receipt.hash, success: true };
  }

  /**
   * Get proposal details
   */
  async getProposal(proposalId) {
    await this.initialize();
    const proposal = await this.contracts.registry.getProposal(proposalId);
    return {
      id: proposal.id,
      proposer: proposal.proposer,
      description: proposal.description,
      risk: this._intToRisk(proposal.risk),
      status: this._statusToString(proposal.status),
      createdAt: Number(proposal.createdAt),
      resolvedAt: Number(proposal.resolvedAt),
      rejectReason: proposal.rejectReason
    };
  }

  /**
   * Get all proposals (paginated)
   */
  async getProposals(offset = 0, limit = 10) {
    await this.initialize();
    const count = await this.contracts.registry.getProposalCount();
    const total = Number(count);
    const proposals = [];

    const end = Math.min(offset + limit, total);
    for (let i = offset; i < end; i++) {
      const id = await this.contracts.registry.getProposalIdAt(i);
      const proposal = await this.getProposal(id);
      proposals.push(proposal);
    }

    return { proposals, total, offset, limit };
  }

  // ==================== Stake Operations ====================

  /**
   * Get required stake for a risk level
   */
  async getRequiredStake(risk) {
    await this.initialize();
    const riskLevel = this._riskToInt(risk);
    const amount = await this.contracts.stakeManager.getRequiredStake(riskLevel);
    return {
      raw: amount.toString(),
      formatted: ethers.formatEther(amount)
    };
  }

  /**
   * Stake tokens for a proposal
   */
  async stake(proposalId, risk) {
    await this.initialize();
    const riskLevel = this._riskToInt(risk);
    const requiredStake = await this.contracts.stakeManager.getRequiredStake(riskLevel);

    // First approve the stake manager to spend tokens
    await this.approve(this.addresses.stakeManager, requiredStake);

    // Then stake
    const tx = await this.contracts.stakeManager.stake(proposalId, riskLevel);
    const receipt = await tx.wait();

    return {
      txHash: receipt.hash,
      amount: ethers.formatEther(requiredStake),
      success: true
    };
  }

  /**
   * Release stake (on successful execution)
   */
  async releaseStake(proposalId) {
    await this.initialize();
    const tx = await this.contracts.stakeManager.releaseStake(proposalId);
    const receipt = await tx.wait();
    return { txHash: receipt.hash, success: true };
  }

  /**
   * Slash stake (on failed execution)
   */
  async slashStake(proposalId) {
    await this.initialize();
    const tx = await this.contracts.stakeManager.slashStake(proposalId);
    const receipt = await tx.wait();
    return { txHash: receipt.hash, success: true };
  }

  /**
   * Get stake info for a proposal
   */
  async getStakeInfo(proposalId) {
    await this.initialize();
    const info = await this.contracts.stakeManager.getStake(proposalId);
    return {
      staker: info.staker,
      amount: ethers.formatEther(info.amount),
      locked: info.locked,
      resolved: info.resolved
    };
  }

  // ==================== Helper Methods ====================

  _riskToInt(risk) {
    const map = { low: 0, medium: 1, high: 2 };
    return map[risk?.toLowerCase()] ?? 0;
  }

  _intToRisk(riskInt) {
    const map = { 0: 'low', 1: 'medium', 2: 'high' };
    return map[Number(riskInt)] ?? 'low';
  }

  _statusToString(status) {
    const map = {
      0: 'PENDING',
      1: 'VERIFIED',
      2: 'REJECTED',
      3: 'EXECUTED',
      4: 'FAILED'
    };
    return map[Number(status)] ?? 'UNKNOWN';
  }

  /**
   * Get contract addresses
   */
  getAddresses() {
    return this.addresses;
  }

  /**
   * Get signer address
   */
  getSignerAddress() {
    return this.signer?.address;
  }
}

module.exports = { EthereumClient };
