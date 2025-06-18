import fs from 'fs';
import path from 'path';

interface DeploymentData {
  chainId: number;
  dps: {
    contractAddress: string;
    deployerAddress: string;
    txHash?: string;
  };
  dpr: {
    contractAddress: string;
    deployerAddress: string;
    txHash?: string;
    constructors: {
      ownerAddress: string;
      dpsAddress: string;
      royaltyRate: string; // in wei
    };
  };
}

/**
 * Add a new deployment to the ESP deployment registry
 */
export async function addDeployment(deploymentData: DeploymentData): Promise<void> {
  // Skip hardhat chain
  if (deploymentData.chainId === 31337) {
    console.log(`🚫 Skipping deployment registry update for chainId ${deploymentData.chainId}`);
    return;
  }

  const registryPath = path.join(__dirname, '..', 'esp.deployments.ts');
  
  try {
    // Read current registry
    let registryContent = fs.readFileSync(registryPath, 'utf8');
    
    const timestamp = new Date().toISOString();
    
    // Build the new chain entry
    const chainEntry = `    ${deploymentData.chainId}: {
      dps: {
        contractAddress: '${deploymentData.dps.contractAddress}',
        deployerAddress: '${deploymentData.dps.deployerAddress}',
        txHash: '${deploymentData.dps.txHash || 'TBD'}',
        deployedAt: '${timestamp}'
      },
      dpr: {
        contractAddress: '${deploymentData.dpr.contractAddress}',
        deployerAddress: '${deploymentData.dpr.deployerAddress}',
        txHash: '${deploymentData.dpr.txHash || 'TBD'}',
        deployedAt: '${timestamp}',
        constructors: {
          ownerAddress: '${deploymentData.dpr.constructors.ownerAddress}',
          dpsAddress: '${deploymentData.dpr.constructors.dpsAddress}',
          royaltyRate: '${deploymentData.dpr.constructors.royaltyRate}'
        }
      }
    }`;

    // Check if chain already exists and build a more precise regex for replacement
    const chainRegex = new RegExp(`    ${deploymentData.chainId}: \\{[\\s\\S]*?\\n    \\}`, 's');
    
    if (registryContent.match(chainRegex)) {
      // Update existing chain - be careful to preserve structure
      registryContent = registryContent.replace(chainRegex, chainEntry);
      console.log(`📝 Updated existing ${deploymentData.chainId} deployment in registry`);
    } else {
      // For adding new chains, we need to be more specific about where to insert
      // Find the last existing chain entry and insert after it
      const chainsObjectPattern = /export const espDeployments[^=]*=\s*{\s*chains:\s*{([^}]*(?:}[^}]*)*?)}\s*}/s;
      const match = registryContent.match(chainsObjectPattern);
      
      if (match) {
        const chainsContent = match[1];
        
        // Check if there are existing chains
        const hasExistingChains = /\d+:\s*{/.test(chainsContent);
        
        if (hasExistingChains) {
          // Find the last chain entry and add comma + new entry
          const insertPattern = /(.*})(\s*)(}\s*};\s*export default espDeployments;)/s;
          const insertMatch = registryContent.match(insertPattern);
          
          if (insertMatch) {
            registryContent = insertMatch[1] + ',\n' + chainEntry + '\n  ' + insertMatch[3];
          } else {
            throw new Error('Could not find insertion point for new chain');
          }
        } else {
          // No existing chains, insert as first entry
          const insertPattern = /(export const espDeployments[^=]*=\s*{\s*chains:\s*{)(\s*)(}\s*};\s*export default espDeployments;)/s;
          const insertMatch = registryContent.match(insertPattern);
          
          if (insertMatch) {
            registryContent = insertMatch[1] + '\n' + chainEntry + '\n  ' + insertMatch[3];
          } else {
            throw new Error('Could not find insertion point for first chain');
          }
        }
        
        console.log(`📝 Added new ${deploymentData.chainId} deployment to registry`);
      } else {
        throw new Error('Could not find chains object structure in registry file');
      }
    }
    
    // Write back to file
    fs.writeFileSync(registryPath, registryContent, 'utf8');
    console.log(`✅ Deployment registry updated successfully`);
    
  } catch (error) {
    console.error(`❌ Failed to update deployment registry:`, error);
    throw error;
  }
}

/**
 * Quick helper to format deployment data from deploy script results
 */
export function formatDeploymentData(
  chainId: number,
  dpsResult: { address: string; deployerAddress: string; txHash?: string },
  dprResult: { 
    address: string; 
    deployerAddress: string; 
    txHash?: string;
    owner: string;
    dpsAddress: string;
    royaltyRate: bigint;
  }
): DeploymentData {
  return {
    chainId,
    dps: {
      contractAddress: dpsResult.address,
      deployerAddress: dpsResult.deployerAddress,
      txHash: dpsResult.txHash
    },
    dpr: {
      contractAddress: dprResult.address,
      deployerAddress: dprResult.deployerAddress,
      txHash: dprResult.txHash,
      constructors: {
        ownerAddress: dprResult.owner,
        dpsAddress: dprResult.dpsAddress,
        royaltyRate: dprResult.royaltyRate.toString()
      }
    }
  };
}