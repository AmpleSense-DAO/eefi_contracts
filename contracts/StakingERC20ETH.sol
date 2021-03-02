pragma solidity ^0.7.0;

import "./VaultRewards.sol";
import "./IERC900.sol";

/**
 * An IERC900 staking contract
 */
contract Staking is IERC900  {

    /// @dev handle to access ERC20 token token contract to make transfers
    IERC20 private _token;
    VaultRewards public rewards;
    uint256 PRECISION;

    constructor(IERC20 stake_token, uint256 decimals) {
        _token = stake_token;
        PRECISION = 10**decimals;
        rewards = new VaultRewards();
    }
    
    /**
        @dev Stakes a certain amount of tokens, this MUST transfer the given amount from the account
        @param amount Amount of ERC20 token to stake
        @param data Additional data as per the EIP900
    */
    function stake(uint256 amount, bytes calldata data) external override {
        stakeFor(msg.sender, amount, data);
    }

    /**
        @dev Stakes a certain amount of tokens, this MUST transfer the given amount from the caller
        @param account Address who will own the stake afterwards
        @param amount Amount of ERC20 token to stake
        @param data Additional data as per the EIP900
    */
    function stakeFor(address account, uint256 amount, bytes calldata data) public override {
        //transfer the ERC20 token from the account, he must have set an allowance of {amount} tokens
        require(_token.transferFrom(msg.sender, address(this), amount), "ERC20 token transfer failed.");
        //create the stake for this amount
        rewards.stakeFor(account, amount);
    }

    /**
        @dev Unstakes a certain amount of tokens, this SHOULD return the given amount of tokens to the account, if unstaking is currently not possible the function MUST revert
        @param amount Amount of ERC20 token to remove from the stake
        @param data Additional data as per the EIP900
    */
    function unstake(uint256 amount, bytes calldata data) external override {
        rewards.unstake(msg.sender, amount);
        //make the transfer
        require(_token.transfer(msg.sender, amount),"ERC20 token transfer failed");
    }

     /**
        @dev Withdraws rewards (basically unstake then restake)
        @param amount Amount of ERC20 token to remove from the stake
    */
    function withdraw(uint256 amount) external {
        rewards.unstake(msg.sender, amount);
        rewards.stakeFor(msg.sender, amount);
    }

    /**
        @dev eth sent here is distributed to stakers
     */
    receive() payable external {
        payable(address(rewards)).transfer(msg.value);
    }

    /**
        @dev Returns the current total of tokens staked for an address
        @param account address owning the stake
        @return the total of staked tokens of this address
    */
    function totalStakedFor(address account) external view override returns (uint256) {
        return rewards.totalStakedFor(account);
    }
    
    /**
        @dev Returns the current total of tokens staked
        @return the total of staked tokens
    */
    function totalStaked() external view override returns (uint256) {
        return rewards.totalStaked();
    }

    /**
        @dev Address of the token being used by the staking interface
        @return ERC20 token token address
    */
    function token() external view override returns (address) {
        return address(_token);
    }

    /**
        @dev MUST return true if the optional history functions are implemented, otherwise false
        We dont want this
    */
    function supportsHistory() external pure override returns (bool) {
        return false;
    }

    /**
        @dev Returns how much ETH and ERC20 the user can withdraw currently
        @param account Address of the user to check reward for
        @return eth the amount of ETH account will perceive if he unstakes now
        @return token the amount of tokens account will perceive if he unstakes now
    */
    function getReward(address account) public view returns (uint256 eth, uint256 token) {
        return rewards.getReward(account);
    }
}