import { expect } from "chai";
import { viem } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { parseEther, keccak256, encodeAbiParameters } from "viem";

describe("ExtraVoteCheck Modifier Tests", function () {
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

  // Helper function to create a mock signature
  function createMockSignature(): `0x${string}` {
    // This is just a placeholder signature for testing
    return "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1c";
  }

  async function deployDAOFixture() {
    const publicClient = await viem.getPublicClient();
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
    
    // Deploy Governor contract
    const MyGovernor = await viem.deployContract("MyGovernor", [
      GovernanceToken.address, // token
      TimelockController.address, // timelock
      PaymentContract.address, // paymentContract
      parseEther("1") // standardTransactionPower
    ]);
    
    // Setup initial state for testing
    await GovernanceToken.write.mint([voter1.account.address, parseEther("100")]);
    await GovernanceToken.write.mint([voter2.account.address, parseEther("100")]);
    
    // Set voting weight
    await MyGovernor.write.setVotingWeight([voter1.account.address, 1]);
    await MyGovernor.write.setVotingWeight([voter2.account.address, 1]);

    // Create a mock proposal ID
    const proposalId = 1n;
    
    // Add test helper functions to the contract
    await MyGovernor.write.setVotingActive([true]);

    return { 
      MyGovernor, 
      GovernanceToken, 
      PaymentContract, 
      deployer, 
      voter1, 
      voter2, 
      voter3,
      proposalId,
      publicClient
    };
  }

  describe("Vote Restrictions", function () {
    it("Should restrict voting if user hasn't committed their vote", async function () {
      const { MyGovernor, voter1, proposalId } = await loadFixture(deployDAOFixture);
      
      const support = FOR;
      const signature = createMockSignature();
      
      // Try to cast a vote without committing first
      await expect(
        MyGovernor.write.castVoteBySig([
          proposalId,
          support,
          voter1.account.address,
          signature
        ], {
          account: voter1.account
        })
      ).to.be.rejectedWith("You must commit your vote before casting it");
    });

    it("Should restrict voting if commitment hash doesn't match", async function () {
      const { MyGovernor, voter1, proposalId } = await loadFixture(deployDAOFixture);
      
      const support = FOR;
      const wrongSupport = AGAINST;
      const signature = createMockSignature();
      
      // Set the committed flag for testing
      await MyGovernor.write.setCommitted([voter1.account.address, true]);
      
      // Create a commitment but with different values
      const wrongCommitHash = createCommitHash(wrongSupport, SALT);
      
      // Store the wrong commitment
      await MyGovernor.write.storeCommitment([proposalId, voter1.account.address, wrongCommitHash]);
      
      // Try to cast a vote with non-matching commitment
      await expect(
        MyGovernor.write.castVoteBySig([
          proposalId,
          support,
          voter1.account.address,
          signature
        ], {
          account: voter1.account
        })
      ).to.be.rejectedWith("committed vote does not match");
    });

    it("Should set voting weight to 0 if user has 5 consecutive failed votes", async function () {
      const { MyGovernor, voter1, proposalId } = await loadFixture(deployDAOFixture);
      
      const support = FOR;
      const signature = createMockSignature();
      
      // Set up the voter with 5 consecutive losses
      await MyGovernor.write.setVoterLossStreak([voter1.account.address, 5]);
      
      // Set the committed flag and store valid commitment for testing
      await MyGovernor.write.setCommitted([voter1.account.address, true]);
      const commitHash = createCommitHash(support, SALT);
      await MyGovernor.write.storeCommitment([proposalId, voter1.account.address, commitHash]);
      
      // Cast a vote - this should trigger the maxFailurestreak check
      try {
        await MyGovernor.write.castVoteBySig([
          proposalId,
          support,
          voter1.account.address,
          signature
        ], {
          account: voter1.account
        });
      } catch (error) {
        // Ignore signature validation errors
        console.log("Signature validation error (expected):", error);
      }
      
      // Check that voting weight is now 0
      const votingWeight = await MyGovernor.read.votingWeight([voter1.account.address]);
      expect(votingWeight).to.equal(0n);
    });

    it("Should not allow revealing a vote twice", async function () {
      const { MyGovernor, voter1, proposalId } = await loadFixture(deployDAOFixture);
      
      const support = FOR;
      const signature = createMockSignature();
      
      // Set the committed flag and store valid commitment for testing
      await MyGovernor.write.setCommitted([voter1.account.address, true]);
      const commitHash = createCommitHash(support, SALT);
      await MyGovernor.write.storeCommitment([proposalId, voter1.account.address, commitHash]);
      
      // Mark the vote as already revealed
      await MyGovernor.write.setHasRevealed([proposalId, voter1.account.address, true]);
      
      // Try to cast a vote after already revealing
      await expect(
        MyGovernor.write.castVoteBySig([
          proposalId,
          support,
          voter1.account.address,
          signature
        ], {
          account: voter1.account
        })
      ).to.be.rejectedWith("Vote already revealed");
    });
  });

  describe("Vote Casting and Counting", function () {
    it("Should correctly count votes", async function () {
      const { MyGovernor, voter1, voter2, proposalId } = await loadFixture(deployDAOFixture);
      
      // Set up multiple voters with different votes
      await MyGovernor.write.setCommitted([voter1.account.address, true]);
      await MyGovernor.write.setCommitted([voter2.account.address, true]);
      
      const commitHash1 = createCommitHash(FOR, SALT);
      const commitHash2 = createCommitHash(AGAINST, SALT);
      
      await MyGovernor.write.storeCommitment([proposalId, voter1.account.address, commitHash1]);
      await MyGovernor.write.storeCommitment([proposalId, voter2.account.address, commitHash2]);
      
      // Count votes directly using the countVoteForTest function
      await MyGovernor.write.countVoteForTest([proposalId, voter1.account.address, FOR, 1n]);
      await MyGovernor.write.countVoteForTest([proposalId, voter2.account.address, AGAINST, 1n]);
      
      // Check vote counts
      const proposalVotes = await MyGovernor.read.getProposalVotes([proposalId]);
      expect(proposalVotes.forVotes).to.equal(1n);
      expect(proposalVotes.againstVotes).to.equal(1n);
      expect(proposalVotes.abstainVotes).to.equal(0n);
    });
  });
});
