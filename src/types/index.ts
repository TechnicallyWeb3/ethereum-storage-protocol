/**
 * ESP-specific TypeChain Types
 * 
 * Only includes types for ESP contracts, excluding OpenZeppelin and test contracts
 */

// Core ESP contract types
export type { DataPointRegistry } from '../../typechain-types/contracts/DataPointRegistry';
export { DataPointRegistry__factory } from '../../typechain-types/factories/contracts/DataPointRegistry__factory';

export type { DataPointStorage } from '../../typechain-types/contracts/DataPointStorage';
export { DataPointStorage__factory } from '../../typechain-types/factories/contracts/DataPointStorage__factory';

// ESP interface types
export type { IDataPointRegistry } from '../../typechain-types/contracts/interfaces/IDataPointRegistry';
export { IDataPointRegistry__factory } from '../../typechain-types/factories/contracts/interfaces/IDataPointRegistry__factory';

export type { IDataPointStorage } from '../../typechain-types/contracts/interfaces/IDataPointStorage';
export { IDataPointStorage__factory } from '../../typechain-types/factories/contracts/interfaces/IDataPointStorage__factory';

// Common TypeChain utilities
export type {
  BaseOverrides,
  NonPayableOverrides,
  PayableOverrides,
  ViewOverrides,
  Overrides,
  TypedContractEvent,
  TypedEventLog,
  TypedListener,
  TypedContractMethod,
  MinEthersFactory,
  GetContractTypeFromFactory,
  GetARGsTypeFromFactory
} from '../../typechain-types/common';

// Re-export useful ethers types
export type {
  ContractTransaction,
  ContractTransactionResponse,
  BigNumberish,
  BytesLike,
  Signer,
  Provider
} from 'ethers'; 