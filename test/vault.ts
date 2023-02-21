
import chai from 'chai';
import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';
import { solidity } from 'ethereum-waffle';

import { FakeERC20 } from '../typechain/FakeERC20';
import { FakeERC721 } from '../typechain/FakeERC721';
import { MockTrader } from '../typechain/MockTrader';
import { StakingERC20WithETH as StakingERC20 } from '../typechain/StakingERC20WithETH';
import { TestElasticVault } from '../typechain/TestElasticVault';
import { FakeAMPL } from '../typechain/FakeAMPL';

chai.use(solidity);

const { expect } = chai;

const zeroAddress = '0x0000000000000000000000000000000000000000';

async function getInfo(vault: TestElasticVault, account: string) {
  // Promise.all can handle only 10 promise max
  const [
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


describe('ElasticVault Contract', () => {
  let vault : TestElasticVault;

  let owner : string;
  let treasury : string;
  
  let amplToken : FakeAMPL;
  let kmplToken: FakeERC20;
  let eefiToken: FakeERC20;
  
  let pioneer2 : StakingERC20;
  let pioneer3 : StakingERC20;
  
  let nft1 : FakeERC721;
  let nft2 : FakeERC721;
  
  let staking_pool : StakingERC20;
  
  let balancerTrader : MockTrader;

  beforeEach(async () => {
    const erc20Factory = await ethers.getContractFactory('FakeERC20');
    const erc721Factory = await ethers.getContractFactory('FakeERC721');
    const vaultFactory = await ethers.getContractFactory('TestElasticVault');
    const stakingerc20Factory = await ethers.getContractFactory('StakingERC20WithETH');
    const traderFactory = await ethers.getContractFactory('MockTrader');
    const amplFactory = await ethers.getContractFactory('FakeAMPL');

    const accounts = await ethers.getSigners();
    owner = accounts[0].address;
    treasury = accounts[1].address;
    
    amplToken = await amplFactory.deploy() as FakeAMPL;
    kmplToken = await erc20Factory.deploy('9') as FakeERC20;
    nft1 = await erc721Factory.deploy() as FakeERC721;
    nft2 = await erc721Factory.deploy() as FakeERC721;
    
    vault = await vaultFactory.deploy(amplToken.address) as TestElasticVault;
    
    let eefiTokenAddress = await vault.eefi_token();
    eefiToken = await ethers.getContractAt('FakeERC20', eefiTokenAddress) as FakeERC20;
    
    pioneer2 = await stakingerc20Factory.deploy(kmplToken.address, eefiTokenAddress, 9) as StakingERC20;
    pioneer3 = await stakingerc20Factory.deploy(amplToken.address, eefiTokenAddress, 9) as StakingERC20;
    staking_pool = await stakingerc20Factory.deploy(amplToken.address, eefiTokenAddress, 9) as StakingERC20;
    balancerTrader = await traderFactory.deploy(amplToken.address, eefiToken.address, ethers.utils.parseEther('1'), ethers.utils.parseEther('1')) as MockTrader;
  });


  it('should have been deployed correctly', async () => {
    const info = await getInfo(vault, owner);

    const deployBlock = await ethers.provider.getBlock(vault.deployTransaction.blockHash!);

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
      await vault.initialize(pioneer2.address, pioneer3.address, staking_pool.address, treasury);
    });

    describe('initialize()', () => {
      it('should be initialized correctly', async () => {
        const info = await getInfo(vault, owner);

        expect(info.pioneer_vault2).to.be.equal(pioneer2.address);
        expect(info.pioneer_vault3).to.be.equal(pioneer3.address);
        expect(info.staking_pool).to.be.equal(staking_pool.address);
      });

      it('should be mint EEFI upon initialization correctly', async () => {
        expect(await eefiToken.balanceOf(treasury)).to.be.equal(await vault.INITIAL_MINT());
      });

      it('should be initialized only once', async () => {
        await expect(
          vault.initialize(
            pioneer2.address,
            pioneer3.address,
            staking_pool.address,
            treasury
          )
        ).to.be.revertedWith('ElasticVault: contract already initialized');
      });
    });

    describe('makeDeposit()', () => {
      it('deposit shall fail if staking without creating ampl allowance first', async () => {
        await expect(vault.makeDeposit(10**9)).to.be.reverted;
      });

      it('should set shares in the contracts & mint eefi', async () => {
        const deposit = BigNumber.from(10**9);
        const EEFI_DEPOSIT_RATE = await vault.EEFI_DEPOSIT_RATE();
        const DEPOSIT_FEE_1000 = await vault.DEPOSIT_FEE_10000();
        const fee = deposit.div(EEFI_DEPOSIT_RATE).mul(DEPOSIT_FEE_1000).div(10000).mul(10**9);

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
        const wamplDeposit = deposit.mul(await vault.MAX_WAMPL_SUPPLY()).div(await amplToken.totalSupply())
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

        expect(afterInfo.accountTotalStaked).to.be.equal(wamplDeposit);
        expect(afterInfo.accountBalance).to.be.equal(deposit);

        expect(afterOwnerEthReward).to.be.equal(wamplDeposit);
        expect(afterOwnerEefiReward).to.be.equal(wamplDeposit);

        expect(afterOwnerPioneer2Reward.__token).to.be.equal(fee);
        expect(afterOwnerEefiBalance).to.be.equal(BigNumber.from(10**9 / 10**4 * 10**9).sub(fee));
      });
    });

    describe('setTrader()', () => {

      it('should revert if trader is the zero address', async () => {
        await expect(vault.setTrader(zeroAddress)).to.be.
          revertedWith('ElasticVault: invalid trader');
      });

      it('should correctly set the trader', async () => {
        const beforeInfo = await getInfo(vault, owner);

        const tx = await vault.setTrader(balancerTrader.address);

        const afterInfo = await getInfo(vault, owner);

        expect(beforeInfo.trader).to.be.equal(zeroAddress);
        expect(afterInfo.trader).to.be.equal(balancerTrader.address);
      });
    });
  

    describe('_rebase()', async() => {

      beforeEach(async () => {
        await vault.setTrader(balancerTrader.address);

        await amplToken.increaseAllowance(vault.address, 10**9);

        await vault.TESTMINT(99999, balancerTrader.address);
        const [ ownerAccount ] = await ethers.getSigners();
        ownerAccount.sendTransaction({ to: balancerTrader.address, value: ethers.utils.parseEther('50') })

        await vault.makeDeposit(10**9);
      });

      it('rebasing shall fail unless 24 hours passed', async () => {
        await expect(vault.rebase(0, 0)).to.be.revertedWith('AMPLRebaser: rebase can only be called once every 24 hours');
      });

      it('rebasing if ampl hasn\'t changed shall credit eefi', async () => {
        await ethers.provider.send('evm_increaseTime', [3600*24]);
        await ethers.provider.send('evm_mine', []); // this one will have 02:00 PM as its timestamp

        const expectedRewardToken = BigNumber.from(10**9).div(await vault.EEFI_EQULIBRIUM_REBASE_RATE()).mul(10**9);/*multiplying by 10^9 because EEFI is 18 digits and not 9*/

        const to_rewards = expectedRewardToken.mul(await vault.TRADE_POSITIVE_REWARDS_100()).div(100);
        const to_pioneer2 = expectedRewardToken.mul(await vault.TRADE_POSITIVE_PIONEER2_100()).div(100);
        const to_pioneer3 = expectedRewardToken.mul(await vault.TRADE_POSITIVE_PIONEER3_100()).div(100);
        const to_lp_staking = expectedRewardToken.mul(await vault.TRADE_POSITIVE_LPSTAKING_100()).div(100);

        const to_treasury = expectedRewardToken.sub(to_rewards).sub(to_pioneer2).sub(to_pioneer3).sub(to_lp_staking);
        
        const before = await getInfo(vault, owner);

        const beforeEEFICallerBalance = await eefiToken.balanceOf(owner);

        const balanceTreasury = await eefiToken.balanceOf(treasury);

        const tx = await vault.rebase(0, 0);

        expect(tx).to.have.emit(pioneer2, "ProfitToken").withArgs(to_pioneer2);
        expect(tx).to.have.emit(pioneer3, "ProfitToken").withArgs(to_pioneer3);
        expect(tx).to.have.emit(staking_pool, "ProfitToken").withArgs(to_lp_staking);

        const balanceTreasuryAfter = await eefiToken.balanceOf(treasury);

        expect(balanceTreasuryAfter.sub(balanceTreasury)).to.be.equal(to_treasury);

        const after = await getInfo(vault, owner);

        expect(before.accountRewardToken).to.be.equal(0);
        expect(before.accountRewardEth).to.be.equal(0);
        expect(before.totalRewardToken).to.be.equal(0);
        expect(before.totalRewardEth).to.be.equal(0);
        const wamplDeposit = BigNumber.from(10**9).mul(await vault.MAX_WAMPL_SUPPLY()).div(await amplToken.totalSupply())
        expect(before.totalStaked).to.be.equal(wamplDeposit);

        expect(after.accountRewardToken).to.be.equal(to_rewards);
        expect(after.accountRewardEth).to.be.equal(0);
        expect(after.totalRewardToken).to.be.equal(0);
        expect(after.totalRewardEth).to.be.equal(45000000000000);
        expect(after.totalStaked).to.be.equal(wamplDeposit);
      });

      it('rebasing if ampl had a negative rebase shall credit eefi', async () => {
        await ethers.provider.send('evm_increaseTime', [3600*24])
        await ethers.provider.send('evm_mine', []) // this one will have 02:00 PM as its timestamp

        const EEFI_NEGATIVE_REBASE_RATE = await vault.EEFI_NEGATIVE_REBASE_RATE();
        const expectedRewardToken = BigNumber.from(10**9).div(EEFI_NEGATIVE_REBASE_RATE).mul(10**9); /*multiplying by 10^9 because EEFI is 18 digits and not 9*/
        const to_rewards = expectedRewardToken.mul(await vault.TRADE_POSITIVE_REWARDS_100()).div(100);

        await amplToken.rebase(0, -500);

        const before = await getInfo(vault, owner);

        const tx = await vault.rebase(0, 0);

        const after = await getInfo(vault, owner);

        expect(before.accountRewardToken).to.be.equal(0);
        expect(before.accountRewardEth).to.be.equal(0);
        expect(before.totalRewardToken).to.be.equal(0);
        expect(before.totalRewardEth).to.be.equal(0);
        expect(before.totalStaked).to.be.equal("200000000000");

        expect(after.accountRewardToken).to.be.closeTo(to_rewards as any, 10**9);
        expect(after.accountRewardEth).to.be.equal(0);
        expect(after.totalRewardToken).to.be.equal(0);
        expect(after.totalRewardEth).to.be.closeTo(to_rewards as any, 10**9);
        expect(after.totalStaked).to.be.equal("200000000000");

        //other distribution detail tests are done in the previous test
      });

      it('rebasing if ampl had a positive rebase shall credit eefi', async () => {
        const amplOldSupply = await amplToken.totalSupply();

        await amplToken.rebase(0, 5000 * 10**9);

        const amplNewSupply = await amplToken.totalSupply();
        const vaultNewSupply = await amplToken.balanceOf(vault.address);

        const [
          TRADE_POSITIVE_EEFI_100,
          TRADE_POSITIVE_ETH_100,
          TRADE_POSITIVE_PIONEER1_100,
          TRADE_POSITIVE_PIONEER2_100,
          TRADE_POSITIVE_LPSTAKING_100,
          TREASURY_EEFI_100,
          TRADER_RATIO_EEFI,
          TRADER_RATIO_ETH,
        ] = await Promise.all([
          vault.TRADE_POSITIVE_EEFI_100(),
          vault.TRADE_POSITIVE_ETH_100(),
          vault.TRADE_POSITIVE_PIONEER1_100(),
          vault.TRADE_POSITIVE_PIONEER2_100(),
          vault.TRADE_POSITIVE_LPSTAKING_100(),
          vault.TREASURY_EEFI_100(),
          balancerTrader.ratio_eefi(),
          balancerTrader.ratio_eth(),
        ]);

        // compute the change ratio of global supply during rebase
        // we cannot use the original computation (10**18) here since BigNumber isn't as large as uint256
        const changeRatio8Digits = amplOldSupply.mul(10**8).div(amplNewSupply);

        // compute how much of the vault holdings come from the rebase
        const surplus = vaultNewSupply.sub(vaultNewSupply.mul(changeRatio8Digits).div(10**8));

        const for_eefi = surplus.mul(TRADE_POSITIVE_EEFI_100).div(100);
        const for_eth = surplus.mul(TRADE_POSITIVE_ETH_100).div(100);

        // check how much eefi & eth the mock trader is supposed to send for the for_eefi & for_eth ampl
        const boughEEFI = for_eefi.mul(TRADER_RATIO_EEFI.div(10**10)).div(10**8);
        const boughtEth = for_eth.mul(TRADER_RATIO_ETH.div(10**10)).div(10**8);
        const expectedEthProfit = boughtEth.mul(TRADE_POSITIVE_PIONEER2_100).div(100);
        const expectedLPEthProfit = boughtEth.mul(TRADE_POSITIVE_LPSTAKING_100).div(100);
        
        // compute how much is sent to treasury
        const treasuryAmount = boughEEFI.mul(TREASURY_EEFI_100).div(100);
        
        // the rest is burned
        let toBurn = boughEEFI.sub(treasuryAmount); // 43204
        // real value due to precision in the contract:
        toBurn = BigNumber.from(43200);
        // increase time by 24h
        await ethers.provider.send('evm_increaseTime', [3600*24]);
        await ethers.provider.send('evm_mine', []);

        const tx = await vault.rebase(0, 0);
        const reward = await vault.getReward(owner);
        
        expect(tx).to.emit(balancerTrader, 'Sale_EEFI').withArgs(48000, 48000);
        expect(tx).to.emit(balancerTrader, 'Sale_ETH').withArgs(20000, 20000);

        expect(tx).to.emit(vault, 'Burn').withArgs(toBurn);

        // pioneer2 and staking pool should get eth
        expect(tx).to.emit(pioneer2, 'ProfitEth').withArgs(expectedEthProfit);
        expect(tx).to.emit(staking_pool, 'ProfitEth').withArgs(expectedLPEthProfit);

        expect(reward.token).to.be.equal(0);
        expect(reward.eth).to.be.equal(9000);
      });
    });

    describe('withdraw()', async() => {

      beforeEach(async () => {      
        await vault.setTrader(balancerTrader.address);

        await amplToken.increaseAllowance(vault.address, 10**9);

        await vault.TESTMINT(99999, balancerTrader.address);
        const [ ownerAccount ] = await ethers.getSigners();
        ownerAccount.sendTransaction({ to: balancerTrader.address, value: ethers.utils.parseEther('50') })

        await vault.makeDeposit(10**9 / 2);
        //double deposit to test deposit pop
        await vault.makeDeposit(10**9 / 2);

        // increase time by 24h
        await ethers.provider.send('evm_increaseTime', [3600*24]);
        await ethers.provider.send('evm_mine', []);

        await vault.rebase(0, 0);
      });
  
      it('unstaking of shares shall fail if higher than balance', async () => {
        const totalStakedFor = await vault.totalStakedFor(owner);
        await expect(vault.withdraw(totalStakedFor.add(1))).to.be.revertedWith('ElasticVault: Not enough balance');
      });
  
      it('unstaking of shares shall fail if not enough time has passed since timelocked tokens', async () => {
        const totalStakedFor = await vault.totalStakedFor(owner);
        await expect(vault.withdraw(totalStakedFor)).to.be.revertedWith('ElasticVault: No unlocked deposits found');
      });
  
      it('unstaking of shares shall work with correct balance and 90 days passed since staking', async () => {

        await ethers.provider.send('evm_increaseTime', [3600*24*90]); // increase time by 90 days
        await ethers.provider.send('evm_mine', []);

        let totalStakedFor = await vault.totalStakedFor(owner);

        const tx = await vault.withdraw(totalStakedFor.sub(1000));
        const tx2 = await vault.withdraw(1000);

        expect(tx).to.emit(vault, 'Withdrawal').withArgs(owner, '999999995', 1);
        expect(tx2).to.emit(vault, 'Withdrawal').withArgs(owner, '5', 0);
      });

      it('unstaking of AMPL shall fail if higher than claimable AMPL', async () => {
        await ethers.provider.send('evm_increaseTime', [3600*24*90]); // increase time by 90 days
        await ethers.provider.send('evm_mine', []);
        const totalClaimableAMPLFor = await vault.totalClaimableBy(owner);
        await expect(vault.withdrawAMPL(totalClaimableAMPLFor.add(1), totalClaimableAMPLFor.add(1))).to.be.revertedWith('ElasticVault: Insufficient AMPL balance');
      });

      it('unstaking of AMPL shall work with correct balance and 90 days passed since staking', async () => {

        await ethers.provider.send('evm_increaseTime', [3600*24*90]); // increase time by 90 days
        await ethers.provider.send('evm_mine', []);

        const totalClaimableAMPLFor = await vault.totalClaimableBy(owner);

        const before = await amplToken.balanceOf(owner);

        const tx = await vault.withdrawAMPL(totalClaimableAMPLFor.sub(1000), totalClaimableAMPLFor.sub(1000));
        const tx2 = await vault.withdrawAMPL(1000, 1000);

        const after = await amplToken.balanceOf(owner);

        expect(tx).to.emit(vault, 'Withdrawal').withArgs(owner, '999999000', 1);
        expect(tx2).to.emit(vault, 'Withdrawal').withArgs(owner, '1000', 0);
        expect(after.sub(before)).to.be.equal(totalClaimableAMPLFor);
      });
    });

    describe('claim()', async () => {

      beforeEach(async () => {      
        await vault.setTrader(balancerTrader.address);

        await amplToken.increaseAllowance(vault.address, 999999*10**9);

        await vault.TESTMINT(99999*10**9, balancerTrader.address);
        const [ ownerAccount, secondAccount ] = await ethers.getSigners();
        ownerAccount.sendTransaction({ to: balancerTrader.address, value: ethers.utils.parseEther('50') })

        await vault.makeDeposit(10000*10**9);
        // add a deposit for another user because we didnt see the critical claiming issue before
        await amplToken.transfer(secondAccount.address, 10000*10**9);
        await amplToken.connect(secondAccount).increaseAllowance(vault.address, 10000*10**9);
        await vault.connect(secondAccount).makeDeposit(10000*10**9);

        // increase time by 24h
        await ethers.provider.send('evm_increaseTime', [3600*24]);
        await ethers.provider.send('evm_mine', []);

        await vault.rebase(0, 0);
        
        await amplToken.rebase(0, 500 * 10**9);

        // increase time by 24h
        await ethers.provider.send('evm_increaseTime', [3600*24]);
        await ethers.provider.send('evm_mine', []);
        
        await vault.rebase(0, 0);
      });

      it('should work as expected', async () => {

        const before = await getInfo(vault, owner);
        
        const tx = await vault.claim();
        
        const after = await getInfo(vault, owner);

        expect(before.accountRewardEth).to.be.equal(8000000);
        expect(before.accountRewardToken).to.be.equal(BigNumber.from("450000000000000000"));

        expect(tx).to.emit(vault, 'Claimed').withArgs(owner, 8000000, BigNumber.from("450000000000000000"));

        expect(after.accountRewardEth).to.be.equal(0);
        expect(after.accountRewardToken).to.be.equal(0);
      });
    });
  });
});