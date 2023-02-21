// SPDX-License-Identifier: NONE
pragma solidity 0.8.4;

import 'uFragments/contracts/UFragments.sol';

contract FakeAMPL is UFragments {

    constructor() UFragments() {
        initialize(msg.sender);
        monetaryPolicy = msg.sender;
    }
}