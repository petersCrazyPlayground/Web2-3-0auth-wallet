// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IBridge {
    function initiateBridge(
        address token,
        uint256 amount,
        bytes32 transactionId,
        string memory destinationAddress
    ) external;
    
    function completeBridge(
        address token,
        address recipient,
        uint256 amount,
        bytes32 transactionId
    ) external;
} 