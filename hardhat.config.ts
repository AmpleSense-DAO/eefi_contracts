import "@nomiclabs/hardhat-waffle";
import "hardhat-typechain";
import "solidity-coverage";
import "hardhat-gas-reporter";
import "@nomiclabs/hardhat-etherscan";
import "hardhat-deploy";
import { HardhatUserConfig } from "hardhat/types";

import { resolve } from "path";
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: resolve(__dirname, "./.env") });

// Ensure that we have all the environment variables we need.
const pk: string | undefined = process.env.PRIVATE_KEY;
if (!pk) {
  throw new Error("Please set your PRIVATE_KEY in a .env file");
}

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  solidity: {
    compilers: [
      { version: "0.7.6", settings: {optimizer: {
      enabled: true,
      runs: 200
    }} },
    { version: "0.6.6", settings: {optimizer: {
      enabled: true,
      runs: 200
    }} }
  ],
    
  },
  networks: {
    hardhat: {
      chainId : 1337,
      forking: {
        enabled: true,
        url: `https://eth-mainnet.alchemyapi.io/v2/EkC-rSDdHIgfpIygkCZLHetwZkz3a5Sy`
      }
    },
    localhost: {
      url: "http://127.0.0.1:8586",
      chainId: 1337,
      timeout: 0
    },
    mainnet: {
      url: `https://eth-mainnet.gateway.pokt.network/v1/lb/6203e99dcbab27003989bceb`,
      gasPrice: 65000000000,
      accounts: [pk]
    }
  },
  etherscan: {
    apiKey: "2NA2YSGJTXQJFFDEKXH9SC2JZJDRVWBSKR"
  }
};

export default config;

