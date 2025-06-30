import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Marketplace Governance Tests", function () {
  let paymentContract: Contract;
  let daoGovernanceCore: Contract;
  let daoVoting: Contract;
  let timelock: Contract;
  let owner: any;
  let seller1: any;
  let seller2: any;
  let buyer1: any;
  let buyer2: any;
  let seller1Address: string;
  let seller2Address: string;
  let buyer1Address: string;
  let buyer2Address: string;
  let ownerAddress: string;

  const standardTransactionPower = ethers.parseEther("0.01");
  const initialQuorumNumerator = 10; // 10% quorum
  
  beforeEach(async function () {
    [owner, seller1, seller2, buyer1, buyer2] = await ethers.getSigners();
    ownerAddress = await owner.getAddress();
    seller1Address = await seller1.getAddress();
    seller2Address = await seller2.getAddress();
    buyer1Address = await buyer1.getAddress();
    buyer2Address = await buyer2.getAddress();

    // Deploy TimelockController
    const TimelockControllerFactory = await ethers.getContractFactory("TimelockController");
    const minDelay = 1; // 1 second for testing
    const proposers = [ownerAddress];
    const executors = [ownerAddress];
    timelock = await TimelockControllerFactory.deploy(minDelay, proposers, executors, ownerAddress);
    
    // Deploy payment contract first (temporarily with a dummy address)
    const PaymentContract = await ethers.getContractFactory("paymentContract");
    paymentContract = await PaymentContract.deploy(ownerAddress);

    // Deploy DAOGovernanceCore
    const DAOGovernanceCore = await ethers.getContractFactory("DAOGovernanceCore");
    daoGovernanceCore = await DAOGovernanceCore.deploy(
      await timelock.getAddress(),
      await paymentContract.getAddress(),
      standardTransactionPower,
      initialQuorumNumerator
    );

    // Deploy DAOVoting
    const DAOVoting = await ethers.getContractFactory("DAOVoting");
    daoVoting = await DAOVoting.deploy(await daoGovernanceCore.getAddress());

    // Set voting contract in governance core
    await daoGovernanceCore.setVotingContract(await daoVoting.getAddress());

    // Redeploy payment contract with correct DAO address
    paymentContract = await PaymentContract.deploy(await daoGovernanceCore.getAddress());

    // For testing, set voting active
    await daoGovernanceCore.setVotingActive(true);
  });

  describe("Escrow Payment Support", function () {
    it("Should register a seller and process an escrow payment", async function () {
      // Register seller1
      await paymentContract.connect(seller1).registerAsSeller();
      
      // Verify seller is registered
      const sellerProfile = await paymentContract.sellerProfiles(seller1Address);
      expect(sellerProfile.isRegistered).to.be.true;
      
      // Make a payment
      const paymentAmount = ethers.parseEther("0.1");
      await paymentContract.connect(buyer1).pay(seller1Address, { value: paymentAmount });
      
      // Check escrow balance
      const marketplaceStats = await paymentContract.getMarketplaceStats();
      const feePercentage = marketplaceStats[0];
      const expectedFee = (paymentAmount * BigInt(feePercentage)) / 100n;
      const expectedEscrow = paymentAmount - expectedFee;
      
      expect(marketplaceStats[1]).to.equal(expectedFee); // feesCollected
      expect(marketplaceStats[2]).to.equal(expectedEscrow); // escrowHeld
      
      // Verify payment record
      const payment = await paymentContract.getPayment(seller1Address, buyer1Address);
      expect(payment).to.equal(expectedEscrow);
    });

    it("Should allow buyer to acknowledge receipt and release escrow", async function () {
      // Register seller
      await paymentContract.connect(seller1).registerAsSeller();
      
      // Make a payment
      const paymentAmount = ethers.parseEther("0.1");
      await paymentContract.connect(buyer1).pay(seller1Address, { value: paymentAmount });
      
      // Get seller's balance before acknowledgment
      const sellerBalanceBefore = await ethers.provider.getBalance(seller1Address);
      
      // Acknowledge receipt
      await paymentContract.connect(buyer1).acknowledgeGoodsReceiption(seller1Address);
      
      // Get seller's balance after acknowledgment
      const sellerBalanceAfter = await ethers.provider.getBalance(seller1Address);
      
      // Calculate expected escrow amount (payment minus fee)
      const feePercentage = await paymentContract.marketplaceFeePercentage();
      const expectedFee = (paymentAmount * BigInt(feePercentage)) / 100n;
      const expectedEscrow = paymentAmount - expectedFee;
      
      // Verify seller received the escrow amount
      expect(sellerBalanceAfter - sellerBalanceBefore).to.equal(expectedEscrow);
      
      // Verify escrow is now 0
      const marketplaceStats = await paymentContract.getMarketplaceStats();
      expect(marketplaceStats[2]).to.equal(0); // escrowHeld
      
      // Verify seller's sales count increased
      const sellerProfile = await paymentContract.sellerProfiles(seller1Address);
      expect(sellerProfile.totalSales).to.equal(1);
    });
  });

  describe("Treasury Management", function () {
    it("Should collect fees in treasury", async function () {
      // Register seller
      await paymentContract.connect(seller1).registerAsSeller();
      
      // Make multiple payments
      const paymentAmount = ethers.parseEther("0.1");
      await paymentContract.connect(buyer1).pay(seller1Address, { value: paymentAmount });
      await paymentContract.connect(buyer2).pay(seller1Address, { value: paymentAmount });
      
      // Calculate expected fees
      const feePercentage = await paymentContract.marketplaceFeePercentage();
      const expectedFeePerPayment = (paymentAmount * BigInt(feePercentage)) / 100n;
      const totalExpectedFees = expectedFeePerPayment * 2n;
      
      // Verify fees collected
      const marketplaceStats = await paymentContract.getMarketplaceStats();
      expect(marketplaceStats[1]).to.equal(totalExpectedFees); // feesCollected
    });

    it("Should allow DAO to withdraw fees", async function () {
      // Register seller
      await paymentContract.connect(seller1).registerAsSeller();
      
      // Make a payment
      const paymentAmount = ethers.parseEther("0.1");
      await paymentContract.connect(buyer1).pay(seller1Address, { value: paymentAmount });
      
      // Calculate expected fee
      const feePercentage = await paymentContract.marketplaceFeePercentage();
      const expectedFee = (paymentAmount * BigInt(feePercentage)) / 100n;
      
      // Get recipient balance before withdrawal
      const recipientBalanceBefore = await ethers.provider.getBalance(buyer2Address);
      
      // Withdraw fees (as DAO)
      await paymentContract.connect(owner).withdrawFees(buyer2Address, expectedFee);
      
      // Get recipient balance after withdrawal
      const recipientBalanceAfter = await ethers.provider.getBalance(buyer2Address);
      
      // Verify recipient received the fees
      expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(expectedFee);
      
      // Verify fees collected is now 0
      const marketplaceStats = await paymentContract.getMarketplaceStats();
      expect(marketplaceStats[1]).to.equal(0); // feesCollected
    });
  });

  describe("Delisting Reported Sellers", function () {
    it("Should allow reporting and delisting of sellers selling illicit goods", async function () {
      // Register seller
      await paymentContract.connect(seller1).registerAsSeller();
      
      // Join DAO to be able to create proposals
      await paymentContract.connect(buyer1).pay(seller1Address, { value: ethers.parseEther("0.1") });
      await daoGovernanceCore.connect(buyer1).joinDAO(await daoGovernanceCore.getAddress());
      
      // Report seller for illicit goods
      await paymentContract.connect(buyer1).reportIllicitGoods(seller1Address, "Selling prohibited items");
      
      // Delist the seller (simulating governance approval)
      await paymentContract.connect(owner).delistSeller(seller1Address, "Found selling prohibited items");
      
      // Verify seller is delisted
      const sellerProfile = await paymentContract.sellerProfiles(seller1Address);
      expect(sellerProfile.isDelisted).to.be.true;
      
      // Try to make a payment to delisted seller (should fail)
      await expect(
        paymentContract.connect(buyer2).pay(seller1Address, { value: ethers.parseEther("0.05") })
      ).to.be.revertedWith("Seller has been delisted from the marketplace");
    });

    it("Should allow DAO to reinstate a delisted seller", async function () {
      // Register seller
      await paymentContract.connect(seller1).registerAsSeller();
      
      // Delist the seller
      await paymentContract.connect(owner).delistSeller(seller1Address, "Test delisting");
      
      // Verify seller is delisted
      let sellerProfile = await paymentContract.sellerProfiles(seller1Address);
      expect(sellerProfile.isDelisted).to.be.true;
      
      // Reinstate the seller
      await paymentContract.connect(owner).reinstateSeller(seller1Address);
      
      // Verify seller is reinstated
      sellerProfile = await paymentContract.sellerProfiles(seller1Address);
      expect(sellerProfile.isDelisted).to.be.false;
      
      // Verify payments can be made to reinstated seller
      await paymentContract.connect(buyer1).pay(seller1Address, { value: ethers.parseEther("0.05") });
      const payment = await paymentContract.getPayment(seller1Address, buyer1Address);
      expect(payment).to.be.gt(0);
    });
  });
}); 