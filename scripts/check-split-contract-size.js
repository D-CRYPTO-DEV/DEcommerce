const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Checking contract sizes for split contracts...\n");

  // Compile contracts
  await hre.run("compile");
  
  // Get contract artifacts
  const DAOGovernanceCore = await hre.ethers.getContractFactory("DAOGovernanceCore");
  const DAOVoting = await hre.ethers.getContractFactory("DAOVoting");
  const DAOVotingLibrary = await hre.ethers.getContractFactory("DAOVotingLibrary");
  const DAOSignatureLibrary = await hre.ethers.getContractFactory("DAOSignatureLibrary");
  
  // For comparison, get the original contract
  const MyGovernor = await hre.ethers.getContractFactory("MyGovernor");
  
  // Get bytecode sizes
  const daoGovernanceCoreSize = DAOGovernanceCore.bytecode.length / 2;
  const daoVotingSize = DAOVoting.bytecode.length / 2;
  const daoVotingLibrarySize = DAOVotingLibrary.bytecode.length / 2;
  const daoSignatureLibrarySize = DAOSignatureLibrary.bytecode.length / 2;
  const myGovernorSize = MyGovernor.bytecode.length / 2;
  
  // Calculate total size of split contracts
  const totalSplitSize = daoGovernanceCoreSize + daoVotingSize + daoVotingLibrarySize + daoSignatureLibrarySize;
  
  // Convert to KB
  const daoGovernanceCoreSizeKB = (daoGovernanceCoreSize / 1024).toFixed(2);
  const daoVotingSizeKB = (daoVotingSize / 1024).toFixed(2);
  const daoVotingLibrarySizeKB = (daoVotingLibrarySize / 1024).toFixed(2);
  const daoSignatureLibrarySizeKB = (daoSignatureLibrarySize / 1024).toFixed(2);
  const myGovernorSizeKB = (myGovernorSize / 1024).toFixed(2);
  const totalSplitSizeKB = (totalSplitSize / 1024).toFixed(2);
  
  // Check if any contract exceeds the size limit
  const SIZE_LIMIT_BYTES = 24 * 1024; // 24KB in bytes
  
  console.log("Contract Sizes:");
  console.log("---------------");
  console.log(`DAOGovernanceCore: ${daoGovernanceCoreSizeKB} KB (${daoGovernanceCoreSize} bytes)`);
  console.log(`DAOVoting: ${daoVotingSizeKB} KB (${daoVotingSize} bytes)`);
  console.log(`DAOVotingLibrary: ${daoVotingLibrarySizeKB} KB (${daoVotingLibrarySize} bytes)`);
  console.log(`DAOSignatureLibrary: ${daoSignatureLibrarySizeKB} KB (${daoSignatureLibrarySize} bytes)`);
  console.log(`Total Split Size: ${totalSplitSizeKB} KB (${totalSplitSize} bytes)`);
  console.log("\nOriginal Contract:");
  console.log(`MyGovernor: ${myGovernorSizeKB} KB (${myGovernorSize} bytes)`);
  
  console.log("\nSize Limit Check:");
  console.log("---------------");
  
  if (daoGovernanceCoreSize > SIZE_LIMIT_BYTES) {
    console.log(`❌ DAOGovernanceCore exceeds the 24KB size limit by ${((daoGovernanceCoreSize - SIZE_LIMIT_BYTES) / 1024).toFixed(2)} KB`);
  } else {
    console.log(`✅ DAOGovernanceCore is under the 24KB size limit by ${((SIZE_LIMIT_BYTES - daoGovernanceCoreSize) / 1024).toFixed(2)} KB`);
  }
  
  if (daoVotingSize > SIZE_LIMIT_BYTES) {
    console.log(`❌ DAOVoting exceeds the 24KB size limit by ${((daoVotingSize - SIZE_LIMIT_BYTES) / 1024).toFixed(2)} KB`);
  } else {
    console.log(`✅ DAOVoting is under the 24KB size limit by ${((SIZE_LIMIT_BYTES - daoVotingSize) / 1024).toFixed(2)} KB`);
  }
  
  if (myGovernorSize > SIZE_LIMIT_BYTES) {
    console.log(`❌ Original MyGovernor exceeds the 24KB size limit by ${((myGovernorSize - SIZE_LIMIT_BYTES) / 1024).toFixed(2)} KB`);
  } else {
    console.log(`✅ Original MyGovernor is under the 24KB size limit by ${((SIZE_LIMIT_BYTES - myGovernorSize) / 1024).toFixed(2)} KB`);
  }
  
  console.log("\nComparison:");
  console.log("----------");
  console.log(`Size difference between split and original: ${(totalSplitSize - myGovernorSize) / 1024} KB`);
  console.log(`Percentage change: ${(((totalSplitSize - myGovernorSize) / myGovernorSize) * 100).toFixed(2)}%`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 