// SPDX-License-Identifier: NONE
pragma solidity ^0.7.0;

import "@balancer-labs/balancer-core-v2/contracts/lib/math/Math.sol";
import "@balancer-labs/balancer-core-v2/contracts/lib/openzeppelin/IERC20.sol";
import '@balancer-labs/balancer-core-v2/contracts/lib/openzeppelin/SafeERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

/**
 * staking contract for ERC20 tokens or ETH
 */
contract Distribute is Ownable {
    using Math for uint256;
    using SafeERC20 for IERC20;

    uint256 PRECISION;

    uint256 constant INITIAL_BOND_VALUE = 1000000;

    uint256 public bond_value = INITIAL_BOND_VALUE;
    //just for info
    uint256 public investor_count;

    uint256 private _total_staked;
    uint256 private _temp_pool;
    // the amount of dust left to distribute after the bond value has been updated
    uint256 public to_distribute;
    mapping(address => uint256) private _bond_value_addr;
    mapping(address => uint256) private _stakes;

    /// @dev token to distribute
    IERC20 public reward_token;

    /**
        @dev Initialize the contract
        @param decimals Precision to use
        @param _reward_token The token used for rewards. Set to 0 for ETH
    */
    constructor(uint256 decimals, IERC20 _reward_token) Ownable() {
        reward_token = _reward_token;
        PRECISION = 10**decimals;
    }

    /**
        @dev Stakes a certain amount, this MUST transfer the given amount from the caller
        @param account Address who will own the stake afterwards
        @param amount Amount to stake
    */
    function stakeFor(address account, uint256 amount) public onlyOwner {
        require(account != address(0), "Distribute: Invalid account");
        require(amount > 0, "Distribute: Amount must be greater than zero");
        _total_staked = _total_staked.add(amount);
        if(_stakes[account] == 0) {
            investor_count++;
        }

        uint256 accumulated_reward = getReward(account);
        _stakes[account] = _stakes[account].add(amount);

        uint256 new_bond_value = accumulated_reward / _stakes[account] / PRECISION;
        _bond_value_addr[account] = bond_value.sub(new_bond_value);
    }

    /**
        @dev unstakes a certain amounts, if unstaking is currently not possible the function MUST revert
        @param account From whom
        @param amount Amount to remove from the stake
    */
    function unstakeFrom(address payable account, uint256 amount) public onlyOwner {
        require(account != address(0), "Distribute: Invalid account");
        require(amount > 0, "Distribute: Amount must be greater than zero");
        require(amount <= _stakes[account], "Distribute: Dont have enough staked");
        uint256 to_reward = _getReward(account, amount);
        _total_staked = _total_staked.sub(amount);
        _stakes[account] = _stakes[account].sub(amount);
        if(_stakes[account] == 0) {
            investor_count--;
        }

        if(to_reward == 0) return;
        //take into account dust error during payment too
        if(address(reward_token) != address(0)) {
            reward_token.safeTransfer(account, to_reward);
        }
        else {
            account.transfer(to_reward);
        }
    }

     /**
        @dev Withdraws rewards (basically unstake then restake)
        @param account From whom
        @param amount Amount to remove from the stake
    */
    function withdrawFrom(address payable account, uint256 amount) external onlyOwner {
        unstakeFrom(account, amount);
        stakeFor(account, amount);
    }

    /**
        @dev Called contracts to distribute dividends
        Updates the bond value
        @param amount Amount of token to distribute
        @param from Address from which to take the token
    */
    function distribute(uint256 amount, address from) external payable onlyOwner {
        if(address(reward_token) != address(0)) {
            if(amount == 0) return;
            reward_token.safeTransferFrom(from, address(this), amount);
        } else {
            amount = msg.value;
        }

        if(_total_staked == 0) {
            //no stakes yet, put into temp pool
            _temp_pool = _temp_pool.add(amount);
            return;
        }

        // if a temp pool existed, add it to the current distribution
        if(_temp_pool > 0) {
            amount = amount.add(_temp_pool);
            _temp_pool = 0;
        }
        
        uint256 temp_to_distribute = to_distribute.add(amount);
        uint256 total_bonds = _total_staked / PRECISION;
        uint256 bond_increase = temp_to_distribute / total_bonds;
        uint256 distributed_total = total_bonds.mul(bond_increase);
        bond_value = bond_value.add(bond_increase);
        //collect the dust
        to_distribute = temp_to_distribute.sub(distributed_total);
    }

    /**
        @dev Returns the current total staked for an address
        @param account address owning the stake
        @return the total staked for this account
    */
    function totalStakedFor(address account) external view returns (uint256) {
        return _stakes[account];
    }
    
    /**
        @return current staked token
    */
    function totalStaked() external view returns (uint256) {
        return _total_staked;
    }

    /**
        @dev Returns how much the user can withdraw currently
        @param account Address of the user to check reward for
        @return the amount account will perceive if he unstakes now
    */
    function getReward(address account) public view returns (uint256) {
        return _getReward(account,_stakes[account]);
    }

    /**
        @dev returns the total amount of stored rewards
    */
    function getTotalReward() external view returns (uint256) {
        if(address(reward_token) != address(0)) {
            return reward_token.balanceOf(address(this));
        } else {
            return address(this).balance;
        }
    }

    /**
        @dev Returns how much the user can withdraw currently
        @param account Address of the user to check reward for
        @param amount Number of stakes
        @return the amount account will perceive if he unstakes now
    */
    function _getReward(address account, uint256 amount) internal view returns (uint256) {
        return amount.mul(bond_value.sub(_bond_value_addr[account])) / PRECISION;
    }
}
