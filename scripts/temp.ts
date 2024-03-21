const hre = require("hardhat");
import { ElasticVault } from "../typechain/ElasticVault";
import { StakingDoubleERC20 } from "../typechain/StakingDoubleERC20";
import { EEFIToken } from "../typechain/EEFIToken";
import { MockTrader } from "../typechain/MockTrader";
import { BigNumberish } from "ethers";

async function main() {
  const accounts = await hre.ethers.getSigners();

  const safeAddr = "0xf950a86013bAA227009771181a885E369e158da3";

  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [safeAddr],
  });
  await hre.network.provider.send("hardhat_setBalance", [
    safeAddr,
    "0x3635c9adc5dea00000"
  ]);


  let safeSigner = await hre.ethers.getSigner(safeAddr);

  const destinationAddress = "0x3A74D7cB25B4c633b166D4928Fc9c5aAD85f5D6A";

  const eefiAddr = "0x857FfC55B1Aa61A7fF847C82072790cAE73cd883";
  const amplAddr = "0xD46bA6D942050d489DBd938a2C909A5d5039A161";

  const eefiToken = await hre.ethers.getContractAt("EEFIToken", eefiAddr) as EEFIToken;
  const amplToken = await hre.ethers.getContractAt("@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20", amplAddr) as EEFIToken;

  const eefiohmlp = "0x79FE75708e834c5A6857A8B17eEaC651907c1dA8";

  const eefiohmlpToken = await hre.ethers.getContractAt("@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20", eefiohmlp) as EEFIToken;

  await hre.network.provider.send("hardhat_setBalance", [
    destinationAddress,
    "0x3635c9adc5dea00000"
  ]);

  // console.log("available balances");

  // console.log("AMPL balance: ", (await amplToken.balanceOf(safeAddr)).toString());
  // console.log("LP deployer balance: ", (await eefiohmlpToken.balanceOf(safeAddr)).toString());

  // await amplToken.connect(safeSigner).transfer(destinationAddress, 3000 * 10**9);
  // await eefiToken.connect(safeSigner).mint(destinationAddress, hre.ethers.utils.parseEther("2000"));
  // await eefiohmlpToken.connect(safeSigner).transfer(destinationAddress, "283602282346051675");



  // console.log("EEFI balance: ", (await eefiToken.balanceOf(destinationAddress)).toString());
  // console.log("AMPL balance: ", (await amplToken.balanceOf(destinationAddress)).toString());
  // console.log("LP deployer balance: ", (await eefiohmlpToken.balanceOf(destinationAddress)).toString());
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
