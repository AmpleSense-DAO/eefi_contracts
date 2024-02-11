// SPDX-License-Identifier: NONE
pragma solidity 0.7.6;

import '@balancer-labs/v2-solidity-utils/contracts/openzeppelin/AccessControl.sol';
import '@balancer-labs/v2-solidity-utils/contracts/openzeppelin/ERC20Burnable.sol';

//Note: Only authorized minters have permission to mint or burn EEFI 

contract EEFIToken is ERC20Burnable, AccessControl {

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    constructor() 
    ERC20("Elastic Finance Token", "EEFI") {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function mint(address account, uint256 amount) public {
        require(hasRole(MINTER_ROLE, msg.sender), "EEFIToken: must have minter role to mint");
        _mint(account, amount);
    }
}
