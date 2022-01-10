// SPDX-License-Identifier: NONE
pragma solidity ^0.7.0;
pragma abicoder v2;

import "@balancer-labs/v2-solidity-utils/contracts/openzeppelin/SafeERC20.sol";
import "../interfaces/IBalancerTrader.sol";

contract MockTrader is IBalancerTrader {

    using SafeERC20 for IERC20;

    IERC20 public ampl_token;
    IERC20 public eefi_token;
    uint256 public ratio_eth = 10000000 ether;
    uint256 public ratio_eefi = 1000000000 ether;

    constructor(IERC20 _ampl_token, IERC20 _eefi_token, uint256 _ratio_eth, uint256 _ratio_eefi) {
        ampl_token = _ampl_token;
        eefi_token = _eefi_token;
        ratio_eth = _ratio_eth;
        ratio_eefi = _ratio_eefi;
    }

    receive() external payable {

    }

    /**
    * @dev Caller must allow the right amount of tokens to the trader
     */
    function sellAMPLForEth(uint256 amount, uint256 minimalExpectedAmount) external override returns (uint256 ethAmount) {
        ampl_token.transferFrom(msg.sender, address(this), amount);
        ethAmount = amount * ratio_eth / 1 ether;
        msg.sender.transfer(ethAmount);
        emit Sale_ETH(amount, ethAmount);
    }

    /**
    * @dev Caller must allow the right amount of tokens to the trader
     */
    function sellAMPLForEEFI(uint256 amount, uint256 minimalExpectedAmount) external override returns (uint256 eefiAmount) {
        ampl_token.transferFrom(msg.sender, address(this), amount);
        eefiAmount = amount * ratio_eefi / 1 ether;
        eefi_token.safeTransfer(msg.sender, eefiAmount);
        emit Sale_EEFI(amount, eefiAmount);
    }
}