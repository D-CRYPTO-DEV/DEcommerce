// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "../DAOVotingLibrary.sol";

/**
 * @title IDAOVoting
 * @dev Interface for the voting contract used by the DAO
 */
interface IDAOVoting {
    // --- Events ---
    event VoteCommitted(uint256 indexed proposalId, address indexed voter, bytes32 commit);
    event VoteRevealedByRelayer(uint256 indexed proposalId, address indexed voter, uint8 support);
    
    // --- Structs ---
    struct VoteCounts {
        uint256 againstVotes;
        uint256 forVotes;
        uint256 abstainVotes;
    }
    
    struct VoterStats {
        uint256 successfulVotes;
        uint256 failedVotes;
        uint8 winStreak;
        uint8 lossStreak;
    }

    // --- Functions ---
    function setGovernanceContract(address _governanceContract) external;
    function governanceContract() external view returns (address);
    
    // Voting functions
    function commitVote(uint256 proposalId, bytes32 commitment) external;
    function revealVote(uint256 proposalId, uint8 support, uint256 salt) external;
    function revealVoteBySig(
        address voter,
        uint256 proposalId,
        uint8 support,
        uint256 salt,
        bytes memory signature
    ) external;
    
    // Vote counting
    function countVoteForTest(uint256 proposalId, address voter, uint8 support, uint256 weight) external returns (uint256, uint256, uint256);
    function getProposalVotes(uint256 proposalId) external view returns (DAOVotingLibrary.VoteCounts memory);
    
    // Voter stats
    function getGovernorStats(address governor) external view returns (uint256 successfulVotes, uint256 failedVotes, uint8 streak);
    function maxFailurestreak() external view returns (bool);
    function governorSuccesfulvotes(address governor) external view returns (uint256);
    function governorfailedvotes(address governor) external view returns (uint256);
    function governorStreak(address governor) external view returns (uint8);
    function governorSuccessfulVotes(address governor) external view returns (uint256);
    
    // Testing and helper functions
    function setCommitted(address voter, bool isCommitted) external;
    function storeCommitment(uint256 proposalId, address voter, bytes32 commitment) external;
    function setHasRevealed(uint256 proposalId, address voter, bool revealed) external;
    function setVoterLossStreak(address voter, uint8 streak) external;
    function setVotingWeight(address voter, uint8 weight) external;
    function setRevealedVoteSupport(uint256 proposalId, address voter, uint8 support) external;
    function addVoterToList(uint256 proposalId, address voter) external;
    function updateVoterStatsForTest(uint256 proposalId, bool proposalSucceeded) external;
} 