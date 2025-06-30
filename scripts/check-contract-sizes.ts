import { artifacts } from "hardhat";
import { Address } from "viem";

async function main() {
  console.log("Checking contract sizes...");
  console.log("=========================\n");

  // Maximum contract size limit in Ethereum
  const MAX_CONTRACT_SIZE = 24576; // 24KB in bytes

  // Get compiled artifacts
  const DAOGovernanceCore = await artifacts.readArtifact("DAOGovernanceCore");
  const DAOVoting = await artifacts.readArtifact("DAOVoting");
  const GovernorsRewardPay = await artifacts.readArtifact("GovernorsRewardPay");
  const governanceToken = await artifacts.readArtifact("governanceToken");
  const PaymentContract = await artifacts.readArtifact("paymentContract");
  const TimelockController = await artifacts.readArtifact("TimelockController");

  // Get contract bytecode sizes
  const daoGovernanceCoreSize = (DAOGovernanceCore.bytecode.length - 2) / 2; // Convert from hex to bytes
  const daoVotingSize = (DAOVoting.bytecode.length - 2) / 2;
  const governorsRewardPaySize = (GovernorsRewardPay.bytecode.length - 2) / 2;
  const governanceTokenSize = (governanceToken.bytecode.length - 2) / 2;
  const paymentContractSize = (PaymentContract.bytecode.length - 2) / 2;
  const timelockControllerSize = (TimelockController.bytecode.length - 2) / 2;

  // Calculate total size of split contracts
  const totalSplitSize = daoGovernanceCoreSize + daoVotingSize + governorsRewardPaySize;

  // Print contract sizes
  console.log("Individual Contract Sizes:");
  console.log("--------------------------");
  console.log(`DAOGovernanceCore:   ${daoGovernanceCoreSize.toFixed(2)} bytes (${(daoGovernanceCoreSize / 1024).toFixed(2)} KB) - ${daoGovernanceCoreSize <= MAX_CONTRACT_SIZE ? "✅ Within limit" : "❌ Exceeds limit"}`);
  console.log(`DAOVoting:           ${daoVotingSize.toFixed(2)} bytes (${(daoVotingSize / 1024).toFixed(2)} KB) - ${daoVotingSize <= MAX_CONTRACT_SIZE ? "✅ Within limit" : "❌ Exceeds limit"}`);
  console.log(`GovernorsRewardPay:  ${governorsRewardPaySize.toFixed(2)} bytes (${(governorsRewardPaySize / 1024).toFixed(2)} KB) - ${governorsRewardPaySize <= MAX_CONTRACT_SIZE ? "✅ Within limit" : "❌ Exceeds limit"}`);
  console.log(`governanceToken:     ${governanceTokenSize.toFixed(2)} bytes (${(governanceTokenSize / 1024).toFixed(2)} KB) - ${governanceTokenSize <= MAX_CONTRACT_SIZE ? "✅ Within limit" : "❌ Exceeds limit"}`);
  console.log(`PaymentContract:     ${paymentContractSize.toFixed(2)} bytes (${(paymentContractSize / 1024).toFixed(2)} KB) - ${paymentContractSize <= MAX_CONTRACT_SIZE ? "✅ Within limit" : "❌ Exceeds limit"}`);
  console.log(`TimelockController:  ${timelockControllerSize.toFixed(2)} bytes (${(timelockControllerSize / 1024).toFixed(2)} KB) - ${timelockControllerSize <= MAX_CONTRACT_SIZE ? "✅ Within limit" : "❌ Exceeds limit"}`);
  
  console.log("\nSplit Contract Analysis:");
  console.log("------------------------");
  console.log(`Total size of split contracts: ${totalSplitSize.toFixed(2)} bytes (${(totalSplitSize / 1024).toFixed(2)} KB)`);
  console.log(`Maximum contract size limit: ${MAX_CONTRACT_SIZE} bytes (${(MAX_CONTRACT_SIZE / 1024).toFixed(2)} KB)`);
  
  // Check if all contracts are within size limit
  const allWithinLimit = 
    daoGovernanceCoreSize <= MAX_CONTRACT_SIZE &&
    daoVotingSize <= MAX_CONTRACT_SIZE &&
    governorsRewardPaySize <= MAX_CONTRACT_SIZE &&
    governanceTokenSize <= MAX_CONTRACT_SIZE &&
    paymentContractSize <= MAX_CONTRACT_SIZE &&
    timelockControllerSize <= MAX_CONTRACT_SIZE;
  
  console.log("\nOverall Status:");
  console.log("--------------");
  if (allWithinLimit) {
    console.log("✅ All contracts are within the size limit and deployable on Ethereum.");
  } else {
    console.log("❌ Some contracts exceed the size limit and cannot be deployed on Ethereum.");
    console.log("   Consider further splitting or optimizing the contracts that exceed the limit.");
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 