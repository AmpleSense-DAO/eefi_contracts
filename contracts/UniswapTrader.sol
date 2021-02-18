// SPDX-License-Identifier: NONE
pragma solidity ^0.7.0;

import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';

contract UniswapTrader {

    using SafeERC20 for IERC20;

    IUniswapV2Router02 router;
    IERC20 public ampl_token;

    event Sale_EEFI(uint256 ampl_amount, uint256 eefi_amount);
    event Sale_ETH(uint256 ampl_amount, uint256 eth_amount);

    constructor(IUniswapV2Router02 _router, IERC20 _ampl_token) {
        require(address(_router) != address(0), "UniswapTrader: Invalid router");
        require(address(_ampl_token) != address(0), "UniswapTrader: Invalid ampl token address");
        router = _router;
        ampl_token = _ampl_token;
    }

    function _sellForEth(uint256 amount) internal {
        require(ampl_token.approve(address(router), amount), 'UniswapTrader: Approval failed');
        address[] memory path = new address[](2);
        path[0] = address(ampl_token);
        path[1] = router.WETH();
        router.swapExactTokensForETH(amount, 0, path, address(this), block.timestamp);
        emit Sale_ETH(amount, address(this).balance);
    }

    function _sellForToken(uint256 amount, address token) internal {
        require(ampl_token.approve(address(router), amount), 'UniswapTrader: Approval failed');
        address[] memory path = new address[](2);
        path[0] = address(ampl_token);
        path[1] = token;
        router.swapExactTokensForTokens(amount, 0, path, address(this), block.timestamp);
        emit Sale_EEFI(amount, IERC20(token).balanceOf(address(this)));
    }
}