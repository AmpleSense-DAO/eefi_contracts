// SPDX-License-Identifier: NONE
pragma solidity 0.7.6;

import "@balancer-labs/v2-solidity-utils/contracts/math/Math.sol";
import '@balancer-labs/v2-solidity-utils/contracts/openzeppelin/SafeERC20.sol';
import '@balancer-labs/v2-solidity-utils/contracts/openzeppelin/Ownable.sol';
import '@balancer-labs/v2-solidity-utils/contracts/openzeppelin/Address.sol';
import '@balancer-labs/v2-solidity-utils/contracts/openzeppelin/ReentrancyGuard.sol';

/**
 * staking contract for ERC20 tokens or ETH
 */
contract Distribute is Ownable, ReentrancyGuard {
    using Math for uint256;
    using SafeERC20 for IERC20;

    /**
     @dev This value is used so when reward token distribution is computed
     the difference in precision between staking and reward token doesnt interfere
     with bond increase computation
     This will be computed based on the difference between decimals
     of the staking token and the reward token
     If both tokens have the same amount of decimals then this value is 1
     If reward token has less decimals then amounts will be multiplied by this value
     to match the staking token precision
     If staking token has less decimals then this value will also be 1
    */
    uint256 public DECIMALS_ADJUSTMENT;

    uint256 public constant INITIAL_BOND_VALUE = 1_000_000;

    uint256 public bond_value = INITIAL_BOND_VALUE;
    //just for info
    uint256 public staker_count;

    uint256 private _total_staked;
    uint256 private _temp_pool;
    // the amount of dust left to distribute after the bond value has been updated
    uint256 public to_distribute;
    mapping(address => uint256) private _bond_value_addr;
    mapping(address => uint256) private _stakes;
    mapping(address => uint256) private pending_rewards;
    uint256 immutable staking_decimals;

    /// @dev token to distribute
    IERC20 immutable public reward_token;

    /**
        @dev Initialize the contract
        @param _staking_decimals Number of decimals of the staking token
        @param _reward_decimals Number of decimals of the reward token
        @param _reward_token The token used for rewards. Set to 0 for ETH
    */
    constructor(uint256 _staking_decimals, uint256 _reward_decimals, IERC20 _reward_token) {
        require(address(_reward_token) != address(0), "Distribute: Invalid reward token");
        reward_token = _reward_token;
        // sanitize reward token decimals
        (bool success, uint256 checked_decimals) = tryGetDecimals(address(_reward_token));
        if(success) {
            require(checked_decimals == _reward_decimals, "Distribute: Invalid reward decimals");
        }
        staking_decimals = _staking_decimals;
        if(_staking_decimals > _reward_decimals) {
            DECIMALS_ADJUSTMENT = 10**(_staking_decimals - _reward_decimals);
        } else {
            DECIMALS_ADJUSTMENT = 1;
        }
    }

    /**
     * @dev Attempts to call the `decimals()` function on an ERC-20 token contract.
     * @param tokenAddress The address of the ERC-20 token contract.
     * @return success Indicates if the call was successful.
     * @return decimals The number of decimals the token uses, or 0 if the call failed.
     */
    function tryGetDecimals(address tokenAddress) public view returns (bool success, uint8 decimals) {
        bytes memory payload = abi.encodeWithSignature("decimals()");
        // Low-level call to the token contract
        bytes memory returnData;
        (success, returnData) = tokenAddress.staticcall(payload);
        
        // If call was successful and returned data is the expected length for uint8
        if (success && returnData.length == 32) {
            // Decode the return data
            decimals = abi.decode(returnData, (uint8));
        } else {
            // Default to 0 decimals if call failed or returned unexpected data
            return (false, 0);
        }
    }

    /**
        @dev Stakes a certain amount, this MUST transfer the given amount from the caller
        @param account Address who will own the stake afterwards
        @param amount Amount to stake
    */
    function stakeFor(address account, uint256 amount) public onlyOwner nonReentrant {
        require(account != address(0), "Distribute: Invalid account");
        require(amount > 0, "Distribute: Amount must be greater than zero");
        _total_staked = _total_staked.add(amount);
        uint256 stake = _stakes[account];
        if(stake == 0) {
            staker_count++;
        }
        uint256 accumulated_reward = getReward(account);
        if(accumulated_reward > 0) {
            // set pending rewards to the current reward
            pending_rewards[account] = accumulated_reward;
        }
        _stakes[account] = stake.add(amount);
        // reset bond value for this account
        _bond_value_addr[account] = bond_value;
    }

    /**
        @dev unstakes a certain amount, if unstaking is currently not possible the function MUST revert
        @param account From whom
        @param amount Amount to remove from the stake
    */
    function unstakeFrom(address payable account, uint256 amount) public onlyOwner nonReentrant {
        require(account != address(0), "Distribute: Invalid account");
        require(amount > 0, "Distribute: Amount must be greater than zero");
        uint256 stake = _stakes[account];
        require(amount <= stake, "Distribute: Dont have enough staked");
        uint256 to_reward = _getReward(account, amount);
        _total_staked -= amount;
        stake -= amount;
        _stakes[account] = stake;
        if(stake == 0) {
            staker_count--;
        }

        if(to_reward == 0) return;

        // void pending rewards
        pending_rewards[account] = 0;

        //take into account dust error during payment too
        if(address(reward_token) != address(0)) {
            reward_token.safeTransfer(account, to_reward);
        }
        else {
            Address.sendValue(account, to_reward);
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
    function distribute(uint256 amount, address from) external payable onlyOwner nonReentrant {
        if(address(reward_token) != address(0)) {
            if(amount == 0) return;
            reward_token.safeTransferFrom(from, address(this), amount);
            require(msg.value == 0, "Distribute: Illegal distribution");
        } else {
            if(msg.value == 0) return;
            amount = msg.value;
        }
        // bond precision is always based on 1 unit of staked token
        uint256 total_bonds = _total_staked / 10**staking_decimals;

        if(total_bonds == 0) {
            // not enough staked to compute bonds account, put into temp pool
            _temp_pool = _temp_pool.add(amount);
            return;
        }

        // if a temp pool existed, add it to the current distribution
        if(_temp_pool > 0) {
            amount = amount.add(_temp_pool);
            _temp_pool = 0;
        }

        uint256 temp_to_distribute = to_distribute + amount;
        // bond value is always computed on decimals adjusted rewards
        uint256 bond_increase = temp_to_distribute * DECIMALS_ADJUSTMENT / total_bonds;
        // adjust back for distributed total
        uint256 distributed_total = total_bonds.mul(bond_increase) / DECIMALS_ADJUSTMENT;
        bond_value = bond_value.add(bond_increase);
        //collect the dust because of the PRECISION used for bonds
        //it will be reinjected into the next distribution
        to_distribute = temp_to_distribute - distributed_total;
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
        @return reward the amount account will perceive if he unstakes now
    */
    function _getReward(address account, uint256 amount) internal view returns (uint256 reward) {
        // we apply decimals adjustement as bond value is computed on decimals adjusted rewards
        uint256 accountBonds = amount.divDown(10**staking_decimals);
        reward = accountBonds.mul(bond_value.sub(_bond_value_addr[account])).divDown(DECIMALS_ADJUSTMENT);
        // adding pending rewards
        reward = reward.add(pending_rewards[account]);
    }
}
