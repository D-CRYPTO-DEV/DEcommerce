 // SPDX-License-Identifier: MIT
 pragma solidity ^0.8.20;

interface IpayeeList{
    function governorSuccesfulvotes(address governor) external view returns (uint256);
    function governorfailedvotes(address governor) external view returns (uint256) ;
    function governorstreak(address governor) external view returns (uint256);
    function governorsSuccesfulvotes() external view returns (uint256);
}

contract RewardsPool {
  

    mapping(address => uint256) public rewards;
    // Interface to interact with the payee list contract
    IpayeeList public payeeList;
    uint256 public tokenBalance = address(this).balance;
    uint8 public balanceRatio = uint8((tokenBalance * 70) / 100); // 70% of the balance will be used for rewards
    uint256 public streakRatio = tokenBalance - balanceRatio; // 30% of the balance will be used for streak rewards
    
    constructor(address _daoAddress) {
        require(_daoAddress != address(0), "Invalid DAO address");
        payeeList = IpayeeList(_daoAddress);
       
    }

    function claimRewards() external {
        require(payeeList.governorSuccesfulvotes(msg.sender) > 0, "No successful votes");
        // Example reward calculation
        uint256 reward = (payeeList.governorSuccesfulvotes(msg.sender) * balanceRatio) / payeeList.governorsSuccesfulvotes();
        require(reward > 0, "No rewards to claim");
        rewards[msg.sender] += reward;
        uint256 payout = rewards[msg.sender];
        require(payout > 0, "No rewards to claim");
        rewards[msg.sender] = 0;
        (bool success, ) = msg.sender.call{value: payout}("");
        require(success, "Transfer failed");
    }

    function claimStreakRewards(address[] memory members, uint256[] memory amounts) external {
        require(members.length == amounts.length, "Mismatch in members and amounts arrays");
        for (uint256 i = 0; i < members.length; i++) {
            rewards[members[i]] += amounts[i];
        }
    }
}