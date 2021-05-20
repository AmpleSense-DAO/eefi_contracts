const hre = require("hardhat");
import { FakeAMPL } from "../../typechain/FakeAMPL";
import { FakeERC20 } from "../../typechain/FakeERC20";
import { WETH } from "../../typechain/WETH";

export async function deployTokens() {
  const accounts = await hre.ethers.getSigners();
  const factory = await hre.ethers.getContractFactory("FakeAMPL");
  const erc20Factory = await hre.ethers.getContractFactory("FakeERC20");
  const wethFactory = await hre.ethers.getContractFactory("WETH");
  let ampl = await factory.deploy() as FakeAMPL;
  let eefi = await erc20Factory.deploy("9") as FakeERC20;
  let usdc = await erc20Factory.deploy("6") as FakeERC20;
  let weth = await wethFactory.deploy(accounts[0].address) as WETH;
  return {ampl, eefi, usdc, weth}
}


// async function main() {
//   let tokens = await deployTokens();

//   console.log("AMPL deployed to " + tokens[0]);
//   console.log("EEFI deployed to " + tokens[1]);
//   console.log("USDC deployed to " + tokens[2]);
//   console.log("WETH deployed to " + tokens[3]);
// }

// // We recommend this pattern to be able to use async/await everywhere
// // and properly handle errors.
// main()
//   .then(() => process.exit(0))
//   .catch(error => {
//     console.error(error);
//     process.exit(1);
//   });
