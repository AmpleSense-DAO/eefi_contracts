const hre = require("hardhat");
import { AmplesenseVault } from "../typechain/AmplesenseVault";
import { FakeERC20 } from "../typechain/FakeERC20";
import { FakeERC721 } from "../typechain/FakeERC721";
import { StakingERC20 } from "../typechain/StakingERC20";
import { StakingERC721 } from "../typechain/StakingERC721";

async function main() {
  const accounts = await hre.ethers.getSigners();
  const erc20Factory = await hre.ethers.getContractFactory("FakeERC20");
  const erc721Factory = await hre.ethers.getContractFactory("FakeERC721");
  const vaultFactory = await hre.ethers.getContractFactory("AmplesenseVault");
  const stakingerc20Factory = await hre.ethers.getContractFactory("StakingERC20");
  const stakingerc721Factory = await hre.ethers.getContractFactory("StakingERC721");
  let amplToken = await erc20Factory.deploy("9") as FakeERC20;
  let kmplToken = await erc20Factory.deploy("9") as FakeERC20;
  let nft1 = await erc721Factory.deploy() as FakeERC721;
  let nft2 = await erc721Factory.deploy() as FakeERC721;

  let routerAddress = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"; //on all nets

  if(hre.network.name == "localhost") {
    const uniswapRouterFactory = await hre.ethers.getContractFactory("FakeUniswapV2Router02");
    const router = await uniswapRouterFactory.deploy();
    routerAddress = router.address;
  }


  let vault = await vaultFactory.deploy(routerAddress, amplToken.address) as AmplesenseVault;

  let eefiTokenAddress = await vault.eefi_token();
  let eefiToken = await hre.ethers.getContractAt("FakeERC20", eefiTokenAddress) as FakeERC20;

  let pioneer1 = await stakingerc721Factory.deploy(nft1.address, nft2.address, amplToken.address) as StakingERC721;
  let pioneer2 = await stakingerc20Factory.deploy(kmplToken.address, eefiTokenAddress, 9) as StakingERC20;
  let pioneer3 = await stakingerc20Factory.deploy(kmplToken.address, eefiTokenAddress, 9) as StakingERC20;
  let staking_pool = await stakingerc20Factory.deploy(amplToken.address, eefiTokenAddress, 9) as StakingERC20;
  await vault.initialize(pioneer1.address, pioneer2.address, pioneer3.address, staking_pool.address, accounts[0]);

   //stake in all distribution contracts
   await amplToken.increaseAllowance(vault.address, 10**9);
   await kmplToken.increaseAllowance(pioneer2.address, 10**9);
   await pioneer2.stake(10**9, "0x");
   await kmplToken.increaseAllowance(pioneer3.address, 10**9);
   await pioneer3.stake(10**9, "0x");
   await amplToken.increaseAllowance(staking_pool.address, 10**9);
   await staking_pool.stake(10**9, "0x");

   await nft1.setApprovalForAll(pioneer1.address, true);
   await nft2.setApprovalForAll(pioneer1.address, true);
   await pioneer1.stake([0, 1], true);
   await pioneer1.stake([0, 1], false);

  console.log("Vault deployed to:", vault.address);
  console.log("AMPL deployed to:", amplToken.address);
  console.log("KMPL deployed to:", kmplToken.address);
  console.log("NFT deployed to:", nft1.address, nft2.address);
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
