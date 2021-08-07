
import chai from 'chai';
import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';
import { solidity } from 'ethereum-waffle';

import { FakeERC20 } from '../typechain/FakeERC20';
import { FakeERC721 } from '../typechain/FakeERC721';
import { MockTrader } from '../typechain/MockTrader';
import { StakingERC20 } from '../typechain/StakingERC20';
import { StakingERC721 } from '../typechain/StakingERC721';
import { AmplesenseVault } from '../typechain/AmplesenseVault';

chai.use(solidity);

const { expect } = chai;

const zeroAddress = '0x0000000000000000000000000000000000000000';

async function getInfo(vault: AmplesenseVault, account: string) {
  // Promise.all can handle only 10 promise max
  const [
    pioneer_vault1,
    pioneer_vault2,
    pioneer_vault3,
    staking_pool,
    trader,
    eefi_token,
    rewards_eefi,
    rewards_eth,
    last_positive,
    accountTotalStaked,
  ] = await Promise.all([
    vault.pioneer_vault1(),
    vault.pioneer_vault2(),
    vault.pioneer_vault3(),
    vault.staking_pool(),
    vault.trader(),
    vault.eefi_token(),
    vault.rewards_eefi(),
    vault.rewards_eth(),
    vault.last_positive(),
    vault.totalStakedFor(account),
  ]);

  const [
    accountTotalClaimable,
    accountBalance,
    [ accountRewardEth, accountRewardToken ],
    totalStaked,
    [ totalRewardEth, totalRewardToken ],
  ] = await Promise.all([
    vault.totalClaimableBy(account),
    vault.balanceOf(account),
    vault.getReward(account),
    vault.totalStaked(),
    vault.totalReward(),
  ]);

  return {
    pioneer_vault1,
    pioneer_vault2,
    pioneer_vault3,
    staking_pool,
    trader,
    eefi_token,
    rewards_eefi,
    rewards_eth,
    last_positive,
    accountTotalStaked,
    accountTotalClaimable,
    accountBalance,
    accountRewardEth,
    accountRewardToken,
    totalStaked,
    totalRewardEth,
    totalRewardToken,
  };
}


describe('AmplesenseVault Contract', () => {
  let vault : AmplesenseVault;

  let owner : string;
  let treasury : string;
  
  let amplToken : FakeERC20;
  let kmplToken: FakeERC20;
  let eefiToken: FakeERC20;
  
  let pioneer1 : StakingERC721;
  
  let pioneer2 : StakingERC20;
  let pioneer3 : StakingERC20;
  
  let nft1 : FakeERC721;
  let nft2 : FakeERC721;
  
  let staking_pool : StakingERC20;
  
  let balancerTrader : MockTrader;

  beforeEach(async () => {
    const erc20Factory = await ethers.getContractFactory('FakeERC20');
    const erc721Factory = await ethers.getContractFactory('FakeERC721');
    const vaultFactory = await ethers.getContractFactory('AmplesenseVault');
    const stakingerc20Factory = await ethers.getContractFactory('StakingERC20');
    const stakingerc721Factory = await ethers.getContractFactory('StakingERC721');

    const accounts = await ethers.getSigners();
    owner = accounts[0].address;
    treasury = accounts[1].address;
    
    amplToken = await erc20Factory.deploy('9') as FakeERC20;
    kmplToken = await erc20Factory.deploy('9') as FakeERC20;
    nft1 = await erc721Factory.deploy() as FakeERC721;
    nft2 = await erc721Factory.deploy() as FakeERC721;
    
    vault = await vaultFactory.deploy(amplToken.address) as AmplesenseVault;
    
    let eefiTokenAddress = await vault.eefi_token();
    eefiToken = await ethers.getContractAt('FakeERC20', eefiTokenAddress) as FakeERC20;
    
    
    pioneer1 = await stakingerc721Factory.deploy(nft1.address, nft2.address, amplToken.address) as StakingERC721;
    pioneer2 = await stakingerc20Factory.deploy(kmplToken.address, eefiTokenAddress, 9) as StakingERC20;
    pioneer3 = await stakingerc20Factory.deploy(amplToken.address, eefiTokenAddress, 9) as StakingERC20;
    staking_pool = await stakingerc20Factory.deploy(amplToken.address, eefiTokenAddress, 9) as StakingERC20;
  });


  it.skip('should have been deployed correctly', async () => {
    const info = await getInfo(vault, owner);

    const deployBlock = await ethers.provider.getBlock(vault.deployTransaction.blockHash!);

    expect(info.pioneer_vault1).to.be.equal(zeroAddress);
    expect(info.pioneer_vault2).to.be.equal(zeroAddress);
    expect(info.pioneer_vault3).to.be.equal(zeroAddress);
    expect(info.staking_pool).to.be.equal(zeroAddress);
    expect(info.trader).to.be.equal(zeroAddress);

    expect(info.eefi_token).to.not.be.equal(zeroAddress);
    expect(info.rewards_eefi).to.not.be.equal(zeroAddress);
    expect(info.rewards_eth).to.not.be.equal(zeroAddress);

    expect(info.last_positive).to.be.equal(deployBlock.timestamp);

    expect(info.accountTotalStaked).to.be.equal(0);
    expect(info.accountTotalClaimable).to.be.equal(0);
    expect(info.accountBalance).to.be.equal(0);
    expect(info.accountRewardEth).to.be.equal(0);
    expect(info.accountRewardToken).to.be.equal(0);
    expect(info.totalStaked).to.be.equal(0);
    expect(info.totalRewardEth).to.be.equal(0);
    expect(info.totalRewardToken).to.be.equal(0);
  });

  describe('Require initialization', async() => {

    beforeEach(async () => {
      await vault.initialize(pioneer1.address, pioneer2.address, pioneer3.address, staking_pool.address, treasury);
    });

    describe.skip('initialize()', () => {
      it('should be initialized correctly', async () => {
        const info = await getInfo(vault, owner);

        expect(info.pioneer_vault1).to.be.equal(pioneer1.address);
        expect(info.pioneer_vault2).to.be.equal(pioneer2.address);
        expect(info.pioneer_vault3).to.be.equal(pioneer3.address);
        expect(info.staking_pool).to.be.equal(staking_pool.address);
      });

      it('should be initialized only once', async () => {
        await expect(
          vault.initialize(
            pioneer1.address,
            pioneer2.address,
            pioneer3.address,
            staking_pool.address,
            treasury
          )
        ).to.be.revertedWith('AmplesenseVault: contract already initialized');
      });
    });

    describe('makeDeposit()', () => {
      it.skip('deposit shall fail if staking without creating ampl allowance first', async () => {
        await expect(vault.makeDeposit(10**9)).to.be.
          revertedWith('ERC20: transfer amount exceeds allowance');
      });

      it('should set shares in the contracts & mint eefi', async () => {
        const deposit = BigNumber.from(10**9);
        const EEFI_DEPOSIT_RATE = await vault.EEFI_DEPOSIT_RATE();
        const DEPOSIT_FEE_1000 = await vault.DEPOSIT_FEE_10000();
        const fee = deposit.div(EEFI_DEPOSIT_RATE).mul(DEPOSIT_FEE_1000).div(10000);

        const beforeInfo = await getInfo(vault, owner);

        const rewardsEth = await ethers.getContractAt('Distribute', beforeInfo.rewards_eth);
        const rewardsEefi = await ethers.getContractAt('Distribute', beforeInfo.rewards_eefi);

        const beforeOwnerEthReward = await rewardsEth.totalStakedFor(owner);
        const beforeOwnerEefiReward = await rewardsEefi.totalStakedFor(owner);
        const beforeOwnerPioneer2Reward = await pioneer2.getReward(owner);
        const beforeOwnerEefiBalance = await eefiToken.balanceOf(owner);

        await amplToken.increaseAllowance(vault.address, 10**9);
        await kmplToken.increaseAllowance(pioneer2.address, 10**9);
        await pioneer2.stake(10**9, '0x');
        const tx = await vault.makeDeposit(deposit);

        const afterInfo = await getInfo(vault, owner);
        const afterOwnerEthReward = await rewardsEth.totalStakedFor(owner);
        const afterOwnerEefiReward = await rewardsEefi.totalStakedFor(owner);
        const afterOwnerPioneer2Reward = await pioneer2.getReward(owner);
        const afterOwnerEefiBalance = await eefiToken.balanceOf(owner);
        
        expect(beforeInfo.accountTotalStaked).to.be.equal(0);
        expect(beforeInfo.accountBalance).to.be.equal(0);

        expect(beforeOwnerEthReward).to.be.equal(0);
        expect(beforeOwnerEefiReward).to.be.equal(0);
        
        expect(beforeOwnerPioneer2Reward.__token).to.be.equal(0);
        expect(beforeOwnerEefiBalance).to.be.equal(0);

        expect(afterInfo.accountTotalStaked).to.be.equal(deposit);
        expect(afterInfo.accountBalance).to.be.equal(deposit);

        expect(afterOwnerEthReward).to.be.equal(deposit);
        expect(afterOwnerEefiReward).to.be.equal(deposit);

        expect(afterOwnerPioneer2Reward.__token).to.be.equal(fee);
        expect(afterOwnerEefiBalance).to.be.equal(BigNumber.from(10**9 / 10**4).sub(fee));
      });
    });
  });
  

  describe.skip('rebasing', async() => {

    beforeEach(async () => {

      const balancerTraderFactory = await ethers.getContractFactory('MockTrader');
      balancerTrader = await balancerTraderFactory.deploy(amplToken.address, eefiToken.address, ethers.utils.parseUnits('0.001', 'ether'), ethers.utils.parseUnits('0.1', 'ether')) as MockTrader;
      await vault.setTrader(balancerTrader.address);

      //no longer needed to stake here
      await amplToken.increaseAllowance(vault.address, 10**9);
      await kmplToken.increaseAllowance(pioneer2.address, 10**9);
      await pioneer2.stake(10**9, '0x');
      await amplToken.increaseAllowance(staking_pool.address, 10**9);
      await staking_pool.stake(10**9, '0x');
      await amplToken.increaseAllowance(pioneer1.address, 10**9);
      await nft1.setApprovalForAll(pioneer1.address, true);
      await nft2.setApprovalForAll(pioneer1.address, true);
      await pioneer1.stake([0, 1], true);
      await pioneer1.stake([0, 1], false);

      await vault.makeDeposit(10**9);
    });

    it('rebasing shall fail unless 24 hours passed', async () => {
      await expect(vault.rebase()).to.be.revertedWith('AMPLRebaser: rebase can only be called once every 24 hours');
    });

    it('rebasing if ampl hasnt changed shall credit eefi', async () => {
      await ethers.provider.send('evm_increaseTime', [3600*24])
      await ethers.provider.send('evm_mine', []) // this one will have 02:00 PM as its timestamp
      await vault.rebase();
      let reward = await vault.getReward(owner);
      await expect(reward.token).to.be.equal(BigNumber.from(10**9).div(await vault.EEFI_EQULIBRIUM_REBASE_RATE()));
      await expect(reward.eth).to.be.equal(BigNumber.from(0));
    });

    it('rebasing if ampl had a negative rebase shall credit eefi', async () => {
      await amplToken.rebase(-500);
      await ethers.provider.send('evm_increaseTime', [3600*24])
      await ethers.provider.send('evm_mine', []) // this one will have 02:00 PM as its timestamp
      await vault.rebase();
      let reward = await vault.getReward(owner);
      await expect(reward.token).to.be.equal(BigNumber.from(10**9).div(await vault.EEFI_NEGATIVE_REBASE_RATE()));
      await expect(reward.eth).to.be.equal(BigNumber.from(0));
    });

    it('rebasing if ampl had a positive rebase shall credit eefi', async () => {
      await amplToken.rebase(500);
      //increase time by 24h
      await ethers.provider.send('evm_increaseTime', [3600*24])
      await ethers.provider.send('evm_mine', [])
      const receipt = await vault.rebase();
      //burning 0 because the fake uniswap contract isnt doing anything
      await expect(receipt).to.emit(vault, 'Sale_EEFI');
      await expect(receipt).to.emit(vault, 'Sale_ETH');
      await expect(receipt).to.emit(vault, 'Burn').withArgs(0);
      await expect(receipt).to.emit(pioneer1, 'ReceivedAMPL').withArgs(BigNumber.from(500/100).mul(await vault.TRADE_POSITIVE_PIONEER1_100()));
      await expect(receipt).to.emit(pioneer2, 'ProfitEth').withArgs(0);
      await expect(receipt).to.emit(staking_pool, 'ProfitEth').withArgs(0);

      //test reward once we have a good uniswap emulator???

      // let reward = await vault.getReward(owner);
      // console.log(reward)
      // expect(reward.token).to.be.equal(BigNumber.from(10**9).div(await vault.EEFI_POSITIVE_REBASE_RATE()));
      // expect(reward.eth).to.be.equal(BigNumber.from(0));
    });
  });

  describe.skip('unstaking', async() => {

    beforeEach(async () => {
      
      const balancerTraderFactory = await ethers.getContractFactory('MockTrader');
      balancerTrader = await balancerTraderFactory.deploy(amplToken.address, eefiToken.address, ethers.utils.parseUnits('0.001', 'ether'), ethers.utils.parseUnits('0.1', 'ether')) as MockTrader;
      await vault.setTrader(balancerTrader.address);

      //stake in all distribution contracts
      await amplToken.increaseAllowance(vault.address, 10**9);
      await kmplToken.increaseAllowance(pioneer2.address, 10**9);
      await pioneer2.stake(10**9, '0x');
      await amplToken.increaseAllowance(staking_pool.address, 10**9);
      await staking_pool.stake(10**9, '0x');
      
      await nft1.setApprovalForAll(pioneer1.address, true);
      await nft2.setApprovalForAll(pioneer1.address, true);
      await pioneer1.stake([0, 1], true);
      await pioneer1.stake([0, 1], false);

      await vault.makeDeposit(10**9);
      // now rebase
      await amplToken.rebase(500);
      await ethers.provider.send('evm_increaseTime', [3600*24])
      await ethers.provider.send('evm_mine', []) // this one will have 02:00 PM as its timestamp
      await vault.rebase();
    });

    it('unstaking shall fail if higher than balance', async () => {
      let totalStakedFor = await vault.totalStakedFor(owner);
      await expect(vault.withdraw(totalStakedFor.add(BigNumber.from(1)))).to.be.revertedWith('AmplesenseVault: Not enough balance');
    });

    it('unstaking shall fail if not enough time has passed since timelocked tokens', async () => {
      let totalStakedFor = await vault.totalStakedFor(owner);
      await expect(vault.withdraw(totalStakedFor)).to.be.revertedWith('AmplesenseVault: No unlocked deposits found');
    });

    it('unstaking shall work with correct balance and 90 days passed since staking', async () => {
      //increase time by 90 days
      await ethers.provider.send('evm_increaseTime', [3600*24*90])
      await ethers.provider.send('evm_mine', [])
      let totalStakedFor = await vault.totalStakedFor(owner);
      const receipt = await vault.withdraw(totalStakedFor);
      await expect(receipt).to.emit(vault, 'Withdrawal').withArgs(owner, '999999990', 0);
    });
  });
});