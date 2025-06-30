import { expect } from "chai";
import { parseEther, keccak256, toHex, encodeAbiParameters } from "viem";
import { viem } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { parseAbiItem } from 'viem';
import { time } from "@nomicfoundation/hardhat-network-helpers";

// Helper function to create a commit hash like the contract does
function createCommitHash(support: number, salt: number): string {
  return keccak256(encodeAbiParameters(
    [{ type: 'uint8' }, { type: 'uint256' }],
    [support, salt]
  ));
}

async function deployDisputeResolutionFixture() {
  const publicClient = await viem.getPublicClient();
  const [deployer, buyer, seller, daoMember1, daoMember2, daoMember3] = await viem.getWalletClients();
  
  // Deploy TimelockController
  const minDelay = 1; // 1 second for testing
  const proposers = [deployer.account.address];
  const executors = [deployer.account.address];
  
  const timelockController = await viem.deployContract("TimelockController", [
    minDelay,
    proposers,
    executors,
    deployer.account.address
  ]);
  
  // Deploy DAOVoting with deployer as the owner
  const daoVoting = await viem.deployContract("DAOVoting", [
    deployer.account.address
  ]);
  
  // Deploy DAOGovernanceCore
  const standardTransactionPower = parseEther("1"); // 1 ETH minimum payment
  const initialQuorumNumerator = 50; // 50% quorum
  
  const daoGovernanceCore = await viem.deployContract("DAOGovernanceCore", [
    timelockController.address,
    "0x0000000000000000000000000000000000000000", // Will set payment contract later
    standardTransactionPower,
    initialQuorumNumerator
  ]);
  
  // Deploy payment contract
  const paymentContract = await viem.deployContract("paymentContract", [
    daoGovernanceCore.address // Use governance core as the DAO address
  ]);
  
  // Update the payment contract address in the governance core
  await daoGovernanceCore.write.setPaymentContract([
    paymentContract.address
  ], {
    account: deployer.account.address
  });
  
  // Set up the governance system
  await timelockController.write.grantRole([
    "0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1", // PROPOSER_ROLE
    daoGovernanceCore.address
  ]);
  
  await timelockController.write.grantRole([
    "0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63", // EXECUTOR_ROLE
    daoGovernanceCore.address
  ]);
  
  await timelockController.write.grantRole([
    "0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63", // EXECUTOR_ROLE
    "0x0000000000000000000000000000000000000000" // Allow anyone to execute
  ]);
  
  // Set voting contract in governance core using the initialization function
  await daoGovernanceCore.write.initializeVotingContract([
    daoVoting.address
  ], {
    account: deployer.account.address
  });
  
  // Set governance contract in voting contract
  await daoVoting.write.setGovernanceContract([
    daoGovernanceCore.address
  ], {
    account: deployer.account.address
  });
  
  // Activate voting for testing
  await daoGovernanceCore.write.setVotingActive([true], {
    account: deployer.account.address
  });
  
  // Make members join the DAO
  // First they need to make payments
  const paymentAmount = parseEther("2"); // 2 ETH payment
  
  // Register seller
  await paymentContract.write.registerAsSeller(["location1", []], {
    account: seller.account.address
  });
  
  // Make payments from DAO members
  await paymentContract.write.pay([seller.account.address, "location1"], {
    value: paymentAmount,
    account: daoMember1.account.address
  });
  
  await paymentContract.write.pay([seller.account.address, "location1"], {
    value: paymentAmount,
    account: daoMember2.account.address
  });
  
  await paymentContract.write.pay([seller.account.address, "location1"], {
    value: paymentAmount,
    account: daoMember3.account.address
  });
  
  // Make payment from buyer (so they can join the DAO)
  await paymentContract.write.pay([seller.account.address, "location1"], {
    value: paymentAmount,
    account: buyer.account.address
  });
  
  // Join the DAO
  await daoGovernanceCore.write.joinDAO([daoGovernanceCore.address], {
    account: daoMember1.account.address
  });
  
  await daoGovernanceCore.write.joinDAO([daoGovernanceCore.address], {
    account: daoMember2.account.address
  });
  
  await daoGovernanceCore.write.joinDAO([daoGovernanceCore.address], {
    account: daoMember3.account.address
  });
  
  await daoGovernanceCore.write.joinDAO([daoGovernanceCore.address], {
    account: buyer.account.address
  });
  
  return {
    publicClient,
    paymentContract,
    daoGovernanceCore,
    daoVoting,
    timelockController,
    deployer,
    buyer,
    seller,
    daoMember1,
    daoMember2,
    daoMember3
  };
}

