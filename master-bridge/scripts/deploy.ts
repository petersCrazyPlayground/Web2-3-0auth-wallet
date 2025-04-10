import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const MasterBridge = await ethers.getContractFactory("MasterBridge");
  const masterBridge = await MasterBridge.deploy();
  
  await masterBridge.waitForDeployment();
  console.log("Master Bridge deployed to:", await masterBridge.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 