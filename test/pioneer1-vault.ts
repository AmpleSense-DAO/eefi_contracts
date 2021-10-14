
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

    it('Should revert (invalid trader)', async () => {
      await network.provider.send('evm_increaseTime', [ 60 * 60 * 25 ]); // time travel 25 hours in the future

      // increase ampl total balance
      await amplToken.rebase(0, BigNumber.from(10_000_000));

      await expect(pioneer.rebase()).to.be.revertedWith('Pioneer1Vault: trader not set');
    });

    it('Should work as intended (no supply increase)', async () => {
      await network.provider.send('evm_increaseTime', [ 60 * 60 * 25 ]); // time travel 25 hours in the future
      await pioneer.setTrader(trader.address);//need to have a trader set
      await amplToken.transfer(pioneer.address, "50000000000000"); //need to be above threshold
      const tx = await pioneer.rebase();
      
      expect(tx).to.have.emit(pioneer, 'Rebase').withArgs(
        BigNumber.from(initialTokenBalance),
        BigNumber.from(initialTokenBalance),
      );
    });

    it('Should revert (threshold)', async () => {
      await network.provider.send('evm_increaseTime', [ 60 * 60 * 25 ]); // time travel 25 hours in the future

      await pioneer.setTrader(trader.address);

      await amplToken.rebase(0, BigNumber.from(10_000_000));

      await expect(pioneer.rebase()).to.be.revertedWith('Pioneer1Vault: Threshold isnt reached yet');
    });

    it('After an AMPL rebase, vault rebasing should distribute ETH', async () => {
      await network.provider.send('evm_increaseTime', [ 60 * 60 * 25 ]); // time travel 25 hours in the future

      await pioneer.setTrader(trader.address);

      const amplTokenInitialSupply = await amplToken.totalSupply();

      await amplToken.transfer(pioneer.address, "50000000000000");
      const initialVaultAmplBalance = await amplToken.balanceOf(pioneer.address); // 50000000000000

      await amplToken.rebase(0, BigNumber.from('40000000000000'));

      const amplTokenNewSupply = await amplToken.totalSupply();
      // add more eth into the trader
      await owner.sendTransaction({ to: trader.address, value: BigNumber.from('40000000000000') });

      const amplBalance = await amplToken.balanceOf(pioneer.address);
      //compute how much AMPL the vault should have sold
      //convert to human readable values
      const oldSupply = amplTokenInitialSupply.div(10**9).toNumber();
      const newSupply = amplTokenNewSupply.div(10**9).toNumber();
      const ratio =  oldSupply / newSupply;
      const amplBalanceHuman = amplBalance.div(10**9).toNumber();
      const initialVaultAmplBalanceHuman = initialVaultAmplBalance.div(10**9).toNumber();
      // the amount of AMPL tokens the vault got through AMPL rebase
      const surplus = amplBalanceHuman - amplBalanceHuman * ratio;
      //surplus shouldnt remove more tokens from the vault than it had before the rebase
      //but due to computation error, it could, however since we're only selling up to 80% of it, we'll never remove more than we should
      //percentage is rounded down in the contract
      const percentage = Math.floor((80 - 25) * ((amplBalanceHuman - 40000) / 760000) + 25);
      const toSell = surplus * percentage / 100;
      const toSellBN = BigNumber.from(Math.floor(toSell * 10**5)).mul(10**4);
      
      const tx = await pioneer.rebase();

      expect(tx).to.have.emit(pioneer, 'Rebase').withArgs(
        amplTokenInitialSupply,
        amplTokenNewSupply,
      );
      expect(tx).to.have.emit(trader,"Sale_ETH").withArgs(
        toSellBN,
        toSellBN //the exchange rate for AMPL/ETH on mock is 1/1
      )
      // now lets try and get higher selling percent
      await amplToken.transfer(pioneer.address, "500000000000000");
      const amplBalance2 = await amplToken.balanceOf(pioneer.address);
      const amplBalanceHuman2 = amplBalance2.div(10**9).toNumber();
      await amplToken.rebase(0, BigNumber.from('40000000000000'));
      const percentage2 = Math.floor((80 - 25) * ((amplBalanceHuman2 - 40000) / 760000) + 25);
      expect(percentage2).to.be.equal(61);
      const amplTokenNewSupply2 = await amplToken.totalSupply();

      await network.provider.send('evm_increaseTime', [ 60 * 60 * 25 ]); // time travel 25 hours in the future
      const tx2 = await pioneer.rebase();

      expect(tx2).to.have.emit(pioneer, 'Rebase').withArgs(
        amplTokenNewSupply,
        amplTokenNewSupply2,
      );
      const oldSupply2 = amplTokenNewSupply.div(10**9).toNumber();
      const newSupply2 = amplTokenNewSupply2.div(10**9).toNumber();
      const ratio2 =  oldSupply2 / newSupply2;
      const surplus2 = amplBalanceHuman2 - amplBalanceHuman2 * ratio2;
      const toSell2 = surplus2 * percentage2 / 100;
      const toSellBN2 = BigNumber.from(Math.floor(toSell2 * 10**5)).mul(10**4);

      expect(toSellBN2).to.be.equal("267985860000"); //the value computed by the contract is actually 268200079936

      expect(tx2).to.have.emit(trader,"Sale_ETH").withArgs(
        "268200079936",
        "268200079936" //the exchange rate for AMPL/ETH on mock is 1/1
      )

      const previousSupply = amplTokenNewSupply2;

      // last one is capping the percentage to 80%
      {
        await amplToken.transfer(pioneer.address, "500000000000000");
        const amplBalance2 = await amplToken.balanceOf(pioneer.address);
        const amplBalanceHuman2 = amplBalance2.div(10**9).toNumber();
        await amplToken.rebase(0, BigNumber.from('40000000000000'));
        const percentage2 = Math.floor((80 - 25) * ((Math.min(amplBalanceHuman2, 800000) - 40000) / 760000) + 25);
        expect(percentage2).to.be.equal(80);
        const amplTokenNewSupply2 = await amplToken.totalSupply();

        await network.provider.send('evm_increaseTime', [ 60 * 60 * 25 ]); // time travel 25 hours in the future
        const tx2 = await pioneer.rebase();

        expect(tx2).to.have.emit(pioneer, 'Rebase').withArgs(
          previousSupply,
          amplTokenNewSupply2,
        );
        const oldSupply2 = previousSupply.div(10**9).toNumber();
        const newSupply2 = amplTokenNewSupply2.div(10**9).toNumber();
        const ratio2 =  oldSupply2 / newSupply2;
        const surplus2 = amplBalanceHuman2 - amplBalanceHuman2 * ratio2;
        const toSell2 = surplus2 * percentage2 / 100;
        const toSellBN2 = BigNumber.from(Math.floor(toSell2 * 10**5)).mul(10**4);

        expect(toSellBN2).to.be.equal("670519390000"); //the value computed by the contract is actually 671055253791

        expect(tx2).to.have.emit(trader,"Sale_ETH").withArgs(
          "671055253791",
          "671055253791" //the exchange rate for AMPL/ETH on mock is 1/1
        )
      }

    });
  });
});