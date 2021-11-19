const hre = require("hardhat");
import { AmplesenseVault } from "../typechain/AmplesenseVault";
import { FakeAMPL } from "../typechain/FakeAMPL";

function delay(ms: number) {
  return new Promise( resolve => setTimeout(resolve, ms) );
}

async function main() {
  const accounts = await hre.ethers.getSigners();

  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: ["0x1b228a749077b8e307c5856ce62ef35d96dca2ea"],
  });

  await hre.network.provider.send("hardhat_setBalance", [
    "0x1b228a749077b8e307c5856ce62ef35d96dca2ea",
    "0x3635c9adc5dea00000"
  ]);

  const ampleMonetaryPolicy = await hre.ethers.getSigner("0x1b228a749077b8e307c5856ce62ef35d96dca2ea");

  const vault = await hre.ethers.getContractAt("AmplesenseVault", "0x4EE6eCAD1c2Dae9f525404De8555724e3c35d07B") as AmplesenseVault;
  const pioneer1 = await hre.ethers.getContractAt("AmplesenseVault", "0x1c85638e118b37167e9298c2268758e058DdfDA0") as AmplesenseVault;
  const amplToken = await hre.ethers.getContractAt("FakeAMPL", "0xd46ba6d942050d489dbd938a2c909a5d5039a161") as FakeAMPL;

  while(true) {
    // jump 24 hours always
    await hre.ethers.provider.send('evm_increaseTime', [3600*24]);
    await hre.ethers.provider.send('evm_mine', []); // this one will have 02:00 PM as its timestamp
    const rebaseAmount = hre.ethers.BigNumber.from((Math.floor(Math.random() * 1000) - 500)).mul(10**3);
    console.log("rebase amount " + rebaseAmount.toString());
    const res = await amplToken.connect(ampleMonetaryPolicy).rebase(0, rebaseAmount.mul(10**9));
    try{
      const tx = await vault.rebase();
      console.log(""+tx.gasLimit, ""+tx.gasPrice!);
    } catch(err) {
      console.log(err);
    };
    try{
      let pioneer1Ampl = hre.ethers.utils.formatUnits(await amplToken.balanceOf(pioneer1.address),9);
      console.log("pioneer ampl amount: " + pioneer1Ampl);
      if(pioneer1Ampl >= 40000) {
        await pioneer1.rebase();
      }
    } catch(err) {

    };
    await delay(10*1000);
  }
  
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
