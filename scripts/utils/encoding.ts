// taken from https://github.com/balancer-labs/balancer-v2-monorepo/blob/a3875bdf1c5afb57092caf4d36062d906dcc2513/pvt/helpers/src/models/pools/mockPool.ts

import { ethers } from 'ethers';
import { BigNumber } from 'ethers';

export type BigNumberish = string | number | BigNumber;

export const encodeJoin = (joinAmounts: BigNumberish[], dueProtocolFeeAmounts: BigNumberish[]): string =>
  encodeJoinExitMockPool(joinAmounts, dueProtocolFeeAmounts);

export const encodeExit = (exitAmounts: BigNumberish[], dueProtocolFeeAmounts: BigNumberish[]): string =>
  encodeJoinExitMockPool(exitAmounts, dueProtocolFeeAmounts);

function encodeJoinExitMockPool(amounts: BigNumberish[], dueProtocolFeeAmounts: BigNumberish[]): string {
  return ethers.utils.defaultAbiCoder.encode(['uint256[]', 'uint256[]'], [amounts, dueProtocolFeeAmounts]);
}