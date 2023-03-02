// SPDX-License-Identifier: NONE
pragma solidity 0.7.6;
pragma abicoder v2;

import "@balancer-labs/v2-vault/contracts/interfaces/IVault.sol";
import "@balancer-labs/v2-solidity-utils/contracts/openzeppelin/SafeERC20.sol";
import "@balancer-labs/v2-solidity-utils/contracts/openzeppelin/Address.sol";
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

    uint256 private constant MAX_UINT = type(uint256).max;

    IERC20 public constant amplToken = IERC20(0xD46bA6D942050d489DBd938a2C909A5d5039A161);
    IERC20 public constant ohmToken = IERC20(0x64aa3364F17a4D01c6f1751Fd97C2BD3D7e7f1D5);
    IWETH9 public constant wethToken = IWETH9(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    IPoolV1 public constant amplETH = IPoolV1(0xa751A143f8fe0a108800Bfb915585E4255C2FE80);
    IPoolV1 public constant ohmETH = IPoolV1(0xD1eC5e215E8148D76F4460e4097FD3d5ae0A3558);
    IVault public constant vault = IVault(0xBA12222222228d8Ba445958a75a0704d566BF2C8);
    
    IERC20 public immutable eefiToken;
    bytes32 public immutable eefiohmPoolID;
    bytes32 public immutable ohmethPoolID = 0xd1ec5e215e8148d76f4460e4097fd3d5ae0a35580002000000000000000003d3;

    constructor(IERC20 _eefiToken, bytes32 _eefiohmPoolID) {
        require(address(_eefiToken) != address(0), "BalancerTrader: Invalid eefi token address");
        eefiToken = IERC20(_eefiToken);
        eefiohmPoolID = _eefiohmPoolID;
        require(amplToken.approve(address(amplETH), MAX_UINT), 'BalancerTrader: Approval failed');
    }

    receive() external payable {
        // make sure we accept only eth coming from unwrapping weth
        require(msg.sender == address(wethToken),"BalancerTrader: Not accepting ETH");
    }

    /**
    * @dev Caller must transfer the right amount of tokens to the trader
    * @param amount Amount of AMPL to sell
    * @param minimalExpectedAmount The minimal expected amount of eth
     */
    function sellAMPLForOHM(uint256 amount, uint256 minimalExpectedAmount) external override returns (uint256 ohmAmount) {
        require(amplToken.transferFrom(msg.sender, address(this), amount),"BalancerTrader: transferFrom failed");
        (uint256 ethAmount,) = amplETH.swapExactAmountIn(address(amplToken), amount, address(wethToken), minimalExpectedAmount, MAX_UINT);
        wethToken.approve(address(vault), ethAmount);
        ohmAmount = vault.swap(
        IVault.SingleSwap(
            ohmethPoolID,
            IVault.SwapKind.GIVEN_IN,
            IAsset(address(wethToken)),
            IAsset(address(ohmToken)),
            ethAmount,
            "0x"
        ),
        IVault.FundManagement(
            address(this),
            false,
            msg.sender,
            false),
            0, block.timestamp);
        if(ohmAmount < minimalExpectedAmount) {
            revert("BalancerTrader: minimalExpectedAmount not acquired");
        }
        emit Sale_OHM(amount, ohmAmount);
    }

    /**
    * @dev Caller must transfer the right amount of tokens to the trader
    * @param amount Amount of AMPL to sell
    * @param minimalExpectedAmount The minimal expected amount of EEFI
     */
    function sellAMPLForEEFI(uint256 amount, uint256 minimalExpectedAmount) external override returns (uint256 eefiAmount) {
        require(amplToken.transferFrom(msg.sender, address(this), amount),"BalancerTrader: transferFrom failed");
        (uint256 ethAmount,) = amplETH.swapExactAmountIn(address(amplToken), amount, address(wethToken), 0, MAX_UINT);
        wethToken.approve(address(vault), ethAmount);

        IVault.BatchSwapStep[] memory steps = new IVault.BatchSwapStep[](2);
        steps[0] = IVault.BatchSwapStep(
                    ohmethPoolID,
                    0, //eth
                    1,
                    ethAmount,
                    "0x"
                );
        steps[1] = IVault.BatchSwapStep(
                    eefiohmPoolID,
                    1,
                    2,
                    0,
                    "0x"
                );
        IAsset[] memory assets = new IAsset[](3);
        assets[0] = IAsset(address(0));
        assets[1] = IAsset(address(ohmToken));
        assets[1] = IAsset(address(eefiToken));

        int256[] memory limits = new int256[](2);
        int256[] memory deltas = vault.batchSwap(
            IVault.SwapKind.GIVEN_IN,
            steps,
            assets,
            IVault.FundManagement(
            address(this),
            false,
            msg.sender,
            false),
            limits,
            block.timestamp
        );

        eefiAmount = uint256(-deltas[2]);

        if(eefiAmount < minimalExpectedAmount) {
            revert("BalancerTrader: minimalExpectedAmount not acquired");
        }
        emit Sale_EEFI(amount, eefiAmount);
    }
}
