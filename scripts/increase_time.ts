const hre = require("hardhat");

function delay(ms: number) {
  return new Promise( resolve => setTimeout(resolve, ms) );
}

async function main() {
  while(true) {
    // jump 90 days
    await hre.ethers.provider.send('evm_increaseTime', [3600*24*90]);
    await hre.ethers.provider.send('evm_mine', []); // this one will have 02:00 PM as its timestamp
    await delay(10*60*1000);
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
