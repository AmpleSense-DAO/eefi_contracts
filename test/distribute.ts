
import chai from 'chai';
import { ethers } from 'hardhat';
import { solidity } from 'ethereum-waffle';
import { BigNumber } from '@ethersproject/bignumber';

import { FakeERC20 } from '../typechain/FakeERC20';
import { Distribute } from '../typechain/Distribute';

chai.use(solidity);

const { expect } = chai;

const zeroAddress = '0x0000000000000000000000000000000000000000';


async function getInfo(distribute: Distribute, userAddress: string) {
  const [
    bondValue,
    totalStake,
    rewardTokenAddress,
    toDistribute,
    investorCount,
    userReward,
    userStake,
  ] = await Promise.all([
    distribute.bond_value(),
    distribute.totalStaked(),
    distribute.reward_token(),
    distribute.to_distribute(),
    distribute.investor_count(),
    distribute.getReward(userAddress),
    distribute.totalStakedFor(userAddress),
  ]);
  return { bondValue, totalStake, rewardTokenAddress, toDistribute, investorCount, userReward, userStake };
}

/** Returns a random integer between min and max (inclusive). */
 function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

describe('Distribute Contract', () => {

  let rewardToken: FakeERC20;
  let distribute: Distribute;
  let owner: string;
  let userA: string;
  let userB: string;

  beforeEach(async () => {

    const erc20Factory = await ethers.getContractFactory('FakeERC20');
    const distributeFactory = await ethers.getContractFactory('Distribute');

    const accounts = await ethers.getSigners();
    owner = await accounts[0].getAddress();
    userA = await accounts[1].getAddress();
    userB = await accounts[2].getAddress();

    rewardToken = await erc20Factory.deploy('9') as FakeERC20;
    distribute = await distributeFactory.deploy('0', rewardToken.address) as Distribute;
  });

  it('Should have been deployed correctly', async () => {
    
    const { bondValue, investorCount, toDistribute, rewardTokenAddress } = await getInfo(distribute, userA);

    expect(bondValue.toNumber()).to.be.equal(1000000);
    expect(investorCount.toNumber()).to.be.equal(0);
    expect(toDistribute.toNumber()).to.be.equal(0);
    expect(rewardTokenAddress).to.be.equal(rewardToken.address);
  });

  describe('stakeFor', () => {

    describe('Should revert', () => {
      it('if account is the zero address', async () => {
        await expect(distribute.stakeFor(zeroAddress, BigNumber.from(100))).to.be.revertedWith('Distribute: Invalid account');
      });

      it('if amount is  zero', async () => {
        await expect(distribute.stakeFor(userA, BigNumber.from(0))).to.be.revertedWith('Distribute: Amount must be greater than zero');
      });
    });
    
    describe('Should work as expected', () => {
      beforeEach(async () => {
        await distribute.stakeFor(userA, BigNumber.from(100));
      });

      it('for the first call with user A', async () => {

        const { totalStake, investorCount, userStake, userReward } = await getInfo(distribute, userA);

        expect(totalStake.toNumber()).to.be.equal(100);
        expect(investorCount.toNumber()).to.be.equal(1);
        expect(userStake.toNumber()).to.be.equal(100);
        expect(userReward.toNumber()).to.be.equal(0);
      });

      it('for the second call with user A', async () => {
        await distribute.stakeFor(userA, BigNumber.from(150));

        const { totalStake, investorCount, userStake, userReward } = await getInfo(distribute, userA);

        expect(totalStake.toNumber()).to.be.equal(250);
        expect(investorCount.toNumber()).to.be.equal(1);
        expect(userStake.toNumber()).to.be.equal(250);
        expect(userReward.toNumber()).to.be.equal(0);
      });

      it('for the second call with user B', async () => {
        await distribute.stakeFor(userB, BigNumber.from(150));

        const { totalStake, investorCount, userStake, userReward } = await getInfo(distribute, userB);

        expect(totalStake.toNumber()).to.be.equal(250);
        expect(investorCount.toNumber()).to.be.equal(2);
        expect(userStake.toNumber()).to.be.equal(150);
        expect(userReward.toNumber()).to.be.equal(0);
      });
    });
    
  });

  describe('unstakeFrom', () => {

    describe('Should revert', () => {
      it('for account zero', async () => {
        await expect(distribute.unstakeFrom(zeroAddress, BigNumber.from(100))).to.be.revertedWith('Distribute: Invalid account');
      });

      it('for amount zero', async () => {
        await expect(distribute.unstakeFrom(userA, BigNumber.from(0))).to.be.revertedWith('Distribute: Amount must be greater than zero');
      });
    });

    describe('stake 100 for user A, then', () => {

      beforeEach(async () => {
        await distribute.stakeFor(userA, BigNumber.from(100));
      });

      it('Should revert if unstake is greater than stake', async () => {
        await expect(distribute.unstakeFrom(userA, BigNumber.from(101))).to.be.revertedWith('Distribute: Dont have enough staked');
      });

      it('Should correctly partially unstake', async () => {
        await distribute.unstakeFrom(userA, BigNumber.from(50));

        const { totalStake, userStake, investorCount } = await getInfo(distribute, userA);

        expect(totalStake.toNumber()).to.be.equal(50);
        expect(userStake.toNumber()).to.be.equal(50);
        expect(investorCount.toNumber()).to.be.equal(1);
      });

      it('Should correctly totally unstake', async () => {
        await distribute.unstakeFrom(userA, BigNumber.from(100));

        const { totalStake, userStake, investorCount } = await getInfo(distribute, userA);

        expect(totalStake.toNumber()).to.be.equal(0);
        expect(userStake.toNumber()).to.be.equal(0);
        expect(investorCount.toNumber()).to.be.equal(0);
      });

    });
  });

  describe('distribute', () => {

    beforeEach(async () => {

      await Promise.all([
        rewardToken.rebase(BigNumber.from(1000)), // mint 100 token to `owner` address
        rewardToken.approve(distribute.address, BigNumber.from(1000)), // allow Distribute contract to spend `owner`'s token
      ]);
    });

    
    it('Should add amount to temp_pool', async () => {
      await distribute.distribute(BigNumber.from(100), owner);

      const { bondValue } = await getInfo(distribute, userA);

      expect(bondValue).to.be.equal(1000000); // bond value should not increase
    });
    

    describe('already staked', () => {

      beforeEach(async () => {
        await distribute.stakeFor(userA, BigNumber.from(100));
        await distribute.stakeFor(userB, BigNumber.from(50));
      });

      it('Should collect some reward', async () => {

        // Pre-compute expected values
        const { bondValue: initialBondValue, totalStake, userStake: userAStake } = await getInfo(distribute, userA);
        const { userStake: userBStake } = await getInfo(distribute, userB);

        const distributedAmount = getRandomInt(1, 999);
        const expectedIncrease = Math.floor(distributedAmount / totalStake.toNumber());
        const expectedNewBondValue = initialBondValue.toNumber() + expectedIncrease;
        const expectedRemaining = distributedAmount % totalStake.toNumber();
        const expectedUserAReward = userAStake.toNumber() * expectedIncrease;
        const expectedUserBReward = userBStake.toNumber() * expectedIncrease;


        // Distribute transaction
        await distribute.distribute(BigNumber.from(distributedAmount), owner);

        // Retrieve actual values from teh smart-contract
        const { bondValue, userReward: userAReward, toDistribute } = await getInfo(distribute, userA);
        const { userReward: userBReward } = await getInfo(distribute, userB);
        
        // Check actual values against expected values
        expect(bondValue).to.be.equal(expectedNewBondValue);
        expect(toDistribute).to.be.equal(expectedRemaining);

        expect(userAReward).to.be.equal(expectedUserAReward);
        expect(userBReward).to.be.equal(expectedUserBReward);

        // stacked amount should not have changed
        expect(userAStake).to.be.equal(100);
        expect(userBStake).to.be.equal(50);
      });
    });

  });

  describe('withdrawFrom', () => {
    // TODO
  });


});
