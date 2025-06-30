import { run } from "hardhat";
import fs from "fs";
import { Address } from "viem";

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

async function main() {
  console.log("Starting contract verification process...");

  // Read deployment information
  const deploymentPath = "./deployment-info.json";
  if (!fs.existsSync(deploymentPath)) {
    console.error(`Deployment info not found at ${deploymentPath}`);
    process.exit(1);
  }

  const deploymentInfo: DeploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const contracts = deploymentInfo.contracts;
  const args = deploymentInfo.constructorArgs;

  console.log(`Verifying contracts deployed on ${deploymentInfo.network}...`);

  // Verify TimelockController
  try {
    console.log(`Verifying TimelockController at ${contracts.TimelockController}...`);
    await run("verify:verify", {
      address: contracts.TimelockController,
      constructorArguments: [
        args.TimelockController.minDelay,
        args.TimelockController.proposers,
        args.TimelockController.executors,
        args.TimelockController.admin
      ],
    });
    console.log("TimelockController verified successfully");
  } catch (error) {
    console.error("Error verifying TimelockController:", error);
  }

  // Verify GovernanceToken
  try {
    console.log(`Verifying GovernanceToken at ${contracts.GovernanceToken}...`);
    await run("verify:verify", {
      address: contracts.GovernanceToken,
      constructorArguments: [
        args.GovernanceToken.initialOwner
      ],
    });
    console.log("GovernanceToken verified successfully");
  } catch (error) {
    console.error("Error verifying GovernanceToken:", error);
  }

  // Verify PaymentContract
  try {
    console.log(`Verifying PaymentContract at ${contracts.PaymentContract}...`);
    await run("verify:verify", {
      address: contracts.PaymentContract,
      constructorArguments: [
        args.PaymentContract.initialDAOAddress
      ],
    });
    console.log("PaymentContract verified successfully");
  } catch (error) {
    console.error("Error verifying PaymentContract:", error);
  }

  // Verify DAOVoting
  try {
    console.log(`Verifying DAOVoting at ${contracts.DAOVoting}...`);
    await run("verify:verify", {
      address: contracts.DAOVoting,
      constructorArguments: [
        args.DAOVoting.initialOwner
      ],
    });
    console.log("DAOVoting verified successfully");
  } catch (error) {
    console.error("Error verifying DAOVoting:", error);
  }

  // Verify DAOGovernanceCore
  try {
    console.log(`Verifying DAOGovernanceCore at ${contracts.DAOGovernanceCore}...`);
    await run("verify:verify", {
      address: contracts.DAOGovernanceCore,
      constructorArguments: [
        args.DAOGovernanceCore.token,
        args.DAOGovernanceCore.timelock,
        args.DAOGovernanceCore.paymentContract,
        args.DAOGovernanceCore.standardTransactionPower
      ],
    });
    console.log("DAOGovernanceCore verified successfully");
  } catch (error) {
    console.error("Error verifying DAOGovernanceCore:", error);
  }

  // Verify GovernorsRewardPay
  try {
    console.log(`Verifying GovernorsRewardPay at ${contracts.GovernorsRewardPay}...`);
    await run("verify:verify", {
      address: contracts.GovernorsRewardPay,
      constructorArguments: [
        args.GovernorsRewardPay.votingContract,
        args.GovernorsRewardPay.rewardToken,
        args.GovernorsRewardPay.baseReward,
        args.GovernorsRewardPay.rewardMultiplierPercentage,
        args.GovernorsRewardPay.maxMultiplier,
        args.GovernorsRewardPay.initialOwner
      ],
    });
    console.log("GovernorsRewardPay verified successfully");
  } catch (error) {
    console.error("Error verifying GovernorsRewardPay:", error);
  }

  console.log("\nContract verification process completed!");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 