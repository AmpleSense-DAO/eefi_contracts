// SPDX-License-Identifier: NONE
pragma solidity 0.7.6;
pragma abicoder v2;

import "@balancer-labs/v2-solidity-utils/contracts/openzeppelin/IERC20.sol";
import "@balancer-labs/v2-solidity-utils/contracts/openzeppelin/SafeERC20.sol";
import '@balancer-labs/v2-solidity-utils/contracts/math/Math.sol';
import '@balancer-labs/v2-solidity-utils/contracts/openzeppelin/Ownable.sol';

/* ========== Interfaces ========== */

interface IEEFIToken is IERC20 {
    function mint(address to, uint256 amount) external;
    function burn(uint256 amount) external;
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

contract TokenUpgrader is Ownable {
    using SafeERC20 for IEEFIToken;
    using Math for uint256;

    /* ========== Constants, Mappings and Events ========== */

    //Constants
    IEEFIToken public constant oldEEFI =
        IEEFIToken(0x4cFc3f4095D19b84603C11FD8A2F0154e9036a98);
    IVestingExecutor public constant vesting =
        IVestingExecutor(0xcaf5b5D268032a41cAF34d9280A1857E3394Ba47);

    IEEFIToken public newEEFI;
    uint256 public immutable vestingDeadline;

    //Mappings
    mapping(address => uint256) upgradedUserTokens;
    mapping(address => bool) public excludedAddresses;

    //Events
    event TokenUpgrade(address indexed user, uint256 amount);

    //Constructor
    constructor(IEEFIToken new_eefi, uint256 _vestingDeadline) {
        require(
            address(new_eefi) != address(0),
            "TokenUpgrader: Invalid eefi token address"
        );
        newEEFI = new_eefi;
        vestingDeadline = _vestingDeadline;
    }

    /* ========== Excluded Address Management ========== */

    function excludeAddress(address _address, bool exclude) public onlyOwner {
        excludedAddresses[_address] = exclude;
    }

    function removeAddressFromExclude(address _address) public onlyOwner {
        excludedAddresses[_address] = false;
    }

    /* ========== Upgrade Functions ========== */

    /** @dev This function performs an upgrade of all old tokens claimed from vesting
             It can be called as much as needed (for example once for each round) or a single time
             once all tokens from round 1 and round 2 have been claimed by the user
        @notice Not marked as non-rentrant as all code of external contracts is known
    */
    function upgrade() external {
        // Retrieve vesting schedules and token claim data
        ScheduleInfo[] memory infos = vesting.retrieveScheduleInfo(msg.sender);

        //Require sender is not on excluded addresses list
        require(
            excludedAddresses[msg.sender] == false,
            "TokenUpgrader: Address is not authorized to upgrade"
        );

        uint256 validClaimableAmount = 0;
        for(uint i = 0; i < infos.length; i++) {
            ScheduleInfo memory info = infos[i];
            require(info.asset == address(oldEEFI)); //Make sure asset being swapped is old EEFI
            // Filter out Round 3 vesting activity
            if(infos[i].startTime <= vestingDeadline) {
                // Count as upgradable only tokens claimed from Vesting contract
                validClaimableAmount = validClaimableAmount.add(info.claimedAmount);
            }
        }

        require(
            validClaimableAmount > 0,
            "TokenUpgrader: No tokens to upgrade, have you claimed the old tokens from vesting?"
        );
        
        // Subtract tokens that user already upgraded to prevent user from claiming more tokens than owed
        uint256 toUpgrade = validClaimableAmount.sub(
            upgradedUserTokens[msg.sender]
        );

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

        // TokenUpgrader must have burn rights on old EEFI token
        oldEEFI.burn(toUpgrade);

        // TokenUpgrader must have minting rights on the new EEFI token
        newEEFI.mint(msg.sender, toUpgrade);

        emit TokenUpgrade(msg.sender, toUpgrade);
    }
}
