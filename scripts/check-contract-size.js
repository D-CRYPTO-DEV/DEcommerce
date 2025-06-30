const { viem } = require("hardhat");

async function main() {
  console.log("Compiling contracts...");
  await hre.run("compile");

  console.log("Checking contract sizes...");

  // Get the contract artifacts
  const MyGovernorArtifact = await hre.artifacts.readArtifact("MyGovernor");
  const DAOVotingLibraryArtifact = await hre.artifacts.readArtifact("DAOVotingLibrary");
  const DAOSignatureLibraryArtifact = await hre.artifacts.readArtifact("DAOSignatureLibrary");
  
  // Calculate sizes
  const myGovernorSize = MyGovernorArtifact.deployedBytecode.length / 2;
  const daoVotingLibrarySize = DAOVotingLibraryArtifact.deployedBytecode.length / 2;
  const daoSignatureLibrarySize = DAOSignatureLibraryArtifact.deployedBytecode.length / 2;
  
  // Display sizes in KB
  console.log(`MyGovernor contract size: ${(myGovernorSize / 1024).toFixed(2)} KB`);
  console.log(`DAOVotingLibrary size: ${(daoVotingLibrarySize / 1024).toFixed(2)} KB`);
  console.log(`DAOSignatureLibrary size: ${(daoSignatureLibrarySize / 1024).toFixed(2)} KB`);
  
  // Check if the contract exceeds the size limit
  const sizeLimit = 24 * 1024; // 24KB in bytes
  if (myGovernorSize > sizeLimit) {
    console.log(`⚠️ WARNING: MyGovernor contract size exceeds the 24KB limit by ${((myGovernorSize - sizeLimit) / 1024).toFixed(2)} KB`);
  } else {
    console.log(`✅ MyGovernor contract is under the 24KB limit with ${((sizeLimit - myGovernorSize) / 1024).toFixed(2)} KB to spare`);
  }
  
  // Total deployed size (contract + libraries)
  const totalSize = myGovernorSize + daoVotingLibrarySize + daoSignatureLibrarySize;
  console.log(`Total deployed size (contract + libraries): ${(totalSize / 1024).toFixed(2)} KB`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 