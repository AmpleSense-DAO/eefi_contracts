// SPDX-License-Identifier: NONE
pragma solidity 0.7.6;
pragma abicoder v2;

import "@balancer-labs/v2-solidity-utils/contracts/openzeppelin/IERC20.sol";
import "@balancer-labs/v2-solidity-utils/contracts/openzeppelin/SafeERC20.sol";
import '@balancer-labs/v2-solidity-utils/contracts/math/Math.sol';

interface IEEFIToken is IERC20 {
    function mint(address to, uint256 amount) external;
    function burn(uint256 amount) external;
}

struct ScheduleInfo {
        uint256 id;
        uint256 startTime;
        uint256 cliffTime;
        uint256 endTime;
        uint256 claimedAmount;
        uint256 totalAmount;
        address asset;
    }

interface IVestingExecutor {
    function retrieveScheduleInfo(
        address account
    ) external returns (ScheduleInfo[] memory);
}

contract TokenUpgrader {
    using SafeERC20 for IEEFIToken;
    using Math for uint256;

    IEEFIToken constant public oldEEFI = IEEFIToken(0x4cFc3f4095D19b84603C11FD8A2F0154e9036a98);
    IVestingExecutor constant public vesting = IVestingExecutor(0xcaf5b5D268032a41cAF34d9280A1857E3394Ba47);
    IEEFIToken public newEEFI;
    uint256 public immutable vestingDeadline;
    mapping(address => uint256) upgradedUserTokens;

    event TokenUpgrade(address indexed user, uint256 amount);

    constructor(IEEFIToken new_eefi, uint256 _vestingDeadline) {
        require(address(new_eefi) != address(0), "TokenUpgrader: Invalid eefi token address");
        newEEFI = new_eefi;
        vestingDeadline = _vestingDeadline;
    }

    /** @dev This function performs an upgrade of all old tokens claimed from vesting
             It can be called as much as needed (for example once for each round) or a single time
             once all tokens from round 1 and round 2 have been claimed by the user
        @notice could be marked as non reentrant but we know the code of all external contracts
    */
    function upgrade() external {
        // sum all tokens claimed from vesting prior to round 3
        uint256 upgradableBalance = 0;
        ScheduleInfo[] memory infos = vesting.retrieveScheduleInfo(msg.sender);
        //Need to add retrieveTokenClaimData(address) here because this stores how many tokens have been claimed to date
        
        for(uint i = 0; i < infos.length; i++) {
            ScheduleInfo memory info = infos[i];
            require(info.asset == address(oldEEFI)); // is this usefull?
            // filter out round 3
            if(infos[i].startTime <= vestingDeadline) {
                // count as upgradable only claimed tokens
                upgradableBalance = upgradableBalance.add(info.claimedAmount);
            }
        }

        require(upgradableBalance > 0, "TokenUpgrader: No tokens to upgrade, have you claimed the old tokens from vesting?");

        // subtract tokens that we already upgraded for this user, this prevents upgrading twice the same token
        uint256 toUpgrade = upgradableBalance.sub(upgradedUserTokens[msg.sender]);
        // updated the upgraded tokens count for this user
        upgradedUserTokens[msg.sender] += toUpgrade;

        require(toUpgrade > 0, "TokenUpgrader: All tokens have been upgraded");
        // check how much user has on his wallet as only tokens on his wallet can be upgraded
        uint256 balance = oldEEFI.balanceOf(msg.sender);
        require(toUpgrade <= balance, "TokenUpgrader: You must have the tokens to upgrade on your wallet");
        // take the old EEFI tokens from the user
        oldEEFI.safeTransferFrom(msg.sender, address(this), toUpgrade);
        oldEEFI.burn(toUpgrade);
        // this supposes TokenUpgrader has minting rights on the new EEFI token
        newEEFI.mint(msg.sender, toUpgrade);

        emit TokenUpgrade(msg.sender, toUpgrade);
    }
}
