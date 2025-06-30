import { expect } from "chai";
import { viem } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { parseEther, keccak256, encodeAbiParameters } from "viem";

describe("Split DAO Contract Tests", function () {
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

  async function deploySplitDAOFixture() {
    const [deployer, voter1, voter2, voter3] = await viem.getWalletClients();
    
    // Deploy TimelockController
    const TimelockController = await viem.deployContract("TimelockController", [
      1n, // minDelay (1 second)
      [deployer.account.address], // proposers
      [deployer.account.address], // executors
      deployer.account.address // admin
    ]);
    
    // Deploy governance token
    const GovernanceToken = await viem.deployContract("governanceToken", [
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
      GovernanceToken.address, // token
      TimelockController.address, // timelock
      PaymentContract.address, // paymentContract
      parseEther("1") // standardTransactionPower
    ]);
    
    // Set up contract relationships
    await DAOVoting.write.setGovernanceContract([DAOGovernanceCore.address]);
    await DAOGovernanceCore.write.setVotingContract([DAOVoting.address]);
    
    // Setup initial state for testing
    await GovernanceToken.write.mint([voter1.account.address, parseEther("100")]);
    await GovernanceToken.write.mint([voter2.account.address, parseEther("100")]);
    await GovernanceToken.write.mint([voter3.account.address, parseEther("100")]);
    
    // Set voting weights
    await DAOVoting.write.setVotingWeight([voter1.account.address, 1]);
    await DAOVoting.write.setVotingWeight([voter2.account.address, 1]);
    await DAOVoting.write.setVotingWeight([voter3.account.address, 1]);
    
    return { 
      DAOGovernanceCore, 
      DAOVoting,
      GovernanceToken, 
      PaymentContract, 
      TimelockController,
      deployer,
      voter1,
      voter2,
      voter3
    };
  }

  describe("Basic Integration", function () {
    it("Should correctly set up contract relationships", async function () {
      const { DAOGovernanceCore, DAOVoting } = await loadFixture(deploySplitDAOFixture);
      
      // Check that DAOVoting has the correct governance contract
      const governanceContract = await DAOVoting.read.governanceContract();
      // Use toLowerCase() to make the comparison case-insensitive
      expect(governanceContract.toLowerCase()).to.equal(DAOGovernanceCore.address.toLowerCase());
    });
  });

  describe("Vote Counting", function () {
    it("Should correctly count votes", async function () {
      const { DAOVoting, voter1, voter2, voter3 } = await loadFixture(deploySplitDAOFixture);
      
      const proposalId = 1n;
      
      // Set up voter1 to vote FOR
      await DAOVoting.write.setCommitted([voter1.account.address, true]);
      const commitHash1 = createCommitHash(FOR, SALT);
      await DAOVoting.write.storeCommitment([proposalId, voter1.account.address, commitHash1]);
      
      // Set up voter2 to vote AGAINST
      await DAOVoting.write.setCommitted([voter2.account.address, true]);
      const commitHash2 = createCommitHash(AGAINST, SALT);
      await DAOVoting.write.storeCommitment([proposalId, voter2.account.address, commitHash2]);
      
      // Set up voter3 to vote ABSTAIN
      await DAOVoting.write.setCommitted([voter3.account.address, true]);
      const commitHash3 = createCommitHash(ABSTAIN, SALT);
      await DAOVoting.write.storeCommitment([proposalId, voter3.account.address, commitHash3]);
      
      // Count votes
      await DAOVoting.write.countVoteForTest([proposalId, voter1.account.address, FOR, 1n]);
      await DAOVoting.write.countVoteForTest([proposalId, voter2.account.address, AGAINST, 1n]);
      await DAOVoting.write.countVoteForTest([proposalId, voter3.account.address, ABSTAIN, 1n]);
      
      // Record that the votes were revealed
      await DAOVoting.write.setHasRevealed([proposalId, voter1.account.address, true]);
      await DAOVoting.write.setHasRevealed([proposalId, voter2.account.address, true]);
      await DAOVoting.write.setHasRevealed([proposalId, voter3.account.address, true]);
      
      // Set revealed vote support
      await DAOVoting.write.setRevealedVoteSupport([proposalId, voter1.account.address, FOR]);
      await DAOVoting.write.setRevealedVoteSupport([proposalId, voter2.account.address, AGAINST]);
      await DAOVoting.write.setRevealedVoteSupport([proposalId, voter3.account.address, ABSTAIN]);
      
      // Add voters to list
      await DAOVoting.write.addVoterToList([proposalId, voter1.account.address]);
      await DAOVoting.write.addVoterToList([proposalId, voter2.account.address]);
      await DAOVoting.write.addVoterToList([proposalId, voter3.account.address]);
      
      // Check vote counts
      const votes = await DAOVoting.read.getProposalVotes([proposalId]);
      expect(votes.forVotes).to.equal(1n);
      expect(votes.againstVotes).to.equal(1n);
      expect(votes.abstainVotes).to.equal(1n);
    });
  });

  describe("Voter Stats Tracking", function () {
    it("Should correctly update voter stats", async function () {
      const { DAOVoting, voter1, voter2 } = await loadFixture(deploySplitDAOFixture);
      
      const proposalId = 1n;
      
      // Set up voter1 to vote FOR
      await DAOVoting.write.setRevealedVoteSupport([proposalId, voter1.account.address, FOR]);
      await DAOVoting.write.addVoterToList([proposalId, voter1.account.address]);
      
      // Set up voter2 to vote AGAINST
      await DAOVoting.write.setRevealedVoteSupport([proposalId, voter2.account.address, AGAINST]);
      await DAOVoting.write.addVoterToList([proposalId, voter2.account.address]);
      
      // Update voter stats with proposal succeeding
      await DAOVoting.write.updateVoterStatsForTest([proposalId, true]);
      
      // Check voter stats
      const voter1Stats = await DAOVoting.read.getGovernorStats([voter1.account.address]);
      const voter2Stats = await DAOVoting.read.getGovernorStats([voter2.account.address]);
      
      // Voter1 voted FOR and proposal succeeded, so should have a successful vote
      expect(voter1Stats[0]).to.equal(1n); // successfulVotes
      expect(voter1Stats[1]).to.equal(0n); // failedVotes
      // The streak is returned as a number, not a bigint
      expect(Number(voter1Stats[2])).to.equal(1); // streak
      
      // Voter2 voted AGAINST and proposal succeeded, so should have a failed vote
      expect(voter2Stats[0]).to.equal(0n); // successfulVotes
      expect(voter2Stats[1]).to.equal(1n); // failedVotes
      expect(Number(voter2Stats[2])).to.equal(0); // streak
    });
  });
}); 