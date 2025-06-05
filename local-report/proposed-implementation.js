/**
 * Proposed Implementation for ESP Local Deployment Functionality
 * 
 * This file contains a proposed implementation for improving the
 * local deployment functionality in the ethereum-storage-protocol library.
 */

// File: src/local-deployments.ts
/**
 * Local Deployments Storage
 * 
 * Manages local deployments in a separate file instead of modifying the source files.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

// Types for deployment management
interface LocalDeploymentData {
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

// Get the path to the local deployments file
function getLocalDeploymentsPath(): string {
  const espDir = path.join(os.homedir(), '.esp');
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(espDir)) {
    fs.mkdirSync(espDir, { recursive: true });
  }
  
  return path.join(espDir, 'local.deployments.json');
}

// Get local deployments
function getLocalDeployments(): { [chainId: string]: any } {
  const deploymentsPath = getLocalDeploymentsPath();
  
  if (!fs.existsSync(deploymentsPath)) {
    return {};
  }
  
  try {
    return JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
  } catch (error) {
    console.error('Error reading local deployments:', error);
    return {};
  }
}

// Save local deployments
function saveLocalDeployments(deployments: { [chainId: string]: any }): void {
  const deploymentsPath = getLocalDeploymentsPath();
  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
}

// Add a local deployment
function addLocalDeployment(
  deploymentData: LocalDeploymentData,
  options: { 
    overwrite?: boolean;
    description?: string;
  } = {}
): void {
  // Only allow localhost/hardhat networks
  if (deploymentData.chainId !== 31337 && deploymentData.chainId !== 1337) {
    throw new Error(`addLocalDeployment only accepts localhost networks (chainId 31337 or 1337), got ${deploymentData.chainId}`);
  }

  const { overwrite = false, description } = options;
  
  try {
    const deployments = getLocalDeployments();
    
    // Check if deployment already exists
    if (deployments[deploymentData.chainId] && !overwrite) {
      throw new Error(`Deployment for chainId ${deploymentData.chainId} already exists. Use { overwrite: true } to replace it.`);
    }
    
    const timestamp = new Date().toISOString();
    
    // Create the new deployment entry
    const newDeployment = {
      dps: {
        contractAddress: deploymentData.dps.contractAddress,
        deployerAddress: deploymentData.dps.deployerAddress,
        txHash: deploymentData.dps.txHash || 'manual-entry',
        deployedAt: timestamp,
        ...(description && { description })
      },
      dpr: {
        contractAddress: deploymentData.dpr.contractAddress,
        deployerAddress: deploymentData.dpr.deployerAddress,
        txHash: deploymentData.dpr.txHash || 'manual-entry',
        deployedAt: timestamp,
        constructors: deploymentData.dpr.constructors,
        ...(description && { description })
      }
    };
    
    // Add to deployments
    deployments[deploymentData.chainId] = newDeployment;
    
    // Save to file
    saveLocalDeployments(deployments);
    
    console.log(`✅ Added local deployment for chainId ${deploymentData.chainId}`);
    console.log(`📍 DPS: ${deploymentData.dps.contractAddress}`);
    console.log(`📍 DPR: ${deploymentData.dpr.contractAddress}`);
    
  } catch (error) {
    console.error(`❌ Failed to add local deployment:`, error);
    throw error;
  }
}

// Remove a local deployment
function removeLocalDeployment(chainId: number): void {
  if (chainId !== 31337 && chainId !== 1337) {
    throw new Error(`removeLocalDeployment only accepts localhost networks (chainId 31337 or 1337), got ${chainId}`);
  }
  
  try {
    const deployments = getLocalDeployments();
    
    if (!deployments[chainId]) {
      console.log(`ℹ️  No deployment found for chainId ${chainId}`);
      return;
    }
    
    delete deployments[chainId];
    saveLocalDeployments(deployments);
    
    console.log(`✅ Removed local deployment for chainId ${chainId}`);
    
  } catch (error) {
    console.error(`❌ Failed to remove local deployment:`, error);
    throw error;
  }
}

// Check if a local deployment exists
function hasLocalDeployment(chainId: number = 31337): boolean {
  const deployments = getLocalDeployments();
  return !!deployments[chainId];
}

// File: src/deployments.ts (modified)
/**
 * Modified getContractAddress function to check both official and local deployments
 */
function getContractAddress(chainId: number, contract: 'dps' | 'dpr'): string | undefined {
  // First check official deployments
  const officialDeployments = require('../esp.deployments').espDeployments;
  const officialAddress = officialDeployments.chains[chainId]?.[contract]?.contractAddress;
  
  if (officialAddress) {
    return officialAddress;
  }
  
  // Then check local deployments
  const localDeployments = getLocalDeployments();
  return localDeployments[chainId]?.[contract]?.contractAddress;
}

// File: src/deploy.ts (new)
/**
 * Utility function for deploying ESP contracts
 */
