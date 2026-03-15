// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ActionRegistry
 * @notice Immutable on-chain record of all proposals and executions
 * @dev Core component of Thales verification and settlement system
 */
contract ActionRegistry {
    enum ProposalStatus {
        PENDING,
        VERIFIED,
        REJECTED,
        EXECUTED,
        FAILED
    }

    enum Risk {
        LOW,
        MEDIUM,
        HIGH
    }

    struct Proposal {
        bytes32 id;
        address proposer;
        string description;
        Risk risk;
        ProposalStatus status;
        uint256 createdAt;
        uint256 resolvedAt;
        string rejectReason;
    }

    struct Execution {
        bytes32 proposalId;
        address executor;
        bool success;
        string resultHash;
        uint256 timestamp;
    }

    // Storage
    mapping(bytes32 => Proposal) public proposals;
    mapping(bytes32 => Execution) public executions;
    bytes32[] public proposalIds;

    // Access control
    address public owner;
    mapping(address => bool) public verifiers;
    mapping(address => bool) public executors;

    // Events
    event ProposalRegistered(bytes32 indexed id, address indexed proposer, Risk risk, string description);
    event ProposalVerified(bytes32 indexed id, uint256 timestamp);
    event ProposalRejected(bytes32 indexed id, string reason, uint256 timestamp);
    event ExecutionRecorded(bytes32 indexed id, bool success, string resultHash, uint256 timestamp);
    event VerifierAdded(address indexed verifier);
    event ExecutorAdded(address indexed executor);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyVerifier() {
        require(verifiers[msg.sender] || msg.sender == owner, "Not verifier");
        _;
    }

    modifier onlyExecutor() {
        require(executors[msg.sender] || msg.sender == owner, "Not executor");
        _;
    }

    constructor() {
        owner = msg.sender;
        verifiers[msg.sender] = true;
        executors[msg.sender] = true;
    }

    /**
     * @notice Register a new proposal
     * @param id Unique proposal ID (keccak256 hash)
     * @param description Human-readable description of the action
     * @param risk Risk level (0=LOW, 1=MEDIUM, 2=HIGH)
     * @param proposer Address of the proposer
     */
    function registerProposal(
        bytes32 id,
        string calldata description,
        Risk risk,
        address proposer
    ) external returns (uint256 index) {
        require(proposals[id].createdAt == 0, "Proposal already exists");

        proposals[id] = Proposal({
            id: id,
            proposer: proposer,
            description: description,
            risk: risk,
            status: ProposalStatus.PENDING,
            createdAt: block.timestamp,
            resolvedAt: 0,
            rejectReason: ""
        });

        proposalIds.push(id);
        index = proposalIds.length - 1;

        emit ProposalRegistered(id, proposer, risk, description);
    }

    /**
     * @notice Mark a proposal as verified (approved)
     */
    function markVerified(bytes32 proposalId) external onlyVerifier {
        Proposal storage p = proposals[proposalId];
        require(p.createdAt != 0, "Proposal not found");
        require(p.status == ProposalStatus.PENDING, "Not pending");

        p.status = ProposalStatus.VERIFIED;
        p.resolvedAt = block.timestamp;

        emit ProposalVerified(proposalId, block.timestamp);
    }

    /**
     * @notice Mark a proposal as rejected
     */
    function markRejected(bytes32 proposalId, string calldata reason) external onlyVerifier {
        Proposal storage p = proposals[proposalId];
        require(p.createdAt != 0, "Proposal not found");
        require(p.status == ProposalStatus.PENDING, "Not pending");

        p.status = ProposalStatus.REJECTED;
        p.resolvedAt = block.timestamp;
        p.rejectReason = reason;

        emit ProposalRejected(proposalId, reason, block.timestamp);
    }

    /**
     * @notice Record execution result
     */
    function recordExecution(
        bytes32 proposalId,
        bool success,
        string calldata resultHash
    ) external onlyExecutor {
        Proposal storage p = proposals[proposalId];
        require(p.createdAt != 0, "Proposal not found");
        require(p.status == ProposalStatus.VERIFIED, "Not verified");

        p.status = success ? ProposalStatus.EXECUTED : ProposalStatus.FAILED;

        executions[proposalId] = Execution({
            proposalId: proposalId,
            executor: msg.sender,
            success: success,
            resultHash: resultHash,
            timestamp: block.timestamp
        });

        emit ExecutionRecorded(proposalId, success, resultHash, block.timestamp);
    }

    // Access control management
    function addVerifier(address verifier) external onlyOwner {
        verifiers[verifier] = true;
        emit VerifierAdded(verifier);
    }

    function addExecutor(address executor) external onlyOwner {
        executors[executor] = true;
        emit ExecutorAdded(executor);
    }

    // View functions
    function getProposal(bytes32 id) external view returns (Proposal memory) {
        return proposals[id];
    }

    function getExecution(bytes32 id) external view returns (Execution memory) {
        return executions[id];
    }

    function getProposalCount() external view returns (uint256) {
        return proposalIds.length;
    }

    function getProposalIdAt(uint256 index) external view returns (bytes32) {
        return proposalIds[index];
    }
}
