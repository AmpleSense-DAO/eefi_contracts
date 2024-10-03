
import chai from 'chai';
import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';
import { solidity } from 'ethereum-waffle';
import { formatBytes32String } from 'ethers/lib/utils';

import { FakeERC20 } from '../typechain/FakeERC20';
import { StakingDoubleERC20 } from '../typechain/StakingDoubleERC20';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

chai.use(solidity);

const { expect } = chai;

async function getInfo(staking: StakingDoubleERC20, userAddress: string) {
  const [
    distributeOHMContract,
    distributeEEFIContract,
    userTotalStake,
    totalStake,
    stackingTokenContract,
    supportsHistory,
    [ userOHMReward, userEEFIReward, ],
  ] = await Promise.all([
    staking.staking_contract_ohm(),
    staking.staking_contract_eefi(),
    staking.totalStakedFor(userAddress),
    staking.totalStaked(),
    staking.token(),
    staking.supportsHistory(),
    staking.getReward(userAddress),
  ]);
  return {
    distributeOHMContract,
    distributeEEFIContract,
    userTotalStake,
    totalStake,
    stackingTokenContract,
    supportsHistory,
    userOHMReward,
    userEEFIReward,
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

export async function resetFork(block: number) {
  await hre.network.provider.request({
    method: "hardhat_reset",
    params: [
      {
        forking: {
          jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/EkC-rSDdHIgfpIygkCZLHetwZkz3a5Sy`,
          blockNumber: block
        },
      },
    ],
  });
}


describe('StakingERC20WithETH Contract', () => {

  let eefiToken: FakeERC20;
  let ohmToken: FakeERC20;
  let stakingToken: FakeERC20;
  let staking: StakingDoubleERC20;
  let owner: string;
  let userA: SignerWithAddress;

  beforeEach(async () => {

    await resetFork(20039900);

    const [ erc20Factory, stackingFactory, accounts ] = await Promise.all([
      ethers.getContractFactory('FakeERC20'),
      ethers.getContractFactory('StakingDoubleERC20'),
      ethers.getSigners(),
    ]);

    owner = accounts[0].address;
    userA = accounts[1];

    [ eefiToken, stakingToken, ohmToken ] = await Promise.all([
      erc20Factory.deploy('18') as Promise<FakeERC20>,
      erc20Factory.deploy('9') as Promise<FakeERC20>,
      ethers.getContractAt('FakeERC20', '0x64aa3364F17a4D01c6f1751Fd97C2BD3D7e7f1D5') as Promise<FakeERC20>,
    ]);

    staking = await stackingFactory.deploy(stakingToken.address, '9', eefiToken.address) as StakingDoubleERC20;

    // get ohm
    const big_ohm_holder_36000 = "0x4A6F0f967557A228916e9F0b325c51855e49BAa2";
    
    const holder = await impersonateAndFund(big_ohm_holder_36000);
    await ohmToken.connect(holder).transfer(owner, await ohmToken.balanceOf(big_ohm_holder_36000));
    // print ohm balance
    console.log('ohm balance', (await ohmToken.balanceOf(owner)).toString());
  });

  it('Should have been deployed correctly', async () => {
    const {
      userTotalStake,
      totalStake,
      stackingTokenContract,
      supportsHistory,
      userOHMReward,
      userEEFIReward,
    } = await getInfo(staking, userA.address);

    expect(userTotalStake).to.be.equal(0);
    expect(totalStake).to.be.equal(0);
    expect(stackingTokenContract).to.be.equal(stakingToken.address);
    expect(supportsHistory).to.be.equal(false);
    expect(userOHMReward).to.be.equal(0);
    expect(userEEFIReward).to.be.equal(0);
  });

  describe('requires some amount of tokens', () => {

    beforeEach(async () => {

      const { distributeOHMContract, distributeEEFIContract } = await getInfo(staking, userA.address);

      await Promise.all([
        eefiToken.approve(distributeEEFIContract, BigNumber.from(1_000).mul(BigNumber.from(10).pow(18))),
        ohmToken.approve(distributeOHMContract, BigNumber.from(1_000).mul(BigNumber.from(10).pow(18))),
        stakingToken.approve(staking.address, BigNumber.from(1_000).mul(BigNumber.from(10).pow(18))),
      ]);
    });

    it('Should stakeFor some tokens', async () => {

      const beforeBalance = await stakingToken.balanceOf(owner);
      const stakingBeforeBalance = await stakingToken.balanceOf(staking.address);
      const before = await getInfo(staking, userA.address);

      const stake = BigNumber.from(100).mul(BigNumber.from(10).pow(9));
      
      const tx = await staking.stakeFor(userA.address, stake, formatBytes32String('0'));
      
      const afterBalance = await stakingToken.balanceOf(owner);
      const stakingAfterBalance = await stakingToken.balanceOf(staking.address);
      const after = await getInfo(staking, userA.address);

      expect(afterBalance).to.be.equal(beforeBalance.sub(stake));
      
      expect(stakingBeforeBalance).to.be.equal(0);
      expect(stakingAfterBalance).to.be.equal(stake);

      expect(tx).to.have.emit(staking, 'Staked').withArgs(
        userA.address,
        stake,
        stake,
        formatBytes32String('0'),
      );

      expect(before.totalStake).to.be.equal(0);
      expect(after.totalStake).to.be.equal(stake);

      expect(before.userTotalStake).to.be.equal(0);
      expect(after.userTotalStake).to.be.equal(stake);

      expect(before.userOHMReward).to.be.equal(0);
      expect(after.userOHMReward).to.be.equal(0);

      expect(before.userEEFIReward).to.be.equal(0);
      expect(after.userEEFIReward).to.be.equal(0);
    });

    it('Should unstake some tokens', async () => {

      const stake = BigNumber.from(100).mul(BigNumber.from(10).pow(9));
      const unstake = BigNumber.from(70).mul(BigNumber.from(10).pow(9));
      const remaining = BigNumber.from(30).mul(BigNumber.from(10).pow(9));

      staking.stake(stake, formatBytes32String('0'));

      const beforeBalance = await stakingToken.balanceOf(owner);
      const stakingBeforeBalance = await stakingToken.balanceOf(staking.address);
      const before = await getInfo(staking, owner);

      const tx = await staking.unstake(unstake, formatBytes32String('0'));

      const afterBalance = await stakingToken.balanceOf(owner);
      const stakingAfterBalance = await stakingToken.balanceOf(staking.address);
      const after = await getInfo(staking, owner);

      expect(afterBalance.sub(beforeBalance)).to.be.equal(unstake);
      
      expect(stakingBeforeBalance).to.be.equal(stake);
      expect(stakingAfterBalance).to.be.equal(remaining);

      expect(tx).to.have.emit(staking, 'Unstaked').withArgs(
        owner,
        unstake,
        remaining,
        formatBytes32String('0'),
      );
      
      expect(before.totalStake).to.be.equal(stake);
      expect(after.totalStake).to.be.equal(remaining);

      expect(before.userTotalStake).to.be.equal(stake);
      expect(after.userTotalStake).to.be.equal(remaining);

      expect(before.userOHMReward).to.be.equal(0);
      expect(after.userOHMReward).to.be.equal(0);

      expect(before.userEEFIReward).to.be.equal(0);
      expect(after.userEEFIReward).to.be.equal(0);
    });


    it('Should distribute some eefi', async () => {
      const stake = BigNumber.from(100).mul(BigNumber.from(10).pow(9));
      await staking.stakeFor(userA.address, stake, formatBytes32String('0'));
      const before = await getInfo(staking, userA.address);
      const tx = await staking.distribute_eefi(BigNumber.from(200).mul(BigNumber.from(10).pow(18)));
      const after = await getInfo(staking, userA.address);

      expect(tx).to.have.emit(staking, 'ProfitEEFI').withArgs(
        BigNumber.from(200).mul(BigNumber.from(10).pow(18)),
      );
      
      expect(before.userEEFIReward).to.be.equal(0);
      expect(after.userEEFIReward).to.be.equal(BigNumber.from(200).mul(BigNumber.from(10).pow(18)));
    });


    it('Should distribute some OHM', async () => {
      await staking.stakeFor(userA.address, BigNumber.from(100).mul(BigNumber.from(10).pow(9)), formatBytes32String('0'));
      const before = await getInfo(staking, userA.address); 
      const tx = await staking.distribute_ohm(BigNumber.from(200).mul(BigNumber.from(10).pow(9)));
      const after = await getInfo(staking, userA.address);

      expect(tx).to.have.emit(staking, 'ProfitOHM').withArgs(
        BigNumber.from(200).mul(BigNumber.from(10).pow(9)),
      );

      expect(before.userOHMReward).to.be.equal(0);
      expect(after.userOHMReward).to.be.equal(BigNumber.from(200).mul(BigNumber.from(10).pow(9)));

    });

    it('Should be able to forward wrongfully sent reward tokens', async () => {

      await staking.stakeFor(userA.address, BigNumber.from(100).mul(BigNumber.from(10).pow(9)), formatBytes32String('0'));

      await eefiToken.transfer(staking.address, BigNumber.from(200).mul(BigNumber.from(10).pow(9)));
      await ohmToken.transfer(staking.address, BigNumber.from(200).mul(BigNumber.from(10).pow(9)));
      const tx = await staking.forward();
      const after = await getInfo(staking, userA.address);

      expect(tx).to.have.emit(staking, 'ProfitOHM').withArgs(
        BigNumber.from(200).mul(BigNumber.from(10).pow(9)),
      );

      expect(tx).to.have.emit(staking, 'ProfitEEFI').withArgs(
        BigNumber.from(200).mul(BigNumber.from(10).pow(9)),
      );

      expect(after.userOHMReward).to.be.equal(BigNumber.from(200).mul(BigNumber.from(10).pow(9)));

      expect(after.userEEFIReward).to.be.equal(BigNumber.from(200).mul(BigNumber.from(10).pow(9)));
    });


    it('Should withdraw reward', async () => {
      
      await staking.stakeFor(userA.address, BigNumber.from(100).mul(BigNumber.from(10).pow(9)), formatBytes32String('0'));
      await eefiToken.transfer(staking.address, BigNumber.from(200).mul(BigNumber.from(10).pow(9)));
      await ohmToken.transfer(staking.address, BigNumber.from(200).mul(BigNumber.from(10).pow(9)));
      await staking.forward();

      const ohmBeforeBalance = await ohmToken.balanceOf(userA.address);
      const eefiBeforeBalance = await eefiToken.balanceOf(userA.address);
      const before = await getInfo(staking, userA.address);
      
      await staking.connect(userA).withdraw(BigNumber.from(100).mul(BigNumber.from(10).pow(9)));
      
      const ohmAfterBalance = await ohmToken.balanceOf(userA.address);
      const eefiAfterBalance = await eefiToken.balanceOf(userA.address);
      const after = await getInfo(staking, userA.address);

      expect(before.userTotalStake).to.be.equal(BigNumber.from(100).mul(BigNumber.from(10).pow(9)));
      expect(after.userTotalStake).to.be.equal(BigNumber.from(100).mul(BigNumber.from(10).pow(9)));

      expect(before.userOHMReward).to.be.equal(BigNumber.from(200).mul(BigNumber.from(10).pow(9)));
      expect(after.userOHMReward).to.be.equal(0);

      expect(before.userEEFIReward).to.be.equal(BigNumber.from(200).mul(BigNumber.from(10).pow(9)));
      expect(after.userEEFIReward).to.be.equal(0);

      expect(ohmBeforeBalance).to.be.equal(0);
      expect(ohmAfterBalance).to.be.equal(BigNumber.from(200).mul(BigNumber.from(10).pow(9)));

      expect(eefiBeforeBalance).to.be.equal(0);
      expect(eefiAfterBalance).to.be.equal(BigNumber.from(200).mul(BigNumber.from(10).pow(9)));
    });
  });
});
