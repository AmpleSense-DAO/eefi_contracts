const hre = require("hardhat");
import { ElasticVault } from "../typechain/ElasticVault";
import { StakingDoubleERC20 } from "../typechain/StakingDoubleERC20";
import { EEFIToken } from "../typechain/EEFIToken";
import { MockTrader } from "../typechain/MockTrader";
import { BigNumberish } from "ethers";

async function main() {
  const accounts = await hre.ethers.getSigners();

  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: ["0xf950a86013bAA227009771181a885E369e158da3"],
  });
  await hre.network.provider.send("hardhat_setBalance", [
    "0xf950a86013bAA227009771181a885E369e158da3",
    "0x3635c9adc5dea00000"
  ]);

  let adminSigner = await hre.ethers.getSigner("0xf950a86013bAA227009771181a885E369e158da3");

  const eefiAddr = "0x4cFc3f4095D19b84603C11FD8A2F0154e9036a98";
  const ohmAddr = "0x64aa3364F17a4D01c6f1751Fd97C2BD3D7e7f1D5";
  const amplAddr = "0xD46bA6D942050d489DBd938a2C909A5d5039A161";

  const eefiToken = await hre.ethers.getContractAt("EEFIToken", eefiAddr) as EEFIToken;
  const ohmToken = await hre.ethers.getContractAt("@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20", ohmAddr) as EEFIToken;
  const amplToken = await hre.ethers.getContractAt("@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20", amplAddr) as EEFIToken;

  console.log("EEFI balance: ", (await eefiToken.balanceOf("0x3A74D7cB25B4c633b166D4928Fc9c5aAD85f5D6A")).toString());
  console.log("OHM balance: ", (await ohmToken.balanceOf("0x3A74D7cB25B4c633b166D4928Fc9c5aAD85f5D6A")).toString());
  console.log("AMPL balance: ", (await amplToken.balanceOf("0x3A74D7cB25B4c633b166D4928Fc9c5aAD85f5D6A")).toString());

  // const amplHolder = "0x7b32Ec1A1768cfF4a2Ef7B34bc1783eE1F8965F9";
  // await hre.network.provider.request({
  //   method: "hardhat_impersonateAccount",
  //   params: [amplHolder],
  // });
  // await hre.network.provider.send("hardhat_setBalance", [
  //   amplHolder,
  //   "0x3635c9adc5dea00000"
  // ]);
  // const amplHolderSigner = await hre.ethers.getSigner(amplHolder);

  // await amplToken.connect(amplHolderSigner).transfer("0x3A74D7cB25B4c633b166D4928Fc9c5aAD85f5D6A", 3000 * 10**9);

  // await hre.network.provider.request({
  //   method: "hardhat_impersonateAccount",
  //   params: ["0xF416a7AcB0CF8081F6EF299605D44e25b3856Ff1"],
  // });

  // let admin2Signer = await hre.ethers.getSigner("0xF416a7AcB0CF8081F6EF299605D44e25b3856Ff1");

  // //await eefiToken.connect(admin2Signer).mint("0x3A74D7cB25B4c633b166D4928Fc9c5aAD85f5D6A", hre.ethers.utils.parseEther("2000"));

  // // await eefiToken.connect(adminSigner).transfer("0x3A74D7cB25B4c633b166D4928Fc9c5aAD85f5D6A", hre.ethers.utils.parseEther("2000"));
  // // console.log("EEFI transferred to 0x3A74D7cB25B4c633b166D4928Fc9c5aAD85f5D6A")
  // await ohmToken.connect(adminSigner).transfer("0x3A74D7cB25B4c633b166D4928Fc9c5aAD85f5D6A", 2000*10**9);
  // console.log("OHM transferred to 0x3A74D7cB25B4c633b166D4928Fc9c5aAD85f5D6A")

  
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
