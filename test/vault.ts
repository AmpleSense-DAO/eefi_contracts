
import chai from 'chai';
import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';
import { solidity } from 'ethereum-waffle';

import { FakeERC20 } from '../typechain/FakeERC20';
import { MockTrader } from '../typechain/MockTrader';
import { StakingDoubleERC20 as StakingERC20 } from '../typechain/StakingDoubleERC20';
import { ElasticVault } from '../typechain/ElasticVault';
import { FakeAMPL } from '../typechain/FakeAMPL';
import { EEFIToken } from '../typechain/EEFIToken';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Trader } from '../typechain/Trader';

chai.use(solidity);

const { expect } = chai;

const zeroAddress = '0x0000000000000000000000000000000000000000';

async function getInfo(vault: ElasticVault, account: string) {
  // Promise.all can handle only 10 promise max
  const [
    staking_pool,
    trader,
    eefi_token,
    rewards_eefi,
    rewards_ohm,
    treasury,
    last_positive,
    accountTotalStaked,
  ] = await Promise.all([
    vault.staking_pool(),
    vault.trader(),
    vault.eefi_token(),
    vault.rewards_eefi(),
    vault.rewards_ohm(),
    vault.treasury(),
    vault.last_positive(),
    vault.totalStakedFor(account),
  ]);

  const [
    accountTotalClaimable,
    accountBalance,
    [ accountRewardOHM, accountRewardEEFI ],
    totalStaked,
    [ totalRewardOHM, totalRewardEEFI ],
  ] = await Promise.all([
    vault.totalClaimableBy(account),
    vault.balanceOf(account),
    vault.getReward(account),
    vault.totalStaked(),
    vault.totalReward(),
  ]);

  return {
    staking_pool,
    trader,
    eefi_token,
    rewards_eefi,
    rewards_ohm,
    treasury,
    last_positive,
    accountTotalStaked,
    accountTotalClaimable,
    accountBalance,
    accountRewardOHM,
    accountRewardEEFI,
    totalStaked,
    totalRewardOHM,
    totalRewardEEFI,
  };
}

async function impersonateAndFund(address: string) : Promise<SignerWithAddress> {
  await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [address],
  });
  await hre.network.provider.send("hardhat_setBalance", [
  address,
  "0x3635c9adc5dea00000"
  ]);

  return await ethers.getSigner(address);
}

