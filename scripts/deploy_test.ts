const hre = require("hardhat");
import { ElasticVault } from "../typechain/ElasticVault";
import { StakingERC20 } from "../typechain/StakingERC20";
import { Pioneer1Vault } from "../typechain/Pioneer1Vault";
import { EEFIToken } from "../typechain/EEFIToken";
import { MockTrader } from "../typechain/MockTrader";
import { deployTokens } from "./utils/deploy_tokens";
import { deploy } from "./utils/deploy";

async function main() {
  const accounts = await hre.ethers.getSigners();

  const vaultFactory = await hre.ethers.getContractFactory("ElasticVault");
  const stakingerc20Factory = await hre.ethers.getContractFactory("StakingERC20");
  const stakingerc721Factory = await hre.ethers.getContractFactory("Pioneer1Vault");
  const traderFactory = await hre.ethers.getContractFactory("MockTrader");

  if(hre.network.name == "localhost") {

  }

  const tokens = await deployTokens();

  let eefiToken = await deploy("EEFIToken") as EEFIToken;
  let vault = await vaultFactory.deploy(eefiToken.address, tokens.ampl.address) as ElasticVault;
  await eefiToken.grantRole(await eefiToken.MINTER_ROLE(), vault.address);
  await eefiToken.grantRole(await eefiToken.MINTER_ROLE(), accounts[0].address);
  

  let staking_pool = await stakingerc20Factory.deploy(tokens.eefiethlp.address, eefiToken.address, 9) as StakingERC20;

  await vault.initialize(staking_pool.address, accounts[0].address);

  let trader = await traderFactory.deploy(tokens.ampl.address, eefiToken.address, hre.ethers.utils.parseUnits("0.001", "ether"), hre.ethers.utils.parseUnits("0.1", "ether")) as MockTrader;

  await eefiToken.mint(trader.address, 50000 * 10**9);
  await accounts[0].sendTransaction({
    to: trader.address,
    value: hre.ethers.utils.parseEther("10.0")
  });
  await vault.setTrader(trader.address);
   //stake in all distribution contracts
   
   await tokens.eefiethlp.increaseAllowance(staking_pool.address, 10**9);
   await staking_pool.stake(10**9, "0x");

  console.log("Vault deployed to:", vault.address);
  console.log("LPStaking deployed to:", staking_pool.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
