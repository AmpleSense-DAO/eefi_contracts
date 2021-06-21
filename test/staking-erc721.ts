
import chai from 'chai';
import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';
import { solidity } from 'ethereum-waffle';
import { formatBytes32String } from 'ethers/lib/utils';

import { FakeERC20 } from '../typechain/FakeERC20';
import { FakeERC721 } from '../typechain/FakeERC721';
import { StakingERC721 } from '../typechain/StakingERC721';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

chai.use(solidity);

const { expect } = chai;

const initialNFTBalance = BigNumber.from(20);
const initialEthBalance = BigNumber.from('0x21E19E0C9BAB2400000');

async function getInfo(stacking: StakingERC721, userAddress: string) {
  const [
    tokenAAddress,
    tokenBAddress,
    amplAddress,
    stackingTokenContract,
    userTotalStake,
    totalStake,
    userReward,
  ] = await Promise.all([
    stacking.tokenA(),
    stacking.tokenB(),
    stacking.ampl(),
    stacking.stakingContractEth(),
    stacking.totalStakedFor(userAddress),
    stacking.totalStaked(),
    stacking.getReward(userAddress),
  ]);
  return {
    tokenAAddress,
    tokenBAddress,
    amplAddress,
    stackingTokenContract,
    userTotalStake,
    totalStake,
    userReward,
  };
}


