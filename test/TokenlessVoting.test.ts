import { expect } from "chai";
import { viem } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { Address } from "viem";
import hre from "hardhat";

async function deployTokenlessVotingSystem() {
  const publicClient = await viem.getPublicClient();
  const [deployer, user1, user2, user3] = await viem.getWalletClients();
  
  // Deploy the TimelockController
  const TimelockController = await viem.deployContract("TimelockController", [
    1, // minDelay (1 second for testing)
    [deployer.account.address], // proposers
    [deployer.account.address], // executors
    deployer.account.address // admin
  ]);
  
  // Deploy the payment contract
  const paymentContract = await viem.deployContract("paymentContract", [
    deployer.account.address,
  ]);
  
  // Deploy the governance core
  const governanceCore = await viem.deployContract("DAOGovernanceCore", [
    TimelockController.address,
    paymentContract.address,
    10n, // standardTransactionPower (10 wei)
    51n  // initialQuorumNumerator (51%)
  ]);
  
  // Deploy the voting contract
  const votingContract = await viem.deployContract("DAOVoting", [
    deployer.account.address
  ]);
  
  // Set up the contracts
  await votingContract.write.setGovernanceContract([governanceCore.address]);
  await governanceCore.write.setVotingContract([votingContract.address]);
  
  // Make payments to allow users to join the DAO
  const paymentAmount = 20n; // 20 wei (above standardTransactionPower)
  
  await paymentContract.write.pay([deployer.account.address], {
    value: paymentAmount,
    account: user1.account
  });
  
  await paymentContract.write.pay([deployer.account.address], {
    value: paymentAmount,
    account: user2.account
  });
  
  await paymentContract.write.pay([deployer.account.address], {
    value: paymentAmount,
    account: user3.account
  });
  
  return {
    publicClient,
    deployer,
    user1,
    user2,
    user3,
    governanceCore,
    votingContract,
    paymentContract,
    TimelockController
  };
}

describe("Tokenless Voting System", async () => {
  describe("DAO Membership", async () => {
    it("allows users to join the DAO after making a payment", async () => {
      const { governanceCore, user1 } = await loadFixture(deployTokenlessVotingSystem);
      
      // User1 joins the DAO
      await governanceCore.write.joinDAO([governanceCore.address], {
        account: user1.account
      });
      
      // Check if user1 is a member
      const isMember = await governanceCore.read.isMember([user1.account.address]);
      expect(isMember).to.be.true;
      
      // Check member count
      const memberCount = await governanceCore.read.memberCount();
      expect(memberCount).to.equal(1n);
    });
    
    it("prevents users from joining without making a payment", async () => {
      const { governanceCore, deployer } = await loadFixture(deployTokenlessVotingSystem);
      
      // Attempt to join the DAO without making a payment
      await expect(
        governanceCore.write.joinDAO([governanceCore.address], {
          account: deployer.account
        })
      ).to.be.rejectedWith("You must have made a payment to the DAO to join");
    });
    
    it("prevents users from joining multiple times", async () => {
      const { governanceCore, user1 } = await loadFixture(deployTokenlessVotingSystem);
      
      // User1 joins the DAO
      await governanceCore.write.joinDAO([governanceCore.address], {
        account: user1.account
      });
      
      // Attempt to join again
      await expect(
        governanceCore.write.joinDAO([governanceCore.address], {
          account: user1.account
        })
      ).to.be.rejectedWith("Already a member");
    });
  });
  
  describe("Voting Weight", async () => {
    it("assigns equal voting weight to all members", async () => {
      const { governanceCore, votingContract, user1, user2 } = await loadFixture(deployTokenlessVotingSystem);
      
      // Users join the DAO
      await governanceCore.write.joinDAO([governanceCore.address], {
        account: user1.account
      });
      
      await governanceCore.write.joinDAO([governanceCore.address], {
        account: user2.account
      });
      
      // Check voting weights
      const user1Weight = await votingContract.read.votingWeight([user1.account.address]);
      const user2Weight = await votingContract.read.votingWeight([user2.account.address]);
      
      expect(user1Weight).to.equal(1n);
      expect(user2Weight).to.equal(1n);
    });
  });
  
  describe("Quorum Calculation", async () => {
    it("calculates quorum based on member count and quorum numerator", async () => {
      const { governanceCore, user1, user2, user3 } = await loadFixture(deployTokenlessVotingSystem);
      
      // All users join the DAO
      await governanceCore.write.joinDAO([governanceCore.address], {
        account: user1.account
      });
      
      await governanceCore.write.joinDAO([governanceCore.address], {
        account: user2.account
      });
      
      await governanceCore.write.joinDAO([governanceCore.address], {
        account: user3.account
      });
      
      // Check member count
      const memberCount = await governanceCore.read.memberCount();
      expect(memberCount).to.equal(3n);
      
      // Check quorum numerator
      const quorumNumerator = await governanceCore.read.quorumNumerator();
      expect(quorumNumerator).to.equal(51n);
      
      // Check calculated quorum (51% of 3 = 1.53, rounded to 1)
      const quorum = await governanceCore.read.quorum([0n]);
      expect(quorum).to.equal(1n);
    });
    
    it("allows changing the quorum numerator", async () => {
      const { governanceCore } = await loadFixture(deployTokenlessVotingSystem);
      
      // Update quorum numerator to 75%
      await governanceCore.write.updateQuorumNumerator([75n]);
      
      // Check updated quorum numerator
      const quorumNumerator = await governanceCore.read.quorumNumerator();
      expect(quorumNumerator).to.equal(75n);
    });
  });
});