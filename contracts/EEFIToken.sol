// SPDX-License-Identifier: NONE
pragma solidity 0.7.6;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@balancer-labs/v2-solidity-utils/contracts/openzeppelin/ERC20Burnable.sol';

//Note: Only the Elastic Finance DAO vault contract (ElasticVault.sol) is authorized to mint or burn EEFI 

contract EEFIToken is ERC20Burnable, Ownable {
    constructor() 
    ERC20("Elastic Finance Token", "EEFI")
    Ownable() {
    }

    function mint(address account, uint256 amount) public onlyOwner {
        _mint(account, amount);
    }
}
