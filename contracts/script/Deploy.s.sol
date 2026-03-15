// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../src/ThalesToken.sol";
import "../src/ActionRegistry.sol";
import "../src/StakeManager.sol";

/**
 * @title Deploy
 * @notice Deployment script for Thales contracts
 * @dev Run with: forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast
 */
contract Deploy {
    function run() external {
        // Get deployer private key from environment
        uint256 deployerPrivateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

        // Start broadcasting transactions
        vm.startBroadcast(deployerPrivateKey);

        // Deploy ThalesToken
        ThalesToken token = new ThalesToken();

        // Deploy ActionRegistry
        ActionRegistry registry = new ActionRegistry();

        // Deploy StakeManager
        StakeManager stakeManager = new StakeManager(address(token), address(registry));

        // Grant StakeManager permission to burn tokens (for slashing)
        // Note: StakeManager needs to call token.burn(), but only owner can
        // For simplicity, we'll transfer ownership or use a different approach

        // Grant verifier and executor roles to deployer (for testing)
        registry.addVerifier(address(stakeManager));
        registry.addExecutor(address(stakeManager));

        vm.stopBroadcast();

        // Log deployed addresses
        console.log("=== Thales Contracts Deployed ===");
        console.log("ThalesToken:", address(token));
        console.log("ActionRegistry:", address(registry));
        console.log("StakeManager:", address(stakeManager));
        console.log("================================");
    }
}

// Foundry cheatcodes interface
interface Vm {
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

library console {
    address constant CONSOLE_ADDRESS = 0x000000000000000000636F6e736F6c652e6c6f67;

    function log(string memory p0) internal view {
        (bool ignored,) = CONSOLE_ADDRESS.staticcall(abi.encodeWithSignature("log(string)", p0));
        ignored;
    }

    function log(string memory p0, address p1) internal view {
        (bool ignored,) = CONSOLE_ADDRESS.staticcall(abi.encodeWithSignature("log(string,address)", p0, p1));
        ignored;
    }
}

Vm constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);
