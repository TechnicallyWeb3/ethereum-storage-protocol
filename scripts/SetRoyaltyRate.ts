import { ethers } from "hardhat";
import { espDeployments } from "../esp.deployments";
import { DataPointRegistry } from "../typechain-types";

interface ChainConfig {
  dpr: {
    contractAddress: string;
  };
}

/**
 * Set the royalty rate for the DataPointRegistry contract
 * @param chainId - The chain ID to set royalty rate on
 * @param newRoyaltyRate - The new royalty rate in wei (e.g., "1000000000000000" for 0.001 ETH)
 * @param signerIndex - Index of the signer account (should be owner, default: 2 for TW3)
 */
export async function setRoyaltyRate(
  chainId: number, 
  newRoyaltyRate: string,
  signerIndex: number = 2
): Promise<void> {
  console.log(`🔧 Setting royalty rate on chain ID ${chainId}...`);
  
  // Get chain configuration from deployment registry
  const chainConfig = espDeployments.chains[chainId] as ChainConfig;
  
  if (!chainConfig || !chainConfig.dpr) {
    throw new Error(`❌ No DPR deployment found for chain ID: ${chainId}`);
  }
  
  const dprAddress = chainConfig.dpr.contractAddress;
  console.log(`📍 DPR Contract Address: ${dprAddress}`);
  console.log(`💰 New Royalty Rate: ${ethers.formatUnits(newRoyaltyRate, "gwei")} GWEI`);
  
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
  console.log(`📊 Current royalty rate: ${ethers.formatUnits(currentRoyaltyRate.toString(), "gwei")} GWEI`);
  
  if (currentRoyaltyRate.toString() === newRoyaltyRate) {
    console.log(`✅ Royalty rate is already set to ${ethers.formatUnits(newRoyaltyRate, "gwei")} GWEI. No change needed.`);
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
    console.log(`📊 Previous rate: ${ethers.formatUnits(currentRoyaltyRate.toString(), "gwei")} GWEI`);
    console.log(`📊 New rate: ${ethers.formatUnits(newRoyaltyRate, "gwei")} GWEI`);
    console.log(`⛽ Gas used: ${receipt.gasUsed.toString()}`);
    console.log(`🧾 Block number: ${receipt.blockNumber}`);
  } else {
    throw new Error(`❌ Transaction failed`);
  }
}

/**
 * Get current royalty rate from the DPR contract
 * @param chainId - The chain ID to query
 */
export async function getCurrentRoyaltyRate(chainId: number): Promise<string> {
  console.log(`📊 Getting current royalty rate on chain ID ${chainId}...`);
  
  // Get chain configuration from deployment registry
  const chainConfig = espDeployments.chains[chainId] as ChainConfig;
  
  if (!chainConfig || !chainConfig.dpr) {
    throw new Error(`❌ No DPR deployment found for chain ID: ${chainId}`);
  }
  
  const dprAddress = chainConfig.dpr.contractAddress;
  console.log(`📍 DPR Contract Address: ${dprAddress}`);
  
  // Connect to the DPR contract (read-only, no signer needed)
  const DPR = await ethers.getContractAt("DataPointRegistry", dprAddress) as DataPointRegistry;
  
  const royaltyRate = await DPR.royaltyRate();
  const rateString = royaltyRate.toString();
  const rateGwei = ethers.formatUnits(rateString, "gwei");
  
  console.log(`📊 Current royalty rate: ${rateGwei} GWEI`);
  console.log(`💰 Raw value: ${rateString} wei`);
  
  return rateString;
}

/**
 * Helper function to map network names to chain IDs
 */
function getChainIdFromNetwork(networkName: string): number {
  const networkToChainId: { [key: string]: number } = {
    'sepolia': 11155111,
    'mainnet': 1,
    'polygon': 137,
    'bsc': 56,
    'arbitrum': 42161,
    'optimism': 10,
    'localhost': 31337,
    'hardhat': 31337
  };
  
  const chainId = networkToChainId[networkName];
  if (!chainId) {
    throw new Error(`❌ Unknown network: ${networkName}. Supported networks: ${Object.keys(networkToChainId).join(', ')}`);
  }
  
  return chainId;
}

// CLI execution
if (require.main === module) {
  const main = async () => {
    const args = process.argv.slice(2);
    
    if (args.length < 1) {
      console.log(`Usage: npx hardhat run scripts/SetRoyaltyRate.ts --network <network>`);
      console.log(`Environment variables:`);
      console.log(`  ROYALTY_RATE: New royalty rate in wei (required for setting)`);
      console.log(`  SIGNER_INDEX: Index of signer account (default: 2)`);
      console.log(`  ACTION: 'set' or 'get' (default: 'get')`);
      console.log(`  CHAIN_ID: Chain ID to use (optional, defaults to current network)`);
      console.log(`Examples:`);
      console.log(`  ACTION=get npx hardhat run scripts/SetRoyaltyRate.ts --network sepolia`);
      console.log(`  ACTION=set ROYALTY_RATE=1000000000000000 npx hardhat run scripts/SetRoyaltyRate.ts --network sepolia`);
      console.log(`  ACTION=get CHAIN_ID=11155111 npx hardhat run scripts/SetRoyaltyRate.ts --network sepolia`);
      process.exit(1);
    }
    
    const network = await ethers.provider.getNetwork();
    const networkName = network.name === "unknown" ? "localhost" : network.name;
    
    // Allow override of chain ID via environment variable
    const chainId = process.env.CHAIN_ID 
      ? parseInt(process.env.CHAIN_ID) 
      : getChainIdFromNetwork(networkName);
    
    const action = process.env.ACTION || 'get';
    const signerIndex = parseInt(process.env.SIGNER_INDEX || '2');
    
    try {
      if (action === 'set') {
        const royaltyRate = process.env.ROYALTY_RATE;
        if (!royaltyRate) {
          throw new Error(`❌ ROYALTY_RATE environment variable is required for setting royalty rate`);
        }
        await setRoyaltyRate(chainId, royaltyRate, signerIndex);
      } else {
        await getCurrentRoyaltyRate(chainId);
      }
    } catch (error) {
      console.error(`❌ Error:`, error);
      process.exit(1);
    }
  };
  
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
} 