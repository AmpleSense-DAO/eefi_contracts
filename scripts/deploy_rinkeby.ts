const hre = require("hardhat");
import { TestElasticVault } from "../typechain/TestElasticVault";
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

  console.log("deploying vault " + tokens.ampl.address)

  let [p1, vault] = await deployVerify("TestElasticVault",tokens.ampl.address) as [any, TestElasticVault];

  console.log("Deployed vault");

  let eefiTokenAddress = await vault.eefi_token();
  let eefiToken = await hre.ethers.getContractAt("EEFIToken", eefiTokenAddress) as EEFIToken;


  let [p2, pioneer1] = await deployVerify("Pioneer1Vault",tokens.nft1.address, tokens.nft2.address, tokens.ampl.address) as [any, Pioneer1Vault];
  console.log("pioneer1");
  let [p3, pioneer2] = await deployVerify("StakingERC20",tokens.kmpl.address, eefiTokenAddress, 9) as [any, StakingERC20];
  console.log("pioneer2");
  let [p4, pioneer3] = await deployVerify("StakingERC20",tokens.kmplethlp.address, eefiTokenAddress, 9) as [any, StakingERC20];
  console.log("pioneer3");
  let [p5, staking_pool] = await deployVerify("StakingERC20",tokens.eefiethlp.address, eefiTokenAddress, 9) as [any, StakingERC20];
  console.log("staking pool");

  await vault.initialize(pioneer1.address, pioneer2.address, pioneer3.address, staking_pool.address, accounts[0].address);
  console.log("vault initialized");

  let [p6, trader] = await deployVerify("MockTrader","0x526B6Ed08093D6A6952109EeDb46c4bB7aC7278c", "0xa0d530c68c0a5547880727412adaf289465a27c4", hre.ethers.utils.parseUnits("1000000", "ether"), hre.ethers.utils.parseUnits("1000000000", "ether")) as [any, MockTrader];
  console.log("trader");

  await vault.TESTMINT(hre.ethers.utils.parseUnits("50000", "ether"), trader.address);
  await accounts[0].sendTransaction({
    to: trader.address,
    value: hre.ethers.utils.parseEther("1.0"),
    gasLimit: 999999
  });
  await vault.setTrader(trader.address);
  await pioneer1.setTrader(trader.address);

  

  const [p7, distributor] = await deployVerify("TokenDistributor", tokens.ampl.address, eefiTokenAddress, tokens.kmpl.address, tokens.kmplethlp.address, tokens.eefiethlp.address);
  console.log("Deployed distributor");

  //check etherscan verify
  await Promise.all([p1, p2, p3, p4, p5, p6, p7]).catch(error => {
    console.log("not all contracts were verified");
  });
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

  await tokens.ampl.transfer(distributor.address, 10000 * 10**9);
  await vault.TESTMINT(10000 * 10**9, distributor.address);
  await tokens.kmpl.transfer(distributor.address, 10000 * 10**9);
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
