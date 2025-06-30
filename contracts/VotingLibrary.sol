// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title VotingLibrary
 * @dev Library for vote counting and voter statistics management
 */
library VotingLibrary {
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
    
    // --- Vote Counting Functions ---
    function countVote(
        VoteCounts storage votes,
        uint8 support,
        uint256 weight
    ) internal returns (uint256, uint256, uint256) {
        if (support == 0) { // Against
            votes.againstVotes += weight;
        } else if (support == 1) { // For
            votes.forVotes += weight;
        } else if (support == 2) { // Abstain
            votes.abstainVotes += weight;
        } else {
            revert("InvalidVoteType");
        }
        return (votes.againstVotes, votes.forVotes, votes.abstainVotes);
    }
    
    // --- Voter Statistics Functions ---
    function updateVoterStats(
        mapping(address => VoterStats) storage voterStatsMap,
        address voter,
        uint8 support,
        bool proposalSucceeded
    ) internal {
        VoterStats storage stats = voterStatsMap[voter];
        
        // A "win" for the voter is voting FOR a successful proposal, or AGAINST a failed one.
        bool voterWon = (support == 1 && proposalSucceeded) || (support == 0 && !proposalSucceeded);

        if (voterWon) {
            stats.successfulVotes++;
            stats.winStreak++;
            stats.lossStreak = 0;
        } else { // Voting FOR a failed proposal or AGAINST a successful one is a loss.
            stats.failedVotes++;
            stats.lossStreak++;
            stats.winStreak = 0;
        }
    }
    
    function hasMaxFailureStreak(VoterStats storage stats, uint8 maxFailures) internal view returns (bool) {
        return stats.lossStreak >= maxFailures;
    }
    
    // --- Commitment Functions ---
    function createCommitHash(uint8 support, uint256 salt) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(support, salt));
    }
    
    function validateCommitment(bytes32 storedCommitment, uint8 support, uint256 salt) internal pure returns (bool) {
        bytes32 calculatedCommitment = createCommitHash(support, salt);
        return storedCommitment == calculatedCommitment;
    }
} 