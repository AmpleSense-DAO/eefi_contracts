// SPDX-License-Identifier: NONE
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;
import '@balancer-labs/balancer-core-v2/contracts/vault/Vault.sol';
import '@balancer-labs/balancer-core-v2/contracts/vault/Authorizer.sol';
import '@balancer-labs/balancer-core-v2/contracts/test/WETH.sol';
import '@balancer-labs/balancer-core-v2/contracts/pools/stable/StablePool.sol';

contract Pool is StablePool {
    constructor(
        IVault vault,
        string memory name,
        string memory symbol,
        IERC20[] memory tokens
    ) StablePool(vault, name, symbol, tokens, 1, 0, 10, 10, msg.sender) {
        
    }
}

contract FakeBalancer {

    constructor(IERC20 ampl, IERC20 usdc, IWETH weth) {
        Authorizer authorizer = new Authorizer(msg.sender);
        Vault vault = new Vault(IAuthorizer(authorizer), weth, 100, 100);
        // IERC20[] memory tokens = new IERC20[](2);
        // tokens[0] = ampl;
        // tokens[1] = usdc;
        // Pool ampl_usdc = new Pool(IVault(vault), "amplusdc", "amplusdc", tokens);
    }

}