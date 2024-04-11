
import chai from 'chai';
import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';
import { solidity } from 'ethereum-waffle';
import { Trader } from '../typechain/Trader';
import { EEFIToken } from "../typechain/EEFIToken";
import { TokenUpgrader } from "../typechain/TokenUpgrader";
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { deploy } from "../scripts/utils/deploy";

chai.use(solidity);

const { expect } = chai;

const vestingExecutorABI = [{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address[]","name":"addresses","type":"address[]"}],"name":"addressesAddedToWhiteList","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"recipient","type":"address"},{"indexed":false,"internalType":"uint256","name":"transferAmount","type":"uint256"}],"name":"bonusVestingTokenTransfered","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"string","name":"description","type":"string"},{"indexed":false,"internalType":"uint256","name":"number","type":"uint256"}],"name":"processLog","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"string","name":"message","type":"string"}],"name":"processLog2","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"address2","type":"address"}],"name":"processLog3","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"contract IERC20","name":"token","type":"address"},{"indexed":false,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"withdrawalAmount","type":"uint256"}],"name":"tokenLockWithdrawal","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"vester","type":"address"},{"indexed":false,"internalType":"uint256","name":"vestedAssetAmount","type":"uint256"},{"indexed":false,"internalType":"address","name":"purchaseToken","type":"address"},{"indexed":false,"internalType":"uint256","name":"amountTransferred","type":"uint256"}],"name":"vestingPurchaseTransactionComplete","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"token","type":"address"},{"indexed":false,"internalType":"uint256","name":"withdrawalAmount","type":"uint256"}],"name":"vestingTokenWithdrawal","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"vester","type":"address"},{"indexed":false,"internalType":"uint256","name":"vestedAssetAmount","type":"uint256"}],"name":"vestingTransactionComplete","type":"event"},{"inputs":[{"internalType":"address[]","name":"_addresses","type":"address[]"}],"name":"addAuthorizedSwapAddresses","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"tokenAddress","type":"address"},{"internalType":"uint256","name":"decimals","type":"uint256"}],"name":"addAuthorizedSwapToken","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"tokenAddress","type":"address"},{"internalType":"uint256","name":"decimals","type":"uint256"},{"internalType":"uint256","name":"numDecimals","type":"uint256"}],"name":"addPurchaseToken","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"tokenAddress","type":"address"},{"internalType":"uint256","name":"decimals","type":"uint256"},{"internalType":"uint256","name":"price","type":"uint256"},{"internalType":"uint256","name":"numDecimals","type":"uint256"}],"name":"addVestingToken","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"uint256","name":"fromDecimals","type":"uint256"},{"internalType":"uint256","name":"toDecimals","type":"uint256"}],"name":"adjustDecimals","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"authorizedSwapAddresses","outputs":[{"internalType":"address","name":"whitelistaddress","type":"address"},{"internalType":"bool","name":"isSet","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"authorizedSwapTokens","outputs":[{"internalType":"contract IERC20","name":"token","type":"address"},{"internalType":"uint256","name":"decimals","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"uint256","name":"scheduleId","type":"uint256"}],"name":"cancelVesting","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"scheduleId","type":"uint256"},{"internalType":"address","name":"vestor","type":"address"},{"internalType":"address","name":"vestingAsset","type":"address"}],"name":"claimTokens","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"current_standard_vesting_status","outputs":[{"internalType":"enum VestingExecutor.standardVestingStatus","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"current_swapping_status","outputs":[{"internalType":"enum VestingExecutor.swappingStatus","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"current_token_lock_status","outputs":[{"internalType":"enum VestingExecutor.tokenLockStatus","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"current_vesting_status","outputs":[{"internalType":"enum VestingExecutor.vestingStatus","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"current_whitelist_status","outputs":[{"internalType":"enum VestingExecutor.whiteListStatus","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_address","type":"address"}],"name":"isWhitelisted","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"purchaseAmountThreshold","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"purchaseTokens","outputs":[{"internalType":"contract IERC20","name":"token","type":"address"},{"internalType":"uint256","name":"decimals","type":"uint256"},{"internalType":"uint256","name":"numDecimals","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_vestingTokenPurchaseAmount","type":"uint256"},{"internalType":"address","name":"_exchangeToken","type":"address"},{"internalType":"address","name":"_vestingAsset","type":"address"},{"components":[{"internalType":"address","name":"asset","type":"address"},{"internalType":"bool","name":"isFixed","type":"bool"},{"internalType":"uint256","name":"cliffWeeks","type":"uint256"},{"internalType":"uint256","name":"vestingWeeks","type":"uint256"},{"internalType":"uint256","name":"startTime","type":"uint256"}],"internalType":"struct VestingExecutor.VestingParams","name":"_vestingParams","type":"tuple"}],"name":"purchaseVestingToken","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"releasePercentage","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_address","type":"address"}],"name":"removeAuthorizedSwapAddress","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"tokenAddress","type":"address"}],"name":"removeAuthorizedSwapToken","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"tokenAddress","type":"address"}],"name":"removePurchaseToken","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"tokenAddress","type":"address"}],"name":"removeVestingToken","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"vestorAddress","type":"address"}],"name":"retrieveClaimableTokens","outputs":[{"components":[{"internalType":"uint256","name":"scheduleID","type":"uint256"},{"internalType":"uint256","name":"claimableTokens","type":"uint256"}],"internalType":"struct VestingManager.ClaimableInfo[]","name":"","type":"tuple[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"retrieveScheduleInfo","outputs":[{"components":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"uint256","name":"startTime","type":"uint256"},{"internalType":"uint256","name":"cliffTime","type":"uint256"},{"internalType":"uint256","name":"endTime","type":"uint256"},{"internalType":"uint256","name":"claimedAmount","type":"uint256"},{"internalType":"uint256","name":"totalAmount","type":"uint256"},{"internalType":"address","name":"asset","type":"address"}],"internalType":"struct VestingManager.ScheduleInfo[]","name":"","type":"tuple[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_vestorAddress","type":"address"}],"name":"retrieveTokenClaimData","outputs":[{"components":[{"internalType":"address","name":"asset","type":"address"},{"internalType":"uint256","name":"scheduleID","type":"uint256"},{"internalType":"uint256","name":"claimedAmount","type":"uint256"}],"internalType":"struct VestingManager.TokenClaimInfo[]","name":"","type":"tuple[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"threshold","type":"uint256"}],"name":"setPurchaseAmountThreshold","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_releasePercentage","type":"uint256"}],"name":"setReleasePercentage","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"value","type":"uint256"}],"name":"setStandardVestingStatus","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_ratio","type":"uint256"}],"name":"setSwapRatio","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"value","type":"uint256"}],"name":"setSwappingStatus","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"value","type":"uint256"}],"name":"setTokenLockStatus","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_purchaseCliffWeeks","type":"uint256"},{"internalType":"uint256","name":"_purchaseVestingWeeks","type":"uint256"},{"internalType":"uint256","name":"_swapCliffWeeks","type":"uint256"},{"internalType":"uint256","name":"_swapVestingWeeks","type":"uint256"}],"name":"setValidVestingParams","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"value","type":"uint256"}],"name":"setVestingStatus","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"value","type":"uint256"}],"name":"setWhiteListStatus","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"vestor","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"components":[{"internalType":"address","name":"asset","type":"address"},{"internalType":"bool","name":"isFixed","type":"bool"},{"internalType":"uint256","name":"cliffWeeks","type":"uint256"},{"internalType":"uint256","name":"vestingWeeks","type":"uint256"},{"internalType":"uint256","name":"startTime","type":"uint256"}],"internalType":"struct VestingExecutor.VestingParams","name":"_vestingParams","type":"tuple"}],"name":"standardVesting","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"swapTokenAmount","type":"uint256"},{"internalType":"address","name":"tokenToSwap","type":"address"},{"components":[{"internalType":"address","name":"asset","type":"address"},{"internalType":"bool","name":"isFixed","type":"bool"},{"internalType":"uint256","name":"cliffWeeks","type":"uint256"},{"internalType":"uint256","name":"vestingWeeks","type":"uint256"},{"internalType":"uint256","name":"startTime","type":"uint256"}],"internalType":"struct VestingExecutor.VestingParams","name":"_vestingParams","type":"tuple"}],"name":"swapAndVest","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"swapRatio","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"tokenLock","outputs":[{"internalType":"contract TokenLock","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"contract IERC20","name":"token","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transferERC20","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"contract IERC20","name":"token","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transferLockedTokens","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"validVestingParams","outputs":[{"internalType":"uint256","name":"purchaseCliffWeeks","type":"uint256"},{"internalType":"uint256","name":"purchaseVestingWeeks","type":"uint256"},{"internalType":"uint256","name":"swapCliffWeeks","type":"uint256"},{"internalType":"uint256","name":"swapVestingWeeks","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"vestingManager","outputs":[{"internalType":"contract VestingManager","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"vestingParams","outputs":[{"internalType":"address","name":"asset","type":"address"},{"internalType":"bool","name":"isFixed","type":"bool"},{"internalType":"uint256","name":"cliffWeeks","type":"uint256"},{"internalType":"uint256","name":"vestingWeeks","type":"uint256"},{"internalType":"uint256","name":"startTime","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"vestingTokens","outputs":[{"internalType":"contract IERC20","name":"token","type":"address"},{"internalType":"uint256","name":"decimals","type":"uint256"},{"internalType":"uint256","name":"numDecimals","type":"uint256"},{"internalType":"uint256","name":"price","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"assetAddress","type":"address"}],"name":"viewLockedAmount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"address","name":"asset","type":"address"}],"name":"withdrawVestingTokens","outputs":[],"stateMutability":"nonpayable","type":"function"}]

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

describe('TokenUpgrader Contract', () => {

  let upgrader: TokenUpgrader;
  let eefiToken : EEFIToken;
  let oldEefiToken : EEFIToken;

  let owner: SignerWithAddress;
  let treasury: SignerWithAddress;

  before(async () => {
    const accounts = await ethers.getSigners();
    owner = accounts[0];
    eefiToken = await ethers.getContractAt("EEFIToken", "0x857FfC55B1Aa61A7fF847C82072790cAE73cd883") as EEFIToken;
    upgrader = await deploy("TokenUpgrader") as TokenUpgrader;

    treasury = await impersonateAndFund("0xf950a86013bAA227009771181a885E369e158da3");
    // grant minting rights to the upgrader
    await eefiToken.connect(treasury).grantRole(await eefiToken.MINTER_ROLE(), upgrader.address);

    oldEefiToken = await ethers.getContractAt("EEFIToken", "0x4cFc3f4095D19b84603C11FD8A2F0154e9036a98") as EEFIToken;

    // at the end of vesting period
    await hre.ethers.provider.send('evm_increaseTime', [1722180197-1707933723]);
    await hre.ethers.provider.send('evm_mine', []);
  });

  it('should fail to upgrade if tokens are not claimed from vesting', async () => {
    const vestor = await impersonateAndFund("0x84C1d27b613f5B0636dD720a762dabE882a8E1cC");
    // has 2 schedules: 56000000000000000000 and 35000000000000000000
    await expect(upgrader.connect(vestor).upgrade())
      .to.be.revertedWith("TokenUpgrader: No tokens to upgrade, have you claimed the old tokens from vesting?");
  });

  it('upgrade should work with only first schedule claimed', async () => {
    const vestor = await impersonateAndFund("0x8325A509845a8f4F2760eAD394Ad95b059ef645c");
    // claim vested tokens
    const vestingExecutor = await ethers.getContractAt(vestingExecutorABI, "0xcaf5b5D268032a41cAF34d9280A1857E3394Ba47");
    const oldEefiBalancePreClaim = await oldEefiToken.balanceOf(vestor.address);
    await vestingExecutor.connect(vestor).claimTokens(0, vestor.address, oldEefiToken.address);
    const oldEefiBalance = await oldEefiToken.balanceOf(vestor.address);
    await oldEefiToken.connect(vestor).approve(upgrader.address, oldEefiBalance);
    const tx = await upgrader.connect(vestor).upgrade();
    const newEefiBalance = await eefiToken.balanceOf(vestor.address);
    const upgradedBalance = oldEefiBalance.sub(oldEefiBalancePreClaim);
    expect(upgradedBalance).to.be.equal(newEefiBalance);
    expect(tx).to.emit(upgrader, "TokenUpgrade").withArgs(vestor.address, upgradedBalance);
    expect(upgradedBalance).to.be.equal(BigNumber.from("30000000000000000000")); // value checked against mainnet
  });

  it('upgrade should work again after second schedule is claimed', async () => {
    const vestor = await impersonateAndFund("0x8325A509845a8f4F2760eAD394Ad95b059ef645c");
    // claim vested tokens
    const vestingExecutor = await ethers.getContractAt(vestingExecutorABI, "0xcaf5b5D268032a41cAF34d9280A1857E3394Ba47");
    await vestingExecutor.connect(vestor).claimTokens(1, vestor.address, oldEefiToken.address);
    const oldEefiBalance = await oldEefiToken.balanceOf(vestor.address);
    await oldEefiToken.connect(vestor).approve(upgrader.address, oldEefiBalance);
    const tx = await upgrader.connect(vestor).upgrade();
    expect(tx).to.emit(upgrader, "TokenUpgrade").withArgs(vestor.address, BigNumber.from("1203849500000000000000")); // value checked against mainnet
  });

  it('upgrade should fail if tokens were claimed but are not in user wallet but work once the tokens are in the wallet', async () => {
    const vestor = await impersonateAndFund("0x84C1d27b613f5B0636dD720a762dabE882a8E1cC");
    // has 2 schedules: 56000000000000000000 and 35000000000000000000
    const totalClaim = BigNumber.from("35000000000000000000").add(BigNumber.from("56000000000000000000"));
    // claim vested tokens
    const vestingExecutor = await ethers.getContractAt(vestingExecutorABI, "0xcaf5b5D268032a41cAF34d9280A1857E3394Ba47");
    await vestingExecutor.connect(vestor).claimTokens(0, vestor.address, oldEefiToken.address);
    await vestingExecutor.connect(vestor).claimTokens(1, vestor.address, oldEefiToken.address);
    const oldEefiBalance = await oldEefiToken.balanceOf(vestor.address);
    await oldEefiToken.connect(vestor).approve(upgrader.address, oldEefiBalance);
    await oldEefiToken.connect(vestor).transfer(treasury.address, oldEefiBalance);
    // User tries to upgrade without having sufficient oldEEFI tokens in their wallet
    await expect(upgrader.connect(vestor).upgrade())
    .to.be.revertedWith("TokenUpgrader: You must have the tokens to upgrade in your wallet");

    // User gets back the tokens in their wallet
    await oldEefiToken.connect(treasury).transfer(vestor.address, oldEefiBalance);
    const tx = await upgrader.connect(vestor).upgrade();
    const newEefiBalance = await eefiToken.balanceOf(vestor.address);
    expect(oldEefiBalance).to.be.equal(newEefiBalance);
    expect(newEefiBalance).to.be.equal(totalClaim);
    expect(tx).to.emit(upgrader, "TokenUpgrade").withArgs(vestor.address, totalClaim);
  });

  it('should not allow blacklisted addresses to upgrade', async () => {
    const blacklistedUser = await impersonateAndFund("0x84C1d27b613f5B0636dD720a762dabE882a8E1cC");
    // Owner blacklists the user
    await upgrader.connect(owner).excludeAddress(blacklistedUser.address, true);
    
    // Try to upgrade tokens for blacklisted address
    await expect(upgrader.connect(blacklistedUser).upgrade())
      .to.be.revertedWith("TokenUpgrader: Address is not authorized to upgrade");
  });
  
});