/*  This script performs the following functions: 
1. Performs the rebase call for the AmpleSenseVault (determines whether EEFI is minted, or purchased and burned)
2. Calculates slippage arguments for trades
3. Has several fail-safes, including reverts if the transation will require too much gas (.env.MAX_GAS_PRICE) using Fast gas price, 
or the computed amount of AMPL to sell for EEFI is too small (<.25% new AMPL supply). 
4. This script utilizes the wallet approved to call the rebase function by the AmpleSenseVault contract
*/

const hre = require("hardhat");
import { AmplesenseVault } from "../typechain/AmplesenseVault";
import { BalancerTrader } from "../typechain/BalancerTrader"
import { UFragments } from "../typechain/UFragments";
import { BalancerSDK, BalancerSdkConfig, Network, SwapType, BatchSwapStep } from '@balancer-labs/sdk';
import { resolve } from "path";
import { config as dotenvConfig } from "dotenv";
import {BigNumber, ethers} from "ethers";

dotenvConfig({ path: resolve(__dirname, "./.env") });

// Ensure that we have all the environment variables we need.
const ALCHEMY_API_KEY: string | undefined = process.env.ALCHEMY_API_KEY;
const ETH_GAS_API_KEY: string | undefined = process.env.ETH_GAS_API_KEY;
const MAX_GAS_PRICE: string | undefined = process.env.MAX_GAS_PRICE;
const EEFI_SLIPPAGE: string | undefined = process.env.EEFI_SLIPPAGE;
const ETH_SLIPPAGE: string | undefined = process.env.ETH_SLIPPAGE;
const LISTEN_AMPL_REBASE: string | undefined = process.env.LISTEN_AMPL_REBASE;

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
  return axios.get(`https://ethgasstation.info/api/ethgasAPI.json`)
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
    return [BigNumber.from(deltas[1]).abs(), expectedETH];
  } catch(err) {
    console.log("error computeSellAMPLForEEFI", err);
    return [BigNumber.from("0"),BigNumber.from("0")];
  }
}

async function rebase(expectedEEFI : any, expectedETH : any, vault : AmplesenseVault) : Promise<boolean> {
  let gasPriceFast = await fetchGasPrice();
  console.log(`Using gas price: ${gasPriceFast}`);
  try {
    const eefiSlippage100 = BigNumber.from((parseFloat(EEFI_SLIPPAGE!) * 100).toString());
    const ethSlippage100 = BigNumber.from((parseFloat(ETH_SLIPPAGE!) * 100).toString());
    const expectedEEFIWithSlippage = expectedEEFI.mul(eefiSlippage100).div(BigNumber.from("100"));
    const expectedETHWithSlippage = expectedETH.mul(ethSlippage100).div(BigNumber.from("100"));
    console.log("minEEFI: "+expectedEEFIWithSlippage, "minETH: "+expectedETHWithSlippage);

    const trader = await hre.ethers.getContractAt("BalancerTrader", "0xCB569E7Ca72FE970cf08610Bf642f55aD616880C") as BalancerTrader;
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
  const amplToken = await hre.ethers.getContractAt("UFragments", "0xd46ba6d942050d489dbd938a2c909a5d5039a161") as UFragments;
  return new Promise((resolve,reject) => {
    amplToken.once("LogRebase", () => {
      resolve("");
    });
  });
}

async function main() {
  const accounts = await hre.ethers.getSigners();

  // await hre.network.provider.request({
  //   method: "hardhat_impersonateAccount",
  //   params: ["0x1B228a749077b8e307C5856cE62Ef35d96Dca2ea"],
  // });
  // await hre.network.provider.request({
  //   method: "hardhat_impersonateAccount",
  //   params: ["0x695375090C1E9ca67f1495528162f055eD7630c5"],
  // });
  // await hre.network.provider.send("hardhat_setBalance", [
  //   "0x1B228a749077b8e307C5856cE62Ef35d96Dca2ea",
  //   "0x3635c9adc5dea00000"
  // ]);
  // const signer = await hre.ethers.getSigner("0x1B228a749077b8e307C5856cE62Ef35d96Dca2ea");
  // const signer2 = await hre.ethers.getSigner("0x695375090C1E9ca67f1495528162f055eD7630c5");

  const vault = await hre.ethers.getContractAt("AmplesenseVault", "0x5f9A579C795e665Fb00032523140e386Edcb99ee", /*signer2*/accounts[0]) as AmplesenseVault;
  const amplToken = await hre.ethers.getContractAt("UFragments", "0xd46ba6d942050d489dbd938a2c909a5d5039a161"/*, signer*/) as UFragments;

  // await hre.ethers.provider.send('evm_increaseTime', [3600*16]);
  // await hre.ethers.provider.send('evm_mine', []);

  while(true) {
    console.log(`${new Date().toUTCString()}: starting new rebase call`);
    
    const currentTimestamp = Math.floor(Date.now() / 1000)/* + 16*3600*/;

    if(parseInt(LISTEN_AMPL_REBASE!) == 1) {
      console.log(`${new Date().toUTCString()}: awaiting ampl rebase event`);
      let promise = waitRebase();
      // await delay(1000);
      // const totalSupply = await amplToken.totalSupply();
      // amplToken.rebase(0, totalSupply.mul(8).div(1000));
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
      const isEquilibrium = newSupply.eq(lastSupply);
      const EEFI_EQULIBRIUM_REBASE_RATE = BigNumber.from(10000);
      const EEFI_NEGATIVE_REBASE_RATE = BigNumber.from(100000);
      const eefi = amplBalance.div(isEquilibrium? EEFI_EQULIBRIUM_REBASE_RATE : EEFI_NEGATIVE_REBASE_RATE).mul(BigNumber.from(10**9));
      console.log(`going to mint ${prettyETH(eefi)} eefi`);
      const res = await rebase(BigNumber.from(ethers.constants.MaxUint256), BigNumber.from(ethers.constants.MaxUint256), vault);
      if(!res) {
        console.log("error executing rebase");
      }
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
