// SPDX-License-Identifier: NONE
pragma solidity 0.7.6;

import "@balancer-labs/v2-solidity-utils/contracts/openzeppelin/IERC20.sol";
import "@balancer-labs/v2-solidity-utils/contracts/math/Math.sol";

/**
 * Helper inspired by waampl https://github.com/ampleforth/ampleforth-contracts/blob/master/contracts/waampl.sol
 * The goal is to wrap AMPL into non rebasing user shares
*/
abstract contract Wrapper {
    using Math for uint256;

    /// @dev The maximum waampl supply.
    uint256 public constant MAX_WAAMPL_SUPPLY = 10_000_000e12; // 10 M at 12 decimals
    IERC20 immutable public ampl;

    constructor(IERC20 _ampl) {
        require(address(_ampl) != address(0), "Wrapper: Invalid ampl token address");
        ampl = _ampl;
    }

    /// @dev Converts AMPLs to waampl amount.
    function _ampleTowaample(uint256 amples)
        internal
        view
        returns (uint208)
    {
        uint256 waamples = amples.mul(MAX_WAAMPL_SUPPLY).divDown(ampl.totalSupply());
        // maximum value is 10_000_000e12 and always fits into uint208
        require(waamples <= type(uint208).max, "Wrapper: waampl supply overflow");
        return uint208(waamples); 
    }
}