describe("Dispute Resolution", function() {
  describe("reportTransactionPetition", function() {
    it("should create a governance proposal when a dispute is reported", async function() {
      const { 
        publicClient, 
        paymentContract, 
        daoGovernanceCore, 
        buyer, 
        seller 
      } = await loadFixture(deployDisputeResolutionFixture);
      
      // Buyer makes a payment
      const paymentAmount = parseEther("2");
      const payTxHash = await paymentContract.write.pay([seller.account.address, "location1"], {
        value: paymentAmount,
        account: buyer.account.address
      });
      
      // Get the payment timestamp
      const payReceipt = await publicClient.waitForTransactionReceipt({ hash: payTxHash });
      const block = await publicClient.getBlock({ blockHash: payReceipt.blockHash });
      const paymentTimestamp = block.timestamp;
      
      // Store the payment timestamp for later use
      console.log("Payment timestamp:", paymentTimestamp);
      
      // Check payment record
      const payment = await paymentContract.read.getPayment([seller.account.address, buyer.account.address]);
      console.log("Payment amount:", payment.toString());
      
      // Get transaction ID
      const transactionId = await paymentContract.read.buyerSellerToTransactionId([buyer.account.address, seller.account.address]);
      console.log("Transaction ID:", transactionId.toString());
      
      // Add a small delay to ensure transaction is fully processed
      await time.increase(10);
      
      // Report a dispute
      const disputeTxHash = await paymentContract.write.reportTransactionPetition(
        [seller.account.address, "Item not as described"],
        { account: buyer.account.address }
      );
      
      const disputeReceipt = await publicClient.waitForTransactionReceipt({ hash: disputeTxHash });
      expect(disputeReceipt.status).to.equal("success");
      
      // Check that a dispute event was emitted
      const disputeLogs = await publicClient.getLogs({
        address: paymentContract.address,
        event: parseAbiItem('event DisputeCreated(address indexed buyer, address indexed seller, uint256 transactionId, uint256 proposalId)'),
        fromBlock: disputeReceipt.blockNumber,
        toBlock: disputeReceipt.blockNumber
      });
      
      expect(disputeLogs.length).to.be.greaterThan(0);
      const proposalId = disputeLogs[0].args.proposalId;
      expect(proposalId).to.not.equal(0n);
    });
    
    it("should send funds to seller if proposal is defeated", async function() {
      const { 
        publicClient, 
        paymentContract, 
        daoGovernanceCore, 
        daoVoting,
        buyer, 
        seller,
        daoMember1,
        daoMember2,
        daoMember3
      } = await loadFixture(deployDisputeResolutionFixture);
      
      // Get seller's initial balance
      const sellerBalanceBefore = await publicClient.getBalance({
        address: seller.account.address
      });
      
      // Buyer makes a payment
      const paymentAmount = parseEther("2");
      const payTxHash = await paymentContract.write.pay([seller.account.address, "location1"], {
        value: paymentAmount,
        account: buyer.account.address
      });
      
      // Get the payment timestamp
      const payReceipt = await publicClient.waitForTransactionReceipt({ hash: payTxHash });
      const block = await publicClient.getBlock({ blockHash: payReceipt.blockHash });
      const paymentTimestamp = block.timestamp;
      
      // Store the payment timestamp for later use
      console.log("Payment timestamp:", paymentTimestamp);
      
      // Check payment record
      const payment = await paymentContract.read.getPayment([seller.account.address, buyer.account.address]);
      console.log("Payment amount:", payment.toString());
      
      // Get transaction ID
      const transactionId = await paymentContract.read.buyerSellerToTransactionId([buyer.account.address, seller.account.address]);
      console.log("Transaction ID:", transactionId.toString());
      
      // Add a small delay to ensure transaction is fully processed
      await time.increase(10);
      
      // Report a dispute
      const disputeTxHash = await paymentContract.write.reportTransactionPetition(
        [seller.account.address, "Item not as described"],
        { account: buyer.account.address }
      );
      
      const disputeReceipt = await publicClient.waitForTransactionReceipt({ hash: disputeTxHash });
      const disputeLogs = await publicClient.getLogs({
        address: paymentContract.address,
        event: parseAbiItem('event DisputeCreated(address indexed buyer, address indexed seller, uint256 transactionId, uint256 proposalId)'),
        fromBlock: disputeReceipt.blockNumber,
        toBlock: disputeReceipt.blockNumber
      });
      
      const proposalId = disputeLogs[0].args.proposalId;
      
      // Get proposal details
      const proposalSnapshot = await daoGovernanceCore.read.proposalSnapshot([proposalId]);
      const proposalDeadline = await daoGovernanceCore.read.proposalDeadline([proposalId]);
      const commitDeadline = await daoGovernanceCore.read.commitDeadline([proposalId]);
      
      console.log("Proposal snapshot:", proposalSnapshot.toString());
      console.log("Proposal deadline:", proposalDeadline.toString());
      console.log("Commit deadline:", commitDeadline.toString());
      
      // All members vote AGAINST the proposal (vote = 0)
      // This will result in the proposal being defeated and funds going to the seller
      
      // Create commit hashes for votes (0 = against)
      const voteSupport = 0; // 0 = against
      const salt = 0; // Simple salt for testing
      
      // Create the commit hash using our helper function
      const commitHash = createCommitHash(voteSupport, salt);
      
      // Store commitments directly using the helper functions
      // This is equivalent to calling commitVote but allows us to bypass the timing checks
      
      // Store commitment for daoMember1
      await daoVoting.write.storeCommitment([
        proposalId,
        daoMember1.account.address,
        commitHash
      ]);
      
      // Store commitment for daoMember2
      await daoVoting.write.storeCommitment([
        proposalId,
        daoMember2.account.address,
        commitHash
      ]);
      
      // Store commitment for daoMember3
      await daoVoting.write.storeCommitment([
        proposalId,
        daoMember3.account.address,
        commitHash
      ]);
      
      // Move time to after commit deadline but before proposal deadline
      await time.increaseTo(Number(commitDeadline) + 1);
      
      // Reveal votes during the reveal period
      await daoVoting.write.revealVote([proposalId, 0, 0], {
        account: daoMember1.account.address
      });
      
      await daoVoting.write.revealVote([proposalId, 0, 0], {
        account: daoMember2.account.address
      });
      
      await daoVoting.write.revealVote([proposalId, 0, 0], {
        account: daoMember3.account.address
      });
      
      // Move time to after proposal deadline
      await time.increaseTo(Number(proposalDeadline) + 1);
      
      // Check dispute resolution
      await paymentContract.write.checkDisputeResolution([proposalId], {
        account: buyer.account.address
      });
      
      // Check seller's balance after resolution
      const sellerBalanceAfter = await publicClient.getBalance({
        address: seller.account.address
      });
      
      // Verify that the seller received the funds
      expect(sellerBalanceAfter).to.be.greaterThan(sellerBalanceBefore);
      // The seller should receive the escrow amount, which is 98% of the payment (2% fee)
      const escrowAmount = paymentAmount * 98n / 100n;
      expect(sellerBalanceAfter - sellerBalanceBefore).to.equal(escrowAmount);
    });
  });
}); 