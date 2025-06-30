import { expect } from "chai";
import { viem } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { parseEther, keccak256, encodeAbiParameters } from "viem";

describe("DAO Reward System Tests", function () {
  const AGAINST = 0;
  const FOR = 1;
  const ABSTAIN = 2;
  const SALT = 123456789n;

  // Helper function to create a commitment hash
  function createCommitHash(support: number, salt: bigint) {
    return keccak256(
      encodeAbiParameters(
        [{ type: "uint8" }, { type: "uint256" }],
        [support, salt]
      )
    );
  }

  async function deployRewardSystemFixture() {
    const [deployer, voter1, voter2, voter3] = await viem.getWalletClients();
    
    // Deploy TimelockController
    const TimelockController = await viem.deployContract("TimelockController", [
      1n, // minDelay (1 second)
      [deployer.account.address], // proposers
      [deployer.account.address], // executors
      deployer.account.address // admin
    ]);
    
    // Deploy TestToken instead of governanceToken
    const TestToken = await viem.deployContract("TestToken", [
      deployer.account.address // initialOwner
    ]);
    
    // Deploy payment contract
    const PaymentContract = await viem.deployContract("paymentContract", [
      deployer.account.address // DAO address
    ]);
    
    // Deploy DAOVoting contract
    const DAOVoting = await viem.deployContract("DAOVoting", [
      deployer.account.address // initialOwner
    ]);
    
    // Deploy DAOGovernanceCore contract
    const DAOGovernanceCore = await viem.deployContract("DAOGovernanceCore", [
      TestToken.address, // token
      TimelockController.address, // timelock
      PaymentContract.address, // paymentContract
      parseEther("1") // standardTransactionPower
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
    
    // Set up contract relationships
    await DAOVoting.write.setGovernanceContract([DAOGovernanceCore.address]);
    await DAOGovernanceCore.write.setVotingContract([DAOVoting.address]);
    
    // Mint tokens to voters and reward treasury
    await TestToken.write.mint([voter1.account.address, parseEther("100")]);
    await TestToken.write.mint([voter2.account.address, parseEther("100")]);
    await TestToken.write.mint([voter3.account.address, parseEther("100")]);
    await TestToken.write.mint([GovernorsRewardPay.address, parseEther("1000")]);
    
    // Set voting weights
    await DAOVoting.write.setVotingWeight([voter1.account.address, 1]);
    await DAOVoting.write.setVotingWeight([voter2.account.address, 1]);
    await DAOVoting.write.setVotingWeight([voter3.account.address, 1]);
    
    return { 
      DAOGovernanceCore, 
      DAOVoting,
      TestToken, 
      PaymentContract, 
      TimelockController,
      GovernorsRewardPay,
      deployer,
      voter1,
      voter2,
      voter3
    };
  }

  describe("Reward Calculation", function () {
    it("Should calculate rewards correctly based on successful votes", async function () {
      const { DAOVoting, GovernorsRewardPay, voter1 } = await loadFixture(deployRewardSystemFixture);
      
      const proposalId = 1n;
      
      // Set up voter1 to have 1 successful vote
      await DAOVoting.write.setRevealedVoteSupport([proposalId, voter1.account.address, FOR]);
      await DAOVoting.write.addVoterToList([proposalId, voter1.account.address]);
      await DAOVoting.write.updateVoterStatsForTest([proposalId, true]);
      
      // Check voter stats to verify
      const stats = await DAOVoting.read.getGovernorStats([voter1.account.address]);
      expect(stats[0]).to.equal(1n); // successfulVotes
      expect(Number(stats[2])).to.equal(1); // streak
      
      // Check claimable reward - should be base reward * 1 successful vote * (1 + streak * multiplier)
      const claimableReward = await GovernorsRewardPay.read.getClaimableReward([voter1.account.address]);
      
      // With 1 successful vote, streak is 1, and multiplier is 10%, so reward is 0.1 * 1 * (1 + 0.1) = 0.11
      expect(claimableReward).to.equal(parseEther("0.11")); // 0.11 token
    });

    it("Should apply streak multiplier correctly", async function () {
      const { DAOVoting, GovernorsRewardPay, voter1 } = await loadFixture(deployRewardSystemFixture);
      
      // Set up voter1 to have 3 successful votes and a streak of 3
      const proposalId1 = 1n;
      const proposalId2 = 2n;
      const proposalId3 = 3n;
      
      // First successful vote
      await DAOVoting.write.setRevealedVoteSupport([proposalId1, voter1.account.address, FOR]);
      await DAOVoting.write.addVoterToList([proposalId1, voter1.account.address]);
      await DAOVoting.write.updateVoterStatsForTest([proposalId1, true]);
      
      // Second successful vote
      await DAOVoting.write.setRevealedVoteSupport([proposalId2, voter1.account.address, FOR]);
      await DAOVoting.write.addVoterToList([proposalId2, voter1.account.address]);
      await DAOVoting.write.updateVoterStatsForTest([proposalId2, true]);
      
      // Third successful vote
      await DAOVoting.write.setRevealedVoteSupport([proposalId3, voter1.account.address, FOR]);
      await DAOVoting.write.addVoterToList([proposalId3, voter1.account.address]);
      await DAOVoting.write.updateVoterStatsForTest([proposalId3, true]);
      
      // Check voter stats
      const stats = await DAOVoting.read.getGovernorStats([voter1.account.address]);
      expect(stats[0]).to.equal(3n); // successfulVotes
      expect(Number(stats[2])).to.equal(3); // streak
      
      // Check claimable reward - should be base reward * 3 successful votes * (1 + 3 * 10%)
      // 0.1 * 3 * (1 + 0.3) = 0.1 * 3 * 1.3 = 0.39
      const claimableReward = await GovernorsRewardPay.read.getClaimableReward([voter1.account.address]);
      expect(claimableReward).to.equal(parseEther("0.39")); // 0.39 token
    });
  });

  describe("Reward Claiming", function () {
    it("Should allow claiming rewards", async function () {
      const { DAOVoting, GovernorsRewardPay, TestToken, voter1, deployer } = await loadFixture(deployRewardSystemFixture);
      
      // Set up voter1 to have 2 successful votes and a streak of 2
      const proposalId1 = 1n;
      const proposalId2 = 2n;
      
      // First successful vote
      await DAOVoting.write.setRevealedVoteSupport([proposalId1, voter1.account.address, FOR]);
      await DAOVoting.write.addVoterToList([proposalId1, voter1.account.address]);
      await DAOVoting.write.updateVoterStatsForTest([proposalId1, true]);
      
      // Second successful vote
      await DAOVoting.write.setRevealedVoteSupport([proposalId2, voter1.account.address, FOR]);
      await DAOVoting.write.addVoterToList([proposalId2, voter1.account.address]);
      await DAOVoting.write.updateVoterStatsForTest([proposalId2, true]);
      
      // Check initial token balance
      const initialBalance = await TestToken.read.balanceOf([voter1.account.address]);
      
      // Claim reward using the voter's wallet client
      await GovernorsRewardPay.write.claimReward({
        account: voter1.account
      });
      
      // Check new token balance
      const newBalance = await TestToken.read.balanceOf([voter1.account.address]);
      
      // Expected reward: 0.1 * 2 * (1 + 2 * 0.1) = 0.1 * 2 * 1.2 = 0.24
      const expectedReward = parseEther("0.24");
      expect(newBalance - initialBalance).to.equal(expectedReward);
      
      // Check that rewarded votes are updated
      const rewardedVotes = await GovernorsRewardPay.read.rewardedVotes([voter1.account.address]);
      expect(rewardedVotes).to.equal(2n);
    });

    it("Should not allow claiming rewards twice for the same votes", async function () {
      const { DAOVoting, GovernorsRewardPay, TestToken, voter1, deployer } = await loadFixture(deployRewardSystemFixture);
      
      // Set up voter1 to have 1 successful vote
      const proposalId = 1n;
      await DAOVoting.write.setRevealedVoteSupport([proposalId, voter1.account.address, FOR]);
      await DAOVoting.write.addVoterToList([proposalId, voter1.account.address]);
      await DAOVoting.write.updateVoterStatsForTest([proposalId, true]);
      
      // Claim reward using the voter's wallet client
      await GovernorsRewardPay.write.claimReward({
        account: voter1.account
      });
      
      // Try to claim again - should fail since there are no new successful votes
      let hasError = false;
      try {
        await GovernorsRewardPay.write.claimReward({
          account: voter1.account
        });
      } catch (error) {
        // Any error is acceptable as long as the transaction reverts
        hasError = true;
      }
      
      // Verify that the transaction reverted
      expect(hasError).to.be.true;
      
      // Check that rewarded votes haven't changed
      const rewardedVotes = await GovernorsRewardPay.read.rewardedVotes([voter1.account.address]);
      expect(rewardedVotes).to.equal(1n);
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to update reward parameters", async function () {
      const { GovernorsRewardPay, deployer } = await loadFixture(deployRewardSystemFixture);
      
      // Update reward parameters
      const newBaseReward = parseEther("0.2");
      const newMultiplierPercentage = 20n;
      const newMaxMultiplier = 400n;
      
      await GovernorsRewardPay.write.setRewardParameters([
        newBaseReward,
        newMultiplierPercentage,
        newMaxMultiplier
      ], {
        account: deployer.account
      });
      
      // Check updated parameters
      const baseReward = await GovernorsRewardPay.read.baseReward();
      const multiplierPercentage = await GovernorsRewardPay.read.rewardMultiplierPercentage();
      const maxMultiplier = await GovernorsRewardPay.read.maxMultiplier();
      
      expect(baseReward).to.equal(newBaseReward);
      expect(multiplierPercentage).to.equal(newMultiplierPercentage);
      expect(maxMultiplier).to.equal(newMaxMultiplier);
    });

    it("Should allow owner to withdraw funds", async function () {
      const { GovernorsRewardPay, TestToken, deployer } = await loadFixture(deployRewardSystemFixture);
      
      const withdrawAmount = parseEther("100");
      const initialTreasuryBalance = await TestToken.read.balanceOf([GovernorsRewardPay.address]);
      const initialDeployerBalance = await TestToken.read.balanceOf([deployer.account.address]);
      
      // Withdraw funds
      await GovernorsRewardPay.write.withdrawFunds([deployer.account.address, withdrawAmount], {
        account: deployer.account
      });
      
      // Check balances
      const newTreasuryBalance = await TestToken.read.balanceOf([GovernorsRewardPay.address]);
      const newDeployerBalance = await TestToken.read.balanceOf([deployer.account.address]);
      
      expect(initialTreasuryBalance - newTreasuryBalance).to.equal(withdrawAmount);
      expect(newDeployerBalance - initialDeployerBalance).to.equal(withdrawAmount);
    });
  });
}); 