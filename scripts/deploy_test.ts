const hre = require("hardhat");
import { ElasticVault } from "../typechain/ElasticVault";
import { StakingDoubleERC20 } from "../typechain/StakingDoubleERC20";
import { EEFIToken } from "../typechain/EEFIToken";
import { MockTrader } from "../typechain/MockTrader";

async function main() {
  const accounts = await hre.ethers.getSigners();

  const vaultFactory = await hre.ethers.getContractFactory("ElasticVault");
  const stakingerc20Factory = await hre.ethers.getContractFactory("StakingDoubleERC20");
  const traderFactory = await hre.ethers.getContractFactory("MockTrader");

  if(hre.network.name == "localhost") {

  }

  const eefiAddr = "0x857FfC55B1Aa61A7fF847C82072790cAE73cd883";
  const amplAddr = "0xD46bA6D942050d489DBd938a2C909A5d5039A161";
  const ohmAddr = "0x64aa3364F17a4D01c6f1751Fd97C2BD3D7e7f1D5";
  const eefiohmlpAddr = "0x79FE75708e834c5A6857A8B17eEaC651907c1dA8";

  let vault = await vaultFactory.deploy(eefiAddr, amplAddr) as ElasticVault;
  const eefiToken = await hre.ethers.getContractAt("EEFIToken", eefiAddr) as EEFIToken;
  // const ohmToken = await hre.ethers.getContractAt("@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20", ohmAddr) as EEFIToken;

  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: ["0xF416a7AcB0CF8081F6EF299605D44e25b3856Ff1"],
  });
  await hre.network.provider.send("hardhat_setBalance", [
    "0xF416a7AcB0CF8081F6EF299605D44e25b3856Ff1",
    "0x3635c9adc5dea00000"
  ]);

  let adminSigner = await hre.ethers.getSigner("0xF416a7AcB0CF8081F6EF299605D44e25b3856Ff1");

  // const ohmHolderAddr = "0x88E08adB69f2618adF1A3FF6CC43c671612D1ca4"
  // await hre.network.provider.request({
  //   method: "hardhat_impersonateAccount",
  //   params: [ohmHolderAddr],
  // });
  // await hre.network.provider.send("hardhat_setBalance", [
  //   ohmHolderAddr,
  //   "0x3635c9adc5dea00000"
  // ]);
  // let ohmHolder = await hre.ethers.getSigner(ohmHolderAddr);
  // await ohmToken.connect(ohmHolder).transfer(adminSigner.address, 1000 * 10**9);
  // await eefiToken.connect(adminSigner).grantRole(await eefiToken.MINTER_ROLE(), vault.address);

  // also grant minting role to admin for testing
  await eefiToken.connect(adminSigner).grantRole(await eefiToken.MINTER_ROLE(), adminSigner.address);

  let staking_pool = await stakingerc20Factory.deploy(eefiohmlpAddr, 18, eefiToken.address) as StakingDoubleERC20;

  let trader = await traderFactory.deploy(amplAddr, eefiToken.address, hre.ethers.utils.parseUnits("0.001", "ether"), hre.ethers.utils.parseUnits("0.1", "ether")) as MockTrader;
  await vault.initialize(staking_pool.address, accounts[0].address, trader.address);;

  console.log("Vault deployed to:", vault.address);
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
