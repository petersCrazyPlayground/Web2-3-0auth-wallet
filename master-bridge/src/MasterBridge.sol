// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/IBridge.sol";

contract MasterBridge is ReentrancyGuard {
    address public owner;
    mapping(bytes32 => bool) public processedTransactions;
    mapping(address => bool) public authorizedBridges;
    
    event BridgeRegistered(
        address indexed bridge,
        string indexed chain
    );
    
    event BridgeUnregistered(
        address indexed bridge,
        string indexed chain
    );
    
    event CrossChainTransferInitiated(
        bytes32 indexed transactionId,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        string sourceChain,
        string destinationChain
    );
    
    event CrossChainTransferCompleted(
        bytes32 indexed transactionId,
        address indexed recipient,
        uint256 amount
    );

    constructor() {
        owner = msg.sender;
    }

    function registerBridge(address bridge, string memory chain) external {
        require(msg.sender == owner, "Only owner can register bridges");
        authorizedBridges[bridge] = true;
        emit BridgeRegistered(bridge, chain);
    }

    function unregisterBridge(address bridge, string memory chain) external {
        require(msg.sender == owner, "Only owner can unregister bridges");
        authorizedBridges[bridge] = false;
        emit BridgeUnregistered(bridge, chain);
    }

    function initiateCrossChainTransfer(
        address sourceBridge,
        address destinationBridge,
        address token,
        uint256 amount,
        bytes32 transactionId,
        string memory sourceChain,
        string memory destinationChain
    ) external nonReentrant {
        require(authorizedBridges[sourceBridge], "Source bridge not authorized");
        require(authorizedBridges[destinationBridge], "Destination bridge not authorized");
        require(!processedTransactions[transactionId], "Transaction already processed");
        
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        processedTransactions[transactionId] = true;
        
        emit CrossChainTransferInitiated(
            transactionId,
            msg.sender,
            msg.sender,
            amount,
            sourceChain,
            destinationChain
        );
    }

    function completeCrossChainTransfer(
        address bridge,
        address token,
        address recipient,
        uint256 amount,
        bytes32 transactionId
    ) external nonReentrant {
        require(msg.sender == owner, "Only owner can complete transfers");
        require(authorizedBridges[bridge], "Bridge not authorized");
        require(!processedTransactions[transactionId], "Transaction already processed");
        
        IERC20(token).transfer(recipient, amount);
        processedTransactions[transactionId] = true;
        
        emit CrossChainTransferCompleted(transactionId, recipient, amount);
    }
} 