# Elastic Protocol Vault contracts

## AMPLRebaser.sol

Fetches data from AMPL to feed the contracts inheriting from it the AMPL rebase pool changes. 

## DepositsLinkedList.sol

Manages AMPL deposit and withdrawal accounting. 

## Distribute.sol

Handle OHM and EEFI reward pools and their computation.

## EEFIToken.sol

Erc20 token contract. Note: EEFI can be minted and burned by Treasury multisig/ and authorized contracts. 

## ElasticVault.sol

The main Elastic Vault which enables users to stake AMPL and earn rewards in EEFI and OHM.

The vault's operations are powered by tokens deposited into it that have three distinct rebase phases: positive, negative and neutral (equilibrium).  

The Elastic Vault currently accepts AMPL deposits, so its operations are described in the context of this token. Additional vaults can be launched featuring rebasing tokens with similar mechanics. 

During Negative Rebases: The vault mints EEFI (based on how much AMPL is deposited into the vault) and distributes it to AMPL stakers and OHM/EEFI LP providers. 

During Neutral Rebases/Equilibrium: The vault mints EEFI (based on how much AMPL is deposited into the vault); the mint amount is higher than what occurs during negative rebases. EEFI is distributed as outlined above. 

During positive rebases, a percentage of the new AMPL supply is automatically sold for OHM and EEFI. 90% of purchased EEFI is burned. OHM purchaed is distributed to stakers and vaults.  

The rebase function is called after each AMPL rebase, which either mints new EEFI (and distributes it) or deposits a portion of newly generated AMPL into TokenStorage. The rebase function can be called by any address. Rebase callers receive a small EEFI reward as compensation for performing this service. 

AMPL deposited into the TokenStorage is used to buy and burn EEFI as well as purchase OHM for distribution to stakers. 

The contract inherits from AMPLRebaser which adds the rebase public function and tracks the supply changes in AMPL to compute the percentage of currently owed AMPL tokens by the contract that is coming from AMPL rebase cycles.

The Elastic Vault contract creates the EEFI token used in rewards. EEFI is only minted by the contract during neutral/negative AMPL rebase cycles. 

## StakingDoubleERC20.sol

This is an erc20 staking vault that also manages distribution of token and OHM rewards to users.

## Trader.sol

Used to manage selling of AMPL for OHM and EEFI.

## Wrapper.sol 

Helper contract that wraps AMPL deposited into Elastic Vault into non-rebasing user shares. Inspired by wAMPL implementation: https://github.com/ampleforth/ampleforth-contracts/blob/master/contracts/waampl.sol. 

## How to use

- installing: yarn
- tests and gas analysis: yarn test
- compile contracts: yarn build
- coverage: yarn coverage
- deploying on a local mainnet fork: yarn deploy-fork
