// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title DAOVotingLibrary
 * @dev Library for handling DAO voting operations and vote counting
 */
library DAOVotingLibrary {
    // --- Constants ---
    uint8 public constant AGAINST = 0;
    uint8 public constant FOR = 1;
    uint8 public constant ABSTAIN = 2;
    
    // --- Structs ---
    struct VoteCounts {
        uint256 againstVotes;
        uint256 forVotes;
        uint256 abstainVotes;
    }
    
    struct VoterStats {
        uint256 successfulVotes; // Number of votes that aligned with proposal outcome
        uint256 failedVotes;     // Number of votes that didn't align with proposal outcome
        uint8 winStreak;         // Current streak of successful votes
        uint8 lossStreak;        // Current streak of failed votes
    }
    
    /**
     * @dev Creates a commitment hash for commit-reveal voting
     * @param support The vote option (0=against, 1=for, 2=abstain)
     * @param salt A random value to hide the vote
     * @return The commitment hash
     */
    function createCommitHash(uint8 support, uint256 salt) internal pure returns (bytes32) {
        return keccak256(abi.encode(support, salt));
    }
    
    /**
     * @dev Counts a vote for a proposal
     * @param votes The current vote counts
     * @param support The vote option (0=against, 1=for, 2=abstain)
     * @param weight The voting weight
     * @return againstVotes The updated against votes
     * @return forVotes The updated for votes
     * @return abstainVotes The updated abstain votes
     */
    function countVote(
        VoteCounts storage votes,
        uint8 support,
        uint256 weight
    ) internal returns (uint256, uint256, uint256) {
        require(
            support <= 2,
            "DAOVotingLibrary: invalid vote type"
        );
        
        if (support == AGAINST) {
            votes.againstVotes += weight;
        } else if (support == FOR) {
            votes.forVotes += weight;
        } else if (support == ABSTAIN) {
            votes.abstainVotes += weight;
        }
        
        return (votes.againstVotes, votes.forVotes, votes.abstainVotes);
    }
    
    /**
     * @dev Updates a voter's statistics based on their vote and the proposal outcome
     * @param voterStats The voter's current stats
     * @param voter The voter's address
     * @param support The vote option they chose
     * @param proposalSucceeded Whether the proposal passed or failed
     */
    function updateVoterStats(
        mapping(address => VoterStats) storage voterStats,
        address voter,
        uint8 support,
        bool proposalSucceeded
    ) internal {
        bool voteAlignedWithOutcome = (support == FOR && proposalSucceeded) || 
                                      (support == AGAINST && !proposalSucceeded);
        
        if (voteAlignedWithOutcome) {
            // Vote aligned with outcome - it's a win
            voterStats[voter].successfulVotes++;
            voterStats[voter].winStreak++;
            voterStats[voter].lossStreak = 0; // Reset loss streak
        } else if (support != ABSTAIN) { 
            // Only count as a loss if they actually voted (not abstained)
            voterStats[voter].failedVotes++;
            voterStats[voter].lossStreak++;
            voterStats[voter].winStreak = 0; // Reset win streak
        }
        // Abstain votes don't affect stats
    }
    
    /**
     * @dev Checks if a voter has reached the maximum failure streak
     * @param stats The voter's stats
     * @param maxFailures The maximum allowed consecutive failures
     * @return True if the voter has reached or exceeded the max failure streak
     */
    function hasMaxFailureStreak(VoterStats storage stats, uint8 maxFailures) internal view returns (bool) {
        return stats.lossStreak >= maxFailures;
    }
} 