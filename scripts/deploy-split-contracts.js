const { viem } = require("hardhat");

async function main() {
  console.log("Deploying split DAO contracts...");
  
  const [deployer] = await viem.getWalletClients();
  console.log(`Deploying from address: ${deployer.account.address}`);
  
  // Deploy libraries first
  console.log("Deploying DAOVotingLibrary...");
  const DAOVotingLibrary = await viem.deployContract("DAOVotingLibrary");
  console.log(`DAOVotingLibrary deployed to: ${DAOVotingLibrary.address}`);
  
  console.log("Deploying DAOSignatureLibrary...");
  const DAOSignatureLibrary = await viem.deployContract("DAOSignatureLibrary");
  console.log(`DAOSignatureLibrary deployed to: ${DAOSignatureLibrary.address}`);
  
  // Deploy TimelockController
  console.log("Deploying TimelockController...");
  const TimelockController = await viem.deployContract("TimelockController", [
    1n, // minDelay (1 second for testing)
    [deployer.account.address], // proposers
    [deployer.account.address], // executors
    deployer.account.address // admin
  ]);
  console.log(`TimelockController deployed to: ${TimelockController.address}`);
  
  // Deploy governance token
  console.log("Deploying GovernanceToken...");
  const GovernanceToken = await viem.deployContract("governanceToken", [
    deployer.account.address // initialOwner
  ]);
  console.log(`GovernanceToken deployed to: ${GovernanceToken.address}`);
  
  // Deploy payment contract
  console.log("Deploying PaymentContract...");
  const PaymentContract = await viem.deployContract("paymentContract", [
    deployer.account.address // DAO address
  ]);
  console.log(`PaymentContract deployed to: ${PaymentContract.address}`);
  
  // Deploy DAOVoting contract
  console.log("Deploying DAOVoting...");
  const DAOVoting = await viem.deployContract("DAOVoting", [
    deployer.account.address // initialOwner
  ]);
  console.log(`DAOVoting deployed to: ${DAOVoting.address}`);
  
  // Deploy DAOGovernanceCore contract
  console.log("Deploying DAOGovernanceCore...");
  const DAOGovernanceCore = await viem.deployContract("DAOGovernanceCore", [
    GovernanceToken.address, // token
    TimelockController.address, // timelock
    PaymentContract.address, // paymentContract
    1000000000000000000n // standardTransactionPower (1 ETH)
  ]);
  console.log(`DAOGovernanceCore deployed to: ${DAOGovernanceCore.address}`);
  
  // Deploy GovernorsRewardPay contract
  console.log("Deploying GovernorsRewardPay...");
  const GovernorsRewardPay = await viem.deployContract("GovernorsRewardPay", [
    DAOVoting.address, // votingContract
    GovernanceToken.address, // rewardToken (using governance token as reward)
    100000000000000000n, // baseReward (0.1 ETH equivalent)
    10n, // rewardMultiplierPercentage (10%)
    300n, // maxMultiplier (300%)
    deployer.account.address // initialOwner
  ]);
  console.log(`GovernorsRewardPay deployed to: ${GovernorsRewardPay.address}`);
  
  // Set up contract relationships
  console.log("Setting up contract relationships...");
  
  // Set governance contract in DAOVoting
  console.log("Setting governance contract in DAOVoting...");
  await DAOVoting.write.setGovernanceContract([DAOGovernanceCore.address]);
  
  // Set voting contract in DAOGovernanceCore
  console.log("Setting voting contract in DAOGovernanceCore...");
  await DAOGovernanceCore.write.setVotingContract([DAOVoting.address]);
  
  // Fund the reward treasury
  console.log("Funding the reward treasury...");
  const initialFunding = 1000000000000000000000n; // 1000 tokens
  await GovernanceToken.write.mint([GovernorsRewardPay.address, initialFunding]);
  
  console.log("Deployment complete!");
  console.log("\nDeployment Summary:");
  console.log(`DAOGovernanceCore: ${DAOGovernanceCore.address}`);
  console.log(`DAOVoting: ${DAOVoting.address}`);
  console.log(`DAOVotingLibrary: ${DAOVotingLibrary.address}`);
  console.log(`DAOSignatureLibrary: ${DAOSignatureLibrary.address}`);
  console.log(`GovernanceToken: ${GovernanceToken.address}`);
  console.log(`TimelockController: ${TimelockController.address}`);
  console.log(`PaymentContract: ${PaymentContract.address}`);
  console.log(`GovernorsRewardPay: ${GovernorsRewardPay.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 