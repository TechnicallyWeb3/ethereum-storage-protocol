/**
 * ESP Contract Utilities
 * 
 * Provides contract ABIs and deployment utilities for ESP contracts
 */

import { 
  DataPointRegistry__factory,
  DataPointStorage__factory,
  IDataPointRegistry__factory,
  IDataPointStorage__factory 
} from '../types';

// Contract ABIs
export const DataPointRegistryABI = DataPointRegistry__factory.abi;
export const DataPointStorageABI = DataPointStorage__factory.abi;
export const IDataPointRegistryABI = IDataPointRegistry__factory.abi;
export const IDataPointStorageABI = IDataPointStorage__factory.abi;

// Contract Factories (for deployment and connection)
export {
  DataPointRegistry__factory,
  DataPointStorage__factory,
  IDataPointRegistry__factory,
  IDataPointStorage__factory
} from '../types';

// Contract Interfaces
export type {
  DataPointRegistry,
  DataPointStorage,
  IDataPointRegistry,
  IDataPointStorage
} from '../types';

// Helper function to get contract factory by name
export function getContractFactory(contractName: string) {
  switch (contractName) {
    case 'DataPointRegistry':
      return DataPointRegistry__factory;
    case 'DataPointStorage':
      return DataPointStorage__factory;
    case 'IDataPointRegistry':
      return IDataPointRegistry__factory;
    case 'IDataPointStorage':
      return IDataPointStorage__factory;
    default:
      throw new Error(`Unknown contract: ${contractName}`);
  }
}

// Contract names enum for type safety
export enum ContractNames {
  DataPointRegistry = 'DataPointRegistry',
  DataPointStorage = 'DataPointStorage',
  IDataPointRegistry = 'IDataPointRegistry',
  IDataPointStorage = 'IDataPointStorage'
} 