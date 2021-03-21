const hre = require("hardhat");
import { AmplesenseVault } from "../typechain/AmplesenseVault";
import { FakeERC20 } from "../typechain/FakeERC20";
import { StakingERC20 } from "../typechain/StakingERC20";

async function main() {
  const accounts = await hre.ethers.getSigners();
  const erc20Factory = await hre.ethers.getContractFactory("FakeERC20");
  let amplToken = await erc20Factory.deploy("9") as FakeERC20;
  let kmplToken = await erc20Factory.deploy("9") as FakeERC20;

  const uniswapRouterFactory = await hre.ethers.getContractFactory("FakeUniswapV2Router02");
  const router = await uniswapRouterFactory.deploy();

  const vaultFactory = await hre.ethers.getContractFactory("AmplesenseVault");
  let vault = await vaultFactory.deploy(router.address, amplToken.address) as AmplesenseVault;

  let eefiTokenAddress = await vault.eefi_token();
  let eefiToken = await hre.ethers.getContractAt("FakeERC20", eefiTokenAddress) as FakeERC20;
  
  const stakingerc20Factory = await hre.ethers.getContractFactory("StakingERC20");
  let pioneer1 = await stakingerc20Factory.deploy(amplToken.address, amplToken.address, 9) as StakingERC20;
  let pioneer2 = await stakingerc20Factory.deploy(kmplToken.address, eefiTokenAddress, 9) as StakingERC20;
  let staking_pool = await stakingerc20Factory.deploy(amplToken.address, eefiTokenAddress, 9) as StakingERC20;
  await vault.initialize(pioneer1.address, pioneer2.address, staking_pool.address);

   //stake in all distribution contracts
   await amplToken.increaseAllowance(vault.address, 10**9);
   await kmplToken.increaseAllowance(pioneer2.address, 10**9);
   await pioneer2.stake(10**9, "0x");
   await amplToken.increaseAllowance(staking_pool.address, 10**9);
   await staking_pool.stake(10**9, "0x");
   await amplToken.increaseAllowance(pioneer1.address, 10**9);
   await pioneer1.stake(10**9, "0x");

  console.log("Vault deployed to:", vault.address);
  console.log("AMPL deployed to:", amplToken.address);
  console.log("KMPL deployed to:", kmplToken.address);
  console.log("Pioneer1 deployed to:", pioneer1.address);
  console.log("Pioneer2 deployed to:", pioneer2.address);
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
