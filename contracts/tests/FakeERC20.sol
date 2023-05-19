pragma solidity 0.7.6;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract FakeERC20 is ERC20 {
    constructor(uint8 decimals_) public ERC20("fake", "fake") {
        _setupDecimals(decimals_);
        _mint(msg.sender, 250000 * 10**(decimals()));
    }

    function rebase(int256 amount) external {
        if(amount > 0)
            _mint(msg.sender, uint256(amount));
        else {
            _burn(msg.sender, uint256(-amount));
        }
    }

    function mint(uint256 amount, address to) external {
        _mint(to, amount);
    }
}