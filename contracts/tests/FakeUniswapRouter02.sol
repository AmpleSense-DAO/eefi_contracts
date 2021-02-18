// SPDX-License-Identifier: NONE
pragma solidity ^0.7.0;

contract FakeUniswapV2Router02 {

    constructor() {

    }

    function WETH() external pure returns (address) {

    }


    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts) {

    }

    function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)
        external
        returns (uint[] memory amounts) {
            
        }
    
}