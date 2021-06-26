
import chai from 'chai';
import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';
import { solidity } from 'ethereum-waffle';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import { FakeERC20 } from '../typechain/FakeERC20';
import { FakeERC721 } from '../typechain/FakeERC721';
import { Pioneer1Vault } from '../typechain/Pioneer1Vault';
import { MockTrader } from '../typechain/MockTrader';

chai.use(solidity);

const { expect } = chai;

const initialTokenBalance = BigNumber.from('0xE35FA931A000');
const zeroAddress = '0x0000000000000000000000000000000000000000';
const initialEthBalance = BigNumber.from('0x21E19E0C9BAB2400000');

describe('Pioneer1Vault Contract', () => {

  let tokenA: FakeERC721;
  let tokenB: FakeERC721;
  let trader: MockTrader;
  let amplToken: FakeERC20;
  let eefiToken: FakeERC20;
  let pioneer: Pioneer1Vault;
  let owner: string;
  let userA: SignerWithAddress;

  beforeEach(async () => {

    const [ erc20Factory, erc721Factory, traderFactory, pioneerFactory, accounts ] = await Promise.all([
      ethers.getContractFactory('FakeERC20'),
      ethers.getContractFactory('FakeERC721'),
      ethers.getContractFactory('MockTrader'),
      ethers.getContractFactory('Pioneer1Vault'),
      ethers.getSigners(),
    ]);

    owner = accounts[0].address;
    userA = accounts[1];

    [ tokenA, tokenB, amplToken, eefiToken ] = await Promise.all([
      erc721Factory.deploy() as Promise<FakeERC721>,
      erc721Factory.deploy() as Promise<FakeERC721>,
      erc20Factory.deploy('9') as Promise<FakeERC20>,
      erc20Factory.deploy('9') as Promise<FakeERC20>,
    ]);

    trader = await traderFactory.deploy(amplToken.address, eefiToken.address, ethers.utils.parseEther('1'), ethers.utils.parseEther('1')) as MockTrader;

    pioneer = await pioneerFactory.deploy(tokenA.address, tokenB.address, amplToken.address) as Pioneer1Vault;
  });

  it.skip('Should have been deployed correctly', async () => {

    const traderAddress = await pioneer.trader();
    const amplAddress = await pioneer.ampl();
    const tokenAAddress = await pioneer.tokenA();
    const tokenBAddress = await pioneer.tokenB();
    
    expect(traderAddress).to.be.equal(zeroAddress);
    expect(amplAddress).to.be.equal(amplToken.address);
    expect(tokenAAddress).to.be.equal(tokenA.address);
    expect(tokenBAddress).to.be.equal(tokenB.address);
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
});