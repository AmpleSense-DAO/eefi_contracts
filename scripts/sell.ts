// Simplified and adapted script for performing the sell operation
import { ethers, BigNumber } from "ethers";
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
dotenvConfig({ path: resolve(__dirname, "./.env") });

// Importing necessary artifacts
const ElasticVaultJson = require("../artifacts/contracts/ElasticVault.sol/ElasticVault.json");

// Environment variables setup
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const MAX_GAS_PRICE = process.env.MAX_GAS_PRICE;
const EEFI_SLIPPAGE = process.env.EEFI_SLIPPAGE;
const ETH_SLIPPAGE = process.env.ETH_SLIPPAGE;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Basic validation for environment variables
if (!ALCHEMY_API_KEY || !MAX_GAS_PRICE || !EEFI_SLIPPAGE || !ETH_SLIPPAGE || !PRIVATE_KEY) {
  console.error("One or more environment variables are missing");
  process.exit(1);
}

// Setup Ethereum provider and signer
const provider = new ethers.providers.StaticJsonRpcProvider(`https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_API_KEY}`);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);

// Utilizing axios for fetching current gas price
const axios = require("axios");
async function fetchGasPrice() {
  const response = await axios.get(`https://api.etherscan.io/api?module=gastracker&action=gasoracle`);
  return Math.floor(response.data.result.FastGasPrice);
}

// Utility functions for formatting
function prettyETH(amount: BigNumber): string {
  return ethers.utils.formatEther(amount);
}

async function main() {
  const vault = new ethers.Contract("0xYourElasticVaultAddress", ElasticVaultJson.abi, signer);

  const simulatedSell = async () => {
    try {
      // Simulating sell call to get expected EEFI and OHM without actual blockchain transaction
      const { eefi_purchased, ohm_purchased } = await vault.callStatic.sell(BigNumber.from(0), BigNumber.from(0));

      console.log(`Simulated Sell Results - EEFI: ${prettyETH(eefi_purchased)}, OHM: ${prettyETH(ohm_purchased)}`);
      return { eefi_purchased, ohm_purchased };
    } catch (error) {
      console.error("Simulation failed:", error);
      throw error;
    }
  };

  const executeSell = async (eefi_purchased: BigNumber, ohm_purchased: BigNumber) => {
    // Applying slippage
    const eefiSlippageApplied = eefi_purchased.mul(100 - parseInt(EEFI_SLIPPAGE!)).div(100);
    const ohmSlippageApplied = ohm_purchased.mul(100 - parseInt(ETH_SLIPPAGE!)).div(100);

    // Fetching current fast gas price and ensuring it does not exceed MAX_GAS_PRICE
    const currentGasPrice = await fetchGasPrice();
    if (currentGasPrice > parseInt(MAX_GAS_PRICE!)) {
      console.error("Current gas price exceeds maximum allowed gas price. Aborting transaction.");
      return;
    }

    try {
      // Executing sell with calculated minimums after applying slippage
      const tx = await vault.sell(eefiSlippageApplied, ohmSlippageApplied, {
        gasPrice: ethers.utils.parseUnits(currentGasPrice.toString(), 'gwei')
      });
      console.log(`Executing sell - Transaction hash: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`Transaction confirmed - Block number: ${receipt.blockNumber}`);
    } catch (error) {
      console.error("Failed to execute sell:", error);
      throw error;
    }
  };

  // Running the simulation and then executing the sell function based on simulation results
  const { eefi_purchased, ohm_purchased } = await simulatedSell();
  await executeSell(eefi_purchased, ohm_purchased);
}

// We recommend this pattern to be able to use async/await everywhere and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
