const hre = require("hardhat");
import { AmplesenseVault } from "../typechain/AmplesenseVault";
import { StakingERC20 } from "../typechain/StakingERC20";
import { Pioneer1Vault } from "../typechain/Pioneer1Vault";
import { EEFIToken } from "../typechain/EEFIToken";
import { MockTrader } from "../typechain/MockTrader";
import { TokenDistributor } from "../typechain/TokenDistributor";
import { deployTokens } from "./utils/deploy_tokens";
import { FakeAMPL } from "../typechain/FakeAMPL";
import { FakeERC20 } from "../typechain/FakeERC20";
import { FakeERC721 } from "../typechain/FakeERC721";

async function main() {
  const accounts = await hre.ethers.getSigners();

  const vaultFactory = await hre.ethers.getContractFactory("AmplesenseVault");
  const stakingerc20Factory = await hre.ethers.getContractFactory("StakingERC20");
  const stakingerc721Factory = await hre.ethers.getContractFactory("Pioneer1Vault");
  const traderFactory = await hre.ethers.getContractFactory("MockTrader");
  const tokenDistributorFactory = await hre.ethers.getContractFactory("TokenDistributor");
  const erc20Factory = await hre.ethers.getContractFactory("FakeERC20");

  let vault = await vaultFactory.attach("0xb2859b64b1593430d385e742CC81e2802c742886") as AmplesenseVault;
  let pioneer1 = await stakingerc721Factory.attach("0x0Ed21B05dd38E8fEd2824E5Ad74B015059Bb2DF0") as Pioneer1Vault;
  let ampl = await erc20Factory.attach("0x7Da216B833AbE2367047B2844E2919852CCD7CEa") as FakeERC20;

  let r = await vault.pioneer_vault1();
  console.log(r);

  const tx = await vault.initialize("0x0Ed21B05dd38E8fEd2824E5Ad74B015059Bb2DF0", "0x4d33b90858919054982285BaEd231110a2236855", "0x08e2b59EAEc8Fd159ff82Ed81C64B4f7C102eeCD", "0x71914d4f5424ac697518b341C6519a5a25F13d4D", accounts[0].address);
  console.log("vault initialized");
  // let eefiTokenAddress = await vault.eefi_token();

  // let trader = await traderFactory.deploy("0x7Da216B833AbE2367047B2844E2919852CCD7CEa", eefiTokenAddress, hre.ethers.utils.parseUnits("0.001", "ether"), hre.ethers.utils.parseUnits("0.1", "ether")) as MockTrader;
  // console.log("trader");

  // await vault.TESTMINT(50000 * 10**9, trader.address);
  // await accounts[0].sendTransaction({
  //   to: trader.address,
  //   value: hre.ethers.utils.parseEther("10.0")
  // });
  // await vault.setTrader(trader.address);
  // await pioneer1.setTrader(trader.address);

  

  // const distributor = await tokenDistributorFactory.deploy(tokens.ampl.address, eefiTokenAddress, tokens.kmpl.address, tokens.kmplethlp.address, tokens.eefiethlp.address);
  // console.log("Deployed distributor");
  // await tokens.ampl.transfer(distributor.address, hre.ethers.utils.parseUnits("10000", "gwei"));
  // await tokens.eefi.transfer(distributor.address, hre.ethers.utils.parseUnits("10000", "gwei"));
  // await tokens.kmpl.transfer(distributor.address, hre.ethers.utils.parseUnits("10000", "gwei"));
  // console.log("Send ampl, eefi, kmpl");
  // await tokens.eefiethlp.transfer(distributor.address, hre.ethers.utils.parseUnits("1.0", "ether"));
  // await tokens.kmplethlp.transfer(distributor.address, hre.ethers.utils.parseUnits("1.0", "ether"));
  // console.log("Send liquidity tokens");
  // //stake in all distribution contracts

  // console.log("begin staking...");

  // await tokens.nft1.setApprovalForAll(pioneer1.address, true);
  // await tokens.nft2.setApprovalForAll(pioneer1.address, true);
  // await pioneer1.stake([0, 1], true);
  // await pioneer1.stake([0, 1], false);

  // await tokens.kmpl.increaseAllowance(pioneer2.address, 10**9);
  // await pioneer2.stake(10**9, "0x");

  // await tokens.kmplethlp.increaseAllowance(pioneer3.address, 10**9);
  // await pioneer3.stake(10**9, "0x");

  // await tokens.eefiethlp.increaseAllowance(staking_pool.address, 10**9);
  // await staking_pool.stake(10**9, "0x");
  // console.log("AMPL deployed to " + tokens.ampl.address);
  // console.log("EEFI deployed to " + tokens.eefi.address);
  // console.log("KMPL deployed to " + tokens.kmpl.address);
  // console.log("EEFIETHLP deployed to " + tokens.eefiethlp.address);
  // console.log("KMPLETHLP deployed to " + tokens.kmplethlp.address);
  // console.log("Token distributor deployed to " + distributor.address);
  // console.log("Vault deployed to:", vault.address);
  // console.log("Pioneer1 deployed to:", pioneer1.address);
  // console.log("Pioneer2 deployed to:", pioneer2.address);
  // console.log("Pioneer3 deployed to:", pioneer3.address);
  // console.log("LPStaking deployed to:", staking_pool.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
