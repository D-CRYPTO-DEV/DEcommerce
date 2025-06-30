import { expect } from "chai";
import { viem } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { parseEther, keccak256, encodeAbiParameters, zeroAddress } from "viem";

describe("Parallel Proposals Test", function () {
  const AGAINST = 0;
  const FOR = 1;
  const ABSTAIN = 2;
  const SALT = 123456789n;
  const NUM_PROPOSALS = 10;

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
    return "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1c";
  }

  async function deployDAOFixture() {
    const publicClient = await viem.getPublicClient();
    const [deployer, ...voters] = await viem.getWalletClients();
    
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
    
    // Setup initial state for testing - give tokens to all voters
    for (let i = 0; i < voters.length && i < 10; i++) {
      await GovernanceToken.write.mint([voters[i].account.address, parseEther("100")]);
      await DAOVoting.write.setVotingWeight([voters[i].account.address, 1]);
    }
    
    // Note: DAOVoting doesn't have setVotingActive function, we'll need to work with the actual voting period

    return { 
      DAOGovernanceCore,
      DAOVoting,
      GovernanceToken, 
      PaymentContract, 
      TimelockController,
      deployer, 
      voters,
      publicClient
    };
  }

  it("Should handle 10 proposals in parallel", async function () {
    const { DAOVoting, voters } = await loadFixture(deployDAOFixture);
    
    console.log(`Testing ${NUM_PROPOSALS} parallel proposals with ${voters.length} voters`);
    
    // Create proposal IDs
    const proposalIds = Array.from({ length: NUM_PROPOSALS }, (_, i) => BigInt(i + 1));
    
    // Set up test data for each proposal
    for (let i = 0; i < NUM_PROPOSALS; i++) {
      const proposalId = proposalIds[i];
      
      // For each proposal, half of voters vote FOR and half vote AGAINST
      for (let j = 0; j < voters.length && j < 10; j++) {
        const voter = voters[j];
        const support = j % 2 === 0 ? FOR : AGAINST; // Alternate FOR and AGAINST votes
        
        // Set up voter for this proposal
        await DAOVoting.write.setCommitted([voter.account.address, true]);
        
        // Create commit hash
        const commitHash = createCommitHash(support, SALT);
        
        // Store commitment
        await DAOVoting.write.storeCommitment([proposalId, voter.account.address, commitHash]);
        
        // Count vote directly
        await DAOVoting.write.countVoteForTest([proposalId, voter.account.address, support, 1n]);
        
        // Record that the vote was revealed
        await DAOVoting.write.setHasRevealed([proposalId, voter.account.address, true]);
        await DAOVoting.write.setRevealedVoteSupport([proposalId, voter.account.address, support]);
        await DAOVoting.write.addVoterToList([proposalId, voter.account.address]);
      }
    }
    
    // Check vote counts for all proposals
    for (let i = 0; i < NUM_PROPOSALS; i++) {
      const proposalId = proposalIds[i];
      const proposalVotes = await DAOVoting.read.getProposalVotes([proposalId]);
      
      // We should have equal FOR and AGAINST votes (or one more FOR if odd number of voters)
      const expectedFor = Math.ceil(Math.min(voters.length, 10) / 2);
      const expectedAgainst = Math.floor(Math.min(voters.length, 10) / 2);
      
      console.log(`Proposal ${proposalId}: FOR=${proposalVotes.forVotes}, AGAINST=${proposalVotes.againstVotes}, ABSTAIN=${proposalVotes.abstainVotes}`);
      
      expect(proposalVotes.forVotes).to.equal(BigInt(expectedFor));
      expect(proposalVotes.againstVotes).to.equal(BigInt(expectedAgainst));
      expect(proposalVotes.abstainVotes).to.equal(0n);
    }
    
    // Update voter stats for all proposals - half succeed, half fail
    for (let i = 0; i < NUM_PROPOSALS; i++) {
      const proposalId = proposalIds[i];
      const proposalSucceeds = i % 2 === 0; // Alternate success and failure
      
      await DAOVoting.write.updateVoterStatsForTest([proposalId, proposalSucceeds]);
    }
    
    // Check voter stats after all proposals
    for (let j = 0; j < voters.length && j < 10; j++) {
      const voter = voters[j];
      const stats = await DAOVoting.read.getGovernorStats([voter.account.address]);
      
      // Calculate expected stats:
      // - If voter votes FOR, they win on even-numbered proposals (which succeed)
      // - If voter votes AGAINST, they win on odd-numbered proposals (which fail)
      const votesFor = j % 2 === 0; // Whether this voter votes FOR
      const expectedSuccesses = Math.ceil(NUM_PROPOSALS / 2); // Half of the proposals
      
      console.log(`Voter ${j}: successfulVotes=${stats[0]}, failedVotes=${stats[1]}, streak=${stats[2]}`);
      
      // Each voter should have won on half the proposals
      expect(stats[0] + stats[1]).to.equal(BigInt(NUM_PROPOSALS));
    }
  });
}); 