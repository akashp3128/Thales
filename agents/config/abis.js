/**
 * Contract ABIs for Thales Phase 4
 * Minimal ABIs with only the functions we need
 */

const ThalesTokenABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "function mint(address to, uint256 amount)",
  "function burn(address from, uint256 amount)",
  "function claimFaucet()",
  "function hasClaimed(address) view returns (bool)",
  "function FAUCET_AMOUNT() view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
  "event FaucetClaim(address indexed claimer, uint256 amount)"
];

const ActionRegistryABI = [
  "function registerProposal(bytes32 id, string description, uint8 risk, address proposer) returns (uint256)",
  "function markVerified(bytes32 proposalId)",
  "function markRejected(bytes32 proposalId, string reason)",
  "function recordExecution(bytes32 proposalId, bool success, string resultHash)",
  "function getProposal(bytes32 id) view returns (tuple(bytes32 id, address proposer, string description, uint8 risk, uint8 status, uint256 createdAt, uint256 resolvedAt, string rejectReason))",
  "function getExecution(bytes32 id) view returns (tuple(bytes32 proposalId, address executor, bool success, string resultHash, uint256 timestamp))",
  "function getProposalCount() view returns (uint256)",
  "function getProposalIdAt(uint256 index) view returns (bytes32)",
  "function addVerifier(address verifier)",
  "function addExecutor(address executor)",
  "function verifiers(address) view returns (bool)",
  "function executors(address) view returns (bool)",
  "event ProposalRegistered(bytes32 indexed id, address indexed proposer, uint8 risk, string description)",
  "event ProposalVerified(bytes32 indexed id, uint256 timestamp)",
  "event ProposalRejected(bytes32 indexed id, string reason, uint256 timestamp)",
  "event ExecutionRecorded(bytes32 indexed id, bool success, string resultHash, uint256 timestamp)"
];

const StakeManagerABI = [
  "function token() view returns (address)",
  "function registry() view returns (address)",
  "function getRequiredStake(uint8 risk) view returns (uint256)",
  "function stake(bytes32 proposalId, uint8 risk)",
  "function releaseStake(bytes32 proposalId)",
  "function slashStake(bytes32 proposalId)",
  "function getStake(bytes32 proposalId) view returns (tuple(address staker, uint256 amount, bool locked, bool resolved))",
  "function isStaked(bytes32 proposalId) view returns (bool)",
  "function totalStaked(address) view returns (uint256)",
  "function STAKE_LOW() view returns (uint256)",
  "function STAKE_MEDIUM() view returns (uint256)",
  "function STAKE_HIGH() view returns (uint256)",
  "function SLASH_PERCENT() view returns (uint256)",
  "event Staked(address indexed player, bytes32 indexed proposalId, uint256 amount)",
  "event StakeReleased(address indexed player, bytes32 indexed proposalId, uint256 amount)",
  "event StakeSlashed(address indexed player, bytes32 indexed proposalId, uint256 slashedAmount, uint256 returned)"
];

module.exports = {
  ThalesTokenABI,
  ActionRegistryABI,
  StakeManagerABI
};
