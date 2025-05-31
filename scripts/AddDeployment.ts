import fs from 'fs';
import path from 'path';

interface DeploymentData {
  network: string;
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
  // Skip localhost and hardhat networks
  if (deploymentData.network === 'localhost' || deploymentData.network === 'hardhat') {
    console.log(`🚫 Skipping deployment registry update for ${deploymentData.network} network`);
    return;
  }

  const registryPath = path.join(__dirname, '..', 'esp.deployments.ts');
  
  try {
    // Read current registry
    let registryContent = fs.readFileSync(registryPath, 'utf8');
    
    const timestamp = new Date().toISOString();
    
    // Build the new network entry
    const networkEntry = `    ${deploymentData.network}: {
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

    // Check if network already exists
    const networkRegex = new RegExp(`    ${deploymentData.network}: {[^}]*(?:}[^}]*)*}`, 's');
    
    if (registryContent.match(networkRegex)) {
      // Update existing network
      registryContent = registryContent.replace(networkRegex, networkEntry);
      console.log(`📝 Updated existing ${deploymentData.network} deployment in registry`);
    } else {
      // Find the insertion point within the networks object
      // Look for the closing brace of the networks object
      const networksPattern = /networks:\s*{([^}]*(?:}[^}]*)*)}[^}]*$/s;
      const match = registryContent.match(networksPattern);
      
      if (match) {
        // Find where the networks object closes
        const networksStart = registryContent.indexOf('networks: {');
        const networksOpenBrace = registryContent.indexOf('{', networksStart + 'networks: '.length);
        
        // Find the matching closing brace for networks
        let braceCount = 1;
        let i = networksOpenBrace + 1;
        let networksEnd = -1;
        
        while (i < registryContent.length && braceCount > 0) {
          if (registryContent[i] === '{') braceCount++;
          if (registryContent[i] === '}') braceCount--;
          if (braceCount === 0) {
            networksEnd = i;
            break;
          }
          i++;
        }
        
        if (networksEnd !== -1) {
          const beforeInsert = registryContent.substring(0, networksEnd);
          const afterInsert = registryContent.substring(networksEnd);
          
          // Check if we need a comma (if there are existing networks)
          const hasExistingNetworks = beforeInsert.includes(': {') && 
                                     beforeInsert.trim().endsWith('}') && 
                                     !beforeInsert.trim().endsWith('networks: {');
          
          if (hasExistingNetworks) {
            // Insert comma immediately after the last closing brace before inserting new network
            const lastBraceIndex = beforeInsert.lastIndexOf('}');
            const beforeLastBrace = beforeInsert.substring(0, lastBraceIndex + 1);
            const afterLastBrace = beforeInsert.substring(lastBraceIndex + 1);
            
            registryContent = beforeLastBrace + ',\n' + networkEntry + '\n  ' + afterLastBrace + afterInsert;
          } else {
            registryContent = beforeInsert + '\n' + networkEntry + '\n  ' + afterInsert;
          }
          
          console.log(`📝 Added new ${deploymentData.network} deployment to registry`);
        } else {
          throw new Error('Could not find networks closing brace');
        }
      } else {
        throw new Error('Could not find networks object in registry file');
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
  network: string,
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
    network,
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