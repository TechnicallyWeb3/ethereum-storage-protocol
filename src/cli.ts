#!/usr/bin/env node

/**
 * ESP CLI Utilities
 * 
 * Provides command-line utilities for managing ESP deployments
 */

import { addLocalhostDeployment, LocalDeploymentData } from './deployments';

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

function getArg(name: string): string | null {
  const index = args.indexOf(`--${name}`);
  return index !== -1 ? args[index + 1] : null;
}

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

function showHelp() {
  console.log(`
ESP CLI Utilities

Commands:
  add-localhost    Add a localhost deployment to your local package copy

Usage:
  npx ethereum-storage add-localhost --dps <address> --dpr <address> --owner <address> --royalty <rate>

Options:
  --dps <address>     DataPointStorage contract address
  --dpr <address>     DataPointRegistry contract address
  --owner <address>   Owner address used in DPR constructor
  --royalty <rate>    Royalty rate in wei (e.g., 100000000000000 for 0.0001 ETH)
  --chainId <id>      Chain ID (defaults to 31337 for localhost)
  --deployer <addr>   Deployer address (defaults to owner address)
  --description <txt> Description for this deployment
  --overwrite         Overwrite existing deployment if it exists
  --help, -h          Show this help message

Example:
  npx ethereum-storage add-localhost \\
    --dps 0x5FbDB2315678afecb367f032d93F642f64180aa3 \\
    --dpr 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512 \\
    --owner 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \\
    --royalty 100000000000000 \\
    --description "Local test deployment"
  `);
}

async function addLocalhostCommand() {
  // Required arguments
  const dpsAddress = getArg('dps');
  const dprAddress = getArg('dpr');
  const ownerAddress = getArg('owner');
  const royaltyRate = getArg('royalty');

  // Optional arguments
  const chainId = parseInt(getArg('chainId') || '31337');
  const deployer = getArg('deployer') || ownerAddress;
  const overwrite = hasFlag('overwrite');
  const description = getArg('description');

  // Validate required arguments
  if (!dpsAddress || !dprAddress || !ownerAddress || !royaltyRate) {
    console.error('❌ Missing required arguments.');
    console.error('Required: --dps, --dpr, --owner, --royalty');
    console.error('Use --help for usage information.');
    process.exit(1);
  }

  // Validate addresses (basic check)
  const addressRegex = /^0x[a-fA-F0-9]{40}$/;
  if (!addressRegex.test(dpsAddress)) {
    console.error('❌ Invalid DPS address format');
    process.exit(1);
  }
  if (!addressRegex.test(dprAddress)) {
    console.error('❌ Invalid DPR address format');
    process.exit(1);
  }
  if (!addressRegex.test(ownerAddress)) {
    console.error('❌ Invalid owner address format');
    process.exit(1);
  }

  // Validate royalty rate
  if (!/^\d+$/.test(royaltyRate)) {
    console.error('❌ Royalty rate must be a number in wei');
    process.exit(1);
  }

  console.log('🚀 Adding localhost deployment to ESP package...\n');

  try {
    const deploymentData: LocalDeploymentData = {
      chainId,
      dps: {
        contractAddress: dpsAddress,
        deployerAddress: deployer || ownerAddress,
      },
      dpr: {
        contractAddress: dprAddress,
        deployerAddress: deployer || ownerAddress,
        constructors: {
          ownerAddress: ownerAddress,
          dpsAddress: dpsAddress,
          royaltyRate: royaltyRate
        }
      }
    };

    const options = {
      overwrite,
      ...(description && { description })
    };

    addLocalhostDeployment(deploymentData, options);
    
    console.log(`\n🎉 Successfully added localhost deployment!`);
    console.log(`\nYou can now use your localhost contracts with the ESP package:`);
    console.log(`\nExample usage:`);
    console.log(`  import { getContractAddress, loadContract } from 'ethereum-storage';`);
    console.log(`  `);
    console.log(`  const dpsAddress = getContractAddress(${chainId}, 'dps');`);
    console.log(`  const dprAddress = getContractAddress(${chainId}, 'dpr');`);
    console.log(`  `);
    console.log(`  // With ethers provider`);
    console.log(`  const dpsContract = loadContract(${chainId}, 'dps', provider);`);
    console.log(`  const dprContract = loadContract(${chainId}, 'dpr', provider);`);

  } catch (error: any) {
    console.error('❌ Failed to add deployment:', error.message);
    
    if (error.message.includes('already exists')) {
      console.log('\n💡 Tip: Use --overwrite flag to replace existing deployment');
    }
    
    process.exit(1);
  }
}

// Main command handler
async function main() {
  if (hasFlag('help') || hasFlag('h') || !command) {
    showHelp();
    process.exit(0);
  }

  switch (command) {
    case 'add-localhost':
      await addLocalhostCommand();
      break;
    default:
      console.error(`❌ Unknown command: ${command}`);
      console.error('Use --help for available commands');
      process.exit(1);
  }
}

// Run CLI if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ CLI error:', error);
    process.exit(1);
  });
}

export { addLocalhostCommand, showHelp }; 