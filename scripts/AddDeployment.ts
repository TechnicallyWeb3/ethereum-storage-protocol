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

    // Check if chain already exists
    const chainRegex = new RegExp(`    ${deploymentData.chainId}: {[^}]*(?:}[^}]*)*}`, 's');
    
    if (registryContent.match(chainRegex)) {
      // Update existing chain
      registryContent = registryContent.replace(chainRegex, chainEntry);
      console.log(`📝 Updated existing ${deploymentData.chainId} deployment in registry`);
    } else {
      // Find the insertion point within the chains object
      // Look for the closing brace of the chains object
      const chainsPattern = /chains:\s*{([^}]*(?:}[^}]*)*)}[^}]*$/s;
      const match = registryContent.match(chainsPattern);
      
      if (match) {
        // Find where the chains object closes
        const chainsStart = registryContent.indexOf('chains: {');
        const chainsOpenBrace = registryContent.indexOf('{', chainsStart + 'chains: '.length);
        
        // Find the matching closing brace for chains
        let braceCount = 1;
        let i = chainsOpenBrace + 1;
        let chainsEnd = -1;
        
        while (i < registryContent.length && braceCount > 0) {
          if (registryContent[i] === '{') braceCount++;
          if (registryContent[i] === '}') braceCount--;
          if (braceCount === 0) {
            chainsEnd = i;
            break;
          }
          i++;
        }
        
        if (chainsEnd !== -1) {
          const beforeInsert = registryContent.substring(0, chainsEnd);
          const afterInsert = registryContent.substring(chainsEnd);
          
          // Check if we need a comma (if there are existing chains)
          const hasExistingNetworks = beforeInsert.includes(': {') && 
                                     beforeInsert.trim().endsWith('}') && 
                                     !beforeInsert.trim().endsWith('chains: {');
          
          if (hasExistingNetworks) {
            // Insert comma immediately after the last closing brace before inserting new chain
            const lastBraceIndex = beforeInsert.lastIndexOf('}');
            const beforeLastBrace = beforeInsert.substring(0, lastBraceIndex + 1);
            const afterLastBrace = beforeInsert.substring(lastBraceIndex + 1);
            
            registryContent = beforeLastBrace + ',\n' + chainEntry + '\n  ' + afterLastBrace + afterInsert;
          } else {
            registryContent = beforeInsert + '\n' + chainEntry + '\n  ' + afterInsert;
          }
          
          console.log(`📝 Added new ${deploymentData.chainId} deployment to registry`);
        } else {
          throw new Error('Could not find chains closing brace');
        }
      } else {
        throw new Error('Could not find chains object in registry file');
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