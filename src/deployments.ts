/**
 * ESP Deployment Information and Utilities
 * 
 * Re-exports esp.deployments.ts with additional utility functions
 */

export { espDeployments, default } from '../esp.deployments';
export type { 
  DataPointRegistry, 
  DataPointStorage,
  DataPointRegistry__factory,
  DataPointStorage__factory
} from './types';

// Utility functions for working with deployments
export function getContractAddress(network: string, contract: 'dps' | 'dpr') {
  const deployments = require('../esp.deployments').espDeployments;
  return deployments.networks[network]?.[contract]?.contractAddress;
}

export function getDeploymentInfo(network: string, contract: 'dps' | 'dpr') {
  const deployments = require('../esp.deployments').espDeployments;
  return deployments.networks[network]?.[contract];
}

export function getSupportedNetworks() {
  const deployments = require('../esp.deployments').espDeployments;
  return Object.keys(deployments.networks);
} 