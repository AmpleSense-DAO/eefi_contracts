// SPDX-License-Identifier: NONE
pragma solidity ^0.7.0;
pragma abicoder v2;

import "@balancer-labs/balancer-core-v2/contracts/vault/interfaces/IVault.sol";
import "@balancer-labs/balancer-core-v2/contracts/lib/openzeppelin/SafeERC20.sol";

contract BalancerTrader {

    using SafeERC20 for IERC20;

    bytes32 ampl_usdc;
    bytes32 eefi_usdc;
    bytes32 usdc_weth;
    IVault vault;
    IERC20 public ampl_token;

    IAsset[] assets_ampl_eefi;
    IAsset[] assets_ampl_eth;

    event Sale_EEFI(uint256 ampl_amount, uint256 eefi_amount);
    event Sale_ETH(uint256 ampl_amount, uint256 eth_amount);

    constructor(bytes32 _ampl_usdc, bytes32 _eefi_usdc, bytes32 _usdc_weth, IERC20 _ampl_token, address usdc_token, address eefi_token, address _vault) {
        require(address(_ampl_token) != address(0), "BalancerTrader: Invalid ampl token address");
        require(usdc_token != address(0), "BalancerTrader: Invalid usdc token address");
        require(eefi_token != address(0), "BalancerTrader: Invalid eefi token address");
        require(_vault != address(0), "BalancerTrader: Invalid vault address");
        ampl_usdc = _ampl_usdc;
        eefi_usdc = _eefi_usdc;
        usdc_weth = _usdc_weth;

        ampl_token = _ampl_token;
        vault = IVault(_vault);

        // cache assets arrays for balancer
        assets_ampl_eefi = new IAsset[](3);
        assets_ampl_eefi[0] = IAsset(address(ampl_token));
        assets_ampl_eefi[1] = IAsset(usdc_token);
        assets_ampl_eefi[2] = IAsset(eefi_token);

        assets_ampl_eth = new IAsset[](3);
        assets_ampl_eth[0] = IAsset(address(ampl_token));
        assets_ampl_eth[1] = IAsset(usdc_token);
        //assets_ampl_eth[2] = 0;
    }

    function _sellForEth(uint256 amount) internal {
        require(ampl_token.approve(address(vault), amount), 'BalancerTrader: Approval failed');
        IVault.BatchSwapStep[] memory swaps = new IVault.BatchSwapStep[](2);
        int256[] memory limits = new int256[](3);

        limits[0] = int256(amount);
        limits[1] = 10**18; //usdc has 6 digits, so we allow $10*12
        //limits[2] = 0;

        swaps[0] = IVault.BatchSwapStep(ampl_usdc, 0, 1, amount, "");
        swaps[1] = IVault.BatchSwapStep(usdc_weth, 1, 2, 0, "");

        int256[] memory token_swaps = vault.batchSwap(
        IVault.SwapKind.GIVEN_IN,
        swaps,
        assets_ampl_eth,
        IVault.FundManagement(address(this), false, payable(address(this)), false),
        limits,
        block.timestamp
        );
        
        emit Sale_ETH(amount, uint256(token_swaps[1]));
    }

    function _sellForToken(uint256 amount) internal {
        require(ampl_token.approve(address(vault), amount), 'BalancerTrader: Approval failed');
        IVault.BatchSwapStep[] memory swaps = new IVault.BatchSwapStep[](2);
        int256[] memory limits = new int256[](3);

        limits[0] = int256(amount);
        limits[1] = 10**18; //usdc has 6 digits, so we allow $10*12
        //limits[2] = 0;

        swaps[0] = IVault.BatchSwapStep(ampl_usdc, 0, 1, amount, "");
        swaps[1] = IVault.BatchSwapStep(eefi_usdc, 1, 2, 0, "");

        int256[] memory token_swaps = vault.batchSwap(
        IVault.SwapKind.GIVEN_IN,
        swaps,
        assets_ampl_eefi,
        IVault.FundManagement(address(this), false, payable(address(this)), false),
        limits,
        block.timestamp
        );
        
        emit Sale_EEFI(amount, uint256(token_swaps[1]));
    }
}