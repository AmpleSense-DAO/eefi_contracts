// SPDX-License-Identifier: NONE
pragma solidity ^0.7.0;

import 'uFragments/contracts/UFragments.sol';

contract FakeAMPL is UFragments {
    constructor() UFragments() {
        monetaryPolicy = msg.sender;
        initialize(msg.sender);
        monetaryPolicy = msg.sender;
    }

    function forceRebase(uint256 epoch, int256 supplyDelta)
        external
        returns (uint256)
    {
        return rebase(epoch, supplyDelta);
    }
}