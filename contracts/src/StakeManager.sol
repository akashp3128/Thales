// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ThalesToken.sol";
import "./ActionRegistry.sol";

/**
 * @title StakeManager
 * @notice Handles stake deposits, locking, and slashing for Thales actions
 * @dev Players must stake tokens before executing verified proposals
 */
contract StakeManager {
    ThalesToken public token;
    ActionRegistry public registry;
    address public owner;

    // Stake amounts by risk level (in wei, 18 decimals)
    uint256 public constant STAKE_LOW = 10 * 10**18;      // 10 THALES
    uint256 public constant STAKE_MEDIUM = 50 * 10**18;   // 50 THALES
    uint256 public constant STAKE_HIGH = 100 * 10**18;    // 100 THALES
    uint256 public constant SLASH_PERCENT = 50;           // 50% slashed on failure

    struct StakeInfo {
        address staker;
        uint256 amount;
        bool locked;
        bool resolved;
    }

    mapping(bytes32 => StakeInfo) public stakes;
    mapping(address => uint256) public totalStaked;

    // Events
    event Staked(address indexed player, bytes32 indexed proposalId, uint256 amount);
    event StakeReleased(address indexed player, bytes32 indexed proposalId, uint256 amount);
    event StakeSlashed(address indexed player, bytes32 indexed proposalId, uint256 slashedAmount, uint256 returned);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _token, address _registry) {
        token = ThalesToken(_token);
        registry = ActionRegistry(_registry);
        owner = msg.sender;
    }

    /**
     * @notice Get required stake amount for a risk level
     */
    function getRequiredStake(ActionRegistry.Risk risk) public pure returns (uint256) {
        if (risk == ActionRegistry.Risk.LOW) return STAKE_LOW;
        if (risk == ActionRegistry.Risk.MEDIUM) return STAKE_MEDIUM;
        if (risk == ActionRegistry.Risk.HIGH) return STAKE_HIGH;
        return STAKE_LOW;
    }

    /**
     * @notice Stake tokens for a proposal
     * @param proposalId The proposal to stake for
     * @param risk The risk level (determines stake amount)
     */
    function stake(bytes32 proposalId, ActionRegistry.Risk risk) external {
        require(stakes[proposalId].staker == address(0), "Already staked");

        // Verify proposal exists and is verified
        ActionRegistry.Proposal memory proposal = registry.getProposal(proposalId);
        require(proposal.createdAt != 0, "Proposal not found");
        require(
            proposal.status == ActionRegistry.ProposalStatus.VERIFIED,
            "Proposal not verified"
        );

        uint256 amount = getRequiredStake(risk);

        // Transfer tokens to this contract
        require(
            token.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );

        stakes[proposalId] = StakeInfo({
            staker: msg.sender,
            amount: amount,
            locked: true,
            resolved: false
        });

        totalStaked[msg.sender] += amount;

        emit Staked(msg.sender, proposalId, amount);
    }

    /**
     * @notice Release stake after successful execution
     * @param proposalId The proposal that was executed successfully
     */
    function releaseStake(bytes32 proposalId) external onlyOwner {
        StakeInfo storage info = stakes[proposalId];
        require(info.staker != address(0), "No stake found");
        require(info.locked, "Stake not locked");
        require(!info.resolved, "Already resolved");

        info.locked = false;
        info.resolved = true;
        totalStaked[info.staker] -= info.amount;

        // Return full stake to player
        require(token.transfer(info.staker, info.amount), "Transfer failed");

        emit StakeReleased(info.staker, proposalId, info.amount);
    }

    /**
     * @notice Slash stake after failed execution
     * @param proposalId The proposal that failed
     */
    function slashStake(bytes32 proposalId) external onlyOwner {
        StakeInfo storage info = stakes[proposalId];
        require(info.staker != address(0), "No stake found");
        require(info.locked, "Stake not locked");
        require(!info.resolved, "Already resolved");

        info.locked = false;
        info.resolved = true;
        totalStaked[info.staker] -= info.amount;

        // Calculate slash amount (50%)
        uint256 slashAmount = (info.amount * SLASH_PERCENT) / 100;
        uint256 returnAmount = info.amount - slashAmount;

        // Burn slashed amount
        token.burn(address(this), slashAmount);

        // Return remaining to player
        if (returnAmount > 0) {
            require(token.transfer(info.staker, returnAmount), "Transfer failed");
        }

        emit StakeSlashed(info.staker, proposalId, slashAmount, returnAmount);
    }

    /**
     * @notice Get stake info for a proposal
     */
    function getStake(bytes32 proposalId) external view returns (StakeInfo memory) {
        return stakes[proposalId];
    }

    /**
     * @notice Check if a proposal has been staked
     */
    function isStaked(bytes32 proposalId) external view returns (bool) {
        return stakes[proposalId].staker != address(0);
    }
}
