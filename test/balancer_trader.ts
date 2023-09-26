
import chai from 'chai';
import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';
import { solidity } from 'ethereum-waffle';
import { Trader } from '../typechain/Trader';
import { EEFIToken } from "../typechain/EEFIToken";
import { UniswapV2Router02 } from "../typechain/UniswapV2Router02";
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { deploy } from "../scripts/utils/deploy";

chai.use(solidity);

const { expect } = chai;

const ampl_address = "0xd46ba6d942050d489dbd938a2c909a5d5039a161";
const router_address = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const ohm_token_address = "0x64aa3364F17a4D01c6f1751Fd97C2BD3D7e7f1D5";
const big_ohm_older_10000 = "0xfa4843C82789f00311E6Ae1b67f35849b6A9f7fd";

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

describe('Trader Contract', () => {

  let trader: Trader;
  let owner: string;
  let eefiToken : EEFIToken;
  let ohmToken : EEFIToken;

  before(async () => {
    const router = await ethers.getContractAt("UniswapV2Router02", router_address) as UniswapV2Router02;
    ohmToken = await ethers.getContractAt("EEFIToken", ohm_token_address) as EEFIToken;

    const [ traderFactory, accounts ] = await Promise.all([
      ethers.getContractFactory('Trader'),
      ethers.getSigners(),
    ]);
    owner = accounts[0].address;

    // get ohm
    const holder = await impersonateAndFund(big_ohm_older_10000);
    await ohmToken.connect(holder).transfer(owner, BigNumber.from(10000).mul(10**9));

    eefiToken = await deploy("EEFIToken") as EEFIToken;
    // grant minting rights to the tester
    await eefiToken.grantRole(await eefiToken.MINTER_ROLE(), owner);

    let token1 = ohm_token_address;
    let token2 = eefiToken.address;
    const liq1 = BigNumber.from(10000).mul(10**9);
    const liq2 = ethers.utils.parseUnits("10000", "ether");
    await eefiToken.mint(owner, liq2);
    await ohmToken.approve(router.address, liq1);
    await eefiToken.approve(router.address, liq2);
    // create uniswapv2 OHM/EEFI pool
    await router.addLiquidity(token1, token2, liq1, liq2, liq1, liq2, owner, 999999999999);
    
    trader = await traderFactory.deploy(eefiToken.address) as Trader;
    
    // buy ampl
    const ampl = await ethers.getContractAt("EEFIToken", ampl_address) as EEFIToken;
    const wethAddress = await router.WETH();
    await router.swapETHForExactTokens("10000000000000", [wethAddress, ampl_address], accounts[0].address, 999999999999, {value: ethers.utils.parseUnits("600", "ether")});
    await ampl.approve(trader.address, "10000000000000");
  });

  it('sellAMPLForOHM should fail if minimal amount fails to be reached', async () => {
    await expect(trader.sellAMPLForOHM("5000000000000", "999999999999999999999")).to.be.revertedWith("Trader: minimalExpectedAmount not acquired");
  });

  it('sellAMPLForEEFI should fail if minimal amount fails to be reached', async () => {
    await expect(trader.sellAMPLForEEFI("5000000000000", "999999999999999999999")).to.be.revertedWith("Trader: minimalExpectedAmount not acquired");
  });

  it('sellAMPLForOHM should work', async () => {
    const balance = await ohmToken.balanceOf(owner);
    await trader.sellAMPLForOHM("5000000000000", 0);
    const balance2 = await ohmToken.balanceOf(owner);
    const ohm = balance2.sub(balance).div(10**9);
    expect(ohm).to.be.gt(470);
  });

  it('sellAMPLForEEFI should work', async () => {
    const balance = await eefiToken.balanceOf(owner);
    await trader.sellAMPLForEEFI("50000000000", 0);
    const balance2 = await eefiToken.balanceOf(owner);
    const eefi = balance2.sub(balance);
    const eefiParsed = ethers.utils.formatUnits(eefi, "ether");
    expect(parseFloat(eefiParsed)).to.be.gt(4);
  });
});