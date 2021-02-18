// SPDX-License-Identifier: NONE
pragma solidity ^0.7.0;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol';

import './UniswapTrader.sol';
import './VaultRewards.sol';

import "hardhat/console.sol";

contract AmplesenseVault is UniswapTrader, Ownable {

    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    address payable public pioneer_vault1;
    address payable public pioneer_vault2;
    address payable public staking_pool;
    VaultRewards public rewards;

    uint256 constant EEFI_DEPOSIT_RATE = 10000;
    uint256 constant EEFI_NEGATIVE_REBASE_RATE = 100000;
    uint256 constant EEFI_EQULIBRIUM_REBASE_RATE = 10000;
    uint256 constant DEPOSIT_FEE_10000 = 65;
    uint256 constant LOCK_TIME = 90 days;
    uint256 constant INITIAL_SHARE_VALUE = 1000000;
    uint256 constant TRADE_POSITIVE_EEFI_100 = 48;
    uint256 constant TRADE_POSITIVE_ETH_100 = 20;
    uint256 constant TRADE_POSITIVE_PIONEER1_100 = 2;
    uint256 constant TRADE_POSITIVE_REWARDS_100 = 60;
    uint256 constant TRADE_POSITIVE_PIONEER2_100 = 10;
    uint256 constant TRADE_POSITIVE_LPSTAKING_100 = 30;
    uint256 public share_value = INITIAL_SHARE_VALUE;

    event Burn(uint256 amount);

    //
    // Last AMPL total supply
    //
    uint256 public last_ampl_supply;

    uint256 last_rebase_call;

    struct DepositChunk {
        uint256 amount;
        uint256 timestamp;
    }

    mapping(address => uint256) private _shares;
    mapping(address => DepositChunk[]) private _deposits;
    uint256 public total_shares = 0;

    event Deposit(address indexed account, uint256 shares, uint256 length);
    
    constructor(IUniswapV2Router02 router, IERC20 ampl_token, address payable _pioneer_vault1, address payable _pioneer_vault2, address payable _staking_pool) UniswapTrader(router, ampl_token) Ownable() {
        pioneer_vault1 = _pioneer_vault1;
        pioneer_vault2 = _pioneer_vault2;
        staking_pool = _staking_pool;
        
        require(pioneer_vault2 != address(0), "Invalid pioneer vault address");
        last_ampl_supply = ampl_token.totalSupply();
        last_rebase_call = block.timestamp;
        rewards = new VaultRewards();
    }

    function balanceOf(address account) public returns(uint256 ampl) {
        return ampl_token.balanceOf(address(this)).mul(_shares[account]).div(total_shares);
    }

    function makeDeposit(uint256 amount) external {
        depositFor(msg.sender, amount);
    }

    function depositFor(address account, uint256 amount) public {
        ampl_token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 shares = amount.mul(share_value);
        _deposits[account].push(DepositChunk(shares, block.timestamp));

        uint256 to_mint = amount.div(EEFI_DEPOSIT_RATE);
        uint256 deposit_fee = to_mint.mul(DEPOSIT_FEE_10000).div(10000);
        rewards.mintTo(pioneer_vault2, deposit_fee);
        rewards.mintTo(msg.sender, to_mint.sub(deposit_fee));
        
        _shares[account] = _shares[account].add(shares);
        total_shares = total_shares.add(shares);
        // stake the shares also in the rewards pool
        rewards.stakeFor(account, shares);
        emit Deposit(account, shares, _deposits[account].length);
    }

    function withdraw(uint256 shares) external {
        require(_shares[msg.sender] >= shares, "Not enough balance");

        uint256 to_withdraw = ampl_token.balanceOf(address(this)).mul(shares).mul(share_value).div(INITIAL_SHARE_VALUE);
        //uint256 to_withdraw_eefi = eefi_token.balanceOf(address(this)).mul(shares).mul(share_value).div(INITIAL_SHARE_VALUE);
        _shares[msg.sender] -= shares;
        total_shares -= shares;

        uint256 deposits = _deposits[msg.sender].length;
        while(to_withdraw > 0) {
            // either liquidate the deposit, or reduce it
            DepositChunk storage deposit = _deposits[msg.sender][0];
            require(deposit.timestamp < block.timestamp.sub(LOCK_TIME), "No unlocked deposits found");
            if(deposit.amount > to_withdraw) {
                deposit.amount = deposit.amount.sub(to_withdraw);
                to_withdraw = 0;
            } else {
                to_withdraw = to_withdraw.sub(deposit.amount);
                _popDeposit();
            }
        }

        ampl_token.safeTransfer(msg.sender, to_withdraw);
        // unstake the shares also from the rewards pool
        rewards.unstake(msg.sender, shares);
    }

    function rebase() external {
        //make sure this is not manipulable by sending ampl!
        require(block.timestamp - 24 hours > last_rebase_call, "rebase can only be called once every 24 hours");
        uint256 new_supply = ampl_token.totalSupply();
        _updateShares();
        if(new_supply > last_ampl_supply) {
            // positive rebase
            uint256 surplus = new_supply.sub(last_ampl_supply);
            uint256 percent = surplus.div(100);
            uint256 for_eefi = percent.mul(TRADE_POSITIVE_EEFI_100);
            uint256 for_eth = percent.mul(TRADE_POSITIVE_ETH_100);
            uint256 for_pioneer1 = percent.mul(TRADE_POSITIVE_PIONEER1_100);
            //30% ampl remains
            // buy and burn eefi
            _sellForToken(for_eefi, address(rewards.eefi_token()));
            uint256 to_burn = IERC20(rewards.eefi_token()).balanceOf(address(this));
            rewards.burn(to_burn);
            emit Burn(to_burn);
            // buy eth and distribute
            _sellForEth(for_eth);
            percent = address(this).balance.div(100);
            uint256 to_rewards = percent.mul(TRADE_POSITIVE_REWARDS_100);
            uint256 to_pioneer2 = percent.mul(TRADE_POSITIVE_PIONEER2_100);
            uint256 to_lp_staking = percent.mul(TRADE_POSITIVE_LPSTAKING_100);

            payable(address(rewards)).transfer(to_rewards);
            pioneer_vault2.transfer(to_pioneer2);
            staking_pool.transfer(to_lp_staking);

            // distribute ampl to pioneer 1
            ampl_token.safeTransfer(pioneer_vault1, for_pioneer1);
        } else if(new_supply < last_ampl_supply) {
            // negative rebase
            uint256 to_mint = ampl_token.balanceOf(address(this)).div(EEFI_NEGATIVE_REBASE_RATE);
            rewards.mint(to_mint);
        } else {
            // equal
            uint256 to_mint = ampl_token.balanceOf(address(this)).div(EEFI_NEGATIVE_REBASE_RATE);
            rewards.mint(to_mint);
        }

        last_ampl_supply = new_supply;
    }

    function _updateShares() internal {
        share_value = ampl_token.balanceOf(address(this)).mul(INITIAL_SHARE_VALUE).div(total_shares);
        console.log("new share value", share_value);
    }

    function _popDeposit() internal {
        for (uint i = 0; i < _deposits[msg.sender].length - 1; i++) {
            _deposits[msg.sender][0] = _deposits[msg.sender][i + 1];
        }
        delete _deposits[msg.sender][_deposits[msg.sender].length - 1];
        _deposits[msg.sender].pop();
    }
}