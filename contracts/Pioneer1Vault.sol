// SPDX-License-Identifier: NONE
pragma solidity ^0.7.0;

import "@balancer-labs/balancer-core-v2/contracts/lib/math/Math.sol";
import "./StakingERC721.sol";
import "./BalancerTrader.sol";
import "./AMPLRebaser.sol";

contract Pioneer1Vault is StakingERC721,AMPLRebaser,BalancerTrader {
    using Math for uint256;

    uint256 constant SELL_THRESHOLD = 40000 * 10**9;
    uint256 constant START_PERCENT = 25;
    uint256 constant END_PERCENT = 80;
    uint256 constant CAP = 800000 * 10**9;

    constructor(
        address[] memory addresses, //tokenA,tokenB,ampl,usdc,eefi,vault
        bytes32 _ampl_usdc,
        bytes32 _eefi_usdc,
        bytes32 _usdc_weth
        )
    StakingERC721(IERC721(addresses[0]), IERC721(addresses[1]), IERC20(addresses[2]))
    AMPLRebaser(IERC20(addresses[2]))
    BalancerTrader(_ampl_usdc, _eefi_usdc, _usdc_weth, IERC20(addresses[2]), addresses[3], addresses[4], addresses[5]) {
        require(addresses.length == 6, "Pioneer1Vault: Invalid arguments");
    }

    function _rebase(uint256 old_supply, uint256 new_supply) internal override {
        if(new_supply > old_supply) {
            //only for positive rebases
            uint256 balance = ampl_token.balanceOf(address(this));
            uint256 surplus = new_supply.sub(old_supply).mul(balance).divDown(new_supply);
            _sellForEth(_toSell(surplus));
            require(ampl_token.balanceOf(address(this)) >= SELL_THRESHOLD, "Pioneer1Vault: Threshold isnt reached yet");
            stakingContractEth.distribute{value : address(this).balance}(0, address(this));
        }
    }

    function _toSell(uint256 amount) internal view returns (uint256) {
        uint256 percentage = (END_PERCENT - START_PERCENT).mul(Math.min(amount, CAP)).divDown(CAP) + START_PERCENT;
        return amount.mul(amount).divDown(100);
    }

}