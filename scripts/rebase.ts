/*  This script performs the following functions: 
1. Performs the rebase call for the AmpleSenseVault (determines whether EEFI is minted, or purchased and burned)
2. Calculates slippage arguments for trades
3. Has several fail-safes, including reverts if the transation will require too much gas (.env.MAX_GAS_PRICE) using Fast gas price, 
or the computed amount of AMPL to sell for EEFI is too small (<.25% new AMPL supply). 
4. This script utilizes the wallet approved to call the rebase function by the AmpleSenseVault contract
*/

const hre = require("hardhat");
import { AmplesenseVault } from "../typechain/AmplesenseVault";
import { FakeAMPL } from "../typechain/FakeAMPL";
import { BalancerSDK, BalancerSdkConfig, Network, SwapType, BatchSwapStep } from '@balancer-labs/sdk';
import { resolve } from "path";
import { config as dotenvConfig } from "dotenv";
import {BigNumber, ethers} from "ethers";

dotenvConfig({ path: resolve(__dirname, "./.env") });

// Ensure that we have all the environment variables we need.
const ALCHEMY_API_KEY: string | undefined = process.env.ALCHEMY_API_KEY;
const ETH_GAS_API_KEY: string | undefined = process.env.ETH_GAS_API_KEY;
const MAX_GAS_PRICE: string | undefined = process.env.MAX_GAS_PRICE;
if (!ALCHEMY_API_KEY) {
  throw new Error("Please set your ALCHEMY_API_KEY in a .env file");
}
if (!ETH_GAS_API_KEY) {
  throw new Error("Please set your ETH_GAS_API_KEY in a .env file");
}
if (!MAX_GAS_PRICE) {
  throw new Error("Please set your MAX_GAS_PRICE in a .env file");
}

const axios = require("axios");

const config: BalancerSdkConfig = {
  network: Network.MAINNET,
  rpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_API_KEY}`
} 
const balancer = new BalancerSDK(config);

function delay(ms: number) {
  return new Promise( resolve => setTimeout(resolve, ms) );
}

function prettyAMPL(amount: BigNumber) : string {
  return amount.div(BigNumber.from(10**9)).toString();
}

function prettyETH(amount: BigNumber) : string {
  return ethers.utils.formatEther(amount);
}

async function fetchGasPrice() {
  let res = -1;
  return axios.get(`https://data-api.defipulse.com/api/v1/egs/api/ethgasAPI.json?api-key=${ETH_GAS_API_KEY}`)
      .then((ethGasStationResponse : any) => {
        res = Math.floor(ethGasStationResponse.data.fastest / 10);
        return res;
      })
      .catch((err : any) => {
        return res;
      });
}

const balancerAmplETHPooLAbi = [
  "function calcOutGivenIn(uint tokenBalanceIn,uint tokenWeightIn,uint tokenBalanceOut,uint tokenWeightOut,uint tokenAmountIn,uint swapFee) public pure returns (uint tokenAmountOut)",
  "function getBalance(address token) view returns (uint256)",
  "function getDenormalizedWeight(address token) view returns (uint256)",
  "function getSwapFee() view returns (uint256)"
]

// Determine how much ETH will be acquired post-AMPL sale
async function computeSellAMPLForEth(amplAmount : any, amplDelta : BigNumber, ethDelta : BigNumber) : Promise<BigNumber> {
  const balancerAmplEthVault = await hre.ethers.getContractAt(balancerAmplETHPooLAbi, "0xa751A143f8fe0a108800Bfb915585E4255C2FE80");
  const swapFee = await balancerAmplEthVault.getSwapFee();
  const weightAMPL = await balancerAmplEthVault.getDenormalizedWeight("0xD46bA6D942050d489DBd938a2C909A5d5039A161");
  const weightETH = await balancerAmplEthVault.getDenormalizedWeight("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2");
  const balanceAMPL = await balancerAmplEthVault.getBalance("0xD46bA6D942050d489DBd938a2C909A5d5039A161");
  const balanceETH = await balancerAmplEthVault.getBalance("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2");
  const balanceAMPLWithDelta = balanceAMPL.add(amplDelta);
  const balanceETHWithDelta = balanceETH.sub(ethDelta);
  try {
    return await balancerAmplEthVault.calcOutGivenIn(balanceAMPLWithDelta, weightAMPL, balanceETHWithDelta, weightETH, amplAmount, swapFee);
  } catch(err) {
    console.log("error computeSellAMPLForEth:", err);
    return BigNumber.from("0");
  }
}

//Determine how much EEFI will be acquired post ETH sale
async function computeSellAMPLForEEFI(amplAmount : any) : Promise<[BigNumber,BigNumber]> {
  console.log(`selling ${prettyAMPL(amplAmount)}`)
  const expectedETH = await computeSellAMPLForEth(amplAmount, BigNumber.from(0), BigNumber.from(0));
  console.log(`got ${prettyETH(expectedETH)} ETH`);
  if(expectedETH.eq(0)) {
    return [BigNumber.from("0"),BigNumber.from("0")];
  }
  const swapType = SwapType.SwapExactIn;
  const swaps: BatchSwapStep[] = [
    {
        poolId: '0x844ba71d4902ed3de091112951b9c4b4d25a09dd00020000000000000000014b',
        assetInIndex: 0,
        assetOutIndex: 1,
        amount: expectedETH.toString(),
        userData: '0x',
    }
  ];
  const assets: string[] = [
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', //weth
    '0x92915c346287DdFbcEc8f86c8EB52280eD05b3A3' //eefi
  ];
  try {
    const deltas = await balancer.swaps.queryBatchSwap({
      kind: swapType,
      swaps,
      assets,
    });
    return [BigNumber.from(deltas[1]), expectedETH];
  } catch(err) {
    console.log("error computeSellAMPLForEEFI", err);
    return [BigNumber.from("0"),BigNumber.from("0")];
  }
}

async function rebase(expectedEEFI : any, expectedETH : any, vault : AmplesenseVault) : Promise<boolean> {
  let gasPriceFast = -1;
  while(true) { //loop through gas fetching because api fails
    gasPriceFast = await fetchGasPrice();
    if(gasPriceFast > parseInt(MAX_GAS_PRICE!)) {
      console.log(`gas price is higher than allowed amount: ${gasPriceFast}>${parseInt(MAX_GAS_PRICE!)} retrying...`);
      return false;
    }
    if(gasPriceFast > 0) break;
    await delay(2000);
  }
  console.log(`Using gas price: ${gasPriceFast}`);
  try {
    const tx = await vault.rebase(expectedEEFI, expectedETH, {gasPrice: gasPriceFast});
    console.log("transaction hash:" + tx.hash);
    console.log("waiting confirmation...");
    await tx.wait(3); //wait for 3 confirmations
    console.log("tx confirmed");
    return true;
  } catch(err) {
    console.log("error rebase", err);
    return false;
  }
  
}

async function main() {
  const accounts = await hre.ethers.getSigners();

  const vault = await hre.ethers.getContractAt("AmplesenseVault", "0x5f9A579C795e665Fb00032523140e386Edcb99ee", accounts[0]) as AmplesenseVault;
  const amplToken = await hre.ethers.getContractAt("FakeAMPL", "0xd46ba6d942050d489dbd938a2c909a5d5039a161") as FakeAMPL;

  while(true) {
    console.log("starting rebase attempt");
    const lastRebaseCall = (await vault.last_rebase_call()).toNumber();
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const nexRebaseCall = lastRebaseCall + 24*3600;
    if(nexRebaseCall > currentTimestamp) {
      const time = nexRebaseCall - currentTimestamp;
      console.log(`cant call rebase yet, waiting for ${(time/3600).toFixed(1)} hours`)
      await delay(time * 1000); //wait until we can call
    }

    let lastSupply = await vault.last_ampl_supply();
    let newSupply = await amplToken.totalSupply();

    const amplBalance = await amplToken.balanceOf(vault.address);
    const tradePositiveEEFI = await vault.TRADE_POSITIVE_EEFI_100();
    const tradePositiveETH = await vault.TRADE_POSITIVE_ETH_100();

    if(newSupply.gt(lastSupply)) {
      console.log(`positive rebase: ${newSupply} > ${lastSupply}`);
      const digits18 = BigNumber.from(10).pow(18);
      const changeRatio18Digits = lastSupply.mul(digits18).div(newSupply);
      const surplus = amplBalance.sub(amplBalance.mul(changeRatio18Digits).div(digits18));
      const forEEFI = surplus.mul(tradePositiveEEFI).div(100);
      const forETH = surplus.mul(tradePositiveETH).div(100);

      let [expectedEEFI, expectedETH] = await computeSellAMPLForEEFI(forEEFI);
      console.log(`expecting ${prettyETH(expectedEEFI)} EEFI for ${prettyAMPL(forEEFI)} AMPL`);

      expectedETH = await computeSellAMPLForEth(forETH, forEEFI, expectedETH);
      console.log(`expecting ${prettyETH(expectedETH)} ETH for ${prettyAMPL(forETH)} AMPL`);

      if(expectedETH.gt(0) && expectedEEFI.gt(0)) {
        const res = await rebase(expectedEEFI, expectedETH, vault);
        if(!res) {
          console.log("error executing rebase");
        }
      } else {
        console.log("an error occured computing ETH and EEFI expected values, aborting");
      }

    } else {
      console.log(`negative rebase: ${newSupply} < ${lastSupply}`);
    }

    await delay(10000); //retry the whole process in 10 seconds
  }
  
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