async function deployESP(hreOrOptions: any, options: any = {}) {
  // Determine if first argument is Hardhat Runtime Environment
  const isHRE = hreOrOptions && hreOrOptions.ethers && hreOrOptions.network;
  
  const hre = isHRE ? hreOrOptions : null;
  const opts = isHRE ? options : hreOrOptions;
  
  // Get provider and signer
  let provider, signer;
  
  if (hre) {
    // Using Hardhat
    provider = hre.ethers.provider;
    [signer] = await hre.ethers.getSigners();
  } else {
    // Using custom provider/signer
    provider = opts.provider;
    signer = opts.signer;
    
    if (!provider) {
      throw new Error('Provider is required when not using Hardhat');
    }
    
    if (!signer) {
      throw new Error('Signer is required when not using Hardhat');
    }
  }
  
  // Get deployment options with defaults
  const owner = opts.owner || await signer.getAddress();
  
  // For royalty rate, use 1/1000th of gas price if not specified
  let royaltyRate;
  if (opts.royaltyRate) {
    royaltyRate = opts.royaltyRate;
  } else {
    const gasPrice = await provider.getFeeData();
    // Use 1/1000th of gas price, with minimum of 0.1 gwei
    const minRoyalty = hre ? 
      hre.ethers.parseUnits('0.1', 'gwei') : 
      ethers.parseUnits('0.1', 'gwei');
    
    royaltyRate = gasPrice.gasPrice ? 
      (gasPrice.gasPrice / 1000n) : 
      minRoyalty;
      
    // Ensure minimum royalty
    if (royaltyRate < minRoyalty) {
      royaltyRate = minRoyalty;
    }
  }
  
  console.log(`Deploying ESP contracts...`);
  console.log(`Owner: ${owner}`);
  console.log(`Royalty Rate: ${royaltyRate.toString()} wei`);
  
  // Import contract factories
  const { DataPointStorage__factory, DataPointRegistry__factory } = 
    hre ? 
    await import('../typechain-types/factories/contracts') : 
    await import('ethereum-storage/contracts');
  
  // Deploy DataPointStorage
  console.log('Deploying DataPointStorage...');
  const dpsFactory = new DataPointStorage__factory(signer);
  const dps = await dpsFactory.deploy();
  await dps.waitForDeployment();
  const dpsAddress = await dps.getAddress();
  console.log(`DataPointStorage deployed to: ${dpsAddress}`);
  
  // Deploy DataPointRegistry
  console.log('Deploying DataPointRegistry...');
  const dprFactory = new DataPointRegistry__factory(signer);
  const dpr = await dprFactory.deploy(owner, dpsAddress, royaltyRate);
  await dpr.waitForDeployment();
  const dprAddress = await dpr.getAddress();
  console.log(`DataPointRegistry deployed to: ${dprAddress}`);
  
  // Return deployment info
  return {
    dps,
    dpr,
    dpsAddress,
    dprAddress,
    owner,
    royaltyRate,
    chainId: hre ? hre.network.config.chainId : opts.chainId
  };
}

// File: tasks/esp-deploy.ts (new)
/**
 * Hardhat task for deploying and registering ESP contracts
 */
import { task, types } from "hardhat/config";

task("esp:deploy-local", "Deploy ESP contracts locally and register them")
  .addOptionalParam(
    "royalty",
    "Royalty rate in GWEI (defaults to 0.1 GWEI)",
    "0.1",
    types.string
  )
  .addOptionalParam(
    "owner",
    "Contract owner address (defaults to deployer)",
    undefined,
    types.string
  )
  .addFlag(
    "skipRegister",
    "Skip registering the deployment (registration enabled by default)"
  )
  .setAction(async (taskArgs, hre) => {
    console.log(`🚀 ESP Local Deployment Task`);
    console.log(`🌐 Network: ${hre.network.name}\n`);

    const { royalty, owner, skipRegister } = taskArgs;
    
    try {
      // Import the deployment function
      const { deployESP } = await import("../src/deploy");
      
      // Convert royalty rate from GWEI to wei
      const royaltyRateWei = hre.ethers.parseUnits(royalty, "gwei");
      console.log(`💰 Royalty rate: ${royalty} GWEI (${royaltyRateWei.toString()} wei)`);
      
      // Deploy contracts
      const result = await deployESP(hre, {
        owner,
        royaltyRate: royaltyRateWei
      });
      
      console.log(`\n✅ Deployment completed successfully!`);
      console.log(`📍 DataPointStorage: ${result.dpsAddress}`);
      console.log(`📍 DataPointRegistry: ${result.dprAddress}`);
      console.log(`👤 Owner: ${result.owner}`);
      console.log(`💰 Royalty Rate: ${royalty} GWEI`);
      
      // Register the deployment
      if (!skipRegister) {
        console.log(`\n📝 Registering deployment...`);
        
        const { addLocalDeployment } = await import("../src/local-deployments");
        
        const [deployer] = await hre.ethers.getSigners();
        const deployerAddress = await deployer.getAddress();
        
        await addLocalDeployment({
          chainId: hre.network.config.chainId || 31337,
          dps: {
            contractAddress: result.dpsAddress,
            deployerAddress: deployerAddress
          },
          dpr: {
            contractAddress: result.dprAddress,
            deployerAddress: deployerAddress,
            constructors: {
              ownerAddress: result.owner,
              dpsAddress: result.dpsAddress,
              royaltyRate: result.royaltyRate.toString()
            }
          }
        }, {
          description: `Local deployment on ${hre.network.name}`
        });
        
        console.log(`✅ Deployment registered successfully!`);
      }
      
    } catch (error) {
      console.error("❌ Deployment failed:", error);
      process.exit(1);
    }
  });