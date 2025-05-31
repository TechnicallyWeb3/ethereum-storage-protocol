import { ethers } from "hardhat";
import { espDeployments } from "../esp.deployments";
import { DataPointRegistry } from "../typechain-types";

interface NetworkConfig {
  dpr: {
    contractAddress: string;
  };
}

/**
 * Set the royalty rate for the DataPointRegistry contract
 * @param networkName - The network name to set royalty rate on
 * @param newRoyaltyRate - The new royalty rate in wei (e.g., "1000000000000000" for 0.001 ETH)
 * @param signerIndex - Index of the signer account (should be owner, default: 2 for TW3)
 */
export async function setRoyaltyRate(
  networkName: string, 
  newRoyaltyRate: string,
  signerIndex: number = 2
): Promise<void> {
  console.log(`🔧 Setting royalty rate on ${networkName} network...`);
  
  // Get network configuration from deployment registry
  const networkConfig = (espDeployments.networks as any)[networkName] as NetworkConfig;
  
  if (!networkConfig || !networkConfig.dpr) {
    throw new Error(`❌ No DPR deployment found for network: ${networkName}`);
  }
  
  const dprAddress = networkConfig.dpr.contractAddress;
  console.log(`📍 DPR Contract Address: ${dprAddress}`);
  console.log(`💰 New Royalty Rate: ${newRoyaltyRate} wei`);
  
  // Get the signer (should be the owner of the contract)
  const signers = await ethers.getSigners();
  if (signerIndex >= signers.length) {
    throw new Error(`❌ Signer index ${signerIndex} out of range. Available signers: 0-${signers.length - 1}`);
  }
  
  const signer = signers[signerIndex];
  console.log(`👤 Using signer: ${signer.address}`);
  
  // Connect to the DPR contract
  const DPR = (await ethers.getContractAt("DataPointRegistry", dprAddress)).connect(signer) as DataPointRegistry;
  
  // Verify that the signer is the owner
  const currentOwner = await DPR.owner();
  if (currentOwner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(`❌ Access denied: ${signer.address} is not the contract owner (${currentOwner})`);
  }
  
  // Get current royalty rate for comparison
  const currentRoyaltyRate = await DPR.royaltyRate();
  console.log(`📊 Current royalty rate: ${currentRoyaltyRate.toString()} wei`);
  
  if (currentRoyaltyRate.toString() === newRoyaltyRate) {
    console.log(`✅ Royalty rate is already set to ${newRoyaltyRate} wei. No change needed.`);
    return;
  }
  
  // Set the new royalty rate
  console.log(`🚀 Sending transaction to set new royalty rate...`);
  const tx = await DPR.setRoyaltyRate(newRoyaltyRate);
  
  console.log(`⏳ Transaction hash: ${tx.hash}`);
  console.log(`⏳ Waiting for confirmation...`);
  
  const receipt = await tx.wait();
  
  if (receipt?.status === 1) {
    console.log(`✅ Royalty rate successfully updated!`);
    console.log(`📊 Previous rate: ${currentRoyaltyRate.toString()} wei`);
    console.log(`📊 New rate: ${newRoyaltyRate} wei`);
    console.log(`⛽ Gas used: ${receipt.gasUsed.toString()}`);
    console.log(`🧾 Block number: ${receipt.blockNumber}`);
  } else {
    throw new Error(`❌ Transaction failed`);
  }
}

/**
 * Get current royalty rate from the DPR contract
 * @param networkName - The network name to query
 */
export async function getCurrentRoyaltyRate(networkName: string): Promise<string> {
  console.log(`📊 Getting current royalty rate on ${networkName} network...`);
  
  // Get network configuration from deployment registry
  const networkConfig = (espDeployments.networks as any)[networkName] as NetworkConfig;
  
  if (!networkConfig || !networkConfig.dpr) {
    throw new Error(`❌ No DPR deployment found for network: ${networkName}`);
  }
  
  const dprAddress = networkConfig.dpr.contractAddress;
  console.log(`📍 DPR Contract Address: ${dprAddress}`);
  
  // Connect to the DPR contract (read-only, no signer needed)
  const DPR = await ethers.getContractAt("DataPointRegistry", dprAddress) as DataPointRegistry;
  
  const royaltyRate = await DPR.royaltyRate();
  const rateString = royaltyRate.toString();
  
  console.log(`📊 Current royalty rate: ${rateString} wei`);
  console.log(`💰 In GWEI: ${ethers.formatUnits(rateString, "gwei")} GWEI`);
  
  return rateString;
}

// CLI execution
if (require.main === module) {
  async function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 1) {
      console.log(`Usage: npx hardhat run scripts/SetRoyaltyRate.ts --network <network>`);
      console.log(`Environment variables:`);
      console.log(`  ROYALTY_RATE: New royalty rate in wei (required for setting)`);
      console.log(`  SIGNER_INDEX: Index of signer account (default: 2)`);
      console.log(`  ACTION: 'set' or 'get' (default: 'get')`);
      console.log(`Examples:`);
      console.log(`  ACTION=get npx hardhat run scripts/SetRoyaltyRate.ts --network sepolia`);
      console.log(`  ACTION=set ROYALTY_RATE=1000000000000000 npx hardhat run scripts/SetRoyaltyRate.ts --network sepolia`);
      process.exit(1);
    }
    
    const network = await ethers.provider.getNetwork();
    const networkName = network.name === "unknown" ? "localhost" : network.name;
    
    const action = process.env.ACTION || 'get';
    const signerIndex = parseInt(process.env.SIGNER_INDEX || '2');
    
    try {
      if (action === 'set') {
        const royaltyRate = process.env.ROYALTY_RATE;
        if (!royaltyRate) {
          throw new Error(`❌ ROYALTY_RATE environment variable is required for setting royalty rate`);
        }
        await setRoyaltyRate(networkName, royaltyRate, signerIndex);
      } else {
        await getCurrentRoyaltyRate(networkName);
      }
    } catch (error) {
      console.error(`❌ Error:`, error);
      process.exit(1);
    }
  }
  
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
} 