
import chai from 'chai';
import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';
import { solidity } from 'ethereum-waffle';
import { formatBytes32String } from 'ethers/lib/utils';

import { FakeERC20 } from '../typechain/FakeERC20';
import { BalancerTrader } from '../typechain/BalancerTrader';
import { UniswapV2Router02 } from "../typechain/UniswapV2Router02";
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

chai.use(solidity);

const { expect } = chai;

describe('BalancerTrader Contract', () => {

  let token: FakeERC20;
  let trader: BalancerTrader;
  let owner: string;

  beforeEach(async () => {

    const [ traderFactory, accounts ] = await Promise.all([
      ethers.getContractFactory('BalancerTrader'),
      ethers.getSigners(),
    ]);

    owner = accounts[0].address;
    trader = await traderFactory.deploy() as BalancerTrader;
    
  });

  it('Should have been deployed correctly', async () => {
    
  });
});