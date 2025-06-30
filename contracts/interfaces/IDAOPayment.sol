// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title IDAOPayment
 * @dev Interface for the payment contract used by the DAO
 */
interface IDAOPayment {
    /**
     * @dev Returns the amount paid by a user to the DAO
     * @param _useradd Address of the user
     * @return Amount paid to the DAO
     */
    function getPaymentToDAO(address _useradd) external view returns (uint256);
} 