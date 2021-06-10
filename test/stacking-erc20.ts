
import chai from 'chai';
import { ethers } from 'hardhat';
import { solidity } from 'ethereum-waffle';

import { FakeERC20 } from '../typechain/FakeERC20';
import { StakingERC20 } from '../typechain/StakingERC20';

chai.use(solidity);

const { expect } = chai;

async function getInfo(stacking: StakingERC20, userAddress: string) {
  const [
    distributeEthContract,
    distributeTokenContract,
    userTotalStake,
    totalStake,
    stackingTokenContract,
    supportsHistory,
    [ userEthReward, userTokenReward, ],
  ] = await Promise.all([
    stacking.staking_contract_eth(),
    stacking.staking_contract_token(),
    stacking.totalStakedFor(userAddress),
    stacking.totalStaked(),
    stacking.token(),
    stacking.supportsHistory(),
    stacking.getReward(userAddress),
  ]);
  return {
    distributeEthContract,
    distributeTokenContract,
    userTotalStake,
    totalStake,
    stackingTokenContract,
    supportsHistory,
    userEthReward,
    userTokenReward,
  };
}


describe('StackingERC20 Contract', () => {

  let rewardToken: FakeERC20;
  let stakingToken: FakeERC20;
  let staking: StakingERC20;
  let owner: string;
  let userA: string;
  let userB: string;

  beforeEach(async () => {

    const [ erc20Factory, stackingFactory, accounts ] = await Promise.all([
      ethers.getContractFactory('FakeERC20'),
      ethers.getContractFactory('StakingERC20'),
      ethers.getSigners(),
    ]);

    [ owner, userA, userB, rewardToken, stakingToken ] = await Promise.all([
      accounts[0].getAddress(),
      accounts[1].getAddress(),
      accounts[2].getAddress(),
      erc20Factory.deploy('9') as Promise<FakeERC20>,
      erc20Factory.deploy('9') as Promise<FakeERC20>,
    ]);

    staking = await stackingFactory.deploy(stakingToken.address, rewardToken.address, '0') as StakingERC20;
  });

  it('Should have been deployed correctly', async () => {
    
    const {
      userTotalStake,
      totalStake,
      stackingTokenContract,
      supportsHistory,
      userEthReward,
      userTokenReward,
    } = await getInfo(staking, userA);

    expect(userTotalStake).to.be.equal(0);
    expect(totalStake).to.be.equal(0);
    expect(stackingTokenContract).to.be.equal(stakingToken.address);
    expect(supportsHistory).to.be.equal(false);
    expect(userEthReward).to.be.equal(0);
    expect(userTokenReward).to.be.equal(0);
  });

});