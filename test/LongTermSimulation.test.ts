import { expect } from "chai";
import { viem } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { parseEther, keccak256, encodeAbiParameters } from "viem";

describe("Long-Term DAO Simulation (1 Month)", function () {
  // Set longer timeout for this test
  this.timeout(120000); // 2 minutes

  // Constants
  const AGAINST = 0;
  const FOR = 1;
  const ABSTAIN = 2;
  const SALT = 123456789n;
  // Use a smaller number of participants that fits within available test accounts
  const NUM_PARTICIPANTS = 15; // Reduced from 100 to work with available accounts
  const NUM_PROPOSALS = 30; // ~1 proposal per day for a month
  
  // Helper function to create a commitment hash
  function createCommitHash(support: number, salt: bigint) {
    return keccak256(
      encodeAbiParameters(
        [{ type: "uint8" }, { type: "uint256" }],
        [support, salt]
      )
    );
  }

  async function deployDAOFixture() {
    console.log(`Setting up DAO simulation with ${NUM_PARTICIPANTS} participants and ${NUM_PROPOSALS} proposals...`);
    
    const [deployer, ...voters] = await viem.getWalletClients();
    
    // Ensure we have enough test accounts
    expect(voters.length).to.be.at.least(NUM_PARTICIPANTS, "Not enough test accounts available");
    
    // Deploy TimelockController
    const TimelockController = await viem.deployContract("TimelockController", [
      1n, // minDelay (1 second for testing)
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
    
    // Deploy GovernorsRewardPay contract
    const GovernorsRewardPay = await viem.deployContract("GovernorsRewardPay", [
      DAOVoting.address, // votingContract
      GovernanceToken.address, // rewardToken
      parseEther("0.1"), // baseReward (0.1 ETH equivalent)
      10n, // rewardMultiplierPercentage (10%)
      300n, // maxMultiplier (300%)
      deployer.account.address // initialOwner
    ]);
    
    // Set up contract relationships
    await DAOVoting.write.setGovernanceContract([DAOGovernanceCore.address]);
    await DAOGovernanceCore.write.setVotingContract([DAOVoting.address]);
    
    console.log("Setting up participants...");
    // Setup initial state for testing - give tokens to all participants
    for (let i = 0; i < NUM_PARTICIPANTS; i++) {
      const voter = voters[i];
      await GovernanceToken.write.mint([voter.account.address, parseEther("100")]);
      await DAOVoting.write.setVotingWeight([voter.account.address, 1]);
      
      // For testing purposes, set all participants as committed
      await DAOVoting.write.setCommitted([voter.account.address, true]);
    }
    
    // Mint tokens to reward treasury
    await GovernanceToken.write.mint([GovernorsRewardPay.address, parseEther("10000")]);
    
    return { 
      DAOGovernanceCore,
      DAOVoting,
      GovernanceToken, 
      PaymentContract, 
      TimelockController,
      GovernorsRewardPay,
      deployer,
      voters: voters.slice(0, NUM_PARTICIPANTS)
    };
  }

  it(`Should simulate 1 month of DAO activity with ${NUM_PARTICIPANTS} participants`, async function () {
    const { DAOVoting, GovernanceToken, GovernorsRewardPay, voters } = await loadFixture(deployDAOFixture);
    
    console.log(`Simulating ${NUM_PROPOSALS} proposals over 1 month with ${NUM_PARTICIPANTS} participants`);
    
    // Track voting statistics
    const voteStats = {
      totalVotes: 0,
      forVotes: 0,
      againstVotes: 0,
      abstainVotes: 0,
      successfulProposals: 0,
      failedProposals: 0
    };
    
    // Track voter performance
    const voterPerformance = new Array(NUM_PARTICIPANTS).fill(0).map(() => ({
      successfulVotes: 0,
      failedVotes: 0,
      totalRewards: 0n
    }));
    
    // Simulate proposals over a month
    for (let proposalId = 1; proposalId <= NUM_PROPOSALS; proposalId++) {
      console.log(`Processing proposal ${proposalId}...`);
      
      // For each proposal, have participants vote with different distributions
      // We'll simulate different voting patterns:
      // - Some proposals are controversial (close to 50/50)
      // - Some have strong support (70%+ FOR)
      // - Some have strong opposition (70%+ AGAINST)
      
      let forVoters = 0;
      let againstVoters = 0;
      let abstainVoters = 0;
      
      // Determine proposal type
      const proposalType = proposalId % 3;
      let forProbability: number;
      
      if (proposalType === 0) {
        // Controversial proposal (close to 50/50)
        forProbability = 0.5;
      } else if (proposalType === 1) {
        // Strong support (70%+ FOR)
        forProbability = 0.7;
      } else {
        // Strong opposition (70%+ AGAINST)
        forProbability = 0.3;
      }
      
      // Process votes for this proposal
      for (let i = 0; i < NUM_PARTICIPANTS; i++) {
        const voter = voters[i];
        
        // Determine vote (FOR, AGAINST, or ABSTAIN)
        // Some voters may abstain (5% chance)
        let support: number;
        const rand = Math.random();
        
        if (rand < 0.05) {
          // 5% chance to abstain
          support = ABSTAIN;
          abstainVoters++;
        } else if (rand < forProbability + 0.05) {
          // Probability to vote FOR based on proposal type
          support = FOR;
          forVoters++;
        } else {
          // Remaining probability to vote AGAINST
          support = AGAINST;
          againstVoters++;
        }
        
        // Create commit hash
        const commitHash = createCommitHash(support, SALT);
        
        // Store commitment
        await DAOVoting.write.storeCommitment([BigInt(proposalId), voter.account.address, commitHash]);
        
        // Count vote directly
        await DAOVoting.write.countVoteForTest([BigInt(proposalId), voter.account.address, support, 1n]);
        
        // Record that the vote was revealed
        await DAOVoting.write.setHasRevealed([BigInt(proposalId), voter.account.address, true]);
        await DAOVoting.write.setRevealedVoteSupport([BigInt(proposalId), voter.account.address, support]);
        await DAOVoting.write.addVoterToList([BigInt(proposalId), voter.account.address]);
        
        // Update vote statistics
        voteStats.totalVotes++;
        if (support === FOR) voteStats.forVotes++;
        else if (support === AGAINST) voteStats.againstVotes++;
        else voteStats.abstainVotes++;
      }
      
      // Determine if proposal succeeded (more FOR than AGAINST votes)
      const proposalSucceeded = forVoters > againstVoters;
      
      // Update proposal statistics
      if (proposalSucceeded) {
        voteStats.successfulProposals++;
      } else {
        voteStats.failedProposals++;
      }
      
      console.log(`Proposal ${proposalId} results: FOR=${forVoters}, AGAINST=${againstVoters}, ABSTAIN=${abstainVoters}, Success=${proposalSucceeded}`);
      
      // Update voter stats for this proposal
      await DAOVoting.write.updateVoterStatsForTest([BigInt(proposalId), proposalSucceeded]);
    }
    
    // Print overall voting statistics
    console.log("\nVoting Statistics:");
    console.log(`Total Votes Cast: ${voteStats.totalVotes}`);
    console.log(`FOR Votes: ${voteStats.forVotes} (${(voteStats.forVotes / voteStats.totalVotes * 100).toFixed(2)}%)`);
    console.log(`AGAINST Votes: ${voteStats.againstVotes} (${(voteStats.againstVotes / voteStats.totalVotes * 100).toFixed(2)}%)`);
    console.log(`ABSTAIN Votes: ${voteStats.abstainVotes} (${(voteStats.abstainVotes / voteStats.totalVotes * 100).toFixed(2)}%)`);
    console.log(`Successful Proposals: ${voteStats.successfulProposals} (${(voteStats.successfulProposals / NUM_PROPOSALS * 100).toFixed(2)}%)`);
    console.log(`Failed Proposals: ${voteStats.failedProposals} (${(voteStats.failedProposals / NUM_PROPOSALS * 100).toFixed(2)}%)`);
    
    // Process reward distribution
    console.log("\nProcessing reward distribution...");
    
    // Check initial treasury balance
    const initialTreasuryBalance = await GovernanceToken.read.balanceOf([GovernorsRewardPay.address]);
    console.log(`Initial treasury balance: ${initialTreasuryBalance / BigInt(10**18)} tokens`);
    
    // Let each participant claim their rewards
    for (let i = 0; i < NUM_PARTICIPANTS; i++) {
      const voter = voters[i];
      
      // Get voter stats
      const stats = await DAOVoting.read.getGovernorStats([voter.account.address]);
      const successfulVotes = stats[0];
      const failedVotes = stats[1];
      const streak = Number(stats[2]);
      
      // Update voter performance tracking
      voterPerformance[i].successfulVotes = Number(successfulVotes);
      voterPerformance[i].failedVotes = Number(failedVotes);
      
      // Get expected reward
      const expectedReward = await GovernorsRewardPay.read.getClaimableReward([voter.account.address]);
      
      if (expectedReward > 0n) {
        // Check initial balance
        const initialBalance = await GovernanceToken.read.balanceOf([voter.account.address]);
        
        // Claim reward
        await GovernorsRewardPay.write.claimReward({
          account: voter.account
        });
        
        // Check new balance
        const newBalance = await GovernanceToken.read.balanceOf([voter.account.address]);
        const actualReward = newBalance - initialBalance;
        
        // Update tracking
        voterPerformance[i].totalRewards = actualReward;
        
        // Verify reward amount
        expect(actualReward).to.equal(expectedReward);
      }
    }
    
    // Check final treasury balance
    const finalTreasuryBalance = await GovernanceToken.read.balanceOf([GovernorsRewardPay.address]);
    const totalRewardsDistributed = initialTreasuryBalance - finalTreasuryBalance;
    
    console.log(`Final treasury balance: ${finalTreasuryBalance / BigInt(10**18)} tokens`);
    console.log(`Total rewards distributed: ${totalRewardsDistributed / BigInt(10**18)} tokens`);
    
    // Calculate and display reward statistics
    const totalSuccessfulVotes = voterPerformance.reduce((sum, voter) => sum + voter.successfulVotes, 0);
    const totalFailedVotes = voterPerformance.reduce((sum, voter) => sum + voter.failedVotes, 0);
    const totalRewards = voterPerformance.reduce((sum, voter) => sum + voter.totalRewards, 0n);
    
    // Sort participants by rewards to find top performers
    const sortedPerformers = [...voterPerformance]
      .map((perf, index) => ({ index, ...perf }))
      .sort((a, b) => Number(b.totalRewards - a.totalRewards));
    
    console.log("\nReward Distribution Statistics:");
    console.log(`Total Successful Votes: ${totalSuccessfulVotes}`);
    console.log(`Total Failed Votes: ${totalFailedVotes}`);
    console.log(`Average Reward Per Participant: ${Number(totalRewards / BigInt(NUM_PARTICIPANTS)) / 10**18} tokens`);
    
    if (totalSuccessfulVotes > 0) {
      console.log(`Average Reward Per Successful Vote: ${Number(totalRewards / BigInt(totalSuccessfulVotes)) / 10**18} tokens`);
    } else {
      console.log(`Average Reward Per Successful Vote: N/A (no successful votes)`);
    }
    
    console.log("\nTop 5 Performers (or all if fewer):");
    const topCount = Math.min(5, sortedPerformers.length);
    for (let i = 0; i < topCount; i++) {
      const performer = sortedPerformers[i];
      console.log(`Participant ${performer.index}: ${Number(performer.totalRewards) / 10**18} tokens (${performer.successfulVotes} successful votes, ${performer.failedVotes} failed votes)`);
    }
    
    if (sortedPerformers.length > 5) {
      console.log("\nBottom 5 Performers:");
      for (let i = Math.max(topCount, sortedPerformers.length - 5); i < sortedPerformers.length; i++) {
        const performer = sortedPerformers[i];
        console.log(`Participant ${performer.index}: ${Number(performer.totalRewards) / 10**18} tokens (${performer.successfulVotes} successful votes, ${performer.failedVotes} failed votes)`);
      }
    }
    
    // Final verification
    console.log("\nSimulation completed successfully!");
  });
});