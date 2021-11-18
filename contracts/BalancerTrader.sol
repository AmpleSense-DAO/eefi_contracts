// SPDX-License-Identifier: NONE
pragma solidity ^0.7.0;
pragma abicoder v2;

import "@balancer-labs/v2-vault/contracts/interfaces/IVault.sol";
import "@balancer-labs/v2-solidity-utils/contracts/openzeppelin/SafeERC20.sol";
import "./interfaces/IBalancerTrader.sol";
import "hardhat/console.sol";

interface IPoolV1 {
    function swapExactAmountIn(address tokenIn, uint256 tokenAmountIn, address tokenOut, uint256 minAmountOut, uint256 maxPrice) external returns (uint256 tokensOut, uint256 newPrice);
}

interface IWETH9 is IERC20 {
    function withdraw(uint256 wad) external;
    function deposit() external payable;
}

contract BalancerTrader is IBalancerTrader {

    using SafeERC20 for IERC20;

    uint256 constant MAX_INT = uint256(-1);

    IERC20 public constant amplToken = IERC20(0xD46bA6D942050d489DBd938a2C909A5d5039A161);
    IWETH9 public constant wethToken = IWETH9(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    IPoolV1 constant amplEth = IPoolV1(0xa751A143f8fe0a108800Bfb915585E4255C2FE80);
    IVault constant vault = IVault(0xBA12222222228d8Ba445958a75a0704d566BF2C8);
    IERC20 public eefiToken;
    bytes32 public eefiethPoolID;

    constructor(IERC20 _eefiToken, bytes32 _eefiethPoolID) {
        require(address(_eefiToken) != address(0), "BalancerTrader: Invalid eefi token address");
        eefiToken = IERC20(_eefiToken);
        eefiethPoolID = _eefiethPoolID;
        require(amplToken.approve(address(amplEth), MAX_INT), 'BalancerTrader: Approval failed');
    }

    receive() external payable {

    }

    /**
    * @dev Caller must transfer the right amount of tokens to the trader
     */
    function sellAMPLForEth(uint256 amount) external override returns (uint256 ethAmount) {
        amplToken.transferFrom(msg.sender, address(this), amount);
        (ethAmount,) = amplEth.swapExactAmountIn(address(amplToken), amount, address(wethToken), 0, MAX_INT);
        wethToken.withdraw(ethAmount);
        msg.sender.transfer(ethAmount);
        emit Sale_ETH(amount, ethAmount);
    }

    /**
    * @dev Caller must transfer the right amount of tokens to the trader (USDC will be replaced with ETH)
     */
    function sellAMPLForEEFI(uint256 amount) external override returns (uint256 eefiAmount) {
        amplToken.transferFrom(msg.sender, address(this), amount);
        (uint256 ethAmount,) = amplEth.swapExactAmountIn(address(amplToken), amount, address(wethToken), 0, MAX_INT);
        wethToken.approve(address(vault), ethAmount);
        eefiAmount = vault.swap(
        IVault.SingleSwap(
            eefiethPoolID,
            IVault.SwapKind.GIVEN_IN,
            IAsset(address(wethToken)),
            IAsset(address(eefiToken)),
            ethAmount,
            "0x"
        ),
        IVault.FundManagement(
            address(this),
            false,
            msg.sender,
            false),
        0,
        block.timestamp);
        emit Sale_EEFI(amount, eefiAmount);
    }
}
