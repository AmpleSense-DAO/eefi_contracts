const hre = require("hardhat");
import { AmplesenseVault } from "../typechain/AmplesenseVault";
import { StakingERC20 } from "../typechain/StakingERC20";
import { Pioneer1Vault } from "../typechain/Pioneer1Vault";
import { EEFIToken } from "../typechain/EEFIToken";
import { MockTrader } from "../typechain/MockTrader";
import { deployTokens } from "./utils/deploy_tokens";

async function main() {
  const accounts = await hre.ethers.getSigners();

  const vaultFactory = await hre.ethers.getContractFactory("AmplesenseVault");
  const stakingerc20Factory = await hre.ethers.getContractFactory("StakingERC20");
  const stakingerc721Factory = await hre.ethers.getContractFactory("Pioneer1Vault");
  const traderFactory = await hre.ethers.getContractFactory("MockTrader");

  if(hre.network.name == "localhost") {

  }

  const tokens = await deployTokens();

  let vault = await vaultFactory.deploy(tokens.ampl.address) as AmplesenseVault;

  let eefiTokenAddress = await vault.eefi_token();
  let eefiToken = await hre.ethers.getContractAt("EEFIToken", eefiTokenAddress) as EEFIToken;

  let pioneer1 = await stakingerc721Factory.deploy(tokens.nft1.address, tokens.nft2.address, tokens.ampl.address) as Pioneer1Vault;
  let pioneer2 = await stakingerc20Factory.deploy(tokens.kmpl.address, eefiTokenAddress, 9) as StakingERC20;
  let pioneer3 = await stakingerc20Factory.deploy(tokens.kmplethlp.address, eefiTokenAddress, 9) as StakingERC20;
  let staking_pool = await stakingerc20Factory.deploy(tokens.eefiethlp.address, eefiTokenAddress, 9) as StakingERC20;

  await vault.initialize(pioneer1.address, pioneer2.address, pioneer3.address, staking_pool.address, accounts[0].address);

  let trader = await traderFactory.deploy(tokens.ampl.address, eefiTokenAddress, hre.ethers.utils.parseUnits("0.001", "ether"), hre.ethers.utils.parseUnits("0.1", "ether")) as MockTrader;

  await vault.TESTMINT(50000 * 10**9, trader.address);
  await accounts[0].sendTransaction({
    to: trader.address,
    value: hre.ethers.utils.parseEther("10.0")
  });
  await vault.setTrader(trader.address);
  await pioneer1.setTrader(trader.address);
   //stake in all distribution contracts
   
   await tokens.nft1.setApprovalForAll(pioneer1.address, true);
   await tokens.nft2.setApprovalForAll(pioneer1.address, true);
   await pioneer1.stake([0, 1], true);
   await pioneer1.stake([0, 1], false);

   await tokens.kmpl.increaseAllowance(pioneer2.address, 10**9);
   await pioneer2.stake(10**9, "0x");

   await tokens.kmplethlp.increaseAllowance(pioneer3.address, 10**9);
   await pioneer3.stake(10**9, "0x");

   await tokens.eefiethlp.increaseAllowance(staking_pool.address, 10**9);
   await staking_pool.stake(10**9, "0x");

  console.log("Vault deployed to:", vault.address);
  console.log("Pioneer1 deployed to:", pioneer1.address);
  console.log("Pioneer2 deployed to:", pioneer2.address);
  console.log("Pioneer3 deployed to:", pioneer3.address);
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
