const hre = require("hardhat");
import { AmplesenseVault } from "../typechain/AmplesenseVault";
import { StakingERC20 } from "../typechain/StakingERC20";
import { Pioneer1Vault } from "../typechain/Pioneer1Vault";
import { EEFIToken } from "../typechain/EEFIToken";
import { MockTrader } from "../typechain/MockTrader";
import { TokenDistributor } from "../typechain/TokenDistributor";
import { deployTokens } from "./utils/deploy_tokens";
import { deployVerify } from "./utils/deploy";

async function main() {
  const accounts = await hre.ethers.getSigners();

  if(hre.network.name == "localhost") {

  }

  const tokens = await deployTokens();

  console.log("Deployed tokens");

  let vault = await deployVerify("AmplesenseVault",tokens.ampl.address) as AmplesenseVault;

  console.log("Deployed vault");

  let eefiTokenAddress = await vault.eefi_token();
  let eefiToken = await hre.ethers.getContractAt("EEFIToken", eefiTokenAddress) as EEFIToken;


  let pioneer1 = await deployVerify("Pioneer1Vault",tokens.nft1.address, tokens.nft2.address, tokens.ampl.address) as Pioneer1Vault;
  console.log("pioneer1");
  let pioneer2 = await deployVerify("StakingERC20",tokens.kmpl.address, eefiTokenAddress, 9) as StakingERC20;
  console.log("pioneer2");
  let pioneer3 = await deployVerify("StakingERC20",tokens.kmplethlp.address, eefiTokenAddress, 9) as StakingERC20;
  console.log("pioneer3");
  let staking_pool = await deployVerify("StakingERC20",tokens.eefiethlp.address, eefiTokenAddress, 9) as StakingERC20;
  console.log("staking pool");

  await vault.initialize(pioneer1.address, pioneer2.address, pioneer3.address, staking_pool.address, accounts[0].address);
  console.log("vault initialized");

  let trader = await deployVerify("MockTrader",tokens.ampl.address, eefiTokenAddress, hre.ethers.utils.parseUnits("0.001", "ether"), hre.ethers.utils.parseUnits("0.1", "ether")) as MockTrader;
  console.log("trader");

  await vault.TESTMINT(50000 * 10**9, trader.address);
  await accounts[0].sendTransaction({
    to: trader.address,
    value: hre.ethers.utils.parseEther("1.0")
  });
  await vault.setTrader(trader.address);
  await pioneer1.setTrader(trader.address);

  

  const distributor = await deployVerify("TokenDistributor", tokens.ampl.address, eefiTokenAddress, tokens.kmpl.address, tokens.kmplethlp.address, tokens.eefiethlp.address);
  console.log("Deployed distributor");
  //stake in all distribution contracts



  console.log("AMPL deployed to " + tokens.ampl.address);
  console.log("EEFI deployed to " + eefiToken.address);
  console.log("KMPL deployed to " + tokens.kmpl.address);
  console.log("EEFIETHLP deployed to " + tokens.eefiethlp.address);
  console.log("KMPLETHLP deployed to " + tokens.kmplethlp.address);
  console.log("Token distributor deployed to " + distributor.address);
  console.log("Vault deployed to:", vault.address);
  console.log("Pioneer1 deployed to:", pioneer1.address);
  console.log("Pioneer2 deployed to:", pioneer2.address);
  console.log("Pioneer3 deployed to:", pioneer3.address);
  console.log("LPStaking deployed to:", staking_pool.address);
  console.log("NFT1 deployed to " + tokens.nft1.address);
  console.log("NFT2 deployed to " + tokens.nft2.address);

  await tokens.ampl.forceRebase(0, hre.ethers.utils.parseUnits("1000000", "gwei"));
  await tokens.ampl.transfer(distributor.address, hre.ethers.utils.parseUnits("10000", "gwei"));
  await eefiToken.transfer(distributor.address, hre.ethers.utils.parseUnits("10000", "gwei"));
  await tokens.kmpl.transfer(distributor.address, hre.ethers.utils.parseUnits("10000", "gwei"));
  console.log("Send ampl, eefi, kmpl");
  await tokens.eefiethlp.transfer(distributor.address, hre.ethers.utils.parseUnits("1.0", "ether"));
  await tokens.kmplethlp.transfer(distributor.address, hre.ethers.utils.parseUnits("1.0", "ether"));
  console.log("Send liquidity tokens");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
