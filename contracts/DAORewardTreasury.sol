// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IDAOVoting.sol";

/**
 * @title DAORewardTreasury
 * @dev Contract to distribute rewards to DAO members based on their voting performance
 */
contract DAORewardTreasury is Ownable {
    // --- State Variables ---
    IDAOVoting public votingContract;
    IERC20 public rewardToken;
    
    uint256 public baseReward;
    uint256 public rewardMultiplierPercentage;
    uint256 public maxMultiplier;
    
    // Mapping to track last reward claim time
    mapping(address => uint256) public lastClaimTime;
    
    // Mapping to track already rewarded successful votes
    mapping(address => uint256) public rewardedVotes;
    
    // --- Events ---
    event RewardClaimed(address indexed governor, uint256 amount, uint256 successfulVotes, uint8 streak);
    event RewardParametersUpdated(uint256 baseReward, uint256 rewardMultiplierPercentage, uint256 maxMultiplier);
    event VotingContractUpdated(address votingContract);
    event RewardTokenUpdated(address rewardToken);
    event FundsWithdrawn(address to, uint256 amount);
    
    // --- Constructor ---
    constructor(
        address _votingContract,
        address _rewardToken,
        uint256 _baseReward,
        uint256 _rewardMultiplierPercentage,
        uint256 _maxMultiplier,
        address initialOwner
    ) Ownable(initialOwner) {
        require(_votingContract != address(0), "Invalid voting contract address");
        require(_rewardToken != address(0), "Invalid reward token address");
        require(_baseReward > 0, "Base reward must be greater than 0");
        
        votingContract = IDAOVoting(_votingContract);
        rewardToken = IERC20(_rewardToken);
        baseReward = _baseReward;
        rewardMultiplierPercentage = _rewardMultiplierPercentage;
        maxMultiplier = _maxMultiplier;
    }
    
    // --- External Functions ---
    
    /**
     * @dev Allows a governor to claim their rewards based on successful votes and win streak
     */
    function claimReward() external {
        address governor = msg.sender;
        
        // Get governor stats from voting contract
        (uint256 successfulVotes, , uint8 streak) = votingContract.getGovernorStats(governor);
        
        // Calculate new successful votes since last claim
        uint256 newSuccessfulVotes = successfulVotes - rewardedVotes[governor];
        require(newSuccessfulVotes > 0, "No new successful votes to claim rewards for");
        
        // Calculate reward amount with streak multiplier
        uint256 rewardAmount = calculateReward(newSuccessfulVotes, streak);
        
        // Update rewarded votes
        rewardedVotes[governor] = successfulVotes;
        
        // Update last claim time
        lastClaimTime[governor] = block.timestamp;
        
        // Transfer reward tokens
        require(rewardToken.balanceOf(address(this)) >= rewardAmount, "Insufficient reward token balance");
        require(rewardToken.transfer(governor, rewardAmount), "Token transfer failed");
        
        emit RewardClaimed(governor, rewardAmount, newSuccessfulVotes, streak);
    }
    
    /**
     * @dev Returns the amount of reward a governor would receive if they claimed now
     * @param governor The address of the governor
     * @return The reward amount in tokens
     */
    function getClaimableReward(address governor) external view returns (uint256) {
        (uint256 successfulVotes, , uint8 streak) = votingContract.getGovernorStats(governor);
        uint256 newSuccessfulVotes = successfulVotes - rewardedVotes[governor];
        
        if (newSuccessfulVotes == 0) {
            return 0;
        }
        
        return calculateReward(newSuccessfulVotes, streak);
    }
    
    // --- Admin Functions ---
    
    /**
     * @dev Updates the voting contract address
     * @param _votingContract The new voting contract address
     */
    function setVotingContract(address _votingContract) external onlyOwner {
        require(_votingContract != address(0), "Invalid voting contract address");
        votingContract = IDAOVoting(_votingContract);
        emit VotingContractUpdated(_votingContract);
    }
    
    /**
     * @dev Updates the reward token address
     * @param _rewardToken The new reward token address
     */
    function setRewardToken(address _rewardToken) external onlyOwner {
        require(_rewardToken != address(0), "Invalid reward token address");
        rewardToken = IERC20(_rewardToken);
        emit RewardTokenUpdated(_rewardToken);
    }
    
    /**
     * @dev Updates the reward parameters
     * @param _baseReward The base reward amount per successful vote
     * @param _rewardMultiplierPercentage The percentage increase per streak level
     * @param _maxMultiplier The maximum multiplier that can be applied
     */
    function setRewardParameters(
        uint256 _baseReward,
        uint256 _rewardMultiplierPercentage,
        uint256 _maxMultiplier
    ) external onlyOwner {
        require(_baseReward > 0, "Base reward must be greater than 0");
        baseReward = _baseReward;
        rewardMultiplierPercentage = _rewardMultiplierPercentage;
        maxMultiplier = _maxMultiplier;
        emit RewardParametersUpdated(_baseReward, _rewardMultiplierPercentage, _maxMultiplier);
    }
    
    /**
     * @dev Allows the owner to withdraw tokens in case of emergency or to adjust treasury funds
     * @param to The address to send the tokens to
     * @param amount The amount of tokens to withdraw
     */
    function withdrawFunds(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid recipient address");
        require(amount > 0, "Amount must be greater than 0");
        require(rewardToken.balanceOf(address(this)) >= amount, "Insufficient balance");
        
        require(rewardToken.transfer(to, amount), "Token transfer failed");
        emit FundsWithdrawn(to, amount);
    }
    
    // --- Internal Functions ---
    
    /**
     * @dev Calculates the reward amount based on successful votes and win streak
     * @param successfulVotes Number of successful votes
     * @param streak Current win streak
     * @return The reward amount in tokens
     */
    function calculateReward(uint256 successfulVotes, uint8 streak) internal view returns (uint256) {
        // Base reward is multiplied by the number of successful votes
        uint256 reward = baseReward * successfulVotes;
        
        // Apply streak multiplier (exponential growth with cap)
        if (streak > 0) {
            // Calculate multiplier: 1 + (streak * multiplierPercentage / 100)
            uint256 multiplier = 100 + (streak * rewardMultiplierPercentage);
            
            // Cap the multiplier
            if (multiplier > 100 + maxMultiplier) {
                multiplier = 100 + maxMultiplier;
            }
            
            // Apply multiplier
            reward = (reward * multiplier) / 100;
        }
        
        return reward;
    }
} 