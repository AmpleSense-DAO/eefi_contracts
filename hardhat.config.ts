import "@nomiclabs/hardhat-waffle";
import "hardhat-typechain";
import "@nomiclabs/hardhat-etherscan"
import { HardhatUserConfig } from "hardhat/types";

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  solidity: {
    compilers: [{ version: "0.7.6", settings: {optimizer: {
      enabled: true,
      runs: 200
    }} }],
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize : true
    },
    rinkeby: {
      url: `https://eth-rinkeby.alchemyapi.io/v2/EkC-rSDdHIgfpIygkCZLHetwZkz3a5Sy`,
      accounts: ["PK"],
      gasPrice : 1000000000
    },
  },
  etherscan: {
    apiKey: "2NA2YSGJTXQJFFDEKXH9SC2JZJDRVWBSKR"
  }
};

export default config;

