// SPDX-License-Identifier: NONE
pragma solidity 0.7.6;

import "./Distribute.sol";
import "./interfaces/IERC900.sol";

/**
 * An IERC900 staking contract
 */
contract StakingDoubleERC20 is IERC900  {
    using SafeERC20 for IERC20;

    /// @dev handle to access ERC20 token token contract to make transfers
    IERC20 private _token;
    Distribute immutable public staking_contract_ohm;
    Distribute immutable public staking_contract_eefi;

    event ProfitOHM(uint256 amount);
    event ProfitEEFI(uint256 amount);
    event StakeChanged(uint256 total, uint256 timestamp);

    constructor(IERC20 stake_token, uint256 stake_decimals, IERC20 eefi) {
        _token = stake_token;
        // we do not need to sanitize the decimals here because the Distribute contract will do it
        staking_contract_ohm = new Distribute(stake_decimals, 9, IERC20(0x64aa3364F17a4D01c6f1751Fd97C2BD3D7e7f1D5));
        staking_contract_eefi = new Distribute(stake_decimals, 18, eefi);
    }

    /**
        @dev Takes OHM from sender and puts it in the reward pool
        @param amount Amount of token to add to rewards
    */
    function distribute_ohm(uint256 amount) payable external {
        staking_contract_ohm.distribute(amount, msg.sender);
        emit ProfitOHM(amount);
    }

    /**
        @dev Takes EEFI from sender and puts it in the reward pool
        @param amount Amount of token to add to rewards
    */
    function distribute_eefi(uint256 amount) external {
        staking_contract_eefi.distribute(amount, msg.sender);
        emit ProfitEEFI(amount);
    }

    /**
        @dev Sends any reward token mistakingly sent to the main contract to the reward pool
    */
    function forward() external {
        IERC20 rewardToken = IERC20(staking_contract_ohm.reward_token());
        uint256 balance = rewardToken.balanceOf(address(this));
        if(balance > 0) {
            rewardToken.approve(address(staking_contract_ohm), balance);
            staking_contract_ohm.distribute(balance, address(this));
            emit ProfitOHM(balance);
        }

        rewardToken = IERC20(staking_contract_eefi.reward_token());
        balance = rewardToken.balanceOf(address(this));
        if(balance > 0) {
            rewardToken.approve(address(staking_contract_eefi), balance);
            staking_contract_eefi.distribute(balance, address(this));
            emit ProfitEEFI(balance);
        }
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
        _token.safeTransferFrom(msg.sender, address(this), amount);
        staking_contract_ohm.stakeFor(account, amount);
        staking_contract_eefi.stakeFor(account, amount);
        emit Staked(account, amount, totalStakedFor(account), data);
        emit StakeChanged(staking_contract_ohm.totalStaked(), block.timestamp);
    }

    /**
        @dev Unstakes a certain amount of tokens, this SHOULD return the given amount of tokens to the account, if unstaking is currently not possible the function MUST revert
        @param amount Amount of ERC20 token to remove from the stake
        @param data Additional data as per the EIP900
    */
    function unstake(uint256 amount, bytes calldata data) external override {
        staking_contract_ohm.unstakeFrom(payable(msg.sender), amount);
        staking_contract_eefi.unstakeFrom(payable(msg.sender), amount);
        _token.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount, totalStakedFor(msg.sender), data);
        emit StakeChanged(staking_contract_ohm.totalStaked(), block.timestamp);
    }

     /**
        @dev Withdraws rewards (basically unstake then restake)
        @param amount Amount of ERC20 token to remove from the stake
    */
    function withdraw(uint256 amount) external {
        staking_contract_ohm.withdrawFrom(payable(msg.sender), amount);
        staking_contract_eefi.withdrawFrom(payable(msg.sender),amount);
    }

    /**
        @dev Returns the current total of tokens staked for an address
        @param account address owning the stake
        @return the total of staked tokens of this address
    */
    function totalStakedFor(address account) public view override returns (uint256) {
        return staking_contract_ohm.totalStakedFor(account);
    }
    
    /**
        @dev Returns the current total of tokens staked
        @return the total of staked tokens
    */
    function totalStaked() external view override returns (uint256) {
        return staking_contract_ohm.totalStaked();
    }

    /**
        @dev returns the total rewards stored for ohm and eefi
    */
    function totalReward() external view returns (uint256 _ohm, uint256 _eefi) {
        _ohm = staking_contract_ohm.getTotalReward();
        _eefi = staking_contract_eefi.getTotalReward();
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
        @param account Address of the user to check reward for
        @return _ohm the amount of OHM the account will receive if they unstake now
        @return _eefi the amount of EEFI the account will receive if they unstake now
    */
    function getReward(address account) public view returns (uint256 _ohm, uint256 _eefi) {
        _ohm = staking_contract_ohm.getReward(account);
        _eefi = staking_contract_eefi.getReward(account);
    }
}