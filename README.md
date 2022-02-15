# Amplesense Vault contracts

## AmplesenseVault.sol
The main amplesense vault allowing users to stake AMPL and earn rewards in EEFI and ETH.

The value is generated during every phase of the AMPL rebase cycle: positive, negative and neutral (equilibrium) rebases. 

During Negative Rebases: The vault mints EEFI (based on how much AMPL is deposited into the vault) and distributes it to AMPL stakers and other vaults (EEFI/ETH LP providers, kMPL holders and kMPL/ETH liquidity providers)

During Neutral Rebases/Equilibrium: The vault mints EEFI (based on how much AMPL is deposited into the vault); the mint amount is higher than what occurs during negative rebaers. EEFI is distributed as outlined above. 

During positive rebases, 68% of the new AMPL supply is sold for ETH and EEFI. 90% of purchased EEFI is burned. ETH purchaed is distributed to stakers and vaults (as outlined above).  

The rebase function is called after each AMPL rebase, which either mints new EEFI (and distributes it) or buys and burns EEFI, and purchaes ETH for distribution to stakers. 

The contract inherits from AMPLRebaser which adds the rebase public function and tracks the supply changes in AMPL to compute the percentage of currently owed AMPL tokens by the contract that is coming from AMPL rebase cycles.

The contract creates the EEFI token used in rewards. It is the only contract authorized to mint EEFI. 

We use the Distribute contract to handle ETH and EEFI rewards pools and their computation.

## EEFIToken.sol

This is a simple erc20 token contract. Note that the token can be minted and burned. The AmplesenseVault.sol token is the only authorized minter and burner of EEFI. 

## Pioneer1Vault.sol

This contract allows users to stake the already deployed NFT ANFT and ZNFT tokens (ERC 721) to earn ETH coming from excess AMPL from the main vault. (2% of newly created AMPL after every positive rebase.)

It inherits from StakingERC721 to grant NFT staking capabilities and computing rewards, as well as from AMPLRebaser to add a rebase function selling the AMPL for ETH.

The contract will only sell excess AMPL for ETH when the amount of AMPL in the contract exceeds 40,000 AMPL. The AmplesenseVault.sol contract deposits a small portion of new AMPL supply (2%) into the staking contract. Once deposited, AMPL cannot be removed from the vault. Additional AMPL can be added to the vault by third-party wallets. Stakers can remove their NFTs at any time. 

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
