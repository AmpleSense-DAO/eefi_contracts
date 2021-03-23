// SPDX-License-Identifier: NONE
pragma solidity ^0.7.0;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol';

import './UniswapTrader.sol';
import './Distribute.sol';
import './interfaces/IStakingERC20.sol';
import './EEFIToken.sol';

import 'hardhat/console.sol';

contract AmplesenseVault is UniswapTrader, Ownable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    IStakingERC20 public pioneer_vault1;
    IStakingERC20 public pioneer_vault2;
    IStakingERC20 public staking_pool;
    Distribute public rewards_eefi;
    Distribute public rewards_eth;
    EEFIToken public eefi_token;

    uint256 constant public EEFI_DEPOSIT_RATE = 10000;
    uint256 constant public EEFI_NEGATIVE_REBASE_RATE = 100000;
    uint256 constant public EEFI_EQULIBRIUM_REBASE_RATE = 10000;
    uint256 constant public DEPOSIT_FEE_10000 = 65;
    uint256 constant public LOCK_TIME = 90 days;
    uint256 constant public TRADE_POSITIVE_EEFI_100 = 48;
    uint256 constant public TRADE_POSITIVE_ETH_100 = 20;
    uint256 constant public TRADE_POSITIVE_PIONEER1_100 = 2;
    uint256 constant public TRADE_POSITIVE_REWARDS_100 = 60;
    uint256 constant public TRADE_POSITIVE_PIONEER2_100 = 10;
    uint256 constant public TRADE_POSITIVE_LPSTAKING_100 = 30;

    event Burn(uint256 amount);
    event Claimed(address indexed account, uint256 eth, uint256 token);
    event Deposit(address indexed account, uint256 amount, uint256 length);
    event Withdrawal(address indexed account, uint256 amount, uint256 length);
    event Rebase(uint256 last_ampl_supply, uint256 new_supply);

    //
    // Last AMPL total supply
    //
    uint256 public last_ampl_supply;

    uint256 last_rebase_call;

    struct DepositChunk {
        uint256 amount;
        uint256 timestamp;
    }

    mapping(address => DepositChunk[]) private _deposits;

    
    
    constructor(IUniswapV2Router02 router, IERC20 ampl_token) UniswapTrader(router, ampl_token) Ownable() {
        last_ampl_supply = ampl_token.totalSupply();
        last_rebase_call = block.timestamp;
        eefi_token = new EEFIToken();
        rewards_eefi = new Distribute(9, IERC20(eefi_token));
        rewards_eth = new Distribute(9, IERC20(0));
    }

    /**
     * @param account User address
     * @return total amount of shares owned by account
     */
    function totalStakedFor(address account) public view returns (uint256 total) {
        for(uint i = 0; i < _deposits[account].length; i++) {
            total += _deposits[account][i].amount;
        }
        return total;
    }

    function totalClaimableBy(address account) public view returns (uint256 total) {
        for(uint i = 0; i < _deposits[account].length; i++) {
            if(_deposits[account][i].timestamp < block.timestamp.sub(LOCK_TIME)) {
                total += _deposits[account][i].amount;
            } else return total;
        }
    }

    function initialize(IStakingERC20 _pioneer_vault1, IStakingERC20 _pioneer_vault2, IStakingERC20 _staking_pool) external {
        require(address(pioneer_vault1) == address(0), "AmplesenseVault: contract already initialized");
        pioneer_vault1 = _pioneer_vault1;
        pioneer_vault2 = _pioneer_vault2;
        staking_pool = _staking_pool;
    }

    function balanceOf(address account) public view returns(uint256 ampl) {
        if(rewards_eefi.totalStaked() == 0) return 0;
        uint256 ampl_balance = ampl_token.balanceOf(address(this));
        ampl = ampl_balance.mul(rewards_eefi.totalStakedFor(account)).div(rewards_eefi.totalStaked());
    }

    function makeDeposit(uint256 amount) external {
        depositFor(msg.sender, amount);
    }

    function depositFor(address account, uint256 amount) public {
        ampl_token.safeTransferFrom(msg.sender, address(this), amount);
        _deposits[account].push(DepositChunk(amount, block.timestamp));

        uint256 to_mint = amount.div(EEFI_DEPOSIT_RATE);
        uint256 deposit_fee = to_mint.mul(DEPOSIT_FEE_10000).div(10000);
        //send some eefi to pioneer vault 2
        eefi_token.mint(address(this), deposit_fee);
        eefi_token.increaseAllowance(pioneer_vault2.staking_contract_token(), deposit_fee);
        pioneer_vault2.distribute(deposit_fee);
        eefi_token.mint(msg.sender, to_mint.sub(deposit_fee));
        
        // stake the shares also in the rewards pool
        rewards_eefi.stakeFor(account, amount);
        rewards_eth.stakeFor(account, amount);
        emit Deposit(account, amount, _deposits[account].length);
    }

    function withdraw(uint256 amount) external {
        require(amount <= totalStakedFor(msg.sender), "AmplesenseVault: Not enough balance");
        uint256 to_withdraw = amount;
        //make sure the assets aren't time locked
        while(to_withdraw > 0) {
            // either liquidate the deposit, or reduce it
            DepositChunk storage deposit = _deposits[msg.sender][0];
            require(deposit.timestamp < block.timestamp.sub(LOCK_TIME), "AmplesenseVault: No unlocked deposits found");
            if(deposit.amount > to_withdraw) {
                deposit.amount = deposit.amount.sub(to_withdraw);
                to_withdraw = 0;
            } else {
                to_withdraw = to_withdraw.sub(deposit.amount);
                _popDeposit();
            }
        }
        // compute the current ampl count representing user shares
        uint256 ampl_amount = ampl_token.balanceOf(address(this)).mul(amount).div(rewards_eefi.totalStaked());
        ampl_token.safeTransfer(msg.sender, ampl_amount);
        // unstake the shares also from the rewards pool
        rewards_eefi.unstakeFrom(msg.sender, amount);
        rewards_eth.unstakeFrom(msg.sender, amount);
        emit Withdrawal(msg.sender, ampl_amount,_deposits[msg.sender].length);
    }

    function rebase() external {
        require(rewards_eefi.totalStaked() > 0, "AmplesenseVault: rebase failed because no stakers");
        //make sure this is not manipulable by sending ampl!
        require(block.timestamp - 24 hours > last_rebase_call, "AmplesenseVault: rebase can only be called once every 24 hours");
        last_rebase_call = block.timestamp;
        uint256 new_supply = ampl_token.totalSupply();
        if(new_supply > last_ampl_supply) {
            // positive rebase
            uint256 surplus = new_supply.sub(last_ampl_supply);
            uint256 percent = surplus.div(100);
            uint256 for_eefi = percent.mul(TRADE_POSITIVE_EEFI_100);
            uint256 for_eth = percent.mul(TRADE_POSITIVE_ETH_100);
            uint256 for_pioneer1 = percent.mul(TRADE_POSITIVE_PIONEER1_100);
            //30% ampl remains
            // buy and burn eefi
            _sellForToken(for_eefi, address(eefi_token));
            uint256 to_burn = eefi_token.balanceOf(address(this));
            eefi_token.burn(address(this), to_burn);
            emit Burn(to_burn);
            // buy eth and distribute
            _sellForEth(for_eth);
            percent = address(this).balance.div(100);
            uint256 to_rewards = percent.mul(TRADE_POSITIVE_REWARDS_100);
            uint256 to_pioneer2 = percent.mul(TRADE_POSITIVE_PIONEER2_100);
            uint256 to_lp_staking = percent.mul(TRADE_POSITIVE_LPSTAKING_100);
            rewards_eth.distribute{value: to_rewards}(to_rewards, address(this));
            pioneer_vault2.distribute_eth{value: to_pioneer2}();
            staking_pool.distribute_eth{value: to_lp_staking}();

            // distribute ampl to pioneer 1
            ampl_token.safeIncreaseAllowance(pioneer_vault1.staking_contract_token(), for_pioneer1);
            pioneer_vault1.distribute(for_pioneer1);
        } else {
            // equal
            uint256 to_mint = ampl_token.balanceOf(address(this)).div(new_supply < last_ampl_supply? EEFI_NEGATIVE_REBASE_RATE : EEFI_EQULIBRIUM_REBASE_RATE);
            eefi_token.mint(address(this), to_mint);
            eefi_token.increaseAllowance(address(rewards_eefi), to_mint);
            rewards_eefi.distribute(to_mint, address(this));
        }
        emit Rebase(last_ampl_supply, new_supply);
        last_ampl_supply = new_supply;
    }

    function claim() external {
        (uint256 eth, uint256 token) = getReward(msg.sender);
        rewards_eth.withdraw(eth);
        rewards_eefi.withdraw(token);
        emit Claimed(msg.sender, eth, token);
    }

        /**
        @dev Returns how much ETH and EEFI the user can withdraw currently
        @param account Address of the user to check reward for
        @return eth the amount of ETH the account will perceive if he unstakes now
        @return token the amount of tokens the account will perceive if he unstakes now
    */
    function getReward(address account) public view returns (uint256 eth, uint256 token) {
        eth = rewards_eth.getReward(account);
        token = rewards_eefi.getReward(account);
    }

    function _popDeposit() internal {
        for (uint i = 0; i < _deposits[msg.sender].length - 1; i++) {
            _deposits[msg.sender][0] = _deposits[msg.sender][i + 1];
        }
        delete _deposits[msg.sender][_deposits[msg.sender].length - 1];
        _deposits[msg.sender].pop();
    }
}