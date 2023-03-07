/*  This script performs the following functions: 
1. Performs the rebase call for the ElasticVault (determines whether EEFI is minted, or purchased and burned)
2. Calculates slippage arguments for trades
3. Has several fail-safes, including reverts if the transation will require too much gas (.env.MAX_GAS_PRICE) using Fast gas price. 
4. This script utilizes the wallet approved to call the rebase function by the ElasticVault contract
*/

import { ElasticVault } from "../typechain/ElasticVault";
import { BalancerTrader } from "../typechain/BalancerTrader"
import { UFragments } from "../typechain/UFragments";
import { BalancerSDK, BalancerSdkConfig, Network, SwapType, BatchSwapStep } from '@balancer-labs/sdk';
import { resolve } from "path";
import { config as dotenvConfig } from "dotenv";
import {BigNumber, ethers, Wallet} from "ethers";
const balancerTraderJson = require("../artifacts/contracts/interfaces/IBalancerTrader.sol/IBalancerTrader.json");
const fragmentsJson = require("../artifacts/uFragments/contracts/UFragments.sol/UFragments.json");
const ElasticVaultJson = require("../artifacts/contracts/ElasticVault.sol/ElasticVault.json");

dotenvConfig({ path: resolve(__dirname, "./.env") });

// Ensure that we have all the environment variables we need.
const ALCHEMY_API_KEY: string | undefined = process.env.ALCHEMY_API_KEY;
const ETH_GAS_API_KEY: string | undefined = process.env.ETH_GAS_API_KEY;
const MAX_GAS_PRICE: string | undefined = process.env.MAX_GAS_PRICE;
const EEFI_SLIPPAGE: string | undefined = process.env.EEFI_SLIPPAGE;
const ETH_SLIPPAGE: string | undefined = process.env.ETH_SLIPPAGE;
const LISTEN_AMPL_REBASE: string | undefined = process.env.LISTEN_AMPL_REBASE;
const PRIVATE_KEY: string | undefined = process.env.PRIVATE_KEY;

if (!ALCHEMY_API_KEY) {
  throw new Error("Please set your ALCHEMY_API_KEY in a .env file");
}
if (!ETH_GAS_API_KEY) {
  throw new Error("Please set your ETH_GAS_API_KEY in a .env file");
}
if (!MAX_GAS_PRICE) {
  throw new Error("Please set your MAX_GAS_PRICE in a .env file");
}
if (!EEFI_SLIPPAGE) {
  throw new Error("Please set your EEFI_SLIPPAGE in a .env file");
}
if (!ETH_SLIPPAGE) {
  throw new Error("Please set your ETH_SLIPPAGE in a .env file");
}
if (!LISTEN_AMPL_REBASE) {
  throw new Error("Please set your LISTEN_AMPL_REBASE in a .env file");
}
if (!PRIVATE_KEY) {
  throw new Error("Please set your PRIVATE_KEY in a .env file");
}

const axios = require("axios");

const config: BalancerSdkConfig = {
  network: Network.MAINNET,
  rpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_API_KEY}`
} 

const signer = new Wallet(PRIVATE_KEY,new ethers.providers.StaticJsonRpcProvider(config.rpcUrl, "homestead"));

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
  return axios.get(`https://api.etherscan.io/api?module=gastracker&action=gasoracle`)
      .then((response : any) => {
        res = Math.floor(response.data.result.FastGasPrice);
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
async function computesellAMPLForOHM(amplAmount : any, amplDelta : BigNumber, ethDelta : BigNumber) : Promise<BigNumber> {
  const balancerAmplEthVault = new ethers.Contract("0xa751A143f8fe0a108800Bfb915585E4255C2FE80", balancerAmplETHPooLAbi, signer);
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
    console.log("error computesellAMPLForOHM:", err);
    return BigNumber.from("0");
  }
}

//Determine how much EEFI will be acquired post ETH sale
async function computeSellAMPLForEEFI(amplAmount : any) : Promise<[BigNumber,BigNumber]> {
  console.log(`selling ${prettyAMPL(amplAmount)}`)
  const expectedETH = await computesellAMPLForOHM(amplAmount, BigNumber.from(0), BigNumber.from(0));
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
    const balancer = new BalancerSDK(config);
    const deltas = await balancer.swaps.queryBatchSwap({
      kind: swapType,
      swaps,
      assets,
    });
    return [BigNumber.from(deltas[1]).abs(), expectedETH];
  } catch(err) {
    console.log("error computeSellAMPLForEEFI", err);
    return [BigNumber.from("0"),BigNumber.from("0")];
  }
}

