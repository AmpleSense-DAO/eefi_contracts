
import chai from 'chai';
import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';
import { solidity } from 'ethereum-waffle';
import { formatBytes32String } from 'ethers/lib/utils';

import { FakeERC20 } from '../typechain/FakeERC20';
import { StakingERC20 } from '../typechain/StakingERC20';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

chai.use(solidity);

const { expect } = chai;

const initialTokenBalance = BigNumber.from('0xE35FA931A000');

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
  let userA: SignerWithAddress;
  let userB: SignerWithAddress;

  beforeEach(async () => {

    const [ erc20Factory, stackingFactory, accounts ] = await Promise.all([
      ethers.getContractFactory('FakeERC20'),
      ethers.getContractFactory('StakingERC20'),
      ethers.getSigners(),
    ]);

    owner = accounts[0].address;
    userA = accounts[1];
    userB = accounts[2];

    [ rewardToken, stakingToken ] = await Promise.all([
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
    } = await getInfo(staking, userA.address);

    expect(userTotalStake).to.be.equal(0);
    expect(totalStake).to.be.equal(0);
    expect(stackingTokenContract).to.be.equal(stakingToken.address);
    expect(supportsHistory).to.be.equal(false);
    expect(userEthReward).to.be.equal(0);
    expect(userTokenReward).to.be.equal(0);
  });

  describe('requires some amount of tokens', () => {

    beforeEach(async () => {

      const { distributeTokenContract } = await getInfo(staking, userA.address);

      await Promise.all([
        rewardToken.approve(distributeTokenContract, BigNumber.from(1_000)),
        stakingToken.approve(staking.address, BigNumber.from(1_000)),
      ]);
    });

    it('Should stake some tokens', async () => {

      const beforeBalance = await stakingToken.balanceOf(owner);
      const stakingBeforeBalance = await stakingToken.balanceOf(staking.address);
      const before = await getInfo(staking, userA.address);
      
      const tx = await staking.stakeFor(userA.address, BigNumber.from(100), formatBytes32String('0'));
      
      const afterBalance = await stakingToken.balanceOf(owner);
      const stakingAfterBalance = await stakingToken.balanceOf(staking.address);
      const after = await getInfo(staking, userA.address);

      expect(beforeBalance).to.be.equal(initialTokenBalance);
      expect(afterBalance).to.be.equal(initialTokenBalance.sub(100));
      
      expect(stakingBeforeBalance).to.be.equal(0);
      expect(stakingAfterBalance).to.be.equal(100);

      expect(tx).to.have.emit(staking, 'Staked').withArgs(
        userA.address,
        BigNumber.from(100),
        BigNumber.from(100),
        formatBytes32String('0'),
      );

      expect(before.totalStake).to.be.equal(0);
      expect(after.totalStake).to.be.equal(100);

      expect(before.userTotalStake).to.be.equal(0);
      expect(after.userTotalStake).to.be.equal(100);

      expect(before.userEthReward).to.be.equal(0);
      expect(after.userEthReward).to.be.equal(0);

      expect(before.userTokenReward).to.be.equal(0);
      expect(after.userTokenReward).to.be.equal(0);
    });

  });
});