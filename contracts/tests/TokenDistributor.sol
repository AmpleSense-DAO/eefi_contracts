// SPDX-License-Identifier: NONE
pragma solidity ^0.7.0;

import "@balancer-labs/v2-solidity-utils/contracts/openzeppelin/SafeERC20.sol";

contract TokenDistributor {
    using SafeERC20 for IERC20;

    IERC20 ampl;
    IERC20 eefi;
    IERC20 kmpl;
    IERC20 kmplethlp;
    IERC20 eefiethlp;

    constructor(IERC20 _ampl_token, IERC20 _eefi_token, IERC20 _kmpl_token, IERC20 _kmplethlp, IERC20 _eefiethlp) {
        ampl = _ampl_token;
        eefi = _eefi_token;
        kmpl = _kmpl_token;
        kmplethlp = _kmplethlp;
        eefiethlp = _eefiethlp;
    }

    function getAMPL() external {
        ampl.safeTransfer(msg.sender, 100 * 10**9);
    }

    function getEEFI() external {
        eefi.safeTransfer(msg.sender, 100 * 10**9);
    }

    function getKMPL() external {
        kmpl.safeTransfer(msg.sender, 100 * 10**9);
    }

    function getKMPLETHLP() external {
        kmplethlp.safeTransfer(msg.sender, 10**15);
    }

    function getEEFIETHLP() external {
        eefiethlp.safeTransfer(msg.sender, 10**15);
    }
}