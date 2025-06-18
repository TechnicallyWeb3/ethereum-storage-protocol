/**
 * Ethereum Storage Protocol (ESP) - Deployment Registry
 * 
 * This file tracks all ESP contract deployments across different networks.
 * Used for reference, integration, and deployment management.
 * 
 * @version 0.2.0
 * @license AGPL-3.0
 */

interface ContractDeployment {
  contractAddress: string;
  deployerAddress: string;
  txHash: string;
  deployedAt: string;
}

interface DPRDeployment extends ContractDeployment {
  constructors: {
    ownerAddress: string;
    dpsAddress: string;
    royaltyRate: string;
  };
}

interface ChainDeployment {
  dps: ContractDeployment;
  dpr: DPRDeployment;
}

interface ESPDeployments {
  chains: {
    [chainId: number]: ChainDeployment;
  };
}

/**
 * ESP Deployments - Simple Contract Registry
 * Tracks deployed contract addresses and deployment info across networks
 */
export const espDeployments: ESPDeployments = {
  chains: {
    11155111: {
      dps: {
        contractAddress: '0xDA7Adb41ac559e689fE170aE4f2853a450e6E4Cc',
        deployerAddress: '0x02040ee763D6d849515cE194bDa93d12bf3c45d0',
        txHash: 'TBD',
        deployedAt: '2025-06-18T06:04:27.350Z'
      },
      dpr: {
        contractAddress: '0xDA7Ae59Fa1DB9B138dddaaFB6153B11B162Cfd8B',
        deployerAddress: '0x02040ee763D6d849515cE194bDa93d12bf3c45d0',
        txHash: 'TBD',
        deployedAt: '2025-06-18T06:04:27.350Z',
        constructors: {
          ownerAddress: '0xDA00006427E534B1Acde93B9E66d8A9d2C66B2d3',
          dpsAddress: '0xDA7Adb41ac559e689fE170aE4f2853a450e6E4Cc',
          royaltyRate: '1079'
        }
      }
    }
  }
};

export default espDeployments;