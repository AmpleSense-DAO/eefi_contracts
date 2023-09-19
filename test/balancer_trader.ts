
import chai from 'chai';
import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';
import { solidity } from 'ethereum-waffle';
import { BalancerTrader } from '../typechain/BalancerTrader';
import { EEFIToken } from "../typechain/EEFIToken";
import { WeightedPool2TokensFactory } from "../typechain/WeightedPool2TokensFactory";
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
const ohm_token_address = "0x64aa3364F17a4D01c6f1751Fd97C2BD3D7e7f1D5";
const big_ohm_older_30189 = "0x3D7FEAB5cfab1c7De8ab2b7D5B260E76fD88BC78";

async function impersonateAndFund(address: string) : Promise<SignerWithAddress> {
  await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [address],
  });
  await hre.network.provider.send("hardhat_setBalance", [
  address,
  "0x3635c9adc5dea00000"
  ]);

  return await ethers.getSigner(address);
}

describe('BalancerTrader Contract', () => {

  let trader: BalancerTrader;
  let owner: string;
  let eefiToken : EEFIToken;
  let ohmToken : EEFIToken;

  before(async () => {
    
    const poolFactory = await ethers.getContractAt("WeightedPool2TokensFactory", weithed_pool_factory_address) as WeightedPool2TokensFactory;
    const balancerVault = await ethers.getContractAt("IVault", balancer_vault_address) as IVault;
    const router = await ethers.getContractAt("UniswapV2Router02", router_address) as UniswapV2Router02;
    ohmToken = await ethers.getContractAt("EEFIToken", ohm_token_address) as EEFIToken;

    const [ traderFactory, accounts ] = await Promise.all([
      ethers.getContractFactory('BalancerTrader'),
      ethers.getSigners(),
    ]);
    owner = accounts[0].address;

    // get ohm
    const holder = await impersonateAndFund(big_ohm_older_30189);
    await ohmToken.connect(holder).transfer(owner, BigNumber.from(30189).mul(10**9));

    eefiToken = await deploy("EEFIToken") as EEFIToken;
    // grant minting rights to the tester
    await eefiToken.grantRole(await eefiToken.MINTER_ROLE(), owner);

    let token1 = ohm_token_address;
    let token2 = eefiToken.address;
    if(BigNumber.from(token1) > BigNumber.from(token2)) {
      token1 = eefiToken.address;
      token2 = ohm_token_address;
    }

    let tx = await poolFactory.create("eefi pool", "eefipool", [token1, token2], ["500000000000000001", "499999999999999999"], 1e12, false, accounts[0].address);
    const poolCreationEvents = await poolFactory.queryFilter(poolFactory.filters.PoolCreated(null), tx.blockHash);
    const poolAddr = poolCreationEvents[poolCreationEvents.length - 1].args?.pool;
    console.log(poolAddr);
    
    const poolRegisterEvents = await balancerVault.queryFilter(balancerVault.filters.PoolRegistered(null, poolAddr, null));

    const poolID = poolRegisterEvents[0].args?.poolId;

    const JOIN_KIND_INIT = 0;
    const liquidity = BigNumber.from(30189).mul(10**9);
    const initUserData = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256[]'], 
                                        [JOIN_KIND_INIT, [liquidity, liquidity]]);
    const request = {
      assets : [token1, token2],
      maxAmountsIn : [liquidity, liquidity],
      userData : initUserData,
      fromInternalBalance : false
    }
    await eefiToken.mint(accounts[0].address, liquidity);
    await eefiToken.approve(balancerVault.address, liquidity);
    await ohmToken.approve(balancerVault.address, liquidity);
    await balancerVault.joinPool(poolID, accounts[0].address, accounts[0].address, request);

    
    trader = await traderFactory.deploy(eefiToken.address, poolID) as BalancerTrader;
    
    // buy ampl
    const ampl = await ethers.getContractAt("EEFIToken", ampl_address) as EEFIToken;
    const wethAddress = await router.WETH();
    await router.swapETHForExactTokens("10000000000000", [wethAddress, ampl_address], accounts[0].address, 999999999999, {value: ethers.utils.parseUnits("600", "ether")});
    await ampl.approve(trader.address, "10000000000000");
  });

  it('sellAMPLForOHM should fail if minimal amount fails to be reached', async () => {
    expect(trader.sellAMPLForOHM("5000000000000", "99999999999999999")).to.be.revertedWith("BalancerTrader: minimalExpectedAmount not acquired");
  });

  it('sellAMPLForEEFI should fail if minimal amount fails to be reached', async () => {
    expect(trader.sellAMPLForEEFI("5000000000000", "99999999999999999")).to.be.revertedWith("BalancerTrader: minimalExpectedAmount not acquired");
  });

  it('sellAMPLForOHM should work', async () => {
    const balance = await ohmToken.balanceOf(owner);
    await trader.sellAMPLForOHM("5000000000000", 0);
    const balance2 = await ohmToken.balanceOf(owner);
    const ohm = balance2.sub(balance).div(10**9);
    expect(ohm).to.be.gt(500);
  });

  it('sellAMPLForEEFI should work', async () => {
    const balance = await eefiToken.balanceOf(owner);
    await trader.sellAMPLForEEFI("50000000000", 0);
    const balance2 = await eefiToken.balanceOf(owner);
    const eefi = balance2.sub(balance);
    expect(eefi.toNumber()).to.be.gt(0);
  });
});