import { expect } from "chai";
import { viem } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { parseEther } from "viem";

describe("GovernorsRewardPay Simple Tests", function () {
  async function deploySimpleRewardFixture() {
    const [deployer, user1, user2] = await viem.getWalletClients();
    
    // Deploy TestToken instead of governanceToken
    const TestToken = await viem.deployContract("TestToken", [
      deployer.account.address // initialOwner
    ]);
    
    // Deploy the actual DAOVoting contract
    const DAOVoting = await viem.deployContract("DAOVoting", [
      deployer.account.address // initialOwner
    ]);
    
    // Deploy GovernorsRewardPay contract
    const GovernorsRewardPay = await viem.deployContract("GovernorsRewardPay", [
      DAOVoting.address, // votingContract
      TestToken.address, // rewardToken
      parseEther("0.1"), // baseReward (0.1 ETH equivalent)
      10n, // rewardMultiplierPercentage (10%)
      300n, // maxMultiplier (300%)
      deployer.account.address // initialOwner
    ]);
    
    // Mint tokens to the reward contract
    await TestToken.write.mint([GovernorsRewardPay.address, parseEther("1000")]);
    
    // Set up voter stats directly in the DAOVoting contract
    const proposalId = 1n;
    
    // Set up user1 to have 5 successful votes and a streak of 3
    await DAOVoting.write.setRevealedVoteSupport([proposalId, user1.account.address, 1]);
    await DAOVoting.write.addVoterToList([proposalId, user1.account.address]);
    await DAOVoting.write.updateVoterStatsForTest([proposalId, true]);
    
    // Add more successful votes
    await DAOVoting.write.setRevealedVoteSupport([2n, user1.account.address, 1]);
    await DAOVoting.write.addVoterToList([2n, user1.account.address]);
    await DAOVoting.write.updateVoterStatsForTest([2n, true]);
    
    await DAOVoting.write.setRevealedVoteSupport([3n, user1.account.address, 1]);
    await DAOVoting.write.addVoterToList([3n, user1.account.address]);
    await DAOVoting.write.updateVoterStatsForTest([3n, true]);
    
    await DAOVoting.write.setRevealedVoteSupport([4n, user1.account.address, 1]);
    await DAOVoting.write.addVoterToList([4n, user1.account.address]);
    await DAOVoting.write.updateVoterStatsForTest([4n, true]);
    
    await DAOVoting.write.setRevealedVoteSupport([5n, user1.account.address, 1]);
    await DAOVoting.write.addVoterToList([5n, user1.account.address]);
    await DAOVoting.write.updateVoterStatsForTest([5n, true]);
    
    return { 
      GovernorsRewardPay,
      TestToken, 
      DAOVoting,
      deployer,
      user1,
      user2
    };
  }

  describe("Basic Token Transfers", function () {
    it("Should allow owner to withdraw funds", async function () {
      const { GovernorsRewardPay, TestToken, deployer, user1 } = await loadFixture(deploySimpleRewardFixture);
      
      const withdrawAmount = parseEther("100");
      
      // Check initial balances
      const initialTreasuryBalance = await TestToken.read.balanceOf([GovernorsRewardPay.address]);
      const initialUserBalance = await TestToken.read.balanceOf([user1.account.address]);
      
      console.log("Initial treasury balance:", initialTreasuryBalance);
      console.log("Initial user balance:", initialUserBalance);
      
      // Withdraw funds to user1
      await GovernorsRewardPay.write.withdrawFunds([user1.account.address, withdrawAmount], {
        account: deployer.account
      });
      
      // Check balances after withdrawal
      const newTreasuryBalance = await TestToken.read.balanceOf([GovernorsRewardPay.address]);
      const newUserBalance = await TestToken.read.balanceOf([user1.account.address]);
      
      console.log("New treasury balance:", newTreasuryBalance);
      console.log("New user balance:", newUserBalance);
      
      expect(initialTreasuryBalance - newTreasuryBalance).to.equal(withdrawAmount);
      expect(newUserBalance - initialUserBalance).to.equal(withdrawAmount);
    });

    it("Should allow claiming rewards", async function () {
      const { GovernorsRewardPay, TestToken, DAOVoting, user1 } = await loadFixture(deploySimpleRewardFixture);
      
      // Check initial balances
      const initialTreasuryBalance = await TestToken.read.balanceOf([GovernorsRewardPay.address]);
      const initialUserBalance = await TestToken.read.balanceOf([user1.account.address]);
      
      console.log("Initial treasury balance:", initialTreasuryBalance);
      console.log("Initial user balance:", initialUserBalance);
      
      // Verify voter stats
      const stats = await DAOVoting.read.getGovernorStats([user1.account.address]);
      console.log("Voter stats:", stats);
      
      // Get expected reward amount
      const expectedReward = await GovernorsRewardPay.read.getClaimableReward([user1.account.address]);
      console.log("Expected reward:", expectedReward);
      
      // Claim reward
      await GovernorsRewardPay.write.claimReward({
        account: user1.account
      });
      
      // Check balances after claim
      const newTreasuryBalance = await TestToken.read.balanceOf([GovernorsRewardPay.address]);
      const newUserBalance = await TestToken.read.balanceOf([user1.account.address]);
      
      console.log("New treasury balance:", newTreasuryBalance);
      console.log("New user balance:", newUserBalance);
      
      expect(initialTreasuryBalance - newTreasuryBalance).to.equal(expectedReward);
      expect(newUserBalance - initialUserBalance).to.equal(expectedReward);
    });
  });
}); 