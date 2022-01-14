const hre = require("hardhat");
import { TestAmplesenseVault } from "../typechain/TestAmplesenseVault";
import { StakingERC20 } from "../typechain/StakingERC20";
import { Pioneer1Vault } from "../typechain/Pioneer1Vault";
import { TokenDistributor } from "../typechain/TokenDistributor";
import { EEFIToken } from "../typechain/EEFIToken";
import { UniswapV2Router02 } from "../typechain/UniswapV2Router02";
import { IUniswapV2Factory } from "../typechain/IUniswapV2Factory";
import { WeightedPool2TokensFactory } from "../typechain/WeightedPool2TokensFactory";
import { WeightedPool2Tokens } from "../typechain/WeightedPool2Tokens";
import { IVault } from "../typechain/IVault";
import { deploy } from "./utils/deploy";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

async function main() {
  const accounts : SignerWithAddress[] = await hre.ethers.getSigners();

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
  const balancer_vault_address = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";
  const kmpl_eth_pool_address = "0xF00819f1AbeC513A565880a4708596E8dC838027";

  const AMPL_1000K = hre.ethers.BigNumber.from(100000).mul(hre.ethers.BigNumber.from(10).pow(9));
  const EEFI_100K = hre.ethers.BigNumber.from(100000).mul(hre.ethers.BigNumber.from(10).pow(18));
  const EEFI_10K = hre.ethers.BigNumber.from(10000).mul(hre.ethers.BigNumber.from(10).pow(18));
  const KMPL_5K = hre.ethers.BigNumber.from(5000).mul(hre.ethers.BigNumber.from(10).pow(9));
  console.log("deploying vault");

  const vault = await deploy("TestAmplesenseVault",ampl_address) as TestAmplesenseVault;

  console.log("Deployed vault");

  let eefiTokenAddress = await vault.eefi_token();
  let eefiToken = await hre.ethers.getContractAt("EEFIToken", eefiTokenAddress) as EEFIToken;
  const router = await hre.ethers.getContractAt("UniswapV2Router02", router_address) as UniswapV2Router02;
  const poolFactory = await hre.ethers.getContractAt("WeightedPool2TokensFactory", weithed_pool_factory_address) as WeightedPool2TokensFactory;
  const balancerVault = await hre.ethers.getContractAt("IVault", balancer_vault_address) as IVault;
  const kmpl = await hre.ethers.getContractAt("EEFIToken", kmpl_address) as EEFIToken;

  const wethAddress = await router.WETH();

  let weth = await hre.ethers.getContractAt("EEFIToken", wethAddress) as EEFIToken;
  
  // await router.swapETHForExactTokens(AMPL_100K, [wethAddress, ampl_address], accounts[0].address, 999999999999, {value: hre.ethers.utils.parseUnits("600", "ether")});
  // console.log("purchased 100K AMPL");

  // create EEFI/ETH pool
  //sort tokens by address

  let token1 = wethAddress;
  let token2 = eefiTokenAddress;
  // if(hre.ethers.BigNumber.from(token1) > hre.ethers.BigNumber.from(token2)) {
  //   token1 = eefiTokenAddress;
  //   token2 = wethAddress;
  // }

  let tx = await poolFactory.create("eefi pool", "eefipool", [token1, token2], ["850000000000000001", "149999999999999999"], 1e12, false, accounts[0].address);
  const poolCreationEvents = await poolFactory.queryFilter(poolFactory.filters.PoolCreated(null), tx.blockHash);
  const poolAddr = poolCreationEvents[poolCreationEvents.length - 1].args?.pool;
  // const pool = await hre.ethers.getContractAt("WeightedPool2Tokens", poolFactory.address) as WeightedPool2Tokens;
  // console.log(poolAddr);
  
  const poolRegisterEvents = await balancerVault.queryFilter(balancerVault.filters.PoolRegistered(null, poolAddr, null));

  const poolID = poolRegisterEvents[0].args?.poolId;
  // get 1500 WETH
  await accounts[0].sendTransaction({
    to: wethAddress,
    value: hre.ethers.utils.parseEther("3")
  });

  console.log("purchased 3 WETH");

  const JOIN_KIND_INIT = 0;

  // Construct magic userData
  const initUserData = hre.ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], 
                                        [JOIN_KIND_INIT, [hre.ethers.utils.parseEther("3"), hre.ethers.utils.parseUnits("50",9)]]);
  const request = {
    assets : [token1, token2],
    maxAmountsIn : [hre.ethers.utils.parseEther("3"), hre.ethers.utils.parseUnits("50",9)],
    userData : initUserData,
    fromInternalBalance : false
  }
  await vault.TESTMINT(hre.ethers.utils.parseUnits("50",9), accounts[0].address);
  await eefiToken.approve(balancerVault.address, hre.ethers.utils.parseUnits("50",9));
  await weth.approve(balancerVault.address, hre.ethers.utils.parseEther("3"));
  await balancerVault.joinPool(poolID, accounts[0].address, accounts[0].address, request, {value: hre.ethers.utils.parseUnits("3", "ether")});
  console.log("pool created");

  const pioneer1 = await deploy("Pioneer1Vault",nft1_address, nft2_address, ampl_address) as Pioneer1Vault;
  console.log("pioneer1");
  const pioneer2 = await deploy("StakingERC20",kmpl_address, eefiTokenAddress, 9) as StakingERC20;
  console.log("pioneer2");
  const pioneer3 = await deploy("StakingERC20",kmpl_eth_pool_address, eefiTokenAddress, 9) as StakingERC20;
  console.log("pioneer3");
  const staking_pool = await deploy("StakingERC20",poolAddr, eefiTokenAddress, 9) as StakingERC20;
  console.log("staking pool");

  await vault.initialize(pioneer1.address, pioneer2.address, pioneer3.address, staking_pool.address, accounts[0].address);
  console.log("vault initialized");

  const trader = await deploy("BalancerTrader",eefiTokenAddress, poolID) as Pioneer1Vault;
  await vault.setTrader(trader.address);
  await pioneer1.setTrader(trader.address);

  //deploy token distributor for testing
  const distributor = await deploy("TokenDistributor",ampl_address, eefiToken.address, kmpl_address, kmpl_eth_pool_address, poolAddr, nft1_address, nft2_address) as TokenDistributor;
  //give EEFI to distributor
  await vault.TESTMINT(EEFI_100K, distributor.address);
  // give AMPL to distributor
  await router.swapETHForExactTokens(AMPL_1000K, [wethAddress, ampl_address], distributor.address, 999999999999, {value: hre.ethers.utils.parseUnits("600", "ether")});
  console.log("purchased 1M AMPL");
  // give kMPL to distributor
  let signer = await hre.ethers.getSigner("0xf950a86013baa227009771181a885e369e158da3");
  await kmpl.connect(signer).transfer(distributor.address, "9038000000000");
  signer = await hre.ethers.getSigner("0xa4fc358455febe425536fd1878be67ffdbdec59a");
  await kmpl.connect(signer).transfer(distributor.address, "3427000000000");

  console.log("purchased KMPL");

  // give KMPL/ETH lp to distributor
  //const kmplETHLP = await hre.ethers.getContractAt("EEFIToken", kmpl_eth_pool_address, accounts[0]) as EEFIToken;
  //await kmplETHLP.transfer(distributor.address, await kmplETHLP.balanceOf(accounts[0].address));

  // give EEFI/ETH lp to distributor
  const ETHEEFILP = await hre.ethers.getContractAt("EEFIToken", poolAddr, accounts[0]) as EEFIToken;
  await ETHEEFILP.transfer(distributor.address, await ETHEEFILP.balanceOf(accounts[0].address));

  //get nfts
  signer = await hre.ethers.getSigner("0x471105Be0aD8987765A3e92d92Ac7301A6caDAf7");
  let abi = ["function mintWithTokenURI(address to, uint256 tokenId, string memory tokenURI) public"]
  let contract = new hre.ethers.Contract(nft1_address, abi, signer);
  for(let i = 99; i < 150; i++)
    await contract.mintWithTokenURI(distributor.address, i, "plop");
  signer = await hre.ethers.getSigner("0x695375090c1e9ca67f1495528162f055ed7630c5");
  contract = new hre.ethers.Contract(nft2_address, abi, signer);
  for(let i = 99; i < 150; i++)
    await contract.mintWithTokenURI(distributor.address, i, "plop");

  console.log("Distributor AMPL Balance 1M");
  console.log("Distributor KMPL Balance", hre.ethers.utils.formatUnits(await kmpl.balanceOf(distributor.address), 9));
  console.log("Distributor EEFI Balance 100000");
  console.log("Distributor KMPL/ETH LP Balance 0");
  console.log("Distributor EEFI/ETH LP Balance", hre.ethers.utils.formatEther(await ETHEEFILP.balanceOf(distributor.address)));

  console.log("Distributor deployed to " + distributor.address);
  console.log("EEFI deployed to " + eefiToken.address);
  console.log("AMPL deployed to " + ampl_address);
  console.log("KMPL deployed to " + kmpl_address);
  console.log("EEFIETHLP deployed to " + poolAddr);
  console.log("KMPLETHLP deployed to " + kmpl_eth_pool_address);
  console.log("Vault deployed to:", vault.address);
  console.log("Pioneer1 deployed to:", pioneer1.address);
  console.log("Pioneer2 deployed to:", pioneer2.address);
  console.log("Pioneer3 deployed to:", pioneer3.address);
  console.log("LPStaking deployed to:", staking_pool.address);
  console.log("NFT1 deployed to " + nft1_address);
  console.log("NFT2 deployed to " + nft2_address);
  

  const chainid = await hre.network.provider.send("eth_chainId", [
  ]);

  console.log(""+chainid);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
