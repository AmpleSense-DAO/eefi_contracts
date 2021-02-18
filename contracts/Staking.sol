pragma solidity ^0.7.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import "./IERC900.sol";

/**
 * An IERC900 staking contract
 */
contract Staking is IERC900 {
    using SafeMath for uint256;

    uint256 PRECISION;

    event Profit(uint256 amount);

    uint256 public bond_value;
    //just for info
    uint256 public investor_count;

    uint256 private _total_staked;
    // the amount of dust left to distribute after the bond value has been updated
    uint256 public to_distribute;
    mapping(address => uint256) private _bond_value_addr;
    mapping(address => uint256) private _stakes;

    /// @dev handle to access ERC20 token token contract to make transfers
    IERC20 private _token;

    constructor(IERC20 stake_token, uint256 decimals) {
        _token = stake_token;
        PRECISION = 10**decimals;
    }
    
    /**
        @dev Stakes a certain amount of tokens, this MUST transfer the given amount from the addr
        @param amount Amount of ERC20 token to stake
        @param data Additional data as per the EIP900
    */
    function stake(uint256 amount, bytes calldata data) external override {
        //transfer the ERC20 token from the addr, he must have set an allowance of {amount} tokens
        require(_token.transferFrom(msg.sender, address(this), amount), "ERC20 token transfer failed, did you forget to create an allowance?");
        _stakeFor(msg.sender, amount, data);
    }

    /**
        @dev Stakes a certain amount of tokens, this MUST transfer the given amount from the caller
        @param addr Address who will own the stake afterwards
        @param amount Amount of ERC20 token to stake
        @param data Additional data as per the EIP900
    */
    function stakeFor(address addr, uint256 amount, bytes calldata data) external override {
        //transfer the ERC20 token from the addr, he must have set an allowance of {amount} tokens
        require(_token.transferFrom(msg.sender, address(this), amount), "ERC20 token transfer failed, did you forget to create an allowance?");
        //create the stake for this amount
        _stakeFor(addr, amount, data);
    }

    /**
        @dev Unstakes a certain amount of tokens, this SHOULD return the given amount of tokens to the addr, if unstaking is currently not possible the function MUST revert
        @param amount Amount of ERC20 token to remove from the stake
        @param data Additional data as per the EIP900
    */
    function unstake(uint256 amount, bytes calldata data) external override {
        _unstakeFrom(msg.sender, amount, data);
        //make the transfer
        require(_token.transfer(msg.sender, amount),"ERC20 token transfer failed");
    }

     /**
        @dev Withdraws rewards (basically unstake then restake)
        @param amount Amount of ERC20 token to remove from the stake
    */
    function withdraw(uint256 amount) external {
        _unstakeFrom(msg.sender, amount, "0x");
        _stakeFor(msg.sender, amount, "0x");
    }

    receive() payable external {
        _distribute(msg.value);
    }

    /**
        @dev Called by contracts to distribute dividends
        Updates the bond value
    */
    function _distribute(uint256 amount) internal {
        //cant distribute when no stakers
        require(_total_staked > 0, "cant distribute when no stakers");
        //take into account the dust
        uint256 temp_to_distribute = to_distribute.add(amount);
        uint256 total_bonds = _total_staked.div(PRECISION);
        uint256 bond_increase = temp_to_distribute.div(total_bonds);
        uint256 distributed_total = total_bonds.mul(bond_increase);
        bond_value = bond_value.add(bond_increase);
        //collect the dust
        to_distribute = temp_to_distribute.sub(distributed_total);
        emit Profit(amount);
    }

    /**
        @dev Returns the current total of tokens staked for an address
        @param addr address owning the stake
        @return the total of staked tokens of this address
    */
    function totalStakedFor(address addr) external view override returns (uint256) {
        return _stakes[addr];
    }
    
    /**
        @dev Returns the current total of tokens staked
        @return the total of staked tokens
    */
    function totalStaked() external view override returns (uint256) {
        return _total_staked;
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
        @dev Returns how much ETH the user can withdraw currently
        @param addr Address of the user to check reward for
        @return the amount of ETH addr will perceive if he unstakes now
    */
    function getReward(address addr) public view returns (uint256) {
        return _getReward(addr,_stakes[addr]);
    }

    /**
        @dev Returns how much ETH the user can withdraw currently
        @param addr Address of the user to check reward for
        @param amount Number of stakes
        @return the amount of ETH addr will perceive if he unstakes now
    */
    function _getReward(address addr, uint256 amount) internal view returns (uint256) {
        return amount.mul(bond_value.sub(_bond_value_addr[addr])).div(PRECISION);
    }

    /**
        @dev Internally unstakes a certain amount of tokens, this SHOULD return the given amount of tokens to the addr, if unstaking is currently not possible the function MUST revert
        @param account From whom
        @param amount Amount of ERC20 token to remove from the stake
        @param data Additional data as per the EIP900
    */
    function _unstakeFrom(address payable account, uint256 amount, bytes memory data) internal {
        require(account != address(0), "Invalid account");
        require(amount > 0, "Amount must be greater than zero");
        require(amount <= _stakes[account], "You dont have enough staked");
        uint256 to_reward = _getReward(account, amount);
        _total_staked = _total_staked.sub(amount);
        _stakes[account] = _stakes[account].sub(amount);
        if(_stakes[account] == 0) {
            investor_count--;
        }
        account.transfer(to_reward);
        emit Unstaked(account, amount, _total_staked, data);
    }

    /**
        @dev Stakes a certain amount of tokens, this MUST transfer the given amount from the caller
        @param account Address who will own the stake afterwards
        @param amount Amount of ERC20 token to stake
        @param data Additional data as per the EIP900
    */
    function _stakeFor(address account, uint256 amount, bytes memory data) internal {
        require(account != address(0), "Invalid account");
        require(amount > 0, "Amount must be greater than zero");
        _total_staked = _total_staked.add(amount);
        if(_stakes[account] == 0) {
            investor_count++;
        }

        uint256 accumulated_reward = getReward(account);
        _stakes[account] = _stakes[account].add(amount);
        
        uint256 new_bond_value = accumulated_reward.div(_stakes[account].div(PRECISION));
        _bond_value_addr[account] = bond_value.sub(new_bond_value);
        emit Staked(account, amount, _total_staked, data);
    }
}