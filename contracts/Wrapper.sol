// SPDX-License-Identifier: NONE
pragma solidity 0.7.6;

import "@balancer-labs/v2-solidity-utils/contracts/openzeppelin/IERC20.sol";

/**
 * Helper inspired by waampl https://github.com/ampleforth/ampleforth-contracts/blob/master/contracts/waampl.sol
 * The goal is to wrap AMPL into non rebasing user shares
*/
abstract contract Wrapper {

    /// @dev The maximum waampl supply.
    uint256 public constant MAX_WAAMPL_SUPPLY = 10000000 * (10**12); // 10 M
    IERC20 immutable public ampl;

    constructor(IERC20 _ampl) {
        require(address(_ampl) != address(0), "Wrapper: Invalid ampl token address");
        ampl = _ampl;
    }

    /// @dev Converts AMPLs to waampl amount.
    function _ampleTowaample(uint256 amples)
        internal
        view
        returns (uint256)
    {
        return (amples * MAX_WAAMPL_SUPPLY) / ampl.totalSupply();
    }
}