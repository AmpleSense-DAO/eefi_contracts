// SPDX-License-Identifier: NONE
pragma solidity ^0.7.0;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol';

import './StakingERC20.sol';
import './Staking.sol';
import './EEFIToken.sol';

contract EEFIStakingToken is ERC20Burnable, Ownable {
    constructor() 
    ERC20("", "")
    Ownable() {
    }

    function mint(address account, uint256 amount) public onlyOwner {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) public onlyOwner {
        _burn(account, amount);
    }
}

contract StakingERC20Ownable is StakingERC20, Ownable {
    constructor(IERC20 _staking_token, uint256 decimals, IERC20 _reward_token)
    Ownable()
    StakingERC20(_staking_token, decimals, _reward_token) {}

    function unstakeFrom(address account, uint256 amount) external onlyOwner {
        _unstakeFrom(account, amount, "");
    }
}

contract StakingOwnable is Staking, Ownable {
    constructor(IERC20 token, uint256 decimals)
    Ownable()
    Staking(token, decimals) {}

    function unstakeFrom(address payable account, uint256 amount) external onlyOwner {
        _unstakeFrom(account, amount, "");
    }
}

contract VaultRewards is Ownable {

    StakingERC20Ownable eefi_stake;
    StakingOwnable eth_stake;
    EEFIStakingToken staking_token;
    EEFIStakingToken staking_token2;
    EEFIToken public eefi_token;

    constructor() Ownable() {
        staking_token = new EEFIStakingToken();
        staking_token2 = new EEFIStakingToken();
        eefi_token = new EEFIToken();
        eefi_stake = new StakingERC20Ownable(staking_token, 18, eefi_token);
        eth_stake = new StakingOwnable(staking_token2, 18);
    }

    function stakeFor(address account, uint256 amount) public onlyOwner {
        eefi_stake.stakeFor(account, amount, "");
        eth_stake.stakeFor(account, amount, "");
    }

    function unstake(address account, uint256 amount) public onlyOwner {
        eefi_stake.unstakeFrom(account, amount);
    }

    function mintTo(address to, uint256 amount) public onlyOwner {
        eefi_token.mint(to, amount);
    }

    function mint(uint256 amount) public onlyOwner {
        mintTo(address(this), amount);
        eefi_token.approve(address(eefi_stake), amount);
        eefi_stake.distribute(amount);
    }

    function burn(uint256 amount) public onlyOwner {
        eefi_token.burn(address(this), amount);
    }

    receive() payable external {
        payable(address(eth_stake)).transfer(msg.value);
    }
}