// SPDX-License-Identifier: NONE
pragma solidity ^0.7.0;

import '@openzeppelin/contracts/access/Ownable.sol';
import "@balancer-labs/v2-solidity-utils/contracts/math/Math.sol";
import "./interfaces/IBalancerTrader.sol";
import "./AMPLRebaser.sol";
import "./StakingERC721.sol";
/*
Definitions and explanations: 
- Sell Threshold: Only sell AMPL when total AMPL amount is > 40,000
- Start Percent: At the beginning 25% of new AMPL supply will be sold for ETH
- End Percent: At maximum 80% of new AMPL supply will be sold for ETH
- Two ERC721 tokens will be accepted: Zeus and Apollo 
- AMPL will be sold for ETH utilizing the Balancer trading contract 
- The amount of AMPL to sell is dependent on the amount of AMPL in in the vault and is controlled by the CAP constant

*/
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
    }

    function _rebase(uint256 old_supply, uint256 new_supply) internal override {
        if(new_supply > old_supply) {

            require(address(trader) != address(0), "Pioneer1Vault: trader not set");
            //only for positive rebases
            uint256 balance = _ampl_token.balanceOf(address(this));

            uint256 surplus = new_supply.sub(old_supply).mul(balance).divDown(new_supply);

            uint256 toSell = _toSell(surplus);
            
            _ampl_token.approve(address(trader), toSell);

            trader.sellAMPLForEth(_toSell(surplus));
            require(_ampl_token.balanceOf(address(this)) >= SELL_THRESHOLD, "Pioneer1Vault: Threshold isnt reached yet");
            stakingContractEth.distribute{value : address(this).balance}(0, address(this));
        }
    }

    function _toSell(uint256 amount) internal pure returns (uint256) {
        uint256 percentage = (END_PERCENT - START_PERCENT).mul(Math.min(amount, CAP)).divDown(CAP) + START_PERCENT;
        return percentage.mul(amount).divDown(100);
    }

}
