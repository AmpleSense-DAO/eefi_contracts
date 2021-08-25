const hre = require("hardhat");
import { AmplesenseVault } from "../typechain/AmplesenseVault";
import { StakingERC20 } from "../typechain/StakingERC20";
import { Pioneer1Vault } from "../typechain/Pioneer1Vault";
import { EEFIToken } from "../typechain/EEFIToken";
import { UniswapV2Router02 } from "../typechain/UniswapV2Router02";
import { IUniswapV2Factory } from "../typechain/IUniswapV2Factory";
import { WeightedPool2TokensFactory } from "../typechain/WeightedPool2TokensFactory";
import { WeightedPool2Tokens } from "../typechain/WeightedPool2Tokens";
import { IVault } from "../typechain/IVault";
import { deploy } from "./utils/deploy";
import { formatBytes32String } from 'ethers/lib/utils';
import { encodeJoin } from "./utils/encoding"

async function main() {
  const accounts = await hre.ethers.getSigners();

  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: ["0xf950a86013baa227009771181a885e369e158da3"],
  });
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: ["0x695375090c1e9ca67f1495528162f055ed7630c5"],
  });
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: ["0xa4fc358455febe425536fd1878be67ffdbdec59a"],
  });
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: ["0x471105Be0aD8987765A3e92d92Ac7301A6caDAf7"],
  });
  await hre.network.provider.send("hardhat_setBalance", [
    "0xf950a86013baa227009771181a885e369e158da3",
    "0x3635c9adc5dea00000"
  ]);
  await hre.network.provider.send("hardhat_setBalance", [
    "0xa4fc358455febe425536fd1878be67ffdbdec59a",
    "0x3635c9adc5dea00000"
  ]);
  await hre.network.provider.send("hardhat_setBalance", [
    "0x695375090C1E9ca67f1495528162f055eD7630c5",
    "0x3635c9adc5dea00000"
  ]);
  await hre.network.provider.send("hardhat_setBalance", [
    "0x471105Be0aD8987765A3e92d92Ac7301A6caDAf7",
    "0x3635c9adc5dea00000"
  ]);

  const ampl_address = "0xd46ba6d942050d489dbd938a2c909a5d5039a161";
  const nft1_address = "0x2a99792F7C310874F3C24860c06322E26D162c6B";
  const nft2_address = "0x74ee0c3882b97d3d2a04c81c72d16878876329e4";
  const kmpl_address = "0xe8d17542dfe79ff4fbd4b850f2d39dc69c4489a2";
  const router_address = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
  const weithed_pool_factory_address = "0xA5bf2ddF098bb0Ef6d120C98217dD6B141c74EE0";
  const usdc_address = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const balancer_vault_address = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";

  console.log("deploying vault");

  const vault = await deploy("AmplesenseVault",ampl_address) as AmplesenseVault;

  console.log("Deployed vault");

  let eefiTokenAddress = await vault.eefi_token();
  let eefiToken = await hre.ethers.getContractAt("EEFIToken", eefiTokenAddress) as EEFIToken;
  const router = await hre.ethers.getContractAt("UniswapV2Router02", router_address) as UniswapV2Router02;
  const poolFactory = await hre.ethers.getContractAt("WeightedPool2TokensFactory", weithed_pool_factory_address) as WeightedPool2TokensFactory;
  const balancerVault = await hre.ethers.getContractAt("IVault", balancer_vault_address) as IVault;
  const kmpl = await hre.ethers.getContractAt("EEFIToken", kmpl_address) as EEFIToken;
  const usdc = await hre.ethers.getContractAt("EEFIToken", usdc_address) as EEFIToken;

  const wethAddress = await router.WETH();

  await vault.TESTMINT("50000000000000000000000", accounts[0].address);
  await eefiToken.approve(router.address, "50000000000000000000000");
  
  const factoryAddress = await router.factory();
  const factory = await hre.ethers.getContractAt("IUniswapV2Factory", factoryAddress) as IUniswapV2Factory;
  await router.addLiquidityETH(eefiTokenAddress, "50000000000000000000000",0,0,accounts[0].address,9999999999999, {value: hre.ethers.utils.parseUnits("10", "ether")});
  const eefi_ethlp_address = await factory.getPair(eefiTokenAddress, wethAddress);
  console.log("eefi eth pool deployed at " + eefi_ethlp_address);
  
  await router.swapETHForExactTokens("50000000000000", [wethAddress, ampl_address], accounts[0].address, 999999999999, {value: hre.ethers.utils.parseUnits("600", "ether")});
  console.log("purchased 50K AMPL");

  // get usdc
  await router.swapETHForExactTokens("50000000000", [wethAddress, usdc_address], accounts[0].address, 999999999999, {value: hre.ethers.utils.parseUnits("600", "ether")});
  console.log("purchased 50000 USDC");

  //get kmpl  
  

  let signer = await hre.ethers.getSigner("0xf950a86013baa227009771181a885e369e158da3");
  await kmpl.connect(signer).transfer(accounts[0].address, "9038000000000");
  signer = await hre.ethers.getSigner("0xa4fc358455febe425536fd1878be67ffdbdec59a");
  await kmpl.connect(signer).transfer(accounts[0].address, "3427000000000");
  console.log("got 10K kMPL");

  await vault.TESTMINT("10000000000000", accounts[0].address);
  await eefiToken.approve(router.address, "10000000000000");
  await kmpl.approve(router.address, "10000000000000");
  await router.addLiquidity(eefiTokenAddress, kmpl_address, "10000000000000", "10000000000000", 0, 0, accounts[0].address,9999999999999);
  const kmpl_eefilp_address = await factory.getPair(eefiTokenAddress, kmpl_address);

  console.log("kmpl eefi pool deployed at " + kmpl_eefilp_address);

  //get nfts
  signer = await hre.ethers.getSigner("0x471105Be0aD8987765A3e92d92Ac7301A6caDAf7");
  let abi = ["function mintWithTokenURI(address to, uint256 tokenId, string memory tokenURI) public"]
  let contract = new hre.ethers.Contract(nft1_address, abi, signer);
  await contract.mintWithTokenURI(accounts[0].address, 99, "plop");
  await contract.mintWithTokenURI(accounts[0].address, 100, "plop");
  await contract.mintWithTokenURI(accounts[0].address, 101, "plop");
  await contract.mintWithTokenURI(accounts[0].address, 102, "plop");
  signer = await hre.ethers.getSigner("0x695375090c1e9ca67f1495528162f055ed7630c5");
  contract = new hre.ethers.Contract(nft2_address, abi, signer);
  await contract.mintWithTokenURI(accounts[0].address, 99, "plop");
  await contract.mintWithTokenURI(accounts[0].address, 100, "plop");
  await contract.mintWithTokenURI(accounts[0].address, 101, "plop");
  await contract.mintWithTokenURI(accounts[0].address, 102, "plop");

  const pioneer1 = await deploy("Pioneer1Vault",nft1_address, nft2_address, ampl_address) as Pioneer1Vault;
  console.log("pioneer1");
  const pioneer2 = await deploy("StakingERC20",kmpl_address, eefiTokenAddress, 18) as StakingERC20;
  console.log("pioneer2");
  const pioneer3 = await deploy("StakingERC20",kmpl_eefilp_address, eefiTokenAddress, 18) as StakingERC20;
  console.log("pioneer3");
  const staking_pool = await deploy("StakingERC20",eefi_ethlp_address, eefiTokenAddress, 18) as StakingERC20;
  console.log("staking pool");

  await vault.initialize(pioneer1.address, pioneer2.address, pioneer3.address, staking_pool.address, accounts[0].address);
  console.log("vault initialized");

  let tx = await poolFactory.create("eefi pool", "eefipool", [usdc_address, eefiTokenAddress], ["500000000000000001", "499999999999999999"], 1e12, false, accounts[0].address);
  const poolCreationEvents = await poolFactory.queryFilter(poolFactory.filters.PoolCreated(null), tx.blockHash);
  const poolAddr = poolCreationEvents[poolCreationEvents.length - 1].args?.pool;
  const pool = await hre.ethers.getContractAt("WeightedPool2Tokens", factoryAddress) as WeightedPool2Tokens;
  console.log(poolAddr);
  
  const poolRegisterEvents = await balancerVault.queryFilter(balancerVault.filters.PoolRegistered(null, poolAddr, null));

  const poolID = poolRegisterEvents[0].args?.poolId;
  // await pool.queryJoin(poolID, accounts[0].address, accounts[0].address, ["50000000000", "50000000000"], "0", 
  const request = {
    assets : [usdc_address, eefiTokenAddress],
    maxAmountsIn : ["100000000000", "100000000000"],
    userData : encodeJoin(["50000000000", "50000000000"], ["0","0"]),
    fromInternalBalance : false
  }
  await vault.TESTMINT("10000000000000", accounts[0].address);
  await eefiToken.approve(poolAddr, "50000000000");
  await usdc.approve(poolAddr, "50000000000");
  console.log("" + await usdc.balanceOf(accounts[0].address));
  console.log("" + await eefiToken.balanceOf(accounts[0].address));
  await balancerVault.joinPool(poolID, accounts[0].address, accounts[0].address, request);
  console.log("pool created");

  const trader = await deploy("BalancerTrader",eefiTokenAddress, poolID) as Pioneer1Vault;
  await vault.setTrader(trader.address);
  await pioneer1.setTrader(trader.address);

  console.log("AMPL deployed to " + ampl_address);
  console.log("EEFI deployed to " + eefiToken.address);
  console.log("KMPL deployed to " + kmpl_address);
  console.log("EEFIETHLP deployed to " + eefi_ethlp_address);
  console.log("KMPLEEFILP deployed to " + kmpl_eefilp_address);
  console.log("Vault deployed to:", vault.address);
  console.log("Pioneer1 deployed to:", pioneer1.address);
  console.log("Pioneer2 deployed to:", pioneer2.address);
  console.log("Pioneer3 deployed to:", pioneer3.address);
  console.log("LPStaking deployed to:", staking_pool.address);
  console.log("NFT1 deployed to " + nft1_address);
  console.log("NFT2 deployed to " + nft2_address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
