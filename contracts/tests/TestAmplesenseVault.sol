// SPDX-License-Identifier: NONE
pragma solidity 0.7.6;

import '../AmplesenseVault.sol';

contract TestAmplesenseVault is AmplesenseVault {

    constructor(IERC20 ampl_token) AmplesenseVault(ampl_token) {
    }

    // Test mint function: only used during testing.
    function TESTMINT(uint256 amount, address who) external onlyOwner() {
        eefi_token.mint(who, amount);
    }
}