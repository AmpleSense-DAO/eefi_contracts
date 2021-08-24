const hre = require("hardhat");
import { deployVerify } from "./deploy";
import { FakeAMPL } from "../../typechain/FakeAMPL";
import { FakeERC20 } from "../../typechain/FakeERC20";
import { FakeERC721 } from "../../typechain/FakeERC721";
import { WETH } from "../../typechain/WETH";

export async function deployTokens() {
  const accounts = await hre.ethers.getSigners();

  let ampl = await deployVerify("FakeAMPL") as FakeAMPL;
  let usdc = await deployVerify("FakeERC20","6") as FakeERC20;
  let kmpl = await deployVerify("FakeERC20","9") as FakeERC20;
  let kmplethlp = await deployVerify("FakeERC20","18") as FakeERC20;
  let eefiethlp = await deployVerify("FakeERC20","18") as FakeERC20;
  let weth = await deployVerify("WETH",accounts[0].address) as WETH;
  let nft1 = await deployVerify("FakeERC721") as FakeERC721;
  let nft2 = await deployVerify("FakeERC721") as FakeERC721;
  return {ampl, usdc, weth, kmpl, kmplethlp, eefiethlp, nft1, nft2}
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
