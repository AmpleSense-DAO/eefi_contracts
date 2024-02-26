const hre = require("hardhat");
import { ElasticVault } from "../typechain/ElasticVault";
import { StakingDoubleERC20 } from "../typechain/StakingDoubleERC20";
import { EEFIToken } from "../typechain/EEFIToken";
import { MockTrader } from "../typechain/MockTrader";
import { BigNumberish } from "ethers";


async function createUniswapPair(tokenAAddress: string, tokenBAddress : string, signer: any) {
  // Uniswap V2 Factory address on Mainnet
  const UNISWAP_V2_FACTORY_ADDRESS = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";

  // ABI for the `createPair` function from Uniswap V2 Factory
  const UniswapV2FactoryABI = [
      "function createPair(address tokenA, address tokenB) external returns (address pair)",
      "function getPair(address tokenA, address tokenB) external view returns (address pair)"
  ];

  // Connect to the Uniswap V2 Factory contract
  const uniswapFactory = new hre.ethers.Contract(UNISWAP_V2_FACTORY_ADDRESS, UniswapV2FactoryABI, signer);

  // Create the pair
  const tx = await uniswapFactory.createPair(tokenAAddress, tokenBAddress);
  await tx.wait();

  const pairAddress = await uniswapFactory.getPair(tokenAAddress, tokenBAddress);

  console.log(`Pair created: ${pairAddress}`)

  return pairAddress;
}

async function addLiquidity(tokenAAddress: string, tokenBAddress: string, tokenAAmount: BigNumberish, tokenBAmount: BigNumberish, signer: any) {
  // Uniswap V2 Router address on Mainnet
  const UNISWAP_V2_ROUTER_ADDRESS = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

  // ABI for the `addLiquidity` function from Uniswap V2 Router
  const UniswapV2RouterABI = [
      "function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB, uint liquidity)"
  ];

  // Connect to the Uniswap V2 Router contract
  const uniswapRouter = new hre.ethers.Contract(UNISWAP_V2_ROUTER_ADDRESS, UniswapV2RouterABI, signer);

  // Approve the Router to spend your tokens
  // Note: You need to do this step for both Token A and Token B
  // Here's how you might do it for Token A as an example
  const TokenABI = [
      "function approve(address spender, uint256 amount) external returns (bool)"
  ];
  const tokenA = new hre.ethers.Contract(tokenAAddress, TokenABI, signer);
  let tx = await tokenA.approve(UNISWAP_V2_ROUTER_ADDRESS, tokenAAmount);
  await tx.wait();

  const tokenB = new hre.ethers.Contract(tokenBAddress, TokenABI, signer);
  tx = await tokenB.approve(UNISWAP_V2_ROUTER_ADDRESS, tokenBAmount);
  await tx.wait();

  // Set the deadline to 20 minutes from now
  const deadline = Math.floor(Date.now() / 1000) + 20 * 60;

  // Add liquidity
  tx = await uniswapRouter.addLiquidity(
      tokenAAddress,
      tokenBAddress,
      tokenAAmount,
      tokenBAmount,
      0, // amountAMin: Minimum token A amount (set to 0 for simplicity, adjust as needed)
      0, // amountBMin: Minimum token B amount (set to 0 for simplicity, adjust as needed)
      signer.address, // to: Recipient of the liquidity tokens
      deadline
  );

  const receipt = await tx.wait();
  console.log(`Liquidity added: ${receipt.transactionHash}`);
}

async function main() {
  const accounts = await hre.ethers.getSigners();

  const vaultFactory = await hre.ethers.getContractFactory("ElasticVault");
  const stakingerc20Factory = await hre.ethers.getContractFactory("StakingDoubleERC20");
  const traderFactory = await hre.ethers.getContractFactory("MockTrader");

  if(hre.network.name == "localhost") {

  }

  const eefiAddr = "0x4cFc3f4095D19b84603C11FD8A2F0154e9036a98";
  const amplAddr = "0xD46bA6D942050d489DBd938a2C909A5d5039A161";
  const ohmAddr = "0x64aa3364F17a4D01c6f1751Fd97C2BD3D7e7f1D5";

  let vault = await vaultFactory.deploy(eefiAddr, amplAddr) as ElasticVault;
  const eefiToken = await hre.ethers.getContractAt("EEFIToken", eefiAddr) as EEFIToken;
  const ohmToken = await hre.ethers.getContractAt("@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20", ohmAddr) as EEFIToken;

  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: ["0xF416a7AcB0CF8081F6EF299605D44e25b3856Ff1"],
  });
  await hre.network.provider.send("hardhat_setBalance", [
    "0xF416a7AcB0CF8081F6EF299605D44e25b3856Ff1",
    "0x3635c9adc5dea00000"
  ]);

  let adminSigner = await hre.ethers.getSigner("0xF416a7AcB0CF8081F6EF299605D44e25b3856Ff1");

  const ohmHolderAddr = "0x88E08adB69f2618adF1A3FF6CC43c671612D1ca4"
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [ohmHolderAddr],
  });
  await hre.network.provider.send("hardhat_setBalance", [
    ohmHolderAddr,
    "0x3635c9adc5dea00000"
  ]);
  let ohmHolder = await hre.ethers.getSigner(ohmHolderAddr);
  await ohmToken.connect(ohmHolder).transfer(adminSigner.address, 1000 * 10**9);
  await eefiToken.connect(adminSigner).grantRole(await eefiToken.MINTER_ROLE(), vault.address);

  // also grant minting role to admin for testing
  await eefiToken.connect(adminSigner).grantRole(await eefiToken.MINTER_ROLE(), adminSigner.address);

  // create uniswap v2 EEFI/OHM pair
  const eefiohmlpAddr = await createUniswapPair(eefiAddr, ohmAddr, adminSigner);
  // provide liquidity to the pair
  // mint some EEFI to admin
  await eefiToken.connect(adminSigner).mint(adminSigner.address, hre.ethers.utils.parseEther("1000"));

  // check EEFI and OHM balances for debugging
  console.log("EEFI balance:", (await eefiToken.balanceOf(adminSigner.address)).toString());
  console.log("OHM balance:", (await ohmToken.balanceOf(adminSigner.address)).toString());
  // ohm should already be on admins wallet
  await addLiquidity(eefiAddr, ohmAddr, hre.ethers.utils.parseEther("1000"), 1000 * 10**9, adminSigner);

  let staking_pool = await stakingerc20Factory.deploy(eefiohmlpAddr, 18, eefiToken.address) as StakingDoubleERC20;

  let trader = await traderFactory.deploy(amplAddr, eefiToken.address, hre.ethers.utils.parseUnits("0.001", "ether"), hre.ethers.utils.parseUnits("0.1", "ether")) as MockTrader;
  await vault.initialize(staking_pool.address, accounts[0].address, trader.address);;

  console.log("Vault deployed to:", vault.address);
  console.log("LPStaking deployed to:", staking_pool.address);
  console.log("EEFI/OHM LP address:", eefiohmlpAddr);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
