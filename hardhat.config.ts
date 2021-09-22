import "@nomiclabs/hardhat-waffle";
import "hardhat-typechain";
import "@nomiclabs/hardhat-etherscan"
import { HardhatUserConfig } from "hardhat/types";

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
      forking: {
        enabled: true,
        url: `https://eth-mainnet.alchemyapi.io/v2/EkC-rSDdHIgfpIygkCZLHetwZkz3a5Sy`,
        blockNumber: 13235981,
      }
    }
  },
  etherscan: {
    apiKey: "2NA2YSGJTXQJFFDEKXH9SC2JZJDRVWBSKR"
  }
};

export default config;

