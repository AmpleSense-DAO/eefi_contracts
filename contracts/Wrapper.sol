// SPDX-License-Identifier: NONE
pragma solidity 0.7.6;

import "@balancer-labs/v2-solidity-utils/contracts/openzeppelin/IERC20.sol";

/**
 * Helper inspired by WAMPL https://github.com/ampleforth/ampleforth-contracts/blob/master/contracts/WAMPL.sol
 * The goal is to wrap AMPL into non rebasing user shares
*/
abstract contract Wrapper {

    /// @dev The maximum wAMPL supply.
    uint256 public constant MAX_WAMPL_SUPPLY = 10000000 * (10**12); // 10 M
    IERC20 immutable public ampl;

    constructor(IERC20 _ampl) {
        require(address(_ampl) != address(0), "Wrapper: Invalid ampl token address");
        ampl = _ampl;
    }

    /// @dev Converts AMPLs to wAMPL amount.
    function _ampleToWample(uint256 amples)
        internal
        view
        returns (uint256)
    {
        return (amples * MAX_WAMPL_SUPPLY) / ampl.totalSupply();
    }

    /// @dev Converts wAMPLs amount to AMPLs.
    function _wampleToAmple(uint256 wamples)
        internal
        view
        returns (uint256)
    {
        return (wamples *  ampl.totalSupply()) / MAX_WAMPL_SUPPLY;
    }


}