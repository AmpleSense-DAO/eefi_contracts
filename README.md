# Elastic Protocol Vault contracts

## ElasticVault.sol
The main Elastic Vault which enables users to stake AMPL and earn rewards in EEFI and OHM.

The vault's operations are powered by tokens deposited into it that have three distinct rebase phases: positive, negative and neutral (equilibrium).  

The Elastic Vault currently accepts AMPL deposits, so its operations are described in the context of this token. Additional vaults can be launched featuring rebasing tokens with similar mechanics. 

During Negative Rebases: The vault mints EEFI (based on how much AMPL is deposited into the vault) and distributes it to AMPL stakers and OHM/EEFI LP providers. 

During Neutral Rebases/Equilibrium: The vault mints EEFI (based on how much AMPL is deposited into the vault); the mint amount is higher than what occurs during negative rebases. EEFI is distributed as outlined above. 

During positive rebases, a percentage of the new AMPL supply is automatically sold for OHM and EEFI. 90% of purchased EEFI is burned. OHM purchaed is distributed to stakers and vaults.  

The rebase function is called after each AMPL rebase, which either mints new EEFI (and distributes it) or buys and burns EEFI, and purchases OHM for distribution to stakers. 

The contract inherits from AMPLRebaser which adds the rebase public function and tracks the supply changes in AMPL to compute the percentage of currently owed AMPL tokens by the contract that is coming from AMPL rebase cycles.

The Elastic Vault contract creates the EEFI token used in rewards. EEFI is only minted during neutral/negative AMPL rebase cycles. 

We use the Distribute contract to handle OHM and EEFI rewards pools and their computation.

## EEFIToken.sol

This is a simple erc20 token contract. Note that the token can be minted and burned by authorized wallets/contracts. 

## StakingERC20.sol

This is an erc20 staking vault distributing token and OHM rewards to users.

## AMPLRebaser.sol

Fetches data from AMPL to feed the contracts inheriting from it the AMPL rebase pool changes. 

## MockTrader.sol

Used for executing tests locally it emulates selling of AMPL for OHM and EEFI.

## How to use

- installing: yarn
- tests and gas analysis: yarn test
- compile contracts: yarn build
- coverage: yarn coverage
- deploying on a local mainnet fork: yarn deploy-fork
