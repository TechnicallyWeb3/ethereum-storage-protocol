/*
 * Ethereum Storage Protocol (ESP) - Contract Utilities
 * Copyright (C) 2025 TechnicallyWeb3
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 * 
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

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