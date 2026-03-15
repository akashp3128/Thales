/**
 * Contract configuration for Thales Phase 4
 * Addresses are for local Anvil deployment
 */

module.exports = {
  // Network configuration
  rpcUrl: process.env.ANVIL_RPC_URL || 'http://anvil:8545',
  chainId: 31337,

  // Deployed contract addresses (Anvil local)
  addresses: {
    token: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    registry: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    stakeManager: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0'
  },

  // Default deployer account (Anvil account #0)
  deployer: {
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
  },

  // Stake amounts (in wei)
  stakeAmounts: {
    LOW: '10000000000000000000',      // 10 THALES
    MEDIUM: '50000000000000000000',   // 50 THALES
    HIGH: '100000000000000000000'     // 100 THALES
  }
};
