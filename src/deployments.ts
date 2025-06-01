/**
 * ESP Deployment Information and Utilities
 * 
 * Re-exports esp.deployments.ts with additional utility functions
 */
import { DataPointRegistry } from '../typechain-types/contracts/DataPointRegistry';
import { DataPointStorage } from '../typechain-types/contracts/DataPointStorage';
import { DataPointRegistry__factory } from '../typechain-types/factories/contracts/DataPointRegistry__factory';
import { DataPointStorage__factory } from '../typechain-types/factories/contracts/DataPointStorage__factory';
import { Provider } from 'ethers';

export { espDeployments, default } from '../esp.deployments';
export type { 
  DataPointRegistry, 
  DataPointStorage,
  DataPointRegistry__factory,
  DataPointStorage__factory
} from './types';

// Utility functions for working with deployments
export function getContractAddress(chainId: number, contract: 'dps' | 'dpr') {
  const deployments = require('../esp.deployments').espDeployments;
  return deployments.chains[chainId]?.[contract]?.contractAddress;
}

export function getDeploymentInfo(chainId: number, contract: 'dps' | 'dpr') {
  const deployments = require('../esp.deployments').espDeployments;
  return deployments.chains[chainId]?.[contract];
}

export function getSupportedChainIds() {
  const deployments = require('../esp.deployments').espDeployments;
  return Object.keys(deployments.chains).map(Number);
} 

export function loadContract(chainId: number, contract: 'dps' | 'dpr', provider: Provider | null = null) : undefined | DataPointStorage | DataPointRegistry {
  const contractAddress = getContractAddress(chainId, contract);

  if (!contractAddress) {
    throw new Error(`Contract address not found for chainId: ${chainId} and contract: ${contract}`);
  }

  let contractInstance = undefined;
  if (contract === 'dps') {
    contractInstance = DataPointRegistry__factory.connect(contractAddress, provider);
  } else {
    contractInstance = DataPointStorage__factory.connect(contractAddress, provider);
  }

  return contractInstance;
}