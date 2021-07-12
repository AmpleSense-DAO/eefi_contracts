// SPDX-License-Identifier: NONE
pragma solidity ^0.7.0;

import '@openzeppelin/contracts/access/Ownable.sol';
import "@balancer-labs/balancer-core-v2/contracts/lib/math/Math.sol";
import "./interfaces/IBalancerTrader.sol";
import "./AMPLRebaser.sol";
import "./StakingERC721.sol";

contract Pioneer1Vault is StakingERC721, AMPLRebaser, Ownable {
    using Math for uint256;

    uint256 constant SELL_THRESHOLD = 40000 * 10**9;
    uint256 constant START_PERCENT = 25;
    uint256 constant END_PERCENT = 80;
    uint256 constant CAP = 800000 * 10**9;
    IBalancerTrader public trader;

    constructor(
        IERC721 tokenA,
        IERC721 tokenB,
        IERC20 ampl
        )
    StakingERC721(tokenA, tokenB, ampl)
    AMPLRebaser(ampl)
    Ownable() {
    }

    receive() external payable { }

    function setTrader(IBalancerTrader _trader) external onlyOwner() {
        require(address(_trader) != address(0), "Pioneer1Vault: invalid trader");
        trader = _trader;
        // TODO REMOVE LINE BELLOW
        _ampl_token.approve(address(trader), uint256(0x00fffffffffffffffffffffffffffffffffffffffff));
    }

    function _rebase(uint256 old_supply, uint256 new_supply) internal override {
        console.log('---- START _rebase');
        if(new_supply > old_supply) {
            console.log('old_supply: ', old_supply);
            console.log('new_supply: ', new_supply);

            require(address(trader) != address(0), "Pioneer1Vault: trader not set");
            //only for positive rebases
            uint256 balance = _ampl_token.balanceOf(address(this));
            console.log('balance: ', balance);

            uint256 surplus = new_supply.sub(old_supply).mul(balance).divDown(new_supply);
            console.log('surplus: ', surplus);

            uint256 toSell = _toSell(surplus);
            console.log('toSell: ', toSell);
            
            console.log('ampl transfer, from/to/for', msg.sender, address(trader), toSell);
            _ampl_token.transfer(address(trader), toSell);

            trader.sellAMPLForEth(_toSell(surplus));
            console.log(_ampl_token.balanceOf(address(this)));
            require(_ampl_token.balanceOf(address(this)) >= SELL_THRESHOLD, "Pioneer1Vault: Threshold isnt reached yet");
            stakingContractEth.distribute{value : address(this).balance}(0, address(this));
        }
        console.log('---- END _rebase');
    }

    function _toSell(uint256 amount) internal view returns (uint256) {
        uint256 percentage = (END_PERCENT - START_PERCENT).mul(Math.min(amount, CAP)).divDown(CAP) + START_PERCENT;
        return percentage.mul(amount).divDown(100);
    }

}