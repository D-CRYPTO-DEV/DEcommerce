// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.27;

contract eventEmission {

    event PaymentSuccess(address indexed sender, uint256 indexed transactionId, string message);
    
    function emitPaymentSuccess(address sender, uint256 transactionId, string memory message) public {
        emit PaymentSuccess(sender, transactionId, message);
    }

}