describe('StackingERC721 Contract', () => {

  let amplToken: FakeERC20;
  let tokenA: FakeERC721;
  let tokenB: FakeERC721;
  let staking: StakingERC721;
  let owner: string;
  let userA: SignerWithAddress;
  let userB: SignerWithAddress;

  beforeEach(async () => {

    const [ erc20Factory, erc721Factory, stackingFactory, accounts ] = await Promise.all([
      ethers.getContractFactory('FakeERC20'),
      ethers.getContractFactory('FakeERC721'),
      ethers.getContractFactory('StakingERC721'),
      ethers.getSigners(),
    ]);

    owner = accounts[0].address;
    userA = accounts[1];
    userB = accounts[2];

    [ amplToken, tokenA, tokenB ] = await Promise.all([
      erc20Factory.deploy('9') as Promise<FakeERC20>,
      erc721Factory.deploy() as Promise<FakeERC721>,
      erc721Factory.deploy() as Promise<FakeERC721>,
    ]);

    staking = await stackingFactory.deploy(tokenA.address, tokenB.address, amplToken.address) as StakingERC721;
  });

  it.skip('Should have been deployed correctly', async () => {
    const info = await getInfo(staking, userA.address);

    expect(info.tokenAAddress).to.be.equal(tokenA.address);
    expect(info.tokenBAddress).to.be.equal(tokenB.address);
    expect(info.amplAddress).to.be.equal(amplToken.address);
    expect(info.userTotalStake).to.be.equal(0);
    expect(info.totalStake).to.be.equal(0);
    expect(info.userReward).to.be.equal(0);
  });

  describe('requires some NFTs', () => {

    beforeEach(async () => {

      await Promise.all([
        tokenA.approve(staking.address, BigNumber.from(19)),
        tokenA.approve(staking.address, BigNumber.from(18)),
        tokenA.approve(staking.address, BigNumber.from(17)),

        tokenB.approve(staking.address, BigNumber.from(4)),
        tokenB.approve(staking.address, BigNumber.from(5)),
        tokenB.approve(staking.address, BigNumber.from(6)),
      ]);
    });

    it.skip('Should stakeFor some A NFTs', async () => {

      const beforeBalanceA = await tokenA.balanceOf(owner);
      const beforeStakingBalance = await tokenA.balanceOf(staking.address);
      const before = await getInfo(staking, userA.address);

      const ids = [ BigNumber.from(19), BigNumber.from(18), BigNumber.from(17),];
      const tx = await staking.stakeFor(userA.address, ids, true);
      
      const afterBalanceA = await tokenA.balanceOf(owner);
      const afterStakingBalance = await tokenA.balanceOf(staking.address);
      const afterTokenId_0 = await staking.tokenOwnershipA(userA.address, BigNumber.from(0));
      const afterTokenId_1 = await staking.tokenOwnershipA(userA.address, BigNumber.from(1));
      const afterTokenId_2 = await staking.tokenOwnershipA(userA.address, BigNumber.from(2));
      const after = await getInfo(staking, userA.address);

      expect(beforeBalanceA).to.be.equal(initialNFTBalance);
      expect(afterBalanceA).to.be.equal(initialNFTBalance.sub(3));
      
      expect(beforeStakingBalance).to.be.equal(0);
      expect(afterStakingBalance).to.be.equal(3);

      expect(tx).to.have.emit(staking, 'Staked').withArgs(
        userA.address,
        BigNumber.from(3),
        BigNumber.from(3),
      );

      expect(before.totalStake).to.be.equal(0);
      expect(after.totalStake).to.be.equal(3);

      expect(before.userTotalStake).to.be.equal(0);
      expect(after.userTotalStake).to.be.equal(3);

      expect(afterTokenId_0).to.be.equal(19);
      expect(afterTokenId_1).to.be.equal(18);
      expect(afterTokenId_2).to.be.equal(17);

      expect(before.userReward).to.be.equal(0);
      expect(after.userReward).to.be.equal(0);
    });

    it.skip('Should stakeFor some B NFTs', async () => {

      const beforeBalanceB = await tokenB.balanceOf(owner);
      const beforeStakingBalance = await tokenB.balanceOf(staking.address);
      const before = await getInfo(staking, userA.address);

      const ids = [ BigNumber.from(4), BigNumber.from(5), BigNumber.from(6),];
      const tx = await staking.stakeFor(userA.address, ids, false);
      
      const afterBalanceB = await tokenB.balanceOf(owner);
      const afterStakingBalance = await tokenB.balanceOf(staking.address);
      const afterTokenId_0 = await staking.tokenOwnershipB(userA.address, BigNumber.from(0));
      const afterTokenId_1 = await staking.tokenOwnershipB(userA.address, BigNumber.from(1));
      const afterTokenId_2 = await staking.tokenOwnershipB(userA.address, BigNumber.from(2));
      const after = await getInfo(staking, userA.address);

      expect(beforeBalanceB).to.be.equal(initialNFTBalance);
      expect(afterBalanceB).to.be.equal(initialNFTBalance.sub(3));
      
      expect(beforeStakingBalance).to.be.equal(0);
      expect(afterStakingBalance).to.be.equal(3);

      expect(tx).to.have.emit(staking, 'Staked').withArgs(
        userA.address,
        BigNumber.from(3),
        BigNumber.from(3),
      );

      expect(before.totalStake).to.be.equal(0);
      expect(after.totalStake).to.be.equal(3);

      expect(before.userTotalStake).to.be.equal(0);
      expect(after.userTotalStake).to.be.equal(3);

      expect(afterTokenId_0).to.be.equal(4);
      expect(afterTokenId_1).to.be.equal(5);
      expect(afterTokenId_2).to.be.equal(6);

      expect(before.userReward).to.be.equal(0);
      expect(after.userReward).to.be.equal(0);
    });

    it('Should unstake some A NFTs', async () => {

      const ids = [ BigNumber.from(19), BigNumber.from(18), BigNumber.from(17),];
      await staking.stakeFor(userA.address, ids, true);

      const beforeBalanceA = await tokenA.balanceOf(userA.address);
      const beforeStakingBalance = await tokenA.balanceOf(staking.address);
      const beforeTokenId_0 = await staking.tokenOwnershipA(userA.address, BigNumber.from(0));
      const beforeTokenId_1 = await staking.tokenOwnershipA(userA.address, BigNumber.from(1));
      const beforeTokenId_2 = await staking.tokenOwnershipA(userA.address, BigNumber.from(2));
      const before = await getInfo(staking, userA.address);

      const tx = await staking.connect(userA).unstake(BigNumber.from(3), true);

      // const afterBalanceA = await tokenA.balanceOf(userA.address);
      // const afterStakingBalance = await tokenA.balanceOf(staking.address);
      // const after = await getInfo(staking, userA.address);
     
      expect(beforeBalanceA).to.be.equal(0);
      // expect(afterBalanceA).to.be.equal(2);

      expect(beforeStakingBalance).to.be.equal(3);
      // expect(afterStakingBalance).to.be.equal(1);

      // expect(tx).to.have.emit(staking, 'Unstaked').withArgs(
      //   userA.address,
      //   BigNumber.from(2),
      //   BigNumber.from(2),
      // );

      expect(beforeTokenId_0).to.be.equal(19);
      expect(beforeTokenId_1).to.be.equal(18);
      expect(beforeTokenId_2).to.be.equal(17);

      expect(before.totalStake).to.be.equal(3);
      // expect(after.totalStake).to.be.equal(1);

      expect(before.userTotalStake).to.be.equal(3);
      // expect(after.userTotalStake).to.be.equal(1);

      expect(before.userReward).to.be.equal(0);
      // expect(after.userReward).to.be.equal(0);
    });


  //   it('Should distribute some tokens', async () => {

  //     await staking.stakeFor(userA.address, BigNumber.from(100), formatBytes32String('0'));

  //     const beforeBalance = await stakingToken.balanceOf(owner);
  //     const stakingBeforeBalance = await stakingToken.balanceOf(staking.address);
  //     const before = await getInfo(staking, userA.address);

  //     const tx = await staking.distribute(BigNumber.from(200));

  //     const afterBalance = await stakingToken.balanceOf(owner);
  //     const stakingAfterBalance = await stakingToken.balanceOf(staking.address);
  //     const after = await getInfo(staking, userA.address);

  //     expect(beforeBalance).to.be.equal(initialTokenBalance.sub(100));
  //     expect(afterBalance).to.be.equal(initialTokenBalance.sub(100));
      
  //     expect(stakingBeforeBalance).to.be.equal(100);
  //     expect(stakingAfterBalance).to.be.equal(100);

  //     expect(tx).to.have.emit(staking, 'ProfitToken').withArgs(
  //       BigNumber.from(200),
  //     );
      
  //     expect(before.totalStake).to.be.equal(100);
  //     expect(after.totalStake).to.be.equal(100);

  //     expect(before.userTotalStake).to.be.equal(100);
  //     expect(after.userTotalStake).to.be.equal(100);

  //     expect(before.userEthReward).to.be.equal(0);
  //     expect(after.userEthReward).to.be.equal(0);
  //   });


  //   it('Should distribute some eth', async () => {
      
  //     await staking.stakeFor(userA.address, BigNumber.from(100), formatBytes32String('0'));

  //     const beforeBalance = await stakingToken.balanceOf(owner);
  //     const stakingBeforeBalance = await stakingToken.balanceOf(staking.address);
  //     const before = await getInfo(staking, userA.address);
      
  //     const tx = await staking.distribute_eth({ value: BigNumber.from(100) });
      
  //     const afterBalance = await stakingToken.balanceOf(owner);
  //     const stakingAfterBalance = await stakingToken.balanceOf(staking.address);
  //     const after = await getInfo(staking, userA.address);

  //     expect(beforeBalance).to.be.equal(initialTokenBalance.sub(100));
  //     expect(afterBalance).to.be.equal(initialTokenBalance.sub(100));
      
  //     expect(stakingBeforeBalance).to.be.equal(100);
  //     expect(stakingAfterBalance).to.be.equal(100);

  //     expect(tx).to.have.emit(staking, 'ProfitEth').withArgs(
  //       BigNumber.from(100),
  //     );
      
  //     expect(before.totalStake).to.be.equal(100);
  //     expect(after.totalStake).to.be.equal(100);

  //     expect(before.userTotalStake).to.be.equal(100);
  //     expect(after.userTotalStake).to.be.equal(100);

  //     expect(before.userEthReward).to.be.equal(0);
  //     expect(after.userEthReward).to.be.equal(100);

  //   });


  //   it('Should withdraw reward', async () => {
      
  //     await staking.stakeFor(userA.address, BigNumber.from(100), formatBytes32String('0'));
  //     await staking.distribute_eth({ value: BigNumber.from(100) });
  //     await staking.distribute(BigNumber.from(100));

  //     const beforeBalance = await stakingToken.balanceOf(owner);
  //     const stakingBeforeBalance = await stakingToken.balanceOf(staking.address);
  //     const rewardBeforeBalance = await rewardToken.balanceOf(userA.address);
  //     const beforeEthBalance = await userA.getBalance();
  //     const before = await getInfo(staking, userA.address);
      
  //     const tx = await staking.connect(userA).withdraw(BigNumber.from(100));
  //     const receipt = await tx.wait();
      
  //     const afterBalance = await stakingToken.balanceOf(owner);
  //     const stakingAfterBalance = await stakingToken.balanceOf(staking.address);
  //     const rewardAfterBalance = await rewardToken.balanceOf(userA.address);
  //     const afterEthBalance = await userA.getBalance();
  //     const after = await getInfo(staking, userA.address);

  //     expect(beforeBalance).to.be.equal(initialTokenBalance.sub(100));
  //     expect(afterBalance).to.be.equal(initialTokenBalance.sub(100));
      
  //     expect(stakingBeforeBalance).to.be.equal(100);
  //     expect(stakingAfterBalance).to.be.equal(100);

  //     expect(before.totalStake).to.be.equal(100);
  //     expect(after.totalStake).to.be.equal(100);

  //     expect(before.userTotalStake).to.be.equal(100);
  //     expect(after.userTotalStake).to.be.equal(100);

  //     expect(before.userEthReward).to.be.equal(100);
  //     expect(after.userEthReward).to.be.equal(0);

  //     expect(rewardBeforeBalance).to.be.equal(0);
  //     expect(rewardAfterBalance).to.be.equal(100);

  //     expect(beforeEthBalance).to.be.equal(initialEthBalance);
  //     expect(tx.gasPrice).to.be.equal(8_000_000_000);
  //     expect(receipt.gasUsed).to.be.equal(108_936);
  //     expect(afterEthBalance).to.be.equal(initialEthBalance.sub(tx.gasPrice.mul(receipt.gasUsed)).add(100));
  //   });
  });
});