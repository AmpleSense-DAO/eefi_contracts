# Amplesense Vault contracts

## AmplesenseVault.sol
The main amplesense vault allowing users to stake AMPL and earn rewards in EEFI and ETH.

The value is generated during positive and negative rebases. Negative rebases grand a small EEFI bonus, while positive rebases are used to sell the excess AMPL of the contract for ETH and EEFI. It is then distributed among the other vaults.

Staking in the contract also grants a small portion of EEFI tokens.

The rebase function is to be called after each AMPL rebase.

The contract inherits from AMPLRebaser which adds the rebase public function and tracks the supply changes in AMPL to compute the percentage of currently owed AMPL tokens by the contract that is coming from AMPL rebase cycles.

The contract creates the EEFI token used in rewards.

We use Distribute contract to handle ETH and EEFI rewards pools and their computation.

## EEFIToken.sol

This is a simple erc20 token contract

## Pioneer1Vault.sol

This contract allows users to stake the already deployed NFT ANFT and ZNFT tokens to earn ETH coming from excess AMPL from the main vault.

It inherits from StakingERC721 to grant NFT staking capabilities and computing rewards, as well as from AMPLRebaser to add a rebase function selling the AMPL for ETH.

## StakingERC20.sol

This is an erc20 staking vault distributing token and eth rewards to users.

## StakingERC721.sol

This is an erc721 staking vault distributing eth rewards to users.

## AMPLRebaser.sol

Fetches data from AMPL to feed the contracts inheriting from it the AMPL rebase pool changes.

## MockTrader.sol

Used for executing tests locally it emulates selling of AMPL for ETH and EEFI.

## How to use

- installing: yarn
- tests and gas analysis: yarn test
- compile contracts: yarn build
- coverage: yarn coverage
- deploying on a local mainnet fork: yarn deploy-fork