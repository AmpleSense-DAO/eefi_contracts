
import chai from 'chai';
import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';
import { solidity } from 'ethereum-waffle';
import { formatBytes32String } from 'ethers/lib/utils';

import { FakeERC20 } from '../typechain/FakeERC20';
import { BalancerTrader } from '../typechain/BalancerTrader';
import { AmplesenseVault } from "../typechain/AmplesenseVault";
import { EEFIToken } from "../typechain/EEFIToken";
import { WeightedPool2TokensFactory } from "../typechain/WeightedPool2TokensFactory";
import { WeightedPool2Tokens } from "../typechain/WeightedPool2Tokens";
import { IVault } from "../typechain/IVault";
import { UniswapV2Router02 } from "../typechain/UniswapV2Router02";
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { deploy } from "../scripts/utils/deploy";

chai.use(solidity);

const { expect } = chai;

const balancer_vault_address = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";
const ampl_address = "0xd46ba6d942050d489dbd938a2c909a5d5039a161";
const weithed_pool_factory_address = "0xA5bf2ddF098bb0Ef6d120C98217dD6B141c74EE0";
const router_address = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

describe('BalancerTrader Contract', () => {

  let token: FakeERC20;
  let trader: BalancerTrader;
  let owner: string;
  let eefiToken : EEFIToken;
  let wethToken : EEFIToken;

  before(async () => {

    const poolFactory = await ethers.getContractAt("WeightedPool2TokensFactory", weithed_pool_factory_address) as WeightedPool2TokensFactory;
    const balancerVault = await ethers.getContractAt("IVault", balancer_vault_address) as IVault;
    const router = await ethers.getContractAt("UniswapV2Router02", router_address) as UniswapV2Router02;
    const factoryAddress = await router.factory();
    const wethAddress = await router.WETH();
    wethToken = await ethers.getContractAt("EEFIToken", wethAddress) as EEFIToken;

    const [ traderFactory, accounts ] = await Promise.all([
      ethers.getContractFactory('BalancerTrader'),
      ethers.getSigners(),
    ]);

    const vault = await deploy("AmplesenseVault",ampl_address) as AmplesenseVault;
    let eefiTokenAddress = await vault.eefi_token();
    eefiToken = await ethers.getContractAt("EEFIToken", eefiTokenAddress) as EEFIToken;

    let token1 = wethAddress;
    let token2 = eefiTokenAddress;
    if(BigNumber.from(token1) > BigNumber.from(token2)) {
      token1 = eefiTokenAddress;
      token2 = wethAddress;
    }

    let tx = await poolFactory.create("eefi pool", "eefipool", [token1, token2], ["500000000000000001", "499999999999999999"], 1e12, false, accounts[0].address);

    const poolCreationEvents = await poolFactory.queryFilter(poolFactory.filters.PoolCreated(null), tx.blockHash);
    const poolAddr = poolCreationEvents[poolCreationEvents.length - 1].args?.pool;
    const pool = await ethers.getContractAt("WeightedPool2Tokens", factoryAddress) as WeightedPool2Tokens;
    console.log(poolAddr);
    
    const poolRegisterEvents = await balancerVault.queryFilter(balancerVault.filters.PoolRegistered(null, poolAddr, null));

    const poolID = poolRegisterEvents[0].args?.poolId;

    const JOIN_KIND_INIT = 0;
    const ethLiquidity = ethers.utils.parseEther("20");
    const initUserData = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], 
                                        [JOIN_KIND_INIT, [ethLiquidity, ethLiquidity]]);

    
    const request = {
      assets : [token1, token2],
      maxAmountsIn : [ethLiquidity, ethLiquidity],
      userData : initUserData,
      fromInternalBalance : false
    }
    await vault.TESTMINT(ethLiquidity, accounts[0].address);
    await eefiToken.approve(balancerVault.address, ethLiquidity);
    // get weth
    await accounts[0].sendTransaction({
      to: wethAddress,
      value: ethLiquidity
    });
    await wethToken.approve(balancerVault.address, ethLiquidity);
    await balancerVault.joinPool(poolID, accounts[0].address, accounts[0].address, request);

    owner = accounts[0].address;
    trader = await traderFactory.deploy(eefiTokenAddress, poolID) as BalancerTrader;
    
  });

  it('sellAMPLForEth', async () => {
    const accounts = await ethers.getSigners();
    // buy ampl
    const ampl = await ethers.getContractAt("EEFIToken", ampl_address) as EEFIToken;
    const router = await ethers.getContractAt("UniswapV2Router02", router_address) as UniswapV2Router02;
    const wethAddress = await router.WETH();
    // get ampl
    await router.swapETHForExactTokens("5000000000000", [wethAddress, ampl_address], accounts[0].address, 999999999999, {value: ethers.utils.parseUnits("600", "ether")});
    await ampl.approve(trader.address, "5000000000000");
    const balance = await accounts[0].getBalance();
    await trader.sellAMPLForEth("5000000000000");
    const balance2 = await accounts[0].getBalance();
    const eth = ethers.utils.formatEther(balance2.sub(balance));
    expect(parseFloat(eth)).to.be.gt(1);
  });

  it('sellAMPLForEEFI', async () => {
    const accounts = await ethers.getSigners();
    // buy ampl
    const ampl = await ethers.getContractAt("EEFIToken", ampl_address) as EEFIToken;
    const router = await ethers.getContractAt("UniswapV2Router02", router_address) as UniswapV2Router02;
    const wethAddress = await router.WETH();
    // get ampl
    await router.swapETHForExactTokens("50000000000", [wethAddress, ampl_address], accounts[0].address, 999999999999, {value: ethers.utils.parseUnits("600", "ether")});
    await ampl.approve(trader.address, "50000000000");
    const balance = await eefiToken.balanceOf(accounts[0].address);
    await trader.sellAMPLForEEFI("50000000000");
    const balance2 = await eefiToken.balanceOf(accounts[0].address);
    const eefi = ethers.utils.formatEther(balance2.sub(balance));
    expect(parseFloat(eefi)).to.be.gt(0);
  });
});