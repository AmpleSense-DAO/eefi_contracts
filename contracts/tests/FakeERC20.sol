pragma solidity 0.7.6;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract FakeERC20 is ERC20 {
    constructor() public ERC20("fake", "fake") {
        _mint(msg.sender, 250000 * 10**18);
    }
}