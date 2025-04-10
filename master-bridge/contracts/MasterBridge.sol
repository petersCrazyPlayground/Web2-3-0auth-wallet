// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MasterBridge is Ownable {
    using SafeERC20 for IERC20;

    enum Chain {
        Avalanche,
        Solana,
        Bitcoin
    }

    struct BridgeTransaction {
        address token;
        uint256 amount;
        Chain sourceChain;
        Chain destinationChain;
        bytes destinationAddress;
        bool completed;
    }

    mapping(bytes32 => BridgeTransaction) public transactions;
    mapping(address => bool) public supportedTokens;
    mapping(Chain => address) public bridgeContracts;

    event BridgeInitiated(
        bytes32 indexed transactionId,
        address indexed token,
        uint256 amount,
        Chain sourceChain,
        Chain destinationChain,
        bytes destinationAddress
    );
    event BridgeCompleted(bytes32 indexed transactionId);

    constructor() Ownable(msg.sender) {}

    function addSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = true;
    }

    function removeSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = false;
    }

    function setBridgeContract(Chain chain, address bridge) external onlyOwner {
        bridgeContracts[chain] = bridge;
    }

    function initiateBridge(
        address token,
        uint256 amount,
        Chain sourceChain,
        Chain destinationChain,
        bytes memory destinationAddress
    ) external {
        require(supportedTokens[token], "Token not supported");
        require(amount > 0, "Amount must be greater than 0");
        require(destinationAddress.length > 0, "Invalid destination address");
        require(sourceChain != destinationChain, "Source and destination chains must be different");
        require(bridgeContracts[sourceChain] != address(0), "Source bridge not set");
        require(bridgeContracts[destinationChain] != address(0), "Destination bridge not set");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        bytes32 transactionId = keccak256(
            abi.encodePacked(
                block.timestamp,
                msg.sender,
                token,
                amount,
                sourceChain,
                destinationChain,
                destinationAddress
            )
        );

        transactions[transactionId] = BridgeTransaction({
            token: token,
            amount: amount,
            sourceChain: sourceChain,
            destinationChain: destinationChain,
            destinationAddress: destinationAddress,
            completed: false
        });

        emit BridgeInitiated(
            transactionId,
            token,
            amount,
            sourceChain,
            destinationChain,
            destinationAddress
        );
    }

    function completeBridge(bytes32 transactionId) external onlyOwner {
        BridgeTransaction storage transaction = transactions[transactionId];
        require(!transaction.completed, "Transaction already completed");

        transaction.completed = true;
        emit BridgeCompleted(transactionId);
    }

    function withdrawTokens(
        address token,
        uint256 amount
    ) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
} 