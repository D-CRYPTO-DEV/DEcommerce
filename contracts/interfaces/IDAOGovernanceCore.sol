// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/governance/IGovernor.sol";

/**
 * @title IDAOGovernanceCore
 * @dev Interface for the core governance contract used by the DAO
 */
interface IDAOGovernanceCore is IGovernor {
    // --- Events ---
    event JoinedDAO(address DAOApplicant, address _DAOAddress);
    event QuorumNumeratorUpdated(uint256 oldQuorumNumerator, uint256 newQuorumNumerator);
    event VotingContractInitialized(address votingContract);
    event PaymentContractSet(address paymentContract);
    
    // --- Functions ---
    function setVotingContract(address _votingContract) external;
    function initializeVotingContract(address _votingContract) external;
    function votingContract() external view returns (address);
    
    // DAO membership
    function joinDAO(address _DAOAddress) external;
    function isMember(address account) external view returns (bool);
    function memberCount() external view returns (uint256);
    
    // Quorum management
    function quorumNumerator() external view returns (uint256);
    function updateQuorumNumerator(uint256 newQuorumNumerator) external;
    
    // Voting-related functions
    function commitDeadline(uint256 proposalId) external view returns (uint256);
    
    // Payment contract
    function paymentContract() external view returns (address);
    function standardTransactionPower() external view returns (uint256);
} 