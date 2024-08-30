// SPDX-License-Identifier: NONE
pragma solidity 0.7.6;

import "@balancer-labs/v2-solidity-utils/contracts/openzeppelin/IERC20.sol";
import "./interfaces/UFragmentsPolicy.sol";

abstract contract AMPLRebaser {

    event Rebase(uint256 old_supply, uint256 new_supply);

    //
    // Check last AMPL total supply from AMPL contract.
    //
    uint256 public last_ampl_supply;

    uint256 public last_rebase_call;

    IERC20 immutable public ampl_token;

    UFragmentsPolicy immutable public policy = UFragmentsPolicy(0x1B228a749077b8e307C5856cE62Ef35d96Dca2ea);

    constructor(IERC20 _ampl_token) {
        require(address(_ampl_token) != address(0), "AMPLRebaser: Invalid AMPL token address");
        ampl_token = _ampl_token;
        last_ampl_supply = _ampl_token.totalSupply();
        last_rebase_call = UFragmentsPolicy(0x1B228a749077b8e307C5856cE62Ef35d96Dca2ea).lastRebaseTimestampSec();
    }

    function rebase() external {
        require(policy.lastRebaseTimestampSec() > last_rebase_call, "AMPLRebaser: Rebase not available yet");
        uint256 new_supply = ampl_token.totalSupply();
        last_rebase_call = block.timestamp;
        
        _rebase(new_supply);
        emit Rebase(last_ampl_supply, new_supply);
        last_ampl_supply = new_supply;
    }

    function _rebase(uint256 new_supply) internal virtual;

    modifier rebaseSynced() {
        require(last_ampl_supply == ampl_token.totalSupply(), "AMPLRebaser: Operation unavailable mid-rebase");
        _;
    }
}
