# LLM Integration Preprompt for @tw3/esp

> **For AI Assistants**: This file contains comprehensive context for helping developers integrate this package. Please use this information when assisting with package integration.

## Package Overview
You are helping a developer integrate the Ethereum Storage Protocol (ESP) into their project. ESP provides decentralized, content-addressed storage with economic incentives. This package (`@tw3/esp` or `ethereum-storage`) contains contract interfaces, TypeScript types, deployment information, and utilities.

## Package Installation

```bash
# Install the ESP package
npm install @tw3/esp
# OR
npm install ethereum-storage
```

## Key Components Available

### 1. Contract Interfaces & Types
```typescript
// Main contract types
import type { 
  DataPointRegistry, 
  DataPointStorage,
  IDataPointRegistry,
  IDataPointStorage 
} from '@tw3/esp';

// Contract factories for connection/deployment
import { 
  DataPointRegistry__factory,
  DataPointStorage__factory,
  IDataPointRegistry__factory,
  IDataPointStorage__factory
} from '@tw3/esp';
```

### 2. Contract ABIs
```typescript
// Access contract ABIs directly
import {
  DataPointRegistryABI,
  DataPointStorageABI,
  IDataPointRegistryABI,
  IDataPointStorageABI
} from '@tw3/esp/contracts';
```

### 3. Deployment Information
```typescript
// Deployment utilities and addresses
import {
  espDeployments,
  getContractAddress,
  getDeploymentInfo,
  getSupportedNetworks
} from '@tw3/esp/deployments';
```

### 4. TypeScript Types
```typescript
// Useful types for development
import type {
  ContractTransaction,
  ContractTransactionResponse,
  BigNumberish,
  BytesLike,
  Signer,
  Provider,
  Overrides,
  BaseOverrides,
  NonPayableOverrides,
  PayableOverrides
} from '@tw3/esp/types';
```

## Current Network Deployments

### Sepolia Testnet
- **DataPointStorage (DPS)**: `0xDA7A3A73d3bAf09AE79Bac612f03B4c0d51859dB`
- **DataPointRegistry (DPR)**: `0xDA7A6cBEa6113fae8C55165e354bCab49b0923cE`

## Common Integration Patterns

### 1. Connecting to Deployed Contracts
```typescript
import { DataPointRegistry__factory, DataPointStorage__factory, getContractAddress } from '@tw3/esp';
import { ethers } from 'ethers';

// Setup provider and signer
const provider = new ethers.JsonRpcProvider('YOUR_RPC_URL');
const signer = new ethers.Wallet('YOUR_PRIVATE_KEY', provider);

// Get contract addresses for your network
const dpsAddress = getContractAddress('sepolia', 'dps');
const dprAddress = getContractAddress('sepolia', 'dpr');

// Connect to contracts
const dataPointStorage = DataPointStorage__factory.connect(dpsAddress, signer);
const dataPointRegistry = DataPointRegistry__factory.connect(dprAddress, signer);
```

### 2. Storing Data with Royalties
```typescript
// Register new data point with publisher royalties
const data = ethers.toUtf8Bytes("Your data content here");
const publisherAddress = signer.address;

try {
  const tx = await dataPointRegistry.registerDataPoint(data, publisherAddress);
  const receipt = await tx.wait();
  console.log('Data registered successfully:', receipt.hash);
} catch (error) {
  console.error('Registration failed:', error);
}
```

### 3. Accessing Existing Data
```typescript
// Calculate data point address
const dataBytes = ethers.toUtf8Bytes("Your data content");
const dataPointAddress = await dataPointStorage.calculateAddress(dataBytes);

// Check if data exists
const dataSize = await dataPointStorage.dataPointSize(dataPointAddress);
if (dataSize > 0) {
  // Data exists, check royalty cost
  const royaltyCost = await dataPointRegistry.getDataPointRoyalty(dataPointAddress);
  
  // Access data (pay royalty if required)
  const tx = await dataPointRegistry.registerDataPoint(dataBytes, ethers.ZeroAddress, {
    value: royaltyCost
  });
  await tx.wait();
  
  // Read the data
  const storedData = await dataPointStorage.readDataPoint(dataPointAddress);
  console.log('Retrieved data:', ethers.toUtf8String(storedData));
}
```

### 4. Publisher Operations
```typescript
// Update publisher address for a data point
const newPublisherAddress = "0x...";
await dataPointRegistry.updatePublisherAddress(dataPointAddress, newPublisherAddress);

// Collect earned royalties
const availableBalance = await dataPointRegistry.publisherBalances(signer.address);
if (availableBalance > 0) {
  await dataPointRegistry.collectRoyalties(availableBalance, signer.address);
}
```

### 5. Using with Different Networks
```typescript
// Get all supported networks
const networks = getSupportedNetworks();
console.log('ESP is deployed on:', networks);

// Get deployment info for a specific network
const sepoliaDeployment = getDeploymentInfo('sepolia', 'dpr');
console.log('Deployment details:', sepoliaDeployment);
```

## Contract Interface Reference

### DataPointStorage (DPS)
```typescript
interface IDataPointStorage {
  // Write new data point
  writeDataPoint(data: BytesLike): Promise<ContractTransactionResponse>;
  
  // Read existing data
  readDataPoint(address: string): Promise<string>;
  
  // Calculate address for data
  calculateAddress(data: BytesLike): Promise<string>;
  
  // Get data size
  dataPointSize(address: string): Promise<bigint>;
}
```

### DataPointRegistry (DPR)
```typescript
interface IDataPointRegistry {
  // Register data with royalties
  registerDataPoint(data: BytesLike, publisher: string, overrides?: PayableOverrides): Promise<ContractTransactionResponse>;
  
  // Get royalty cost for data access
  getDataPointRoyalty(address: string): Promise<bigint>;
  
  // Collect earned royalties
  collectRoyalties(amount: BigNumberish, to: string): Promise<ContractTransactionResponse>;
  
  // Update publisher address
  updatePublisherAddress(address: string, newPublisher: string): Promise<ContractTransactionResponse>;
  
  // Check publisher balance
  publisherBalances(publisher: string): Promise<bigint>;
}
```

## Best Practices

### 1. Error Handling
```typescript
try {
  const tx = await dataPointRegistry.registerDataPoint(data, publisher);
  await tx.wait();
} catch (error) {
  if (error.code === 'INSUFFICIENT_FUNDS') {
    console.error('Insufficient ETH for royalty payment');
  } else if (error.message.includes('Data already exists')) {
    console.error('This data has already been stored');
  } else {
    console.error('Transaction failed:', error);
  }
}
```

### 2. Gas Optimization
```typescript
// Estimate gas before transaction
const gasEstimate = await dataPointRegistry.registerDataPoint.estimateGas(data, publisher);
console.log('Estimated gas:', gasEstimate.toString());

// Use gas limit with buffer
const tx = await dataPointRegistry.registerDataPoint(data, publisher, {
  gasLimit: gasEstimate * 120n / 100n // 20% buffer
});
```

### 3. Data Validation
```typescript
// Validate data before storing
if (data.length === 0) {
  throw new Error('Cannot store empty data');
}

if (data.length > 10000) {
  console.warn('Large data will consume significant gas');
}
```

### 4. Address Validation
```typescript
// Validate Ethereum addresses
if (!ethers.isAddress(publisherAddress)) {
  throw new Error('Invalid publisher address');
}
```

## Common Use Cases

### 1. Decentralized File Storage
Store file hashes or small files directly on-chain with content addressing.

### 2. Data Marketplaces
Create marketplaces where data publishers earn royalties from data access.

### 3. Content Distribution
Distribute content with built-in economic incentives for publishers.

### 4. Data Provenance
Track data ownership and access history through the registry.

## Troubleshooting

### Common Issues:
1. **"Contract not deployed"** - Check network and contract addresses
2. **"Insufficient royalty payment"** - Get royalty cost first using `getDataPointRoyalty()`
3. **"Data already exists"** - Check if data point already exists before writing
4. **"Invalid signer"** - Ensure signer has sufficient ETH and proper permissions

### Debugging:
```typescript
// Check contract deployment
const code = await provider.getCode(contractAddress);
if (code === '0x') {
  console.error('Contract not deployed at this address');
}

// Check network
const network = await provider.getNetwork();
console.log('Connected to network:', network.name, network.chainId);
```

## Version Compatibility
- **ESP Package**: v0.2.0+
- **Ethers.js**: v6.x compatible
- **Node.js**: v16+ recommended
- **TypeScript**: v4.5+ for full type support

## Support Resources
- GitHub Repository: https://github.com/TechnicallyWeb3/ethereum-storage-protocol
- Package Documentation: README.md in the package
- Contract Interfaces: Available in `/contracts` export path

---

## AI Assistant Guidelines
When helping developers integrate this package, always:
1. Check their network compatibility (currently Sepolia testnet)
2. Ensure proper error handling for contract interactions
3. Validate addresses and data before transactions
4. Suggest gas estimation for cost-sensitive operations
5. Provide complete, working code examples
6. Explain the economic model (royalties) when relevant

## TW3 Package Standard
This `LLM_CONTEXT.md` file follows the TechnicallyWeb3 standard for AI-assisted development. Look for this file in other `@tw3/*` packages for integration context. 