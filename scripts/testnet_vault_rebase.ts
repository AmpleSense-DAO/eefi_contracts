import { ElasticVault } from "../typechain/ElasticVault";
import { Wallet } from "ethers";
import { ethers } from "hardhat";
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
const ElasticVaultJson = require("../artifacts/contracts/ElasticVault.sol/ElasticVault.json");

dotenvConfig({ path: resolve(__dirname, "./.env") });

// Environment variables
const ALCHEMY_API_KEY: string | undefined = process.env.ALCHEMY_API_KEY;
const MAX_GAS_PRICE: string | undefined = process.env.MAX_GAS_PRICE;
const PRIVATE_KEY: string | undefined = process.env.PRIVATE_KEY;
const VAULT_ADDRESS: string | undefined = process.env.VAULT_ADDRESS;

// Ensure environment variables are set
if (!ALCHEMY_API_KEY) {
  throw new Error("Please set your ALCHEMY_API_KEY in a .env file");
}
if (!MAX_GAS_PRICE) {
  throw new Error("Please set your MAX_GAS_PRICE in a .env file");
}
if (!PRIVATE_KEY) {
  throw new Error("Please set your PRIVATE_KEY in a .env file");
}
if (!VAULT_ADDRESS) {
    throw new Error("Please set your VAULT_ADDRESS in a .env file");
}

const axios = require("axios");

const signer = new Wallet(PRIVATE_KEY, hre.ethers.provider);

async function rebase(vault: ElasticVault): Promise<boolean> {
  try {
    const tx = await vault.rebase();
    console.log("transaction hash:" + tx.hash);
    console.log("Rebase transaction confirmed");
    return true;
  } catch(err) {
    console.error("Rebase error:", err);
    return false;
  }
}

async function main() {
  const vault = new ethers.Contract(VAULT_ADDRESS!, ElasticVaultJson.abi, signer) as ElasticVault;
  console.log(`${new Date().toUTCString()}: Starting rebase call`);
  await rebase(vault);
}

// We recommend this pattern to be able to use async/await everywhere and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });