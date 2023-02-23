// SPDX-License-Identifier: NONE
pragma solidity ^0.7.0;
pragma abicoder v2;

import "@balancer-labs/v2-solidity-utils/contracts/openzeppelin/SafeERC20.sol";
import "../interfaces/IBalancerTrader.sol";

contract MockTrader is IBalancerTrader {

    using SafeERC20 for IERC20;

    IERC20 public ampl_token;
    IERC20 public eefi_token;
    IERC20 public ohm_token;
    uint256 public ratio_ohm;
    uint256 public ratio_eefi;

    constructor(IERC20 _ampl_token, IERC20 _eefi_token, uint256 _ratio_ohm, uint256 _ratio_eefi) {
        ampl_token = _ampl_token;
        eefi_token = _eefi_token;
        ratio_ohm = _ratio_ohm;
        ratio_eefi = _ratio_eefi;
    }

    receive() external payable {

    }

    /**
    * @dev Caller must allow the right amount of tokens to the trader
     */
    function sellAMPLForOHM(uint256 amount, uint256 minimalExpectedAmount) external override returns (uint256 ohmAmount) {
        ampl_token.transferFrom(msg.sender, address(this), amount);
        ohmAmount = amount * ratio_ohm / 1 ether;
        ohm_token.safeTransfer(msg.sender, ohmAmount);
        msg.sender.transfer(ohmAmount);
        emit Sale_OHM(amount, ohmAmount);
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