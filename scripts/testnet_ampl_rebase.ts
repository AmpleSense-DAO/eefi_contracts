import { ElasticVault } from "../typechain/ElasticVault";
import { Wallet } from "ethers";
import { ethers } from "hardhat";
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

dotenvConfig({ path: resolve(__dirname, "./.env") });

// Environment variables
const ALCHEMY_API_KEY: string | undefined = process.env.ALCHEMY_API_KEY;
const MAX_GAS_PRICE: string | undefined = process.env.MAX_GAS_PRICE;

// Ensure environment variables are set
if (!ALCHEMY_API_KEY) {
  throw new Error("Please set your ALCHEMY_API_KEY in a .env file");
}
if (!MAX_GAS_PRICE) {
  throw new Error("Please set your MAX_GAS_PRICE in a .env file");
}

// Rebase contract address and event topic
const rebaseContractAddress = "0xD46bA6D942050d489DBd938a2C909A5d5039A161"
const ampleforthRebaserAddress = "0x1B228a749077b8e307C5856cE62Ef35d96Dca2ea"
const UFragmentsJson = require("../artifacts/uFragments/contracts/UFragments.sol/UFragments.json");

async function impersonateAndFund(address: string) : Promise<SignerWithAddress> {
  await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [address],
  });
  await hre.network.provider.send("hardhat_setBalance", [
  address,
  "0x3635c9adc5dea00000"
  ]);

  return await ethers.getSigner(address);
}

async function main() {
  const signer = await impersonateAndFund(ampleforthRebaserAddress);
  const uFragments = new ethers.Contract(rebaseContractAddress, UFragmentsJson.abi, signer);
  await uFragments.connect(signer).rebase(0, 500000*10**9);
}

// We recommend this pattern to be able to use async/await everywhere and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

