# Ethereum Storage Protocol (ESP) - LLM Context Guide

**Version:** 0.3.3  
**Package:** `ethereum-storage` or `@tw3/esp`  
**License:** AGPL-3.0

## Project Summary

ESP is a decentralized storage protocol built on Ethereum that provides:
- **Immutable, content-addressed storage** via DataPointStorage contract
- **Economic incentive layer** via DataPointRegistry contract with publisher royalties
- **TypeScript-first integration** with full TypeChain types and utilities
- **Production-ready contracts** deployed on multiple networks

## Architecture

```
DataPointRegistry (Economic Layer)
        ↓ delegates storage to
DataPointStorage (Storage Layer)
```

## Package Structure

### Main Exports (`ethereum-storage`)
```typescript
// Contract types & factories (TypeChain generated)
import {
  DataPointRegistry, DataPointRegistry__factory,
  DataPointStorage, DataPointStorage__factory,
  IDataPointRegistry, IDataPointRegistry__factory,
  IDataPointStorage, IDataPointStorage__factory
} from 'ethereum-storage';

// Deployment utilities
import {
  espDeployments, loadContract, getContractAddress,
  getDeploymentInfo, getSupportedChainIds
} from 'ethereum-storage';

// All TypeScript types
import type {
  ContractTransaction, ContractTransactionResponse,
  BigNumberish, BytesLike, Signer, Provider,
  BaseOverrides, PayableOverrides, Overrides
} from 'ethereum-storage';
```

### Subpath Exports
```typescript
// Contract ABIs and utilities
import { 
  DataPointRegistryABI, DataPointStorageABI,
  getContractFactory, ContractNames 
} from 'ethereum-storage/contracts';

// Deployment-specific utilities
import {
  espDeployments, loadContract, getContractAddress
} from 'ethereum-storage/deployments';

// Type-only imports
import type {
  DataPointRegistry, DataPointStorage,
  IDataPointRegistry, IDataPointStorage
} from 'ethereum-storage/types';
```

## Contract Interfaces

### DataPointStorage (Core Storage Layer)
```typescript
interface IDataPointStorage {
  // Write immutable data, returns content address
  writeDataPoint(data: BytesLike): Promise<ContractTransaction>;
  
  // Read data by content address
  readDataPoint(address: string): Promise<string>;
  
  // Calculate content address without writing
  calculateAddress(data: BytesLike): Promise<string>;
  
  // Get size of stored data
  dataPointSize(address: string): Promise<BigNumber>;
}
```

### DataPointRegistry (Economic Layer)
```typescript
interface IDataPointRegistry {
  // Register data with publisher royalties
  registerDataPoint(
    data: BytesLike, 
    publisher: string,
    overrides?: PayableOverrides
  ): Promise<ContractTransaction>;
  
  // Get royalty cost for accessing data
  getDataPointRoyalty(address: string): Promise<BigNumber>;
  
  // Pay royalty and read data
  readDataPoint(
    address: string,
    overrides?: PayableOverrides
  ): Promise<ContractTransaction>;
  
  // Collect earned royalties
  collectRoyalties(
    amount: BigNumberish,
    withdrawTo: string
  ): Promise<ContractTransaction>;
}
```

## Working with Deployments

### Chain ID System
ESP uses standard Ethereum chain IDs:
- **Sepolia Testnet:** 11155111
- **Ethereum Mainnet:** 1
- **Polygon:** 137
- **Hardhat/Local:** 31337

### Deployment Utilities

```typescript
import { 
  getSupportedChainIds, getContractAddress, 
  loadContract, getDeploymentInfo 
} from 'ethereum-storage';

// Get all supported networks
const chainIds = getSupportedChainIds(); // [11155111]

// Get contract addresses
const registryAddr = getContractAddress(11155111, 'dpr');
const storageAddr = getContractAddress(11155111, 'dps');

// Get full deployment info
const deployInfo = getDeploymentInfo(11155111, 'dpr');
/* Returns: {
  contractAddress: '0x...',
  deployerAddress: '0x...',
  txHash: '0x...',
  deployedAt: '2025-05-31T18:59:12.000Z',
  constructors: { ... }
} */

// Load contract instances directly
const registry = loadContract(11155111, 'dpr', provider);
const storage = loadContract(11155111, 'dps', signer);
```

## Complete Integration Examples

### Basic Usage Pattern
```typescript
import { ethers } from 'ethers';
import { 
  DataPointRegistry__factory,
  loadContract,
  getContractAddress 
} from 'ethereum-storage';

const provider = new ethers.JsonRpcProvider('YOUR_RPC_URL');
const signer = new ethers.Wallet('PRIVATE_KEY', provider);
const chainId = 11155111; // Sepolia

// Method 1: Manual connection
const registryAddr = getContractAddress(chainId, 'dpr');
const registry = DataPointRegistry__factory.connect(registryAddr, signer);

// Method 2: Helper function (recommended)
const registry2 = loadContract(chainId, 'dpr', signer);

// Store data with royalties
const data = ethers.toUtf8Bytes("Hello ESP!");
const tx = await registry.registerDataPoint(data, signer.address);
const receipt = await tx.wait();

// Extract data point address from event
const event = receipt.logs.find(log => 
  log.topics[0] === registry.interface.getEventTopic('DataPointRegistered')
);
const dataPointAddress = event.topics[1];

// Read data (free from storage layer)
const storage = loadContract(chainId, 'dps', provider);
const storedData = await storage.readDataPoint(dataPointAddress);
```

### Advanced Usage with Royalties
```typescript
import { parseEther, formatUnits } from 'ethers';
import { loadContract, getContractAddress } from 'ethereum-storage';

const registry = loadContract(11155111, 'dpr', signer);

// Check royalty cost before reading
const royaltyCost = await registry.getDataPointRoyalty(dataPointAddress);
console.log(`Royalty: ${formatUnits(royaltyCost, 'ether')} ETH`);

// Read data with royalty payment
const readTx = await registry.readDataPoint(dataPointAddress, {
  value: royaltyCost
});
await readTx.wait();

// Publisher collects royalties
const balance = await provider.getBalance(publisherAddress);
await registry.collectRoyalties(balance, publisherAddress);
```

### Working with ABIs Directly
```typescript
import { DataPointRegistryABI, DataPointStorageABI } from 'ethereum-storage/contracts';
import { ethers } from 'ethers';

// Create contract instance with ABI
const registry = new ethers.Contract(
  registryAddress, 
  DataPointRegistryABI, 
  signer
);

// Use for external tools (Wagmi, Web3.js, etc.)
const wagmiConfig = {
  address: registryAddress,
  abi: DataPointRegistryABI,
  // ...
};
```

## Type Safety Guidelines

### Contract Type Assertions
```typescript
import type { DataPointRegistry, DataPointStorage } from 'ethereum-storage';

// Type-safe contract instances
const registry = loadContract(chainId, 'dpr', signer) as DataPointRegistry;
const storage = loadContract(chainId, 'dps', provider) as DataPointStorage;

// Type-safe transaction handling
import type { ContractTransaction } from 'ethereum-storage';
const tx: ContractTransaction = await registry.registerDataPoint(data, publisher);
```

### Override Types
```typescript
import type { PayableOverrides, Overrides } from 'ethereum-storage';

// For payable functions
const payableOptions: PayableOverrides = {
  value: parseEther('0.01'),
  gasLimit: 500000
};

// For non-payable functions  
const options: Overrides = {
  gasLimit: 300000
};
```

## Common Integration Patterns

### Error Handling
```typescript
try {
  const tx = await registry.registerDataPoint(data, publisher);
  await tx.wait();
} catch (error) {
  if (error.reason === 'InsufficientRoyaltyPayment') {
    // Handle specific contract error
  }
  // Handle other errors
}
```

### Event Listening
```typescript
// Listen for data point registrations
registry.on('DataPointRegistered', (dataPointAddress, publisher, event) => {
  console.log(`New data point: ${dataPointAddress} by ${publisher}`);
});

// Listen for royalty payments
registry.on('RoyaltiesPaid', (dataPointAddress, payer, amount, event) => {
  console.log(`Royalty paid: ${formatUnits(amount, 'ether')} ETH`);
});
```

### Multi-chain Support
```typescript
const networks = [1, 11155111, 137]; // Mainnet, Sepolia, Polygon

const registries = networks.map(chainId => {
  const provider = getProvider(chainId); // Your provider logic
  return {
    chainId,
    registry: loadContract(chainId, 'dpr', provider)
  };
}).filter(({ registry }) => registry !== undefined);
```

## Key Implementation Notes

1. **Content Addressing**: ESP uses deterministic addresses based on keccak256(data)
2. **Gas Optimization**: Storage layer is append-only, registry handles all logic
3. **Royalty Model**: Publishers set rates, protocol collects fees automatically  
4. **Upgradeability**: Registry is upgradeable, storage layer is immutable
5. **Security**: Full reentrancy protection, comprehensive access controls

## Quick Reference

| Function | Contract | Purpose | Payable |
|----------|----------|---------|---------|
| `writeDataPoint()` | Storage | Store data directly | No |
| `registerDataPoint()` | Registry | Store + set royalties | Yes |
| `readDataPoint()` | Storage | Read (free) | No |
| `readDataPoint()` | Registry | Read + pay royalty | Yes |
| `getDataPointRoyalty()` | Registry | Check royalty cost | No |
| `collectRoyalties()` | Registry | Withdraw earnings | No | 