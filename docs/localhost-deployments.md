# Localhost Deployment Management

The Ethereum Storage Protocol (ESP) package allows you to add your own localhost deployments to your local copy of the package. This enables testing with your own deployed contracts without needing testnet tokens.

## Overview

By default, ESP only tracks deployments on live networks (Sepolia, Mainnet, Polygon). However, when developing and testing your application, you may want to:

1. **Test with your own contracts**: Deploy ESP contracts to your local Hardhat network and use them for development
2. **Avoid testnet costs**: Test without needing testnet ETH or dealing with network latency
3. **Rapid iteration**: Quickly deploy, test, and redeploy contracts during development

## Quick Start

### 1. Deploy ESP Contracts Locally

First, you need ESP contracts deployed to your local network. You have several options:

#### Option A: Copy Contracts to Your Project
```bash
# Copy the contract files to your project
mkdir -p contracts/esp
cp node_modules/ethereum-storage/contracts/*.sol contracts/esp/
cp -r node_modules/ethereum-storage/contracts/interfaces contracts/esp/

# Deploy using your preferred method
npx hardhat run scripts/deploy.js --network localhost
```

#### Option B: Create Mock Contracts
```solidity
// contracts/MockESP.sol
import "ethereum-storage/contracts/DataPointStorage.sol";
import "ethereum-storage/contracts/DataPointRegistry.sol";

contract MockDataPointStorage is DataPointStorage {
    // Add any test-specific functionality
}

contract MockDataPointRegistry is DataPointRegistry {
    constructor(address owner, address dps, uint256 royalty) 
        DataPointRegistry(owner, dps, royalty) {}
    // Add any test-specific functionality
}
```

### 2. Add Deployment Using NPX Command

Use the built-in CLI to add your deployment:

```bash
npx ethereum-storage add-localhost \
  --dps 0x5FbDB2315678afecb367f032d93F642f64180aa3 \
  --dpr 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512 \
  --owner 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
  --royalty 100000000000000
```

### 3. Add Deployment Programmatically

Alternatively, add deployments directly in your code:

```typescript
import { addLocalhostDeployment, LocalDeploymentData } from 'ethereum-storage';

const deploymentData: LocalDeploymentData = {
  chainId: 31337,
  dps: {
    contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    deployerAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  },
  dpr: {
    contractAddress: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    deployerAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    constructors: {
      ownerAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      dpsAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      royaltyRate: '100000000000000'
    }
  }
};

addLocalhostDeployment(deploymentData, { description: 'My local deployment' });
```

### 4. Use in Your Code

Now you can use the localhost deployment just like any other network:

```typescript
import { getContractAddress, loadContract } from 'ethereum-storage';
import { ethers } from 'ethers';

// Get deployed contract addresses
const dpsAddress = getContractAddress(31337, 'dps'); // 31337 = localhost
const dprAddress = getContractAddress(31337, 'dpr');

// Connect to contracts
const provider = new ethers.JsonRpcProvider('http://localhost:8545');
const dpsContract = loadContract(31337, 'dps', provider);
const dprContract = loadContract(31337, 'dpr', provider);

// Use contracts normally
const royaltyRate = await dprContract.getRoyaltyRate();
console.log('Royalty rate:', ethers.formatUnits(royaltyRate, 'gwei'), 'GWEI');
```

## API Reference

### `addLocalhostDeployment(deploymentData, options?)`

Adds a localhost deployment to your local package copy.

```typescript
import { addLocalhostDeployment, LocalDeploymentData } from 'ethereum-storage';

const deploymentData: LocalDeploymentData = {
  chainId: 31337, // or 1337
  dps: {
    contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    deployerAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    txHash: '0x...' // optional
  },
  dpr: {
    contractAddress: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    deployerAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    txHash: '0x...', // optional
    constructors: {
      ownerAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      dpsAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      royaltyRate: '100000000000000' // in wei
    }
  }
};

addLocalhostDeployment(deploymentData, {
  overwrite: false, // Set to true to replace existing deployment
  description: 'My local test deployment'
});
```

### `removeLocalhostDeployment(chainId)`

Removes a localhost deployment from your local package copy.

```typescript
import { removeLocalhostDeployment } from 'ethereum-storage';

removeLocalhostDeployment(31337); // Remove localhost deployment
```

### `hasLocalhostDeployment(chainId?)`

Checks if a localhost deployment exists.

```typescript
import { hasLocalhostDeployment } from 'ethereum-storage';

if (hasLocalhostDeployment(31337)) {
  console.log('Localhost deployment exists');
}
```

### `listAllDeployments()`

Lists all deployments including any localhost ones you've added.

```typescript
import { listAllDeployments } from 'ethereum-storage';

const deployments = listAllDeployments();
console.log('Available networks:', Object.keys(deployments));
```

## CLI Usage

The ESP package provides an `npx` command for managing localhost deployments:

```bash
# Show help
npx ethereum-storage --help

# Add localhost deployment
npx ethereum-storage add-localhost \
  --dps <address> \
  --dpr <address> \
  --owner <address> \
  --royalty <rate>

# Required parameters
--dps <address>     # DataPointStorage contract address
--dpr <address>     # DataPointRegistry contract address  
--owner <address>   # Owner address used in DPR constructor
--royalty <rate>    # Royalty rate in wei

# Optional parameters
--chainId <id>      # Chain ID (defaults to 31337)
--deployer <addr>   # Deployer address (defaults to owner)
--description <txt> # Description for this deployment
--overwrite         # Overwrite existing deployment
```

## Example Workflow

Here's a complete workflow for testing with localhost deployments:

1. **Start local network**:
   ```bash
   npx hardhat node
   ```

2. **Deploy contracts** (using your preferred method):
   ```bash
   npx hardhat ignition deploy ignition/modules/ESPCore.js --network localhost
   ```

3. **Add to package**:
   ```bash
   node add-localhost-deployment.js \
     --dps 0x5FbDB2315678afecb367f032d93F642f64180aa3 \
     --dpr 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512 \
     --owner 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
     --royalty 100000000000000
   ```

4. **Test your application**:
   ```typescript
   import { getContractAddress, loadContract } from 'ethereum-storage';
   import { ethers } from 'ethers';

   const provider = new ethers.JsonRpcProvider('http://localhost:8545');
   const dprContract = loadContract(31337, 'dpr', provider);
   
   // Test your code
   await dprContract.setDataPoint(/* your data */);
   ```

## Notes

- **Local modifications only**: Localhost deployments are only added to your local copy of the package
- **Package updates**: You'll need to re-add localhost deployments after updating the ESP package
- **Chain IDs**: Only localhost networks (31337, 1337) are supported for this feature
- **Safety**: The production ESP package will never include localhost deployments

## Troubleshooting

### "Could not find esp.deployments.ts file"

This error occurs if the package can't locate the deployments file. Make sure you're running the script from a project that has `ethereum-storage` installed as a dependency.

### "Deployment already exists"

Use the `--overwrite` flag or the `overwrite: true` option to replace an existing deployment.

### "Invalid address format"

Ensure all addresses are valid Ethereum addresses starting with `0x` and containing 40 hexadecimal characters. 