async function rebase(expectedEEFI : any, expectedETH : any, vault : ElasticVault) : Promise<boolean> {
  let gasPriceFast = 0;
  let gasMax = parseFloat(MAX_GAS_PRICE!);
  while(gasPriceFast == 0 || gasPriceFast > gasMax)
    gasPriceFast = await fetchGasPrice();
  console.log(`Using gas price: ${gasPriceFast}`);
  try {
    const eefiSlippage100 = BigNumber.from((parseFloat(EEFI_SLIPPAGE!) * 100).toString());
    const ethSlippage100 = BigNumber.from((parseFloat(ETH_SLIPPAGE!) * 100).toString());
    const expectedEEFIWithSlippage = expectedEEFI.mul(eefiSlippage100).div(BigNumber.from("100"));
    const expectedETHWithSlippage = expectedETH.mul(ethSlippage100).div(BigNumber.from("100"));
    console.log("minEEFI: "+expectedEEFIWithSlippage, "minETH: "+expectedETHWithSlippage);

    const trader = new ethers.Contract("0xCB569E7Ca72FE970cf08610Bf642f55aD616880C",balancerTraderJson.abi, signer) as unknown as BalancerTrader;
    trader.once("Sale_ETH", (amount, ethAmount) => {
      console.log("Sale_ETH: " + amount + "=>" + ethAmount);
    });
    trader.once("Sale_EEFI", (amount, eefiAmount) => {
      console.log("Sale_EEFI: " + amount + "=>" + eefiAmount);
    });

    const tx = await vault.rebase(expectedEEFIWithSlippage, expectedETHWithSlippage, {gasPrice: BigNumber.from(gasPriceFast.toString()).mul(10**9)});
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

async function waitRebase() {
  const amplToken = new ethers.Contract("0xd46ba6d942050d489dbd938a2c909a5d5039a161", fragmentsJson.abi, signer) as unknown as UFragments;
  return new Promise((resolve,reject) => {
    amplToken.once("LogRebase", () => {
      resolve("");
    });
  });
}

async function main() {
  const vault = new ethers.Contract("0x5f9A579C795e665Fb00032523140e386Edcb99ee", ElasticVaultJson.abi, signer) as unknown as ElasticVault;
  const amplToken = await new ethers.Contract("0xd46ba6d942050d489dbd938a2c909a5d5039a161", fragmentsJson.abi, signer) as unknown as UFragments;

  while(true) {
    console.log(`${new Date().toUTCString()}: starting new rebase call`);
    
    const currentTimestamp = Math.floor(Date.now() / 1000)/* + 16*3600*/;

    if(parseInt(LISTEN_AMPL_REBASE!) == 1) {
      console.log(`${new Date().toUTCString()}: awaiting ampl rebase event`);
      let promise = waitRebase();
      await promise;
    }
    
    const lastRebaseCall = (await vault.last_rebase_call()).toNumber();
    
    const nexRebaseCall = lastRebaseCall + 24*3600;
    if(nexRebaseCall > currentTimestamp) {
      const time = nexRebaseCall - currentTimestamp;
      console.log(`${new Date().toUTCString()}: cant call rebase yet, waiting for ${(time/3600).toFixed(1)} hours`)
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

      expectedETH = await computesellAMPLForOHM(forETH, forEEFI, expectedETH);
      console.log(`expecting ${prettyETH(expectedETH)} ETH for ${prettyAMPL(forETH)} AMPL`);

      if(expectedETH.gt(0) && expectedEEFI.gt(0)) {
        const res = await rebase(expectedEEFI, expectedETH, vault);
        if(!res) {
          console.log("error executing rebase");
        } else {
          await delay(10*60*1000); //wait for 10 minutes to be sure the tx is validated
        }
      } else {
        console.log("an error occured computing ETH and EEFI expected values, aborting");
      }

    } else {
      console.log(`negative rebase: ${newSupply} < ${lastSupply}`);
      const isEquilibrium = newSupply.eq(lastSupply);
      const EEFI_EQULIBRIUM_REBASE_RATE = BigNumber.from(10000);
      const EEFI_NEGATIVE_REBASE_RATE = BigNumber.from(100000);
      const eefi = amplBalance.div(isEquilibrium? EEFI_EQULIBRIUM_REBASE_RATE : EEFI_NEGATIVE_REBASE_RATE).mul(BigNumber.from(10**9));
      console.log(`going to mint ${prettyETH(eefi)} eefi`);
      const res = await rebase(BigNumber.from(ethers.constants.MaxUint256), BigNumber.from(ethers.constants.MaxUint256), vault);
      if(!res) {
        console.log("error executing rebase");
      } else {
        await delay(10*60*1000); //wait for 10 minutes to be sure the tx is validated
      }
    }

    await delay(60000); //retry the whole process in 60 seconds
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
