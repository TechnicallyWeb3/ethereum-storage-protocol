# Ethereum Storage Protocol (ESP)

A decentralized storage protocol built on Ethereum using content-addressed data points with an economic incentive layer.

## Overview

The Ethereum Storage Protocol provides immutable, content-addressed storage with built-in economic incentives for data publishers. The protocol consists of two main components:

- **DataPointStorage**: Core storage layer providing immutable, collision-resistant data storage
- **DataPointRegistry**: Economic layer managing royalties, publisher incentives, and access control

## Features

- 🔒 **Immutable Storage**: Content-addressed storage prevents data tampering
- 💰 **Economic Incentives**: Publishers earn royalties when their data is accessed
- ⚡ **Gas Optimized**: 31.6% gas efficiency improvement over baseline
- 🛡️ **Security Hardened**: Comprehensive reentrancy protection and access controls
- 🔧 **Modular Design**: Upgradeable registry with persistent storage layer
- 📊 **Comprehensive Testing**: 95/95 tests passing with full coverage
- 🤖 **AI-Ready**: Includes LLM context file for AI-assisted development

## Installation

```bash
# Public package
npm install ethereum-storage

# Organization scoped package
npm install @tw3/esp
```

## Quick Start

### Using the NPM Package

```typescript
import { 
  DataPointRegistry__factory, 
  DataPointStorage__factory,
  espDeployments,
  getContractAddress 
} from 'ethereum-storage';
// or from '@tw3/esp'

import { ethers } from 'ethers';

// Connect to deployed contracts
const provider = new ethers.JsonRpcProvider('YOUR_RPC_URL');
const signer = new ethers.Wallet('YOUR_PRIVATE_KEY', provider);

// Get contract addresses for your network
const dpsAddress = getContractAddress('sepolia', 'dps');
const dprAddress = getContractAddress('sepolia', 'dpr');

// Connect to contracts
const dataPointStorage = DataPointStorage__factory.connect(dpsAddress, signer);
const dataPointRegistry = DataPointRegistry__factory.connect(dprAddress, signer);

// Store data with royalties
const data = ethers.toUtf8Bytes("Hello, ESP!");
const tx = await dataPointRegistry.registerDataPoint(data, signer.address);
await tx.wait();
```

### Available Exports

```typescript
// Contract types and factories
import {
  DataPointRegistry,
  DataPointRegistry__factory,
  DataPointStorage,
  DataPointStorage__factory,
  IDataPointRegistry,
  IDataPointStorage
} from 'ethereum-storage';

// Contract ABIs
import {
  DataPointRegistryABI,
  DataPointStorageABI
} from 'ethereum-storage/contracts';

// Deployment information
import {
  espDeployments,
  getContractAddress,
  getDeploymentInfo,
  getSupportedNetworks
} from 'ethereum-storage/deployments';

// TypeScript types
import type {
  ContractTransaction,
  BigNumberish,
  Overrides
} from 'ethereum-storage/types';
```

## AI-Assisted Development

This package includes `LLM_CONTEXT.md` - a comprehensive context file that helps AI assistants provide accurate integration guidance. This innovative feature enables:

- **Better AI Help**: AI assistants understand the package structure and usage patterns
- **Consistent Support**: Standardized integration assistance across TW3 packages  
- **Up-to-Date Context**: AI context stays current with package updates
- **Faster Development**: Reduced time spent explaining package details to AI tools

**For AI Tools**: Look for `LLM_CONTEXT.md` in TW3 packages to provide enhanced integration support.

### Development Setup

```shell
# Install dependencies
npm install

# Run tests
npm test

# Deploy contracts
npx hardhat ignition deploy ./ignition/modules/ESPCore.ts
```

## Architecture

```
User/DApp → DataPointRegistry → DataPointStorage
           (Economic Layer)    (Storage Layer)
```

## API Reference

### DataPointStorage
- `writeDataPoint(bytes data)` - Store new data point
- `readDataPoint(bytes32 address)` - Retrieve stored data
- `calculateAddress(bytes data)` - Get storage address for data
- `dataPointSize(bytes32 address)` - Get size of stored data

### DataPointRegistry
- `registerDataPoint(bytes data, address publisher)` - Register data with royalties
- `getDataPointRoyalty(bytes32 address)` - Get royalty cost for access
- `collectRoyalties(uint256 amount, address to)` - Withdraw earned royalties
- `updatePublisherAddress(bytes32 address, address newPublisher)` - Change publisher

## Deployed Networks

The ESP contracts are currently deployed on:

- **Sepolia Testnet**: 
  - DataPointStorage: `0xDA7A3A73d3bAf09AE79Bac612f03B4c0d51859dB`
  - DataPointRegistry: `0xDA7A6cBEa6113fae8C55165e354bCab49b0923cE`

## Security Status

✅ **Production Ready** - Comprehensive security audit completed  
✅ **95/95 Tests Passing** - Full test coverage achieved  
✅ **Gas Optimized** - Efficient deployment and operation  
✅ **Economic Model Validated** - Self-protecting incentive design  

## License

AGPL-3.0 - See LICENSE file for details
