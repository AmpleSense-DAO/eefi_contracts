
import chai from 'chai';
import { ethers, network } from 'hardhat';
import { BigNumber } from 'ethers';
import { solidity } from 'ethereum-waffle';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import { FakeERC20 } from '../typechain/FakeERC20';
import { FakeERC721 } from '../typechain/FakeERC721';
import { Pioneer1Vault } from '../typechain/Pioneer1Vault';
import { MockTrader } from '../typechain/MockTrader';
import { FakeAMPL } from '../typechain/FakeAMPL';

chai.use(solidity);

const { expect } = chai;

const initialTokenBalance = BigNumber.from('50000000000000000');
const zeroAddress = '0x0000000000000000000000000000000000000000';
const initialEthBalance = BigNumber.from('0x21E19E0C9BAB2400000');

describe('Pioneer1Vault Contract', () => {

  let tokenA: FakeERC721;
  let tokenB: FakeERC721;
  let trader: MockTrader;
  let amplToken: FakeAMPL;
  let eefiToken: FakeERC20;
  let pioneer: Pioneer1Vault;
  let owner: SignerWithAddress;
  let userA: SignerWithAddress;

  beforeEach(async () => {

    const [ amplFactory, erc20Factory, erc721Factory, traderFactory, pioneerFactory, accounts ] = await Promise.all([
      ethers.getContractFactory('FakeAMPL'),
      ethers.getContractFactory('FakeERC20'),
      ethers.getContractFactory('FakeERC721'),
      ethers.getContractFactory('MockTrader'),
      ethers.getContractFactory('Pioneer1Vault'),
      ethers.getSigners(),
    ]);

    owner = accounts[0];
    userA = accounts[1];

    [ tokenA, tokenB, amplToken, eefiToken ] = await Promise.all([
      erc721Factory.deploy() as Promise<FakeERC721>,
      erc721Factory.deploy() as Promise<FakeERC721>,
      amplFactory.deploy() as Promise<FakeAMPL>,
      erc20Factory.deploy('9') as Promise<FakeERC20>,
    ]);

    trader = await traderFactory.deploy(amplToken.address, eefiToken.address, ethers.utils.parseEther('1'), ethers.utils.parseEther('1')) as MockTrader;

    pioneer = await pioneerFactory.deploy(tokenA.address, tokenB.address, amplToken.address) as Pioneer1Vault;
  });

  it('Deploy should revert', async () => {
    const pioneerFactory = await ethers.getContractFactory('Pioneer1Vault');
    await expect(pioneerFactory.deploy(tokenA.address, tokenB.address, zeroAddress)).to.be.revertedWith('AMPLRebaser: Invalid ampl token address');
  });

  it('Should have been deployed correctly', async () => {

    const traderAddress = await pioneer.trader();
    const amplAddress = await pioneer.ampl();
    const tokenAAddress = await pioneer.tokenA();
    const tokenBAddress = await pioneer.tokenB();
    const lastAmplSupply = await pioneer.last_ampl_supply();
    
    expect(traderAddress).to.be.equal(zeroAddress);
    expect(amplAddress).to.be.equal(amplToken.address);
    expect(tokenAAddress).to.be.equal(tokenA.address);
    expect(tokenBAddress).to.be.equal(tokenB.address);
    expect(lastAmplSupply).to.be.equal(initialTokenBalance);
  });

  describe('Set Trader', () => {

    it('Should revert with invalid trader', async () => {
      await expect(pioneer.setTrader(zeroAddress)).to.be.revertedWith('Pioneer1Vault: invalid trader');
    });

    it('Should work as intended', async () => {

      const beforeTraderAddress = await pioneer.trader();
      
      await pioneer.setTrader(trader.address);

      const afterTraderAddress = await pioneer.trader();

      expect(beforeTraderAddress).to.be.equal(zeroAddress);
      expect(afterTraderAddress).to.be.equal(trader.address);
    });
  });

  describe('Rebase', () => {

    it('Should revert (less than 24h)', async () => {
      await expect(pioneer.rebase()).to.be.revertedWith('AMPLRebaser: rebase can only be called once every 24 hours');
    });

    it('Should work as intended (no supply increase)', async () => {
      await network.provider.send('evm_increaseTime', [ 60 * 60 * 25 ]); // time travel 25 hours in the future

      const tx = await pioneer.rebase();
      
      expect(tx).to.have.emit(pioneer, 'Rebase').withArgs(
        BigNumber.from(initialTokenBalance),
        BigNumber.from(initialTokenBalance),
      );
    });

    it('Should revert (invalid trader)', async () => {
      await network.provider.send('evm_increaseTime', [ 60 * 60 * 25 ]); // time travel 25 hours in the future

      // increase ampl total balance
      await amplToken.rebase(0, BigNumber.from(10_000_000));

      await expect(pioneer.rebase()).to.be.revertedWith('Pioneer1Vault: trader not set');
    });

    it('Should revert (threshold)', async () => {
      await network.provider.send('evm_increaseTime', [ 60 * 60 * 25 ]); // time travel 25 hours in the future

      await pioneer.setTrader(trader.address);

      await amplToken.rebase(0, BigNumber.from(10_000_000));

      await expect(pioneer.rebase()).to.be.revertedWith('Pioneer1Vault: Threshold isnt reached yet');
    });

    it('Should work as intended', async () => {

      const amount = BigNumber.from('40000000000000');

      await network.provider.send('evm_increaseTime', [ 60 * 60 * 25 ]); // time travel 25 hours in the future

      await pioneer.setTrader(trader.address);

      await amplToken.rebase(0, amount);
      await amplToken.transfer(pioneer.address, amount.add('50000000000000'));

      await owner.sendTransaction({ to: trader.address, value: amount });

      const beforeOwnerBalance = await owner.getBalance();
      const beforeAmplBalance = await owner.provider?.getBalance(pioneer.address);
      
      const tx = await pioneer.rebase();

      const afterOwnerBalance = await owner.getBalance();
      const afterAmplBalance = await owner.provider?.getBalance(pioneer.address);

      expect(tx).to.have.emit(pioneer, 'Rebase').withArgs(
        initialTokenBalance,
        initialTokenBalance.add(amount),
      );

      expect(beforeOwnerBalance).to.be.closeTo(initialEthBalance as any, BigNumber.from('2000000000000000000') as any);
      expect(beforeAmplBalance).to.be.equal(0);

      expect(afterOwnerBalance).to.be.closeTo(initialEthBalance as any, BigNumber.from('2000000000000000000') as any);
      expect(afterAmplBalance).to.be.equal(0);
    });
  });
});