export async function resetFork() {
  await hre.network.provider.request({
    method: "hardhat_reset",
    params: [
      {
        forking: {
          jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/EkC-rSDdHIgfpIygkCZLHetwZkz3a5Sy`,
          blockNumber: 19479186
        },
      },
    ],
  });
}


describe('ElasticVault Contract', () => {
  let vault : ElasticVault;
  let owner : string;
  let treasury : string;
  let safe : SignerWithAddress;
  let amplToken : FakeAMPL;
  let ohmToken : FakeERC20;
  let eefiToken: EEFIToken;
  let staking_pool : StakingERC20;
  let trader : Trader;
  let amplRebaser : SignerWithAddress;

  beforeEach(async () => {
    await resetFork();
    safe = await impersonateAndFund("0xf950a86013bAA227009771181a885E369e158da3");
    amplRebaser = await impersonateAndFund("0x1B228a749077b8e307C5856cE62Ef35d96Dca2ea");
    const vaultFactory = await ethers.getContractFactory('ElasticVault');
    const stakingerc20Factory = await ethers.getContractFactory('StakingDoubleERC20');
    const traderFactory = await ethers.getContractFactory('Trader');

    const accounts = await ethers.getSigners();
    owner = accounts[0].address;
    treasury = accounts[1].address;
    
    amplToken = await ethers.getContractAt('FakeAMPL', "0xD46bA6D942050d489DBd938a2C909A5d5039A161") as FakeAMPL;
    ohmToken = await ethers.getContractAt('FakeERC20', "0x64aa3364F17a4D01c6f1751Fd97C2BD3D7e7f1D5") as FakeERC20;
    eefiToken = await ethers.getContractAt('EEFIToken', "0x857FfC55B1Aa61A7fF847C82072790cAE73cd883") as EEFIToken;

    vault = await vaultFactory.deploy(eefiToken.address, amplToken.address) as ElasticVault;

    // grant minting rights to the vault
    await eefiToken.connect(safe).grantRole(await eefiToken.MINTER_ROLE(), vault.address);
    staking_pool = await stakingerc20Factory.deploy(amplToken.address, 9, eefiToken.address) as StakingERC20;
    trader = await traderFactory.deploy(eefiToken.address) as Trader;

    await amplToken.connect(safe).transfer(owner, BigNumber.from(500).mul(BigNumber.from(10).pow(9)));
  });


  it('should have been deployed correctly', async () => {
    const info = await getInfo(vault, owner);

    const deployBlock = await ethers.provider.getBlock(vault.deployTransaction.blockHash!);

    expect(info.staking_pool).to.be.equal(zeroAddress);
    expect(info.trader).to.be.equal(zeroAddress);
    expect(info.treasury).to.be.equal(zeroAddress);

    expect(info.eefi_token).to.be.equal(eefiToken.address);
    expect(info.rewards_eefi).to.not.be.equal(zeroAddress);
    expect(info.rewards_ohm).to.not.be.equal(zeroAddress);

    expect(info.last_positive).to.be.equal(deployBlock.timestamp);

    expect(info.accountTotalStaked).to.be.equal(0);
    expect(info.accountTotalClaimable).to.be.equal(0);
    expect(info.accountBalance).to.be.equal(0);
    expect(info.accountRewardOHM).to.be.equal(0);
    expect(info.accountRewardEEFI).to.be.equal(0);
    expect(info.totalStaked).to.be.equal(0);
    expect(info.totalRewardOHM).to.be.equal(0);
    expect(info.totalRewardEEFI).to.be.equal(0);
  });

  describe('Require initialization', async() => {

    beforeEach(async () => {
      await vault.initialize(staking_pool.address, treasury, trader.address);
    });

    describe('initialize()', () => {
      it('should be initialized correctly', async () => {
        const info = await getInfo(vault, owner);
        expect(info.staking_pool).to.be.equal(staking_pool.address);
        expect(info.treasury).to.be.equal(treasury);
      });

      it('should be initialized only once', async () => {
        await expect(
          vault.initialize(
            staking_pool.address,
            treasury,
            trader.address
          )
        ).to.be.revertedWith('ElasticVault: contract already initialized');
      });
    });

    describe('makeDeposit()', () => {
      it('deposit shall fail if staking without creating ampl allowance first', async () => {
        await expect(vault.makeDeposit(10**9)).to.be.reverted;
      });

      it('should fail if vault doesnt have minting rights on eefi', async () => {
        const deposit = BigNumber.from(10**9);
        await amplToken.increaseAllowance(vault.address, 10**9);
        await eefiToken.connect(safe).revokeRole(await eefiToken.MINTER_ROLE(), vault.address);
        await expect(vault.makeDeposit(deposit)).to.be.revertedWith('EEFIToken: must have minter role to mint');
      });

      it('should set shares in the contracts & mint eefi', async () => {
        const deposit = BigNumber.from(10**9);
        const EEFI_DEPOSIT_RATE = await vault.EEFI_DEPOSIT_RATE();
        const DEPOSIT_FEE_1000 = await vault.DEPOSIT_FEE_10000();
        const fee = deposit.div(EEFI_DEPOSIT_RATE).mul(DEPOSIT_FEE_1000).div(10000).mul(10**9);

        const beforeInfo = await getInfo(vault, owner);

        const rewardsOHM = await ethers.getContractAt('Distribute', beforeInfo.rewards_ohm);
        const rewardsEefi = await ethers.getContractAt('Distribute', beforeInfo.rewards_eefi);

        const beforeOwnerOHMReward = await rewardsOHM.totalStakedFor(owner);
        const beforeOwnerEefiReward = await rewardsEefi.totalStakedFor(owner);
        const beforeOwnerEefiBalance = await eefiToken.balanceOf(owner);
        const beforeTreasuryEefiBalance = await eefiToken.balanceOf(treasury);

        await amplToken.increaseAllowance(vault.address, 10**9);
        const waamplDeposit = deposit.mul(await vault.MAX_WAAMPL_SUPPLY()).div(await amplToken.totalSupply())
        await vault.makeDeposit(deposit);

        const afterInfo = await getInfo(vault, owner);
        const afterOwnerOHMReward = await rewardsOHM.totalStakedFor(owner);
        const afterOwnerEefiReward = await rewardsEefi.totalStakedFor(owner);
        const afterOwnerEefiBalance = await eefiToken.balanceOf(owner);
        const afterTreasuryEefiBalance = await eefiToken.balanceOf(treasury);
        
        expect(beforeInfo.accountTotalStaked).to.be.equal(0);
        expect(beforeInfo.accountBalance).to.be.equal(0);

        expect(beforeOwnerOHMReward).to.be.equal(0);
        expect(beforeOwnerEefiReward).to.be.equal(0);
        expect(beforeOwnerEefiBalance).to.be.equal(0);
        expect(beforeTreasuryEefiBalance).to.be.equal(0);

        expect(afterInfo.accountTotalStaked).to.be.equal(waamplDeposit);
        expect(afterInfo.accountBalance).to.be.equal(deposit);

        expect(afterOwnerOHMReward).to.be.equal(waamplDeposit);
        expect(afterOwnerEefiReward).to.be.equal(waamplDeposit);

        expect(afterTreasuryEefiBalance).to.be.equal(beforeTreasuryEefiBalance.add(fee));
        expect(afterOwnerEefiBalance).to.be.equal(BigNumber.from(10**9 / 10**4 * 10**9).sub(fee));
      });
    });

    describe('setTrader()', () => {

      it('should revert if trader is the zero address', async () => {
        await expect(vault.setTraderRequest(zeroAddress)).to.be.
          revertedWith('ElasticVault: invalid trader');
      });

      it('setting trader should revert if trader request was never made before or is invalid', async () => {
        await expect(vault.setTrader()).to.be.
          revertedWith('ElasticVault: invalid trader');
      });

      it('setting trader should revert if trader request is in cooldown', async () => {
        await vault.setTraderRequest(owner);
        await expect(vault.setTrader()).to.be.
          revertedWith('ElasticVault: Trader change cooldown');
      });

      it('should correctly set the trader', async () => {
        const beforeInfo = await getInfo(vault, owner);

        const cooldown = await vault.CHANGE_COOLDOWN();

        await vault.setTraderRequest(owner);
        await ethers.provider.send('evm_increaseTime', [cooldown.toNumber()]);
        await ethers.provider.send('evm_mine', []); // this one will have 02:00 PM as its timestamp
        await vault.setTrader();

        const afterInfo = await getInfo(vault, owner);

        expect(beforeInfo.trader).to.be.equal(trader.address);
        expect(afterInfo.trader).to.be.equal(owner);
      });
    });
  

    describe('_rebase()', async() => {

      beforeEach(async () => {
        await vault.setTraderRequest(trader.address);
        const cooldown = await vault.CHANGE_COOLDOWN();
        await ethers.provider.send('evm_increaseTime', [cooldown.toNumber()]);
        await ethers.provider.send('evm_mine', []); // this one will have 02:00 PM as its timestamp
        await vault.setTrader();

        await amplToken.increaseAllowance(vault.address, 500 * 10**9);
        await vault.makeDeposit(500 * 10**9);
      });

      it('rebasing shall fail unless 24 hours passed', async () => {
        await vault.rebase();
        await expect(vault.rebase()).to.be.revertedWith('AMPLRebaser: rebase can only be called once every 24 hours');
      });

      it('rebasing if ampl hasn\'t changed shall credit eefi', async () => {
        await ethers.provider.send('evm_increaseTime', [3600*24]);
        await ethers.provider.send('evm_mine', []); // this one will have 02:00 PM as its timestamp

        const balance = await amplToken.balanceOf(vault.address);
        const expectedRewardToken = balance.mul(10**9).div(await vault.EEFI_EQULIBRIUM_REBASE_RATE());/*multiplying by 10^9 because EEFI is 18 digits and not 9*/
        const to_rewards = expectedRewardToken.mul(await vault.TRADE_NEUTRAL_NEG_EEFI_REWARDS_100()).div(100);
        const to_lp_staking = expectedRewardToken.mul(await vault.TRADE_NEUTRAL_NEG_LPSTAKING_100()).div(100);

        const to_treasury = expectedRewardToken.sub(to_rewards).sub(to_lp_staking);
        
        const before = await getInfo(vault, owner);

        const balanceTreasury = await eefiToken.balanceOf(treasury);
        const tx = await vault.rebase();

        expect(tx).to.have.emit(staking_pool, "ProfitEEFI").withArgs(to_lp_staking);

        const balanceTreasuryAfter = await eefiToken.balanceOf(treasury);

        expect(balanceTreasuryAfter.sub(balanceTreasury)).to.be.equal(to_treasury);

        const after = await getInfo(vault, owner);

        expect(before.accountRewardOHM).to.be.equal(0);
        expect(before.accountRewardEEFI).to.be.equal(0);
        expect(before.totalRewardOHM).to.be.equal(0);
        expect(before.totalRewardEEFI).to.be.equal(0);
        const waamplDeposit = BigNumber.from(500 * 10**9).mul(await vault.MAX_WAAMPL_SUPPLY()).div(await amplToken.totalSupply())
        expect(before.totalStaked).to.be.equal(waamplDeposit);

        expect(after.accountRewardOHM).to.be.equal(0);
        // there is a slight discrepancy due to how rewards are computed
        expect(after.accountRewardEEFI).to.be.equal("27499999999999986"); // very close to "to_rewards"
        expect(after.totalRewardOHM).to.be.equal(0);
        expect(after.totalRewardEEFI).to.be.equal(to_rewards);
        expect(after.totalStaked).to.be.equal(waamplDeposit);
      });

      it('rebasing if ampl had a negative rebase shall credit eefi', async () => {
        await ethers.provider.send('evm_increaseTime', [3600*24]);
        await ethers.provider.send('evm_mine', []); // this one will have 02:00 PM as its timestamp
        await amplToken.connect(amplRebaser).rebase(0, -5000 * 10**9);

        const balance = await amplToken.balanceOf(vault.address);
        const expectedRewardToken = balance.mul(10**9).div(await vault.EEFI_NEGATIVE_REBASE_RATE());/*multiplying by 10^9 because EEFI is 18 digits and not 9*/
        const to_lp_staking = expectedRewardToken.mul(await vault.TRADE_NEUTRAL_NEG_LPSTAKING_100()).div(100);

        const tx = await vault.rebase();

        expect(tx).to.have.emit(staking_pool, "ProfitEEFI").withArgs(to_lp_staking);
      });

      it('rebasing if ampl had a positive rebase shall store AMPL in sell storage', async () => {
        const amplOldSupply = await amplToken.totalSupply();

        await amplToken.connect(amplRebaser).rebase(0, 500000 * 10**9);

        const amplNewSupply = await amplToken.totalSupply();
        const vaultNewSupply = await amplToken.balanceOf(vault.address);
        // compute the change ratio of global supply during rebase
        // we cannot use the original computation (10**18) here since BigNumber isn't as large as uint256
        const changeRatio12Digits = amplOldSupply.mul(10**12).div(amplNewSupply);
        // compute how much of the vault holdings come from the rebase
        const surplus = vaultNewSupply.sub(vaultNewSupply.mul(changeRatio12Digits).div(10**12));

        await vault.rebase();

        const storage_addr = await vault.token_storage();
        const amplBalance = await amplToken.balanceOf(storage_addr);
        // convert to ETH equivalent to prevent rounding errors during checks
        const amplBalanceUnit = amplBalance.div(10**9);
        const surplusUnit = surplus.div(10**9);
        expect(amplBalanceUnit).to.be.equal(surplusUnit);
      });

      it('selling shall purchase, distribute and burn EEFI, and purchase and distribute OHM', async () => {
        // replicate a positive rebase first
        await amplToken.connect(amplRebaser).rebase(0, 500000 * 10**9);
        await vault.rebase();

        const storage_addr = await vault.token_storage();
        const amplBalance = await amplToken.balanceOf(storage_addr);

        const [
          TRADE_POSITIVE_EEFI_100,
          TRADE_POSITIVE_OHM_100,
          TRADE_POSITIVE_LPSTAKING_100,
          TRADE_POSITIVE_OHM_REWARDS_100,
          TREASURY_EEFI_100,
          TRADE_POSITIVE_TREASURY_100,
        ] = await Promise.all([
          vault.TRADE_POSITIVE_EEFI_100(),
          vault.TRADE_POSITIVE_OHM_100(),
          vault.TRADE_POSITIVE_LPSTAKING_100(),
          vault.TRADE_POSITIVE_OHM_REWARDS_100(),
          vault.TREASURY_EEFI_100(),
          vault.TRADE_POSITIVE_TREASURY_100()
        ]);

        const for_eefi = amplBalance.mul(TRADE_POSITIVE_EEFI_100).div(100);
        const for_ohm = amplBalance.mul(TRADE_POSITIVE_OHM_100).div(100);
        const for_treasury = amplBalance.mul(TRADE_POSITIVE_TREASURY_100).div(100);

        await vault.setAuthorizedTraderRequest(owner);
        const cooldown = await vault.CHANGE_COOLDOWN();
        await ethers.provider.send('evm_increaseTime', [cooldown.toNumber()]);
        await ethers.provider.send('evm_mine', []);
        await vault.setAuthorizedTrader();

        // check how much eefi & ohm the mock trader is supposed to send for the for_eefi & for_ohm ampl
        const bought = await vault.callStatic.sell(0, 0);
        const expectedLPOHMProfit = bought.ohm_purchased.mul(TRADE_POSITIVE_LPSTAKING_100).div(100);
        const expectedRewardsOHM = bought.ohm_purchased.mul(TRADE_POSITIVE_OHM_REWARDS_100).div(100);
        const expectedTreasuryOHM = bought.ohm_purchased.sub(expectedLPOHMProfit).sub(expectedRewardsOHM);
        
        // compute how much is sent to treasury
        const treasuryAmount = bought.eefi_purchased.mul(TREASURY_EEFI_100).div(100);
        
        // the rest is burned
        let toBurn = bought.eefi_purchased.sub(treasuryAmount);
        const treasuryAMPLBalanceBefore = await amplToken.balanceOf(treasury);
        const treasuryEEFIBalanceBefore = await eefiToken.balanceOf(treasury);
        const treasuryOHMBalanceBefore = await ohmToken.balanceOf(treasury);

        const tx = await vault.sell(0,0);
        const treasuryAMPLBalanceAfter = await amplToken.balanceOf(treasury);
        const treasuryEEFIBalanceAfter = await eefiToken.balanceOf(treasury);
        const treasuryOHMBalanceAfter = await ohmToken.balanceOf(treasury);
        expect(treasuryAMPLBalanceAfter.sub(treasuryAMPLBalanceBefore).toString()).to.be.equal(for_treasury.toString());
        expect(treasuryEEFIBalanceAfter.sub(treasuryEEFIBalanceBefore).toString()).to.be.equal(treasuryAmount.toString());
        expect(treasuryOHMBalanceAfter.sub(treasuryOHMBalanceBefore).toString()).to.be.equal(expectedTreasuryOHM.toString());
        const reward = await vault.getReward(owner);
        
        // expect(tx).to.emit(trader, 'Sale_EEFI').withArgs(bought.eefi_purchased, bought.eefi_purchased);
        // expect(tx).to.emit(trader, 'Sale_OHM').withArgs(bought.ohm_purchased, bought.ohm_purchased);

        expect(tx).to.emit(vault, 'Burn').withArgs(toBurn);

        // staking pool should get ohm
        expect(tx).to.emit(staking_pool, 'ProfitOHM').withArgs(expectedLPOHMProfit);

        expect(reward.eefi).to.be.equal(0);
        // imprecise due to how rewards are computed
        expect(reward.ohm.toNumber()).to.be.closeTo(expectedRewardsOHM.toNumber(), 2000000);
      });
    });

    describe('withdraw()', async() => {

      beforeEach(async () => {      
        await vault.setAuthorizedTraderRequest(owner);
        const cooldown = await vault.CHANGE_COOLDOWN();
        await ethers.provider.send('evm_increaseTime', [cooldown.toNumber()]);
        await ethers.provider.send('evm_mine', []);
        await vault.setAuthorizedTrader();

        await amplToken.increaseAllowance(vault.address, 500 * 10**9);

        await vault.makeDeposit(200 * 10**9);
        //double deposit to test deposit pop
        await vault.makeDeposit(300 * 10**9);

        // replicate a positive rebase
        await amplToken.connect(amplRebaser).rebase(0, 5000000 * 10**9);
        await vault.rebase();
        await vault.sell(0, 0);
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

        console.log("totalstakedfor", totalStakedFor.toString());

        const tx = await vault.withdraw(totalStakedFor.sub(1000));
        const tx2 = await vault.withdraw(1000);

        // they should get back the same amount of AMPL + 30% of the positive rebase
        expect(tx).to.emit(vault, 'Withdrawal').withArgs(owner, '504074298030', 1);
        expect(tx2).to.emit(vault, 'Withdrawal').withArgs(owner, '19', 0);
      });
    });

    describe('claim()', async () => {

      beforeEach(async () => {      
        await vault.setAuthorizedTraderRequest(owner);
        const cooldown = await vault.CHANGE_COOLDOWN();
        await ethers.provider.send('evm_increaseTime', [cooldown.toNumber()]);
        await ethers.provider.send('evm_mine', []);
        await vault.setAuthorizedTrader();

        await amplToken.increaseAllowance(vault.address, 250*10**9);
        await vault.makeDeposit(250*10**9);
        const [ ownerAccount, secondAccount ] = await ethers.getSigners();
        // add a deposit for another user because we didnt see the critical claiming issue before
        await amplToken.transfer(secondAccount.address, 250*10**9);
        await amplToken.connect(secondAccount).increaseAllowance(vault.address, 250*10**9);
        await vault.connect(secondAccount).makeDeposit(250*10**9);

        // increase time by 24h
        await ethers.provider.send('evm_increaseTime', [3600*24]);
        await ethers.provider.send('evm_mine', []);

        await amplToken.connect(amplRebaser).rebase(0, 50000 * 10**9);
        await vault.rebase();
        await vault.sell(0, 0);

        // increase time by 24h
        await ethers.provider.send('evm_increaseTime', [3600*24]);
        await ethers.provider.send('evm_mine', []);

        await amplToken.connect(amplRebaser).rebase(0, -50000 * 10**9);
        await vault.rebase();
      });

      it('should work as expected', async () => {

        const before = await getInfo(vault, owner);
        
        const tx = await vault.claim();
        
        const after = await getInfo(vault, owner);

        expect(before.accountRewardOHM).to.be.equal(1259013);
        expect(before.accountRewardEEFI).to.be.equal(BigNumber.from("1323822391060481"));

        expect(tx).to.emit(vault, 'Claimed').withArgs(owner, 1259013, BigNumber.from("1323822391060481"));

        expect(after.accountRewardOHM).to.be.equal(0);
        expect(after.accountRewardEEFI).to.be.equal(0);
      });
    });

    describe('testing wample system resilience to rebasing ampl', async () => {

      beforeEach(async () => {      
        await vault.setAuthorizedTraderRequest(owner);
        const cooldown = await vault.CHANGE_COOLDOWN();
        await ethers.provider.send('evm_increaseTime', [cooldown.toNumber()]);
        await ethers.provider.send('evm_mine', []);
        await vault.setAuthorizedTrader();
      });

      it('stakes', async () => {
        const depositAmount = BigNumber.from(10*10**9);
        await amplToken.increaseAllowance(vault.address, depositAmount);
        await vault.makeDeposit(depositAmount);
        let totalStaked = await vault.totalStaked();
        let totalStakedUser = await vault.totalStakedFor(owner);
        let amplTotalSupply = await amplToken.totalSupply();
        const MAX_WAAMPL_SUPPLY = await vault.MAX_WAAMPL_SUPPLY();
        const expectedShares = depositAmount.mul(MAX_WAAMPL_SUPPLY).div(amplTotalSupply);
        
        expect(totalStaked).to.be.equal(expectedShares);
        expect(totalStakedUser).to.be.equal(expectedShares);

        const [ ownerAccount, secondAccount ] = await ethers.getSigners();
        // add a deposit for another user
        // provision user with enough tokens
        await amplToken.transfer(secondAccount.address, depositAmount.mul(10));
        // create a big enough allowance for testing
        await amplToken.connect(secondAccount).increaseAllowance(vault.address, depositAmount.mul(10));
        await vault.connect(secondAccount).makeDeposit(depositAmount);

        totalStaked = await vault.totalStaked();
        totalStakedUser = await vault.totalStakedFor(owner);
        
        expect(totalStaked).to.be.equal(expectedShares.mul(2));
        expect(totalStakedUser).to.be.equal(expectedShares);
        // rebase ampl
        console.log("total", amplTotalSupply.toString());
        // double total supply
        await amplToken.connect(amplRebaser).rebase(0, amplTotalSupply);
        console.log("total", (await amplToken.totalSupply()).toString());
        // increase time by 24h
        await ethers.provider.send('evm_increaseTime', [3600*24]);
        await ethers.provider.send('evm_mine', []);
        await vault.rebase();
        // another deposit of same amount
        await vault.connect(secondAccount).makeDeposit(depositAmount);

        totalStaked = await vault.totalStaked();
        
        // totalStaked should increase by only half of the expectedShares because AMPL is worth twice less wampl after rebase
        expect(totalStaked).to.be.equal(expectedShares.mul(2).add(expectedShares.div(2)));
        // first stake should remain the same
        expect(await vault.totalStakedFor(owner)).to.be.equal(expectedShares);
        // second user stake should also increase by only half
        expect(await vault.totalStakedFor(secondAccount.address)).to.be.equal(expectedShares.add(expectedShares.div(2)));
        
        // trigger vault positive rebase
        await ethers.provider.send('evm_increaseTime', [3600*24*90]); // increase time by 90 days
        await ethers.provider.send('evm_mine', []);
        await vault.rebase();
        await vault.sell(0, 0);

        // since ampl doubled in total supply, the expected ampl upon withdrawal is twice as much as the initial deposit
        // however since the vault is selling on positive rebases, the real amount of AMPL the user has needs to be computed using this formula:
        // vault AMPL balance * userStake / totalStake
        let vaultAMPLbalance = await amplToken.balanceOf(vault.address);
        let userStake = await vault.totalStakedFor(owner);
        let totalStake = await vault.totalStaked();
        let expectedAMPLAmount = vaultAMPLbalance.mul(userStake).div(totalStake);

        let tx = await vault.withdraw(expectedShares);
        
        expect(tx).to.emit(amplToken, 'Transfer').withArgs(vault.address, owner, expectedAMPLAmount);
        
        // since ampl doubled in total supply, the expected ampl upon withdrawal is twice as much as the initial deposit
        expectedAMPLAmount = depositAmount.mul(2);
        // the second deposit for this account was done after the ampl rebase and should be worth same amount of AMPL as before
        expectedAMPLAmount = expectedAMPLAmount.add(depositAmount);
        console.log(expectedAMPLAmount.toString());
        
        vaultAMPLbalance = await amplToken.balanceOf(vault.address);
        userStake = await vault.totalStakedFor(secondAccount.address);
        totalStake = await vault.totalStaked();
        expectedAMPLAmount = vaultAMPLbalance.mul(userStake).div(totalStake);

        tx = await vault.connect(secondAccount).withdraw(expectedShares.add(expectedShares.div(2)));

        expect(tx).to.emit(amplToken, 'Transfer').withArgs(vault.address, secondAccount.address, expectedAMPLAmount);
        expect(await amplToken.balanceOf(vault.address)).to.be.equal(0);

      });
    });
  });
});