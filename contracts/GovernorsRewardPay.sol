 // SPDX-License-Identifier: MIT
 pragma solidity ^0.8.20;

contract RewardsPool {
    mapping(address => uint256) public rewards;
 
    constructor(address _daoAddress) {
        require(_daoAddress != address(0), "Invalid DAO address");
       
    }

    function claimRewards() external {
        uint256 reward = rewards[msg.sender];
        require(reward > 0, "No rewards to claim");
        (bool success, ) = msg.sender.call{value: reward}("");
        require(success, "Transfer failed");
        rewards[msg.sender] = 0;
    }

    function claimStreakRewards(address[] memory members, uint256[] memory amounts) external {
        require(members.length == amounts.length, "Mismatch in members and amounts arrays");
        for (uint256 i = 0; i < members.length; i++) {
            rewards[members[i]] += amounts[i];
        }
    }
}