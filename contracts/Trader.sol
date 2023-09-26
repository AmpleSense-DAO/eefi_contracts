// SPDX-License-Identifier: NONE
pragma solidity 0.7.6;
pragma abicoder v2;

import "@balancer-labs/v2-solidity-utils/contracts/openzeppelin/SafeERC20.sol";
import "@balancer-labs/v2-solidity-utils/contracts/openzeppelin/Address.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "./interfaces/ITrader.sol";

interface IWETH9 is IERC20 {
    function withdraw(uint256 wad) external;
    function deposit() external payable;
}

contract Trader is ITrader {

    using SafeERC20 for IERC20;

    uint256 private constant MAX_UINT = type(uint256).max;
    int256 private constant MAX_INT = type(int256).max;

    IERC20 public constant amplToken = IERC20(0xD46bA6D942050d489DBd938a2C909A5d5039A161);
    IERC20 public constant ohmToken = IERC20(0x64aa3364F17a4D01c6f1751Fd97C2BD3D7e7f1D5);
    IWETH9 public constant wethToken = IWETH9(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    ISwapRouter public constant uniswapV3Router = ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
    IUniswapV2Router02 public constant uniswapV2Router = IUniswapV2Router02(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);
    IERC20 public immutable eefiToken;

    address[] pathAMPLETH = new address[](2);
    address[] pathOHMEEFI = new address[](2);


    constructor(IERC20 _eefiToken) {
        require(address(_eefiToken) != address(0), "Trader: Invalid eefi token address");
        eefiToken = IERC20(_eefiToken);
        pathAMPLETH[0] = address(amplToken);
        pathAMPLETH[1] = address(wethToken);
        pathOHMEEFI[0] = address(ohmToken);
        pathOHMEEFI[1] = address(_eefiToken);
    }

    receive() external payable {
        // make sure we accept only eth coming from unwrapping weth
        revert("Trader: Not accepting ETH");
    }

    /**
    * @dev Caller must transfer the right amount of tokens to the trader
    * @param amount Amount of AMPL to sell
    * @param minimalExpectedAmount The minimal expected amount of ohm
     */
    function sellAMPLForOHM(uint256 amount, uint256 minimalExpectedAmount) external override returns (uint256 ohmAmount) {
        require(amplToken.transferFrom(msg.sender, address(this), amount),"Trader: transferFrom failed");
        amplToken.approve(address(uniswapV2Router), amount);
        uint[] memory amounts = uniswapV2Router.swapExactTokensForTokens(amount, 0, pathAMPLETH, address(this), block.timestamp);
        uint256 ethAmount = amounts[1];
        wethToken.approve(address(uniswapV3Router), ethAmount);
        ohmAmount = uniswapV3Router.exactInputSingle(
            ISwapRouter.ExactInputSingleParams(
                address(wethToken),
                address(ohmToken),
                3000,
                msg.sender,
                block.timestamp,
                ethAmount,
                0,
                0
            )
        );
        require(ohmAmount >= minimalExpectedAmount, "Trader: minimalExpectedAmount not acquired");

        emit Sale_OHM(amount, ohmAmount);
    }

    /**
    * @dev Caller must transfer the right amount of tokens to the trader
    * @param amount Amount of AMPL to sell
    * @param minimalExpectedAmount The minimal expected amount of EEFI
     */
    function sellAMPLForEEFI(uint256 amount, uint256 minimalExpectedAmount) external override returns (uint256 eefiAmount) {
        require(amplToken.transferFrom(msg.sender, address(this), amount),"Trader: transferFrom failed");
        amplToken.approve(address(uniswapV2Router), amount);
        uint[] memory amounts = uniswapV2Router.swapExactTokensForTokens(amount, 0, pathAMPLETH, address(this), block.timestamp);
        uint256 ethAmount = amounts[1];
        wethToken.approve(address(uniswapV3Router), ethAmount);
        uint256 ohmAmount = uniswapV3Router.exactInputSingle(
            ISwapRouter.ExactInputSingleParams(
                address(wethToken),
                address(ohmToken),
                3000,
                address(this),
                block.timestamp,
                ethAmount,
                0,
                0
            )
        );
        // purchase EEFI
        ohmToken.approve(address(uniswapV2Router), ohmAmount);
        amounts = uniswapV2Router.swapExactTokensForTokens(ohmAmount, 0, pathOHMEEFI, msg.sender, block.timestamp);
        eefiAmount = amounts[1];
        require(eefiAmount >= minimalExpectedAmount, "Trader: minimalExpectedAmount not acquired");

        emit Sale_EEFI(amount, eefiAmount);
    }
}
