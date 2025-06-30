import { viem } from "hardhat";
import { parseEther, Address } from "viem";
import fs from "fs";

async function main() {
  console.log("Starting deployment of DAO contracts...");

  // Get deployer account
  const [deployer] = await viem.getWalletClients();
  console.log(`Deploying contracts with account: ${deployer.account.address}`);

  // Deploy TimelockController
  console.log("Deploying TimelockController...");
  const minDelay = 60n * 60n * 24n; // 1 day in seconds
  const TimelockController = await viem.deployContract("TimelockController", [
    minDelay, // minDelay
    [deployer.account.address], // proposers
    [deployer.account.address], // executors
    deployer.account.address // admin
  ]);
  console.log(`TimelockController deployed to: ${TimelockController.address}`);

  // Deploy governance token
  console.log("Deploying governance token...");
  const GovernanceToken = await viem.deployContract("TestToken", [
    deployer.account.address // initialOwner
  ]);
  console.log(`Governance token deployed to: ${GovernanceToken.address}`);

  // Deploy payment contract
  console.log("Deploying payment contract...");
  const PaymentContract = await viem.deployContract("paymentContract", [
    deployer.account.address // DAO address (will be updated later)
  ]);
  console.log(`Payment contract deployed to: ${PaymentContract.address}`);

  // Deploy DAOVoting contract
  console.log("Deploying DAOVoting contract...");
  const DAOVoting = await viem.deployContract("DAOVoting", [
    deployer.account.address // initialOwner
  ]);
  console.log(`DAOVoting deployed to: ${DAOVoting.address}`);

  // Deploy DAOGovernanceCore contract
  console.log("Deploying DAOGovernanceCore contract...");
  const standardTransactionPower = parseEther("1"); // 1 token as standard transaction power
  const DAOGovernanceCore = await viem.deployContract("DAOGovernanceCore", [
    GovernanceToken.address, // token
    TimelockController.address, // timelock
    PaymentContract.address, // paymentContract
    standardTransactionPower // standardTransactionPower
  ]);
  console.log(`DAOGovernanceCore deployed to: ${DAOGovernanceCore.address}`);

  // Deploy GovernorsRewardPay contract
  console.log("Deploying GovernorsRewardPay contract...");
  const baseReward = parseEther("0.1"); // 0.1 tokens as base reward
  const rewardMultiplierPercentage = 10n; // 10% increase per streak
  const maxMultiplier = 300n; // 300% maximum multiplier
  const GovernorsRewardPay = await viem.deployContract("GovernorsRewardPay", [
    DAOVoting.address, // votingContract
    GovernanceToken.address, // rewardToken
    baseReward, // baseReward
    rewardMultiplierPercentage, // rewardMultiplierPercentage
    maxMultiplier, // maxMultiplier
    deployer.account.address // initialOwner
  ]);
  console.log(`GovernorsRewardPay deployed to: ${GovernorsRewardPay.address}`);

  // Set up contract relationships
  console.log("Setting up contract relationships...");

  // Connect DAOVoting to DAOGovernanceCore
  await DAOVoting.write.setGovernanceContract([DAOGovernanceCore.address]);
  console.log("DAOVoting connected to DAOGovernanceCore");

  // Connect DAOGovernanceCore to DAOVoting
  await DAOGovernanceCore.write.setVotingContract([DAOVoting.address]);
  console.log("DAOGovernanceCore connected to DAOVoting");

  // Update payment contract with DAO address
  await PaymentContract.write.updateDAOAddress([DAOGovernanceCore.address]);
  console.log("Payment contract updated with DAO address");

  // Fund the reward treasury
  const initialTreasuryFunding = parseEther("1000"); // 1000 tokens
  await GovernanceToken.write.mint([GovernorsRewardPay.address, initialTreasuryFunding]);
  console.log(`Funded reward treasury with ${initialTreasuryFunding / BigInt(10**18)} tokens`);

  // Define deployment info interface
  interface DeploymentInfo {
    network: string;
    timestamp: string;
    deployer: Address;
    contracts: {
      TimelockController: Address;
      GovernanceToken: Address;
      PaymentContract: Address;
      DAOVoting: Address;
      DAOGovernanceCore: Address;
      GovernorsRewardPay: Address;
    };
    constructorArgs: {
      TimelockController: {
        minDelay: number;
        proposers: Address[];
        executors: Address[];
        admin: Address;
      };
      GovernanceToken: {
        initialOwner: Address;
      };
      PaymentContract: {
        initialDAOAddress: Address;
      };
      DAOVoting: {
        initialOwner: Address;
      };
      DAOGovernanceCore: {
        token: Address;
        timelock: Address;
        paymentContract: Address;
        standardTransactionPower: string;
      };
      GovernorsRewardPay: {
        votingContract: Address;
        rewardToken: Address;
        baseReward: string;
        rewardMultiplierPercentage: number;
        maxMultiplier: number;
        initialOwner: Address;
      };
    };
  }

  // Save deployment information
  const deploymentInfo: DeploymentInfo = {
    network: process.env.HARDHAT_NETWORK || "localhost",
    timestamp: new Date().toISOString(),
    deployer: deployer.account.address,
    contracts: {
      TimelockController: TimelockController.address,
      GovernanceToken: GovernanceToken.address,
      PaymentContract: PaymentContract.address,
      DAOVoting: DAOVoting.address,
      DAOGovernanceCore: DAOGovernanceCore.address,
      GovernorsRewardPay: GovernorsRewardPay.address
    },
    constructorArgs: {
      TimelockController: {
        minDelay: Number(minDelay),
        proposers: [deployer.account.address],
        executors: [deployer.account.address],
        admin: deployer.account.address
      },
      GovernanceToken: {
        initialOwner: deployer.account.address
      },
      PaymentContract: {
        initialDAOAddress: deployer.account.address
      },
      DAOVoting: {
        initialOwner: deployer.account.address
      },
      DAOGovernanceCore: {
        token: GovernanceToken.address,
        timelock: TimelockController.address,
        paymentContract: PaymentContract.address,
        standardTransactionPower: standardTransactionPower.toString()
      },
      GovernorsRewardPay: {
        votingContract: DAOVoting.address,
        rewardToken: GovernanceToken.address,
        baseReward: baseReward.toString(),
        rewardMultiplierPercentage: Number(rewardMultiplierPercentage),
        maxMultiplier: Number(maxMultiplier),
        initialOwner: deployer.account.address
      }
    }
  };

  // Save deployment info to file
  const deploymentPath = "./deployment-info.json";
  fs.writeFileSync(
    deploymentPath,
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log(`Deployment information saved to ${deploymentPath}`);

  console.log("\nDeployment completed successfully!");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 