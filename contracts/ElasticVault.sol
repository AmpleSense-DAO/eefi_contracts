// SPDX-License-Identifier: NONE
pragma solidity 0.7.6;

// Contract requirements 
import './Distribute.sol';
import './interfaces/IStakingERC20.sol';
import './EEFIToken.sol';
import './AMPLRebaser.sol';
import './Wrapper.sol';
import './interfaces/IBalancerTrader.sol';

import '@balancer-labs/v2-solidity-utils/contracts/math/Math.sol';

contract ElasticVault is AMPLRebaser, Wrapper, Ownable {
    using SafeERC20 for IERC20;
    using Math for uint256;

    IStakingERC20 public pioneer_vault2;
    IStakingERC20 public pioneer_vault3;
    IStakingERC20 public staking_pool;
    IBalancerTrader public trader;
    EEFIToken public eefi_token;
    Distribute immutable public rewards_eefi;
    Distribute immutable public rewards_ohm;
    address payable treasury;
    uint256 public last_positive = block.timestamp;
    IERC20 public constant ohm_token = IERC20(0x64aa3364F17a4D01c6f1751Fd97C2BD3D7e7f1D5);
    
/* 

Parameter Definitions: //See updated parameters below

- EEFI Deposit Rate: Depositors receive reward of .0001 EEFI * Amount of AMPL user deposited into vault 
- EEFI Negative Rebase Rate: When AMPL supply declines mint EEFI at rate of .00001 EEFI * total AMPL deposited into vault 
- EEFI Equilibrium Rebase Rate: When AMPL supply is does not change (is at equilibrium) mint EEFI at a rate of .0001 EEFI * total AMPL deposited into vault 
- Deposit FEE_10000: .65% of EEFI minted to user upon initial deposit is delivered to Treasury 
- Lock Time: AMPL deposited into vault is locked for 90 days; lock time applies to each new AMPL deposit
- Trade Posiitve EEFI_100: Upon positive rebase 45% of new AMPL supply (based on total AMPL in vault) is sold and used to buy EEFI 
- Trade Positive OHM_100: Upon positive rebase 22% of the new AMPL supply (based on total AMPL in vault) is sold for OHM 
- Trade Positive Treasury_100: Upon positive rebase 2% of new AMPL supply (based on total AMPL in vault) is deposited into Pioneer Vault I (Zeus/Apollo NFT stakers) // Send 2% to Treasury [OK]
- Trade Positive Rewards_100: Upon positive rebase, send 55% of OHM rewards to users staking AMPL in vault 
- Trade Positive LP Staking_100: Upon positive rebase, send 30% of OHM rewards to users staking LP tokens (EEFI/OHM)
- Trade Neutral/Negative Rewards: Upon neutral/negative rebase, send 55% of EEFI rewards to users staking AMPL in vault
- Trade Neutral/Negative LP Staking: Upon neutral/negative rebase, send 35% of EEFI rewards to users staking LP tokens (EEFI/OHM)
- Minting Decay: If AMPL does not experience a positive rebase (increase in AMPL supply) for 45 days, do not mint EEFI, or distribute rewards to stakers 
- Initial MINT: Amount of EEFI that will be minted at contract deployment - 170,000 tokens 
- Treasury EEFI_100: Amount of EEFI distributed to DAO Treasury after EEFI buy and burn; 10% of purchased EEFI distributed to Treasury
*/

    uint256 constant public EEFI_DEPOSIT_RATE = 10000;
    uint256 constant public EEFI_NEGATIVE_REBASE_RATE = 100000;
    uint256 constant public EEFI_EQULIBRIUM_REBASE_RATE = 10000;
    uint256 constant public DEPOSIT_FEE_10000 = 65;
    uint256 constant public LOCK_TIME = 90 days;
    uint256 constant public TRADE_POSITIVE_EEFI_100 = 45;
    uint256 constant public TRADE_POSITIVE_OHM_100 = 22;
    uint256 constant public TRADE_POSITIVE_TREASURY_100 = 2;
    uint256 constant public TRADE_POSITIVE_REWARDS_100 = 55;
    uint256 constant public TRADE_NEUTRAL_NEG_REWARDS_100 = 55;
    uint256 constant public TRADE_POSITIVE_LPSTAKING_100 = 30; //Suggest creating 2 seperate sets of constants to account for positive and neutral/negative states (see comments below) [OK]
    uint256 constant public TRADE_NEUTRAL_NEG_LPSTAKING_100 = 35;
    uint256 constant public TREASURY_EEFI_100 = 10;
    uint256 constant public MINTING_DECAY = 45 days;
    uint256 constant public INITIAL_MINT = 170000 ether;

/* 
Event Definitions:

- Burn: EEFI burned (EEFI purchased using AMPL is burned)
- Claimed: Rewards claimed by address 
- Deposit: AMPL deposited by address 
- Withdrawal: AMPL withdrawn by address 
- StakeChanged: AMPL staked in contract; calculated as shares of total AMPL deposited 
*/

    event Burn(uint256 amount);
    event Claimed(address indexed account, uint256 ohm, uint256 eefi);
    event Deposit(address indexed account, uint256 amount, uint256 length);
    event Withdrawal(address indexed account, uint256 amount, uint256 length);
    event StakeChanged(uint256 total, uint256 timestamp);

    struct DepositChunk {
        uint256 amount;
        uint256 timestamp;
    }

    mapping(address => DepositChunk[]) private _deposits;
    
// Only contract can mint new EEFI, and distribute OHM and EEFI rewards     
    constructor(IERC20 ampl_token)
    AMPLRebaser(ampl_token)
    Wrapper(ampl_token)
    Ownable() {
        eefi_token = new EEFIToken();
        rewards_eefi = new Distribute(9, IERC20(eefi_token));
        rewards_ohm = new Distribute(9, IERC20(ohm_token));
    }

    receive() external payable { }

//Comments below outline how AMPL stake and withdrawable amounts are calculated

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

    /**
        @return total The total amount of AMPL claimable by a user
    */
    function totalClaimableBy(address account) public view returns (uint256 total) {
        if(rewards_eefi.totalStaked() == 0) return 0;
        for(uint i = 0; i < _deposits[account].length; i++) {
            if(_deposits[account][i].timestamp < block.timestamp.sub(LOCK_TIME)) {
                total += _deposits[account][i].amount;
            }
        }
        return _waampleToAmple(total);
    }

    /**
        @dev Current amount of AMPL owned by the user
        @param account Account to check the balance of
    */
    function balanceOf(address account) public view returns(uint256 ampl) {
        if(rewards_eefi.totalStaked() == 0) return 0;
        ampl = _waampleToAmple(rewards_eefi.totalStakedFor(account));
    }

    /**
        @dev Called only once by the owner; this function sets up the vaults
        @param _staking_pool Address of the LP staking pool (EEFI/OHM LP token staking pool)
        @param _treasury Address of the treasury (Address of Elastic Finance DAO Treasury)
    */
    function initialize(IStakingERC20 _staking_pool, address payable _treasury) external
    onlyOwner() 
    {
        require(address(treasury) == address(0), "ElasticVault: contract already initialized");
        staking_pool = _staking_pool;
        treasury = _treasury;
        eefi_token.mint(treasury, INITIAL_MINT);
    }

    /**
        @dev Contract owner can set and replace the contract used
        for trading AMPL, OHM and EEFI - Note: this is the only admin permission on the vault and is included to account for changes in future AMPL liqudity distribution and does not impact EEFI minting or provide access to user funds or rewards)
        @param _trader Address of the trader contract
    */
    function setTrader(IBalancerTrader _trader) external onlyOwner() {
        require(address(_trader) != address(0), "ElasticVault: invalid trader");
        trader = _trader;
    }

    /**
        @dev Deposits AMPL into the contract
        @param amount Amount of AMPL to take from the user
    */
    function makeDeposit(uint256 amount) external {
        ampl_token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 waampl = _ampleTowaample(amount);
        _deposits[msg.sender].push(DepositChunk(waampl, block.timestamp));

        uint256 to_mint = amount / EEFI_DEPOSIT_RATE * 10**9;
        uint256 deposit_fee = to_mint.mul(DEPOSIT_FEE_10000).divDown(10000);
        // send some EEFI to Treasury upon initial mint 
        if(last_positive + MINTING_DECAY > block.timestamp) { // if 45 days without positive rebase do not mint EEFI
            eefi_token.mint(treasury, deposit_fee);
            eefi_token.mint(msg.sender, to_mint.sub(deposit_fee));
        }
        
        // stake the shares also in the rewards pool
        rewards_eefi.stakeFor(msg.sender, waampl);
        rewards_ohm.stakeFor(msg.sender, waampl);
        emit Deposit(msg.sender, amount, _deposits[msg.sender].length);
        emit StakeChanged(rewards_ohm.totalStaked(), block.timestamp);
    }

    /**
        @dev Withdraw an amount of AMPL from vault 
        Shares are auto computed
        @param amount Amount of AMPL to withdraw
        @param minimal_expected_amount Minimal amount of AMPL to withdraw if a rebase occurs before the transaction processes
    */
    function withdrawAMPL(uint256 amount, uint256 minimal_expected_amount) external {
        require(minimal_expected_amount > 0, "ElasticVault: Minimal expected amount must be higher than zero");
        require(minimal_expected_amount <= amount, "ElasticVault: Minimal expected amount must be lower or equal to amount");
        uint256 total_staked_user = rewards_eefi.totalStakedFor(msg.sender);
        uint256 total_staked_user_ampl = _waampleToAmple(total_staked_user);
        require(amount <= total_staked_user_ampl, "ElasticVault: Insufficient AMPL balance");
        // compute the amount of waampl that we need to unstake to get the amount of AMPL
        uint256 share_waampl = amount.mul(10**9).divDown(total_staked_user_ampl).mul(total_staked_user).divDown(10**9);
        // compute the minimal amount of waampl to unstake to reach minimal expected amount
        uint256 minimal_shares_waampl = _ampleTowaample(minimal_expected_amount);
        uint256 to_withdraw = share_waampl;
        // make sure the assets aren't time locked
        while(to_withdraw > 0) {
            // either liquidate the deposit, or reduce it
            DepositChunk storage deposit = _deposits[msg.sender][0];
            if(deposit.timestamp > block.timestamp.sub(LOCK_TIME)) {
                //we used all withdrawable chunks
                //if we havent reached the minimal_shares_waampl, we throw an error
                require(to_withdraw <= share_waampl.sub(minimal_shares_waampl), "ElasticVault: No unlocked deposits found");
                break; // exit the loop
            }
            if(deposit.amount > to_withdraw) {
                deposit.amount = deposit.amount.sub(to_withdraw);
                to_withdraw = 0;
            } else {
                to_withdraw = to_withdraw.sub(deposit.amount);
                _popDeposit();
            }
        }
        // compute the final amount of shares that we managed to withdraw
        uint256 amount_shares_withdrawn = share_waampl.sub(to_withdraw);
        // compute the current ampl count representing user shares
        uint256 ampl_amount = _waampleToAmple(amount_shares_withdrawn);
        ampl_token.safeTransfer(msg.sender, ampl_amount);
        
        // unstake the shares also from the rewards pool
        rewards_eefi.unstakeFrom(msg.sender, amount_shares_withdrawn);
        rewards_ohm.unstakeFrom(msg.sender, amount_shares_withdrawn);
        emit Withdrawal(msg.sender, ampl_amount,_deposits[msg.sender].length);
        emit StakeChanged(rewards_ohm.totalStaked(), block.timestamp);
    }

    /**
        @dev Withdraw an amount of shares
        @param amount Amount of shares to withdraw
        !!! This isnt the amount of AMPL the user will get as we are using wrapped ampl to represent shares
    */
    function withdraw(uint256 amount) public {
        uint256 total_staked_user = rewards_eefi.totalStakedFor(msg.sender);
        require(amount <= total_staked_user, "ElasticVault: Not enough balance");
        uint256 to_withdraw = amount;
        // make sure the assets aren't time locked - all AMPL deposits into are locked for 90 days and withdrawal request will fail if timestamp of deposit < 90 days
        while(to_withdraw > 0) {
            // either liquidate the deposit, or reduce it
            DepositChunk storage deposit = _deposits[msg.sender][0];
            require(deposit.timestamp < block.timestamp.sub(LOCK_TIME), "ElasticVault: No unlocked deposits found");
            if(deposit.amount > to_withdraw) {
                deposit.amount = deposit.amount.sub(to_withdraw);
                to_withdraw = 0;
            } else {
                to_withdraw = to_withdraw.sub(deposit.amount);
                _popDeposit();
            }
        }
        // compute the current ampl count representing user shares
        uint256 ampl_amount = _waampleToAmple(amount);
        ampl_token.safeTransfer(msg.sender, ampl_amount);
        
        // unstake the shares also from the rewards pool
        rewards_eefi.unstakeFrom(msg.sender, amount);
        rewards_ohm.unstakeFrom(msg.sender, amount);
        emit Withdrawal(msg.sender, ampl_amount,_deposits[msg.sender].length);
        emit StakeChanged(rewards_ohm.totalStaked(), block.timestamp);
    }
//Functions called depending on AMPL rebase status
    function _rebase(uint256 old_supply, uint256 new_supply, uint256 minimalExpectedEEFI, uint256 minimalExpectedOHM) internal override {
        uint256 new_balance = ampl_token.balanceOf(address(this));

        if(new_supply > old_supply) {
            // This is a positive AMPL rebase and initates trading and distribuition of AMPL according to parameters (see parameters definitions)
            last_positive = block.timestamp;
            require(address(trader) != address(0), "ElasticVault: trader not set");

            uint256 changeRatio18Digits = old_supply.mul(10**18).divDown(new_supply);
            uint256 surplus = new_balance.sub(new_balance.mul(changeRatio18Digits).divDown(10**18));

            uint256 for_eefi = surplus.mul(TRADE_POSITIVE_EEFI_100).divDown(100);
            uint256 for_ohm = surplus.mul(TRADE_POSITIVE_OHM_100).divDown(100);
            uint256 for_treasury = surplus.mul(TRADE_POSITIVE_TREASURY_100).divDown(100);

            // use rebased AMPL to buy and burn eefi
            
            ampl_token.approve(address(trader), for_eefi.add(for_ohm));

            trader.sellAMPLForEEFI(for_eefi, minimalExpectedEEFI);

           // 10% of purchased EEFI is sent to the DAO Treasury. The remaining 90% is burned. 
            uint256 balance = eefi_token.balanceOf(address(this));
            IERC20(address(eefi_token)).safeTransfer(treasury, balance.mul(TREASURY_EEFI_100).divDown(100));
            uint256 to_burn = eefi_token.balanceOf(address(this));
            eefi_token.burn(to_burn);
            emit Burn(to_burn);
            // buy ohm and distribute to vaults
            trader.sellAMPLForOHM(for_ohm, minimalExpectedOHM);
            
            uint256 to_rewards = ohm_token.balanceOf(address(this)).mul(TRADE_POSITIVE_REWARDS_100).divDown(100);
            uint256 to_lp_staking = ohm_token.balanceOf(address(this)).mul(TRADE_POSITIVE_LPSTAKING_100).divDown(100);
            ohm_token.approve(address(rewards_ohm), to_rewards);
            rewards_ohm.distribute(to_rewards, address(this));
            ohm_token.approve(address(staking_pool), to_lp_staking);
            staking_pool.distribute(to_lp_staking);

            ampl_token.safeTransfer(treasury, for_treasury);

            // distribute the remainder of OHM (10%) to the DAO treasury
            ohm_token.safeTransfer(treasury, ohm_token.balanceOf(address(this)));
        } else {
            // If AMPL supply is negative (lower) or equal (at eqilibrium/neutral), distribute EEFI rewards as follows; only if the minting_decay condition is not triggered
            if(last_positive + MINTING_DECAY > block.timestamp) { //if 45 days without positive rebase do not mint
                uint256 to_mint = new_balance.divDown(new_supply < last_ampl_supply ? EEFI_NEGATIVE_REBASE_RATE : EEFI_EQULIBRIUM_REBASE_RATE) * 10**9; /*multiplying by 10^9 because EEFI is 18 digits and not 9*/
                eefi_token.mint(address(this), to_mint);

                /* 
                EEFI Reward Distribution Overview: 

                - TRADE_Neutral_Neg_Rewards_100: Upon neutral/negative rebase, send 55% of EEFI rewards to users staking AMPL in vault 
                - Trade_Neutral_Neg_LPStaking_100: Upon neutral/negative rebase, send 35% of EEFI rewards to uses staking LP tokens (EEFI/OHM)  
                */


                uint256 to_rewards = to_mint.mul(TRADE_NEUTRAL_NEG_REWARDS_100).divDown(100);
                uint256 to_lp_staking = to_mint.mul(TRADE_NEUTRAL_NEG_LPSTAKING_100).divDown(100);

                eefi_token.approve(address(rewards_eefi), to_rewards);
                eefi_token.approve(address(staking_pool.staking_contract_token()), to_lp_staking); 

                rewards_eefi.distribute(to_rewards, address(this));
                staking_pool.distribute(to_lp_staking); 

                // distribute the remainder (10%) of EEFI to the treasury
                IERC20(eefi_token).safeTransfer(treasury, eefi_token.balanceOf(address(this)));
            }
        }
    }

    function claim() external { 
        (uint256 ohm, uint256 eefi) = getReward(msg.sender);
        rewards_ohm.withdrawFrom(msg.sender, rewards_ohm.totalStakedFor(msg.sender));
        rewards_eefi.withdrawFrom(msg.sender, rewards_eefi.totalStakedFor(msg.sender));
        emit Claimed(msg.sender, ohm, eefi);
    }

    /**
        @dev Returns how much OHM and EEFI the user can withdraw currently
        @param account Address of the user to check reward for
        @return ohm the amount of OHM the account will perceive if he unstakes now
        @return eefi the amount of tokens the account will perceive if he unstakes now
    */
    function getReward(address account) public view returns (uint256 ohm, uint256 eefi) { 
        ohm = rewards_ohm.getReward(account); 
        eefi = rewards_eefi.getReward(account);
    }

    /**
        @return current total amount of stakes
    */
    function totalStaked() external view returns (uint256) {
        return rewards_eefi.totalStaked();
    }

    /**
        @dev returns the total rewards stored for eefi and ohm
    */
    function totalReward() external view returns (uint256 ohm, uint256 eefi) {
        ohm = rewards_ohm.getTotalReward(); 
        eefi = rewards_eefi.getTotalReward();
    }

    function _popDeposit() internal {
        for (uint i = 0; i < _deposits[msg.sender].length - 1; i++) {
            _deposits[msg.sender][i] = _deposits[msg.sender][i + 1];
        }
        _deposits[msg.sender].pop();
    }
}
