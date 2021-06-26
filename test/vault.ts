import { ethers } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { AmplesenseVault } from "../typechain/AmplesenseVault";
import { FakeERC20 } from "../typechain/FakeERC20";
import { FakeERC721 } from "../typechain/FakeERC721";
import { StakingERC20 } from "../typechain/StakingERC20";
import { StakingERC721 } from "../typechain/StakingERC721";
import { FakeAMPL } from "../typechain/FakeAMPL";
import { MockTrader } from "../typechain/MockTrader";
import { BigNumber } from "ethers";

const hre = require("hardhat");

chai.use(solidity);

const { expect } = chai;

const zeroAddress = "0x0000000000000000000000000000000000000000";

describe("Vault", () => {
  let vault : AmplesenseVault;
  let owner : string;
  let treasury : string;
  let amplToken : FakeAMPL;
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
    const erc20Factory = await ethers.getContractFactory("FakeERC20");
    const erc721Factory = await ethers.getContractFactory("FakeERC721");
    const vaultFactory = await ethers.getContractFactory("AmplesenseVault");
    const stakingerc20Factory = await ethers.getContractFactory("StakingERC20");
    const stakingerc721Factory = await ethers.getContractFactory("StakingERC721");
    const amplFactory = await ethers.getContractFactory("FakeAMPL");

    const accounts = await ethers.getSigners();
    owner = accounts[0].address;
    treasury = accounts[1].address;
    
    amplToken = await amplFactory.deploy() as FakeAMPL;
    kmplToken = await erc20Factory.deploy("9") as FakeERC20;
    nft1 = await erc721Factory.deploy() as FakeERC721;
    nft2 = await erc721Factory.deploy() as FakeERC721;
    
    vault = await vaultFactory.deploy(amplToken.address) as AmplesenseVault;
    
    let eefiTokenAddress = await vault.eefi_token();
    eefiToken = await ethers.getContractAt("FakeERC20", eefiTokenAddress) as FakeERC20;
    
    
    pioneer1 = await stakingerc721Factory.deploy(nft1.address, nft2.address, amplToken.address) as StakingERC721;
    pioneer2 = await stakingerc20Factory.deploy(kmplToken.address, eefiTokenAddress, 9) as StakingERC20;
    pioneer3 = await stakingerc20Factory.deploy(amplToken.address, eefiTokenAddress, 9) as StakingERC20;
    staking_pool = await stakingerc20Factory.deploy(amplToken.address, eefiTokenAddress, 9) as StakingERC20;

    await vault.initialize(pioneer1.address, pioneer2.address, pioneer3.address, staking_pool.address, treasury);
  });

  describe("AmplesenseVault", async() => {

    describe("AmplesenseVault - initialization and first stake", async() => {

      it("should be initialized only once", async () => {
        await expect(vault.initialize(pioneer1.address, pioneer2.address, pioneer3.address, staking_pool.address, treasury)).to.be.revertedWith("AmplesenseVault: contract already initialized");
      });
  
      it("deposit shall fail if staking without creating ampl allowance first", async () => {
        await expect(vault.makeDeposit(10**9)).to.be.reverted;
      });
  
      it("deposit shall set the correct shares in the contracts", async () => {
        await amplToken.increaseAllowance(vault.address, 10**9);
        //now stake
        await kmplToken.increaseAllowance(pioneer2.address, 10**9);
        await pioneer2.stake(10**9, "0x");
        await vault.makeDeposit(10**9);
  
        let rewards_eefi = await vault.rewards_eefi();
        let rewards_eth = await vault.rewards_eth();
       
        let rewards_eefi_contract =  await ethers.getContractAt("Distribute", rewards_eefi);
        let rewards_eth_contract =  await ethers.getContractAt("Distribute", rewards_eth);
        let total_staked_for = await vault.totalStakedFor(owner);
        let total_balance_for = await vault.balanceOf(owner);
        await expect(total_staked_for).to.be.equal(BigNumber.from(10**9));
        await expect(total_balance_for).to.be.equal(BigNumber.from(10**9));
        await expect(await rewards_eefi_contract.totalStakedFor(owner)).to.be.equal(BigNumber.from(10**9));
        await expect(await rewards_eth_contract.totalStakedFor(owner)).to.be.equal(BigNumber.from(10**9));
      });

      it("deposit shall mint eefi to pioneer2 and to user", async () => {
        await amplToken.increaseAllowance(vault.address, 10**9);
        //now stake
        await kmplToken.increaseAllowance(pioneer2.address, 10**9);
        await pioneer2.stake(10**9, "0x");
        await vault.makeDeposit(10**9);
        let fee = BigNumber.from(10**9).div(BigNumber.from(await vault.EEFI_DEPOSIT_RATE())).mul(await vault.DEPOSIT_FEE_10000()).div(BigNumber.from(10000));
        await expect((await pioneer2.getReward(owner)).__token).to.be.equal(fee);
        await expect((await eefiToken.balanceOf(owner))).to.be.equal(BigNumber.from(10**9 / 10**4).sub(fee));
      });
    });
    

    describe("AmplesenseVault - rebasing", async() => {

      beforeEach(async () => {

        const balancerTraderFactory = await ethers.getContractFactory('MockTrader');
        balancerTrader = await balancerTraderFactory.deploy(amplToken.address, eefiToken.address, ethers.utils.parseUnits("0.001", "ether"), ethers.utils.parseUnits("0.1", "ether")) as MockTrader;
        await vault.setTrader(balancerTrader.address);

        //fund the trader
        await vault.TESTMINT(50000 * 10**9, balancerTrader.address);
        const accounts = await ethers.getSigners();
        await accounts[0].sendTransaction({
          to: balancerTrader.address,
          value: hre.ethers.utils.parseEther("10.0")
        });
        await amplToken.transfer(balancerTrader.address, 500 * 10**9);

        //no longer needed to stake here
        await amplToken.increaseAllowance(vault.address, 25000 * 10**9);
        await kmplToken.increaseAllowance(pioneer2.address, 10**9);
        await pioneer2.stake(10**9, "0x");
        await amplToken.increaseAllowance(staking_pool.address, 10**9);
        await staking_pool.stake(10**9, "0x");
        await amplToken.increaseAllowance(pioneer1.address, 10**9);
        await nft1.setApprovalForAll(pioneer1.address, true);
        await nft2.setApprovalForAll(pioneer1.address, true);
        await pioneer1.stake([0, 1], true);
        await pioneer1.stake([0, 1], false);

        await vault.makeDeposit(25000 * 10**9);
      });

      it("rebasing shall fail unless 24 hours passed", async () => {
        await expect(vault.rebase()).to.be.revertedWith("AMPLRebaser: rebase can only be called once every 24 hours");
      });

      it("rebasing if ampl hasnt changed shall credit eefi", async () => {
        await ethers.provider.send("evm_increaseTime", [3600*24])
        await ethers.provider.send("evm_mine", []) // this one will have 02:00 PM as its timestamp
        await vault.rebase();
        let reward = await vault.getReward(owner);
        await expect(reward.token).to.be.equal(BigNumber.from(25000 * 10**9).div(await vault.EEFI_EQULIBRIUM_REBASE_RATE()));
        await expect(reward.eth).to.be.equal(BigNumber.from(0));
      });

      it("rebasing if ampl had a negative rebase shall credit eefi", async () => {
        await amplToken.rebase(0, -500);
        await ethers.provider.send("evm_increaseTime", [3600*24])
        await ethers.provider.send("evm_mine", []) // this one will have 02:00 PM as its timestamp
        await vault.rebase();
        let reward = await vault.getReward(owner);
        const vaultNewSupply = await amplToken.balanceOf(vault.address);
        // doesnt work because of rounding errors, should just test if close enough?
        await expect(reward.token).to.be.equal(BigNumber.from(/*25000 * 10**9*/vaultNewSupply).div(await vault.EEFI_NEGATIVE_REBASE_RATE()));
        await expect(reward.eth).to.be.equal(BigNumber.from(0));
      });

      it("rebasing if ampl had a positive rebase shall credit eefi", async () => {
        const amplOldSupply = await amplToken.totalSupply();
        const vaultOldSupply = await amplToken.balanceOf(vault.address);
        await amplToken.rebase(0, 500*10**9);
        const amplNewSupply = await amplToken.totalSupply();
        const vaultNewSupply = await amplToken.balanceOf(vault.address);
        //compute the change ratio of global supply during rebase
        const changeRatio8Digits = amplOldSupply.mul(10**8).div(amplNewSupply);
        //compute how much of the vault holdings come from the rebase
        const surplus = vaultNewSupply.sub(vaultNewSupply.mul(changeRatio8Digits).div(10**8));
        // doesnt work because of rounding errors, should just test if close enough?
        await expect(surplus).to.be.equal(vaultNewSupply.sub(vaultOldSupply));
        const for_eefi = surplus.mul(await vault.TRADE_POSITIVE_EEFI_100()).div(100);
        const for_eth = surplus.mul(await vault.TRADE_POSITIVE_ETH_100()).div(100);
        const for_pioneer1 = surplus.mul(await vault.TRADE_POSITIVE_PIONEER1_100()).div(100);
        // check how much eefi the mock trader is supposed to send for the for_eefi ampl
        // we cannot use the original computation here since BigNumber isnt as large as uint256
        const eefi_bought = for_eefi.mul((await balancerTrader.ratio_eefi()).div(10**10)).div(10**8);
        //compute how much is sent to treasury
        const treasury = eefi_bought.mul(await vault.TREASURY_EEFI_100()).div(100);
        //the rest is burned
        const toburn = eefi_bought.sub(treasury);

        //increase time by 24h
        await ethers.provider.send("evm_increaseTime", [3600*24])
        await ethers.provider.send("evm_mine", [])
        const receipt = await vault.rebase();
        //burning
        await expect(receipt).to.emit(balancerTrader, "Sale_EEFI");
        await expect(receipt).to.emit(balancerTrader, "Sale_ETH");
        await expect(receipt).to.emit(vault, "Burn").withArgs(toburn);
        await expect(receipt).to.emit(pioneer1, "ReceivedAMPL").withArgs(for_pioneer1);

        //pioneer2 and staking pool should get eth
        // we sell ampl for eth
        const boughtEth = for_eth.mul((await balancerTrader.ratio_eth()).div(10**10)).div(10**8);
        await expect(receipt).to.emit(pioneer2, "ProfitEth").withArgs(boughtEth.mul(await vault.TRADE_POSITIVE_PIONEER2_100()).div(100));
        await expect(receipt).to.emit(staking_pool, "ProfitEth").withArgs(boughtEth.mul(await vault.TRADE_POSITIVE_LPSTAKING_100()).div(100));

        //test reward once we have a good uniswap emulator???

        let reward = await vault.getReward(owner);
        console.log(reward)
        let totalStaked = await vault.totalStaked();
        console.log(""+totalStaked);

        // needs to be checked too
        // expect(reward.token).to.be.equal(BigNumber.from(10**9).div(await vault.EEFI_POSITIVE_REBASE_RATE()));
        // expect(reward.eth).to.be.equal(BigNumber.from(0));
      });
    });

    describe("AmplesenseVault - unstaking", async() => {

      beforeEach(async () => {
        
        const balancerTraderFactory = await ethers.getContractFactory('MockTrader');
        balancerTrader = await balancerTraderFactory.deploy(amplToken.address, eefiToken.address, ethers.utils.parseUnits("0.001", "ether"), ethers.utils.parseUnits("0.1", "ether")) as MockTrader;
        await vault.setTrader(balancerTrader.address);

        //stake in all distribution contracts
        await amplToken.increaseAllowance(vault.address, 10**9);
        await kmplToken.increaseAllowance(pioneer2.address, 10**9);
        await pioneer2.stake(10**9, "0x");
        await amplToken.increaseAllowance(staking_pool.address, 10**9);
        await staking_pool.stake(10**9, "0x");
        
        await nft1.setApprovalForAll(pioneer1.address, true);
        await nft2.setApprovalForAll(pioneer1.address, true);
        await pioneer1.stake([0, 1], true);
        await pioneer1.stake([0, 1], false);

        await vault.makeDeposit(10**9);
        // now rebase
        await amplToken.rebase(0, 500);
        await ethers.provider.send("evm_increaseTime", [3600*24])
        await ethers.provider.send("evm_mine", []) // this one will have 02:00 PM as its timestamp
        await vault.rebase();
      });

      it("unstaking shall fail if higher than balance", async () => {
        let totalStakedFor = await vault.totalStakedFor(owner);
        await expect(vault.withdraw(totalStakedFor.add(BigNumber.from(1)))).to.be.revertedWith("AmplesenseVault: Not enough balance");
      });

      it("unstaking shall fail if not enough time has passed since timelocked tokens", async () => {
        let totalStakedFor = await vault.totalStakedFor(owner);
        await expect(vault.withdraw(totalStakedFor)).to.be.revertedWith("AmplesenseVault: No unlocked deposits found");
      });

      it("unstaking shall work with correct balance and 90 days passed since staking", async () => {
        //increase time by 90 days
        await ethers.provider.send("evm_increaseTime", [3600*24*90])
        await ethers.provider.send("evm_mine", [])
        let totalStakedFor = await vault.totalStakedFor(owner);
        const receipt = await vault.withdraw(totalStakedFor);
        await expect(receipt).to.emit(vault, "Withdrawal").withArgs(owner, "999999990", 0);
      });

      
    });
  })
});