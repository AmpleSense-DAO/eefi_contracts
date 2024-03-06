import { ElasticVault } from "../typechain/ElasticVault";
import { ethers, Wallet } from "ethers";
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

const config = {
  network: "homestead",
  rpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_API_KEY}`
}

const provider = new ethers.providers.StaticJsonRpcProvider(config.rpcUrl, config.network);
const signer = new Wallet(PRIVATE_KEY, provider);

// Rebase contract address and event topic
const rebaseContractAddress = '0xD46bA6D942050d489DBd938a2C909A5d5039A161';
const eventSignature = 'LogRebase(uint256,uint256)';
const eventTopic = ethers.utils.id(eventSignature);

// Filter for the LogRebase event emitted by the contract
const filter = {
    address: rebaseContractAddress,
    topics: [eventTopic]
};

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchGasPrice(maxRetries = 3, retryDelay = 1000) {
    let attempts = 0;
    while (attempts < maxRetries) {
      try {
        const response = await axios.get(`https://api.etherscan.io/api?module=gastracker&action=gasoracle`);
        if (response.data && response.data.result && response.data.result.FastGasPrice) {
          const res = Math.floor(response.data.result.FastGasPrice);
          console.log(`Gas price fetched successfully: ${res}`);
          return res;
        } else {
          throw new Error('Invalid response structure');
        }
      } catch (err: any) {
        attempts++;
        console.error(`Attempt ${attempts} - Error fetching gas price:`, err.message);
        if (attempts < maxRetries) {
          console.log(`Waiting ${retryDelay}ms before next attempt...`);
          await delay(retryDelay);
        } else {
          console.error(`Failed to fetch gas price after ${maxRetries} attempts.`);
          return -1; // or throw an error depending on how you want to handle this case
        }
      }
    }
  }
async function rebase(vault: ElasticVault): Promise<boolean> {
  let gasPriceFast = 0;
  let gasMax = parseFloat(MAX_GAS_PRICE!);
  while (gasPriceFast <= 0 || gasPriceFast > gasMax) {
    const res = await fetchGasPrice();
    if(res) gasPriceFast = res;
  }
  console.log(`Using gas price: ${gasPriceFast}`);
  try {
    const tx = await vault.rebase({gasPrice: ethers.utils.parseUnits(gasPriceFast.toString(), "gwei")});
    console.log("transaction hash:" + tx.hash);
    await tx.wait(3); //wait for 3 confirmations
    console.log("Rebase transaction confirmed");
    return true;
  } catch(err) {
    console.error("Rebase error:", err);
    return false;
  }
}

provider.on(filter, async (log) => {
    console.log('LogRebase event detected:', log);

    // Decode the log data if necessary
    const decodedData = ethers.utils.defaultAbiCoder.decode(['uint256', 'uint256'], log.data);
    console.log(`Epoch: ${decodedData[0].toString()}, Total Supply: ${decodedData[1].toString()}`);

    // Logic after detecting LogRebase
    const vault = new ethers.Contract(VAULT_ADDRESS!, ElasticVaultJson.abi, signer) as ElasticVault;
    console.log(`${new Date().toUTCString()}: Starting rebase call`);
    const res = await rebase(vault);
    if (!res) {
        console.error("Error executing rebase");
    } else {
        console.log("Rebase executed successfully");
    }
});
