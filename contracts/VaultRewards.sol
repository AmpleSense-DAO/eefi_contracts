pragma solidity ^0.7.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

import './EEFIToken.sol';

/**
 * An IERC900 staking contract
 */
contract VaultRewards is Ownable {
    using SafeMath for uint256;

    EEFIToken public eefi_token;

    uint256 PRECISION = 10**18;

    event ProfitToken(uint256 amount);
    event ProfitEth(uint256 amount);
    event Unstaked(address indexed account,uint256 amount, uint256 stake_left);
    event Staked(address indexed account, uint256 amount, uint256 stake_left);

    uint256 public bond_value_eth;
    uint256 public bond_value_token;

    uint256 private _total_staked;
    // the amount of dust left to distribute after the bond value has been updated
    uint256 public to_distribute_eth;

    // the amount of dust left to distribute after the bond value has been updated
    uint256 public to_distribute_token;
    mapping(address => uint256) private _bond_value_addr_eth;
    mapping(address => uint256) private _bond_value_addr_token;
    mapping(address => uint256) private _stakes;

    constructor() Ownable() {
        eefi_token = new EEFIToken();
    }

    function stakeFor(address account, uint256 amount) public onlyOwner {
        //create the stake for this amount
        _stakeFor(account, amount);
    }

    function unstake(address payable account, uint256 amount) public onlyOwner {
        _unstakeFrom(account, amount);
    }

    function mintTo(address to, uint256 amount) public onlyOwner {
        eefi_token.mint(to, amount);
    }

    function mint(uint256 amount) public onlyOwner {
        mintTo(address(this), amount);
        _distributeToken(amount);
    }

    function burn(uint256 amount) public onlyOwner {
        eefi_token.burn(address(this), amount);
    }

    receive() payable external {
        _distributeEth(msg.value);
    }

    /**
        @dev Called by contracts to distribute dividends
        Updates the bond value
    */
    function _distributeEth(uint256 amount) internal {
        //cant distribute when no stakers
        require(_total_staked > 0, "Cant distribute when no stakers");
        //take into account the dust
        uint256 temp_to_distribute = to_distribute_eth.add(amount);
        uint256 total_bonds = _total_staked.div(PRECISION);
        uint256 bond_increase = temp_to_distribute.div(total_bonds);
        uint256 distributed_total = total_bonds.mul(bond_increase);
        bond_value_eth = bond_value_eth.add(bond_increase);
        //collect the dust
        to_distribute_eth = temp_to_distribute.sub(distributed_total);
        emit ProfitEth(amount);
    }

    /**
        @dev Called by contracts to distribute dividends
        Updates the bond value
    */
    function _distributeToken(uint256 amount) internal {
        //cant distribute when no stakers
        require(_total_staked > 0, "Cant distribute when no stakers");
        //take into account the dust
        uint256 temp_to_distribute = to_distribute_token.add(amount);
        uint256 total_bonds = _total_staked.div(PRECISION);
        uint256 bond_increase = temp_to_distribute.div(total_bonds);
        uint256 distributed_total = total_bonds.mul(bond_increase);
        bond_value_token = bond_value_token.add(bond_increase);
        //collect the dust
        to_distribute_token = temp_to_distribute.sub(distributed_total);
        emit ProfitToken(amount);
    }

    /**
        @dev Returns the current total of tokens staked for an address
        @param addr address owning the stake
        @return the total of staked tokens of this address
    */
    function totalStakedFor(address addr) external view returns (uint256) {
        return _stakes[addr];
    }
    
    /**
        @dev Returns the current total of tokens staked
        @return the total of staked tokens
    */
    function totalStaked() external view returns (uint256) {
        return _total_staked;
    }

    /**
        @dev Returns how much ETH the user can withdraw currently
        @param account Address of the user to check reward for
        @return eth the amount of ETH the account will perceive if he unstakes now
        @return token the amount of tokens the account will perceive if he unstakes now
    */
    function getReward(address account) public view returns (uint256 eth, uint256 token) {
        return _getReward(account,_stakes[account]);
    }

    /**
        @dev Returns how much ETH the user can withdraw currently
        @param account Address of the user to check reward for
        @param amount Number of stakes
        @return eth the amount of ETH the account will perceive if he unstakes now
        @return token the amount of tokens the account will perceive if he unstakes now
    */
    function _getReward(address account, uint256 amount) internal view returns (uint256 eth, uint256 token) {
        token = amount.mul(bond_value_token.sub(_bond_value_addr_token[account])).div(PRECISION);
        eth = amount.mul(bond_value_eth.sub(_bond_value_addr_eth[account])).div(PRECISION);
    }

    /**
        @dev Internally unstakes a certain amount of tokens, this SHOULD return the given amount of tokens to the addr, if unstaking is currently not possible the function MUST revert
        @param account From whom
        @param amount Amount of stakes to remove from the stake
    */
    function _unstakeFrom(address payable account, uint256 amount) internal {
        require(account != address(0), "Invalid account");
        require(amount > 0, "Amount must be greater than zero");
        require(amount <= _stakes[account], "You dont have enough staked");
        (uint256 to_reward_eth, uint256 to_reward_token) = _getReward(account, amount);
        _total_staked = _total_staked.sub(amount);
        _stakes[account] = _stakes[account].sub(amount);
        account.transfer(to_reward_eth);
        eefi_token.transfer(account, to_reward_token);
        emit Unstaked(account, amount, _total_staked);
    }

    /**
        @dev Stakes a certain amount of tokens, this MUST transfer the given amount from the caller
        @param account Address who will own the stake afterwards
        @param amount Amount of ERC20 token to stake
    */
    function _stakeFor(address account, uint256 amount) internal {
        require(account != address(0), "Invalid account");
        require(amount > 0, "Amount must be greater than zero");
        _total_staked = _total_staked.add(amount);

        (uint256 to_reward_eth, uint256 to_reward_token) = _getReward(account, amount);
        _stakes[account] = _stakes[account].add(amount);
        
        uint256 new_bond_value_eth = to_reward_eth.div(_stakes[account].div(PRECISION));
        uint256 new_bond_value_token = to_reward_token.div(_stakes[account].div(PRECISION));
        _bond_value_addr_eth[account] = bond_value_eth.sub(new_bond_value_eth);
        _bond_value_addr_token[account] = bond_value_token.sub(new_bond_value_token);
        emit Staked(account, amount, _total_staked);
    }
}