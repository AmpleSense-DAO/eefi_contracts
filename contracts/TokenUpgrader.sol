// SPDX-License-Identifier: NONE
pragma solidity 0.8.4;

import 'openzeppelin5/token/ERC20/IERC20.sol';
import "openzeppelin5/token/ERC20/utils/SafeERC20.sol";
import 'openzeppelin5/access/Ownable.sol';
import 'openzeppelin5/security/ReentrancyGuard.sol';

/* ========== Interfaces ========== */

interface IEEFIToken is IERC20 {
    function mint(address to, uint256 amount) external;
}

interface IVestingExecutor {
    function retrieveScheduleInfo(
        address account
    ) external returns (ScheduleInfo[] memory);
}

/* ========== Structs ========== */

struct ScheduleInfo {
    uint256 id;
    uint256 startTime;
    uint256 cliffTime;
    uint256 endTime;
    uint256 claimedAmount;
    uint256 totalAmount;
    address asset;
}

/**
 * TokenUpgrader contract is used to upgrade old EEFI tokens to new EEFI tokens
 * To be elligible the old tokens must be claimed from the vesting contract and must have been vested before round 3
 * round 3 tokens are not upgradable.
 * Old eefi tokens are collected and stored in this contract and new eefi tokens are minted to the user
 * The upgrade function can be called several times to progressively upgrade the unlocked tokens
 * Some addresses will be locked out of the upgrade process as their owners reported them as hacked.
*/
contract TokenUpgrader is Ownable, ReentrancyGuard {
    using SafeERC20 for IEEFIToken;

    // Old EEFI token
    IEEFIToken public constant oldEEFI =
        IEEFIToken(0x4cFc3f4095D19b84603C11FD8A2F0154e9036a98);
    // New EEFI token
    IEEFIToken public newEEFI = 
        IEEFIToken(0x857FfC55B1Aa61A7fF847C82072790cAE73cd883);
    // Vesting contract with old EEFI vested
    IVestingExecutor public constant vesting =
        IVestingExecutor(0xcaf5b5D268032a41cAF34d9280A1857E3394Ba47);
    // Deadline corresponds to a few seconds before the start of round 3
    uint256 public constant VESTING_DEADLINE = 1707933723;

    // Keeps track of how many tokens have been upgraded by each user to prevent double claiming
    mapping(address => uint256) upgradedUserTokens;
    // List of addresses that are excluded from the upgrade process
    mapping(address => bool) public excludedAddresses;

    // Event emitted when a user upgrades their tokens
    event TokenUpgrade(address indexed user, uint256 amount);

    /* ========== Excluded Address Management ========== */

    /** @dev Exclude or include an address from the upgrade process
     * @param _address The address to exclude or include
     * @param exclude True to exclude the address, false to include it
     */
    function excludeAddress(address _address, bool exclude) public onlyOwner {
        excludedAddresses[_address] = exclude;
    }

    /* ========== Upgrade Functions ========== */

    /** @dev This function performs an upgrade of all old tokens claimed from vesting
             It can be called as much as needed (for example once for each round) or a single time
             once all tokens from round 1 and round 2 have been claimed by the user
    */
    function upgrade() external nonReentrant {
        //Require sender is not on excluded addresses list
        require(
            excludedAddresses[msg.sender] == false,
            "TokenUpgrader: Address is not authorized to upgrade"
        );

        // Retrieve vesting schedules and token claim data
        ScheduleInfo[] memory infos = vesting.retrieveScheduleInfo(msg.sender);

        // Calculate the total amount of tokens that can be upgraded based on the vesting schedules
        // and the amount of tokens claimed by the user from them.
        // Round 3 schedules are ignored
        uint256 validClaimableAmount = 0;
        for(uint i = 0; i < infos.length; i++) {
            ScheduleInfo memory info = infos[i];
            require(info.asset == address(oldEEFI)); // Make sure asset being swapped is old EEFI
            // Filter out Round 3 vesting activity
            if(infos[i].startTime <= VESTING_DEADLINE) {
                // Count as upgradable only tokens claimed from Vesting contract
                validClaimableAmount += info.claimedAmount;
            }
        }

        require(
            validClaimableAmount > 0,
            "TokenUpgrader: No tokens to upgrade, have you claimed the old tokens from vesting?"
        );
        
        // Subtract tokens that user already upgraded to prevent user from claiming more tokens than owed
        uint256 toUpgrade = validClaimableAmount - upgradedUserTokens[msg.sender];

        // Update the upgraded tokens count for this user
        upgradedUserTokens[msg.sender] += toUpgrade;

        require(toUpgrade > 0, "TokenUpgrader: All claimed tokens have already been upgraded");
        
        // Make sure user has oldEEFI in wallet
        uint256 balance = oldEEFI.balanceOf(msg.sender);
        require(
            toUpgrade <= balance,
            "TokenUpgrader: You must have the tokens to upgrade in your wallet"
        );

        // Remove old EEFI tokens from the user
        oldEEFI.safeTransferFrom(msg.sender, address(this), toUpgrade);

        // TokenUpgrader must have minting rights on the new EEFI token
        // toUpgrade can't be higher than the balance of old eefi from the user wallet
        // this means that the contract can't get tricked into minting more tokens than it should
        newEEFI.mint(msg.sender, toUpgrade);

        emit TokenUpgrade(msg.sender, toUpgrade);
    }
}
