// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../../contracts/DataPointRegistry.sol";
import "../../contracts/DataPointStorage.sol";

contract ReentrancyAttacker {
    DataPointRegistry public registry;
    DataPointStorage public storageContract;
    
    uint256 public attackStage;
    uint256 public callDepth;
    uint256 public maxDepth;
    bool public attackActive;
    address public targetPublisher;
    bytes public attackData;
    
    event AttackStageReached(uint256 stage, uint256 depth);
    event AttackCompleted(bool success, uint256 finalDepth);
    
    constructor(address _registry, address _storage) {
        registry = DataPointRegistry(_registry);
        storageContract = DataPointStorage(_storage);
    }
    
    // Fallback function to catch ETH transfers and attempt reentrancy
    receive() external payable {
        if (attackActive && callDepth < maxDepth) {
            callDepth++;
            emit AttackStageReached(attackStage, callDepth);
            
            if (attackStage == 1) {
                // Stage 1: Attempt reentrancy during royalty collection
                attemptRoyaltyReentrancy();
            } else if (attackStage == 2) {
                // Stage 2: Attempt cross-contract state manipulation
                attemptCrossContractReentrancy();
            } else if (attackStage == 3) {
                // Stage 3: Attempt registration during withdrawal
                attemptRegistrationReentrancy();
            }
        }
    }
    
    function setupRoyaltyReentrancyAttack(
        bytes calldata _data,
        address _publisher,
        uint256 _maxDepth
    ) external payable {
        attackData = _data;
        targetPublisher = _publisher;
        maxDepth = _maxDepth;
        attackStage = 1;
        callDepth = 0;
        attackActive = true;
        
        // Register data point first to set up royalty scenario
        registry.registerDataPoint{value: msg.value}(_data, address(this));
    }
    
    function executeRoyaltyReentrancyAttack() external {
        require(attackActive, "Attack not set up");
        
        // Start the attack by collecting royalties (which will trigger receive())
        try registry.collectRoyalties(
            registry.royaltyBalance(address(this)),
            address(this)
        ) {
            emit AttackCompleted(false, callDepth); // If it completes normally, attack failed
        } catch {
            emit AttackCompleted(true, callDepth); // If it reverts, reentrancy was blocked
        }
        
        attackActive = false;
    }
    
    function attemptRoyaltyReentrancy() internal {
        // Attempt to re-enter collectRoyalties during the withdrawal
        try registry.collectRoyalties(1, address(this)) {
            // If this succeeds, reentrancy vulnerability exists
        } catch {
            // Expected: should revert due to ReentrancyGuard
        }
    }
    
    function setupCrossContractAttack(
        bytes calldata _data1,
        bytes calldata _data2,
        uint256 _maxDepth
    ) external payable {
        attackData = _data1;
        maxDepth = _maxDepth;
        attackStage = 2;
        callDepth = 0;
        attackActive = true;
        
        // Register initial data points to set up cross-contract scenario
        registry.registerDataPoint(_data1, address(this));
        // Store _data2 for use in reentrancy attempt
        storageContract.writeDataPoint(_data2);
    }
    
    function executeCrossContractAttack(bytes calldata _data2) external {
        require(attackActive, "Attack not set up");
        
        // Start attack by withdrawing royalties, which will trigger cross-contract reentrancy
        try registry.collectRoyalties(
            registry.royaltyBalance(address(this)),
            address(this)
        ) {
            emit AttackCompleted(false, callDepth);
        } catch {
            emit AttackCompleted(true, callDepth);
        }
        
        attackActive = false;
    }
    
    function attemptCrossContractReentrancy() internal {
        // Attempt to manipulate state through DPS during DPR operation
        try registry.registerDataPoint(attackData, targetPublisher) {
            // Attempt cross-contract state manipulation
        } catch {
            // Expected: should fail due to reentrancy protection
        }
        
        // Also try direct DPS interaction
        try storageContract.writeDataPoint(attackData) {
            // Direct storage interaction during registry operation
        } catch {
            // May succeed if no reentrancy protection on DPS
        }
    }
    
    function setupRegistrationReentrancy(
        bytes calldata _data,
        uint256 _maxDepth
    ) external payable {
        attackData = _data;
        maxDepth = _maxDepth;
        attackStage = 3;
        callDepth = 0;
        attackActive = true;
    }
    
    function executeRegistrationReentrancyAttack() external payable {
        require(attackActive, "Attack not set up");
        
        // Start attack through registration with value (which might trigger receive)
        try registry.registerDataPoint{value: msg.value}(
            attackData,
            address(this)
        ) {
            emit AttackCompleted(false, callDepth);
        } catch {
            emit AttackCompleted(true, callDepth);
        }
        
        attackActive = false;
    }
    
    function attemptRegistrationReentrancy() internal {
        // Attempt to register another data point during existing registration
        try registry.registerDataPoint(
            abi.encodePacked("nested_", attackData),
            address(this)
        ) {
            // If this succeeds, there's a reentrancy vulnerability in registration
        } catch {
            // Expected: should revert due to reentrancy protection
        }
    }
    
    // Callback-based reentrancy attempts
    function attemptCallbackReentrancy(address target, bytes calldata data) external {
        // Attempt to call back into the contract during execution
        (bool success,) = target.call(data);
        if (success && attackActive && callDepth < maxDepth) {
            callDepth++;
            // Recursive callback attack
            this.attemptCallbackReentrancy(target, data);
        }
    }
    
    // State checking functions
    function checkContractState() external view returns (
        uint256 royaltyBalance,
        uint256 daoBalance,
        bool dataExists
    ) {
        royaltyBalance = registry.royaltyBalance(address(this));
        daoBalance = registry.royaltyBalance(registry.owner());
        
        if (attackData.length > 0) {
            bytes32 dataAddress = storageContract.calculateAddress(attackData);
            dataExists = storageContract.dataPointSize(dataAddress) > 0;
        }
    }
    
    // Recovery functions
    function withdrawEther() external {
        payable(msg.sender).transfer(address(this).balance);
    }
    
    function resetAttack() external {
        attackActive = false;
        attackStage = 0;
        callDepth = 0;
        maxDepth = 0;
    }
    
    // Function to test external call safety
    function testExternalCallSafety(
        address target,
        bytes calldata data,
        uint256 value
    ) external payable returns (bool success, bytes memory returnData) {
        return target.call{value: value}(data);
    }
} 