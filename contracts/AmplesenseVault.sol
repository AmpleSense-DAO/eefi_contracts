// SPDX-License-Identifier: NONE
pragma solidity ^0.7.0;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@balancer-labs/balancer-core-v2/contracts/lib/openzeppelin/SafeERC20.sol';
import '@balancer-labs/balancer-core-v2/contracts/lib/openzeppelin/ERC20Burnable.sol';

import './Distribute.sol';
import './interfaces/IStakingERC20.sol';
import './EEFIToken.sol';
import './AMPLRebaser.sol';
import './interfaces/IBalancerTrader.sol';

contract AmplesenseVault is AMPLRebaser, Ownable {
    using SafeERC20 for IERC20;
    using Math for uint256;

    IStakingERC20 public pioneer_vault1;
    IStakingERC20 public pioneer_vault2;
    IStakingERC20 public pioneer_vault3;
    IStakingERC20 public staking_pool;
    IBalancerTrader public trader;
    EEFIToken public eefi_token;
    Distribute public rewards_eefi;
    Distribute public rewards_eth;
    address payable treasury;
    uint256 public last_positive = block.timestamp;

    uint256 constant public EEFI_DEPOSIT_RATE = 10000;
    uint256 constant public EEFI_NEGATIVE_REBASE_RATE = 100000;
    uint256 constant public EEFI_EQULIBRIUM_REBASE_RATE = 10000;
    uint256 constant public DEPOSIT_FEE_10000 = 65;
    uint256 constant public LOCK_TIME = 90 days;
    uint256 constant public TRADE_POSITIVE_EEFI_100 = 48;
    uint256 constant public TRADE_POSITIVE_ETH_100 = 20;
    uint256 constant public TRADE_POSITIVE_PIONEER1_100 = 2;
    uint256 constant public TRADE_POSITIVE_REWARDS_100 = 45;
    uint256 constant public TRADE_POSITIVE_PIONEER2_100 = 10;
    uint256 constant public TRADE_POSITIVE_PIONEER3_100 = 5;
    uint256 constant public TRADE_POSITIVE_LPSTAKING_100 = 35;
    uint256 constant public TREASURY_EEFI_100 = 10;
    uint256 constant public MINTING_DECAY = 90 days;

    event Burn(uint256 amount);
    event Claimed(address indexed account, uint256 eth, uint256 token);
    event Deposit(address indexed account, uint256 amount, uint256 length);
    event Withdrawal(address indexed account, uint256 amount, uint256 length);

    struct DepositChunk {
        uint256 amount;
        uint256 timestamp;
    }

    mapping(address => DepositChunk[]) private _deposits;
    // ONLY TEST
    function TESTMINT(uint256 amount, address who) external onlyOwner() {
        eefi_token.mint(who, amount);
    }
    
    constructor(IERC20 ampl_token)
    AMPLRebaser(ampl_token)
    Ownable() {
        eefi_token = new EEFIToken();
        rewards_eefi = new Distribute(9, IERC20(eefi_token));
        rewards_eth = new Distribute(9, IERC20(0));
    }

    receive() external payable { }

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

    function initialize(IStakingERC20 _pioneer_vault1, IStakingERC20 _pioneer_vault2, IStakingERC20 _pioneer_vault3, IStakingERC20 _staking_pool, address payable _treasury) external
    onlyOwner() 
    {
        require(address(pioneer_vault1) == address(0), "AmplesenseVault: contract already initialized");
        pioneer_vault1 = _pioneer_vault1;
        pioneer_vault2 = _pioneer_vault2;
        pioneer_vault3 = _pioneer_vault3;
        staking_pool = _staking_pool;
        treasury = _treasury;
    }

    function setTrader(IBalancerTrader _trader) external onlyOwner() {
        require(address(_trader) != address(0), "AmplesenseVault: invalid trader");
        trader = _trader;
    }

    function balanceOf(address account) public view returns(uint256 ampl) {
        if(rewards_eefi.totalStaked() == 0) return 0;
        uint256 ampl_balance = _ampl_token.balanceOf(address(this));
        ampl = ampl_balance.mul(rewards_eefi.totalStakedFor(account)).divDown(rewards_eefi.totalStaked());
    }

    function makeDeposit(uint256 amount) external {
        depositFor(msg.sender, amount);
    }

    function depositFor(address account, uint256 amount) public {
        _ampl_token.safeTransferFrom(msg.sender, address(this), amount);
        _deposits[account].push(DepositChunk(amount, block.timestamp));

        uint256 to_mint = amount / EEFI_DEPOSIT_RATE;
        uint256 deposit_fee = to_mint.mul(DEPOSIT_FEE_10000).divDown(10000);
        //send some eefi to pioneer vault 2
        if(last_positive + MINTING_DECAY > block.timestamp) { //if 60 days without positive rebase do not mint
            eefi_token.mint(address(this), deposit_fee);
            eefi_token.increaseAllowance(pioneer_vault2.staking_contract_token(), deposit_fee);
            pioneer_vault2.distribute(deposit_fee);
            eefi_token.mint(msg.sender, to_mint.sub(deposit_fee));
        }
        
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
        uint256 ampl_amount = _ampl_token.balanceOf(address(this)).mul(amount).divDown(rewards_eefi.totalStaked());
        _ampl_token.safeTransfer(msg.sender, ampl_amount);
        
        // unstake the shares also from the rewards pool
        rewards_eefi.unstakeFrom(msg.sender, amount);
        rewards_eth.unstakeFrom(msg.sender, amount);
        emit Withdrawal(msg.sender, ampl_amount,_deposits[msg.sender].length);
    }

    function _rebase(uint256 old_supply, uint256 new_supply) internal override {
        uint256 new_balance = _ampl_token.balanceOf(address(this));
        
        if(new_supply > old_supply) {
            // positive rebase
            last_positive = block.timestamp;
            require(address(trader) != address(0), "AmplesenseVault: trader not set");

            uint256 surplus = new_supply.sub(old_supply).mul(new_balance).divDown(new_supply);
            uint256 percent = surplus.divDown(100);
            uint256 for_eefi = percent.mul(TRADE_POSITIVE_EEFI_100);
            uint256 for_eth = percent.mul(TRADE_POSITIVE_ETH_100);
            uint256 for_pioneer1 = percent.mul(TRADE_POSITIVE_PIONEER1_100);

            // 30% ampl remains
            // buy and burn eefi
            _ampl_token.safeTransfer(address(trader), for_eefi.add(for_eth));
            trader.sellAMPLForEEFI(for_eefi);
            uint256 balance = eefi_token.balanceOf(address(this));
            IERC20(address(eefi_token)).safeTransfer(treasury, balance.mul(TREASURY_EEFI_100).divDown(100));
            uint256 to_burn = eefi_token.balanceOf(address(this));
            eefi_token.burn(address(this), to_burn);
            emit Burn(to_burn);
            // buy eth and distribute
            trader.sellAMPLForEth(for_eth);
            percent = address(this).balance.divDown(100);
            uint256 to_rewards = percent.mul(TRADE_POSITIVE_REWARDS_100);
            uint256 to_pioneer2 = percent.mul(TRADE_POSITIVE_PIONEER2_100);
            uint256 to_pioneer3 = percent.mul(TRADE_POSITIVE_PIONEER3_100);
            uint256 to_lp_staking = percent.mul(TRADE_POSITIVE_LPSTAKING_100);
            rewards_eth.distribute{value: to_rewards}(to_rewards, address(this));
            pioneer_vault2.distribute_eth{value: to_pioneer2}();
            pioneer_vault3.distribute_eth{value: to_pioneer3}();
            staking_pool.distribute_eth{value: to_lp_staking}();

            // distribute ampl to pioneer 1
            _ampl_token.approve(address(pioneer_vault1), for_pioneer1);
            pioneer_vault1.distribute(for_pioneer1);

            // distribute the remainder (5%) to the treasury
            treasury.transfer(address(this).balance);
        } else {
            // negative or equal
            if(last_positive + MINTING_DECAY > block.timestamp) { //if 60 days without positive rebase do not mint
                uint256 to_mint = new_balance.divDown(new_supply < last_ampl_supply ? EEFI_NEGATIVE_REBASE_RATE : EEFI_EQULIBRIUM_REBASE_RATE);
                eefi_token.mint(address(this), to_mint);
                eefi_token.increaseAllowance(address(rewards_eefi), to_mint);
                rewards_eefi.distribute(to_mint, address(this));
            }
        }
    }

    function claim() external {
        (uint256 eth, uint256 token) = getReward(msg.sender);
        rewards_eth.withdrawFrom(msg.sender, eth);
        rewards_eefi.withdrawFrom(msg.sender, token);
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

    /**
        @return current staked
    */
    function totalStaked() external view returns (uint256) {
        return rewards_eth.totalStaked();
    }

    /**
        @dev returns the total rewards stored for token and eth
    */
    function totalReward() external view returns (uint256 token, uint256 eth) {
        token = rewards_eefi.getTotalReward();
        eth = rewards_eth.getTotalReward();
    }

    function _popDeposit() internal {
        for (uint i = 0; i < _deposits[msg.sender].length - 1; i++) {
            _deposits[msg.sender][i] = _deposits[msg.sender][i + 1];
        }
        _deposits[msg.sender].pop();
    }
}
