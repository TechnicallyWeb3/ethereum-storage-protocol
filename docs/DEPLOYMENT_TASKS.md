# ESP Deployment Tasks

This document explains how to deploy ESP contracts using the convenient Hardhat tasks.

## Overview

The ESP deployment system provides Hardhat tasks for easy contract deployment with vanity addresses and automatic verification. These tasks wrap the deployment scripts with convenient command-line interfaces.

## Available Tasks

### 1. `deploy:vanity` - Deploy ESP Contracts

Deploy both DataPointStorage (DPS) and DataPointRegistry (DPR) contracts with vanity addresses.

#### Usage

```bash
# Deploy with default royalty rate (1/1000th of current gas price)
npx hardhat deploy:vanity --network sepolia

# Deploy with custom royalty rate (in GWEI)
npx hardhat deploy:vanity --royalty 0.01 --network sepolia

# Deploy without verification (verification enabled by default)
npx hardhat deploy:vanity --royalty 0.5 --skip-verify --network sepolia

# Deploy with custom confirmation waiting
npx hardhat deploy:vanity --royalty 0.01 --confirmations 10 --network sepolia
```

#### Parameters

- **`--royalty`** (optional): Royalty rate in GWEI
  - **Default**: 1/1000th of current gas price
  - **Example**: `--royalty 0.01` (sets 0.01 GWEI royalty rate)
  - **Format**: String representing GWEI amount

- **`--skip-verify`** (flag): Skip contract verification
  - **Default**: Verification enabled for mainnet/testnet, disabled for local networks
  - **Usage**: Add flag to skip verification

- **`--confirmations`** (optional): Number of block confirmations to wait before verification
  - **Default**: 5 confirmations
  - **Example**: `--confirmations 10` (waits for 10 confirmations)
  - **Purpose**: Allows Etherscan time to index contracts before verification

#### Features

✅ **Automatic Gas Calculation**: Calculates optimal royalty rate based on network conditions  
✅ **Vanity Address Support**: Handles vanity deployment requirements and nonce validation  
✅ **Smart Funding**: Automatically funds deployer accounts from owner if needed  
✅ **Registry Integration**: Updates `esp.deployments.ts` automatically  
✅ **Enhanced Verification**: Auto-verifies contracts with configurable confirmation waiting  
✅ **Etherscan Indexing**: Waits for block confirmations to ensure reliable verification  
✅ **GWEI Display**: Shows all rates in human-readable GWEI format  

### 2. `deploy:ignition` - Deploy using Hardhat Ignition

Deploy ESP contracts using Hardhat's Ignition deployment system for more robust and resumable deployments.

#### Usage

```bash
# Deploy with default settings (0.1 GWEI royalty rate)
npx hardhat deploy:ignition --network sepolia

# Deploy with custom royalty rate
npx hardhat deploy:ignition --royalty 0.05 --network sepolia

# Deploy with custom owner
npx hardhat deploy:ignition --owner 0x123... --royalty 0.02 --network sepolia

# Deploy without verification
npx hardhat deploy:ignition --royalty 0.1 --skip-verify --network sepolia
```

#### Parameters

- **`--royalty`** (optional): Royalty rate in GWEI
  - **Default**: 0.1 GWEI
  - **Example**: `--royalty 0.05` (sets 0.05 GWEI royalty rate)
  - **Format**: String representing GWEI amount

- **`--owner`** (optional): Contract owner address
  - **Default**: First signer (deployer)
  - **Example**: `--owner 0xDA00006427E534B1Acde93B9E66d8A9d2C66B2d3`

- **`--skip-verify`** (flag): Skip contract verification
  - **Default**: Verification enabled for mainnet/testnet
  - **Usage**: Add flag to skip verification

#### Features

✅ **Ignition Framework**: Uses Hardhat Ignition for robust deployment management  
✅ **Resumable Deployments**: Can resume interrupted deployments  
✅ **Atomic Operations**: Ensures all contracts deploy successfully or none do  
✅ **Parameter Management**: Clean parameter passing to deployment modules  
✅ **Enhanced Verification**: Automatically verifies contracts with 5-confirmation waiting  

### 3. `deploy:verify` - Verify Deployed Contracts

Verify already-deployed contracts on block explorers with enhanced reliability features.

#### Usage

```bash
# Manual verification with contract addresses
npx hardhat deploy:verify \
  --dps 0xDA7A3A73d3bAf09AE79Bac612f03B4c0d51859dB \
  --dpr 0xDA7A6cBEa6113fae8C55165e354bCab49b0923cE \
  --owner 0xDA00006427E534B1Acde93B9E66d8A9d2C66B2d3 \
  --royalty 10000000 \
  --network sepolia

# Auto-load from esp.deployments.ts (recommended)
npx hardhat deploy:verify --auto --network sepolia

# Custom confirmation waiting
npx hardhat deploy:verify --auto --confirmations 10 --network sepolia

# Skip confirmation waiting (immediate verification)
npx hardhat deploy:verify --auto --skip-wait --network sepolia
```

#### Parameters

- **`--dps`** (optional): DataPointStorage contract address
- **`--dpr`** (optional): DataPointRegistry contract address  
- **`--owner`** (optional): Owner address used in DPR constructor
- **`--royalty`** (optional): Royalty rate used in DPR constructor (in wei)
- **`--auto`** (flag): Automatically load contract data from `esp.deployments.ts`
- **`--confirmations`** (optional): Number of confirmations to wait before verification (default: 5)
- **`--skip-wait`** (flag): Skip waiting for confirmations before verification
- **`--chainid`** (optional): Chain ID to verify (defaults to current network)

#### Features

✅ **Auto-Loading**: Automatically loads contract addresses from deployment registry  
✅ **Confirmation Waiting**: Waits for block confirmations before verification attempts  
✅ **Real-time Feedback**: Shows current block and target block during waiting  
✅ **Fallback Support**: Gracefully handles verification failures  
✅ **Multi-Network**: Supports verification across different networks

### 4. `deploy:register` - Register Deployed Contracts

Register already-deployed contracts in the ESP deployment registry (`esp.deployments.ts`).

#### Usage

```bash
# Register contracts with transaction hashes
npx hardhat deploy:register \
  --dps 0xDA7A3A73d3bAf09AE79Bac612f03B4c0d51859dB \
  --dpr 0xDA7A6cBEa6113fae8C55165e354bCab49b0923cE \
  --owner 0xDA00006427E534B1Acde93B9E66d8A9d2C66B2d3 \
  --royalty 10000000 \
  --dps-tx 0xabc123... \
  --dpr-tx 0xdef456... \
  --network sepolia

# Register without transaction hashes (will use "TBD")
npx hardhat deploy:register \
  --dps 0xDA7A3A73d3bAf09AE79Bac612f03B4c0d51859dB \
  --dpr 0xDA7A6cBEa6113fae8C55165e354bCab49b0923cE \
  --owner 0xDA00006427E534B1Acde93B9E66d8A9d2C66B2d3 \
  --royalty 10000000 \
  --network sepolia
```

#### Parameters

- **`--dps`** (required): DataPointStorage contract address
- **`--dpr`** (required): DataPointRegistry contract address  
- **`--owner`** (required): Owner address used in DPR constructor
- **`--royalty`** (required): Royalty rate used in DPR constructor (in wei)
- **`--dps-deployer`** (optional): DPS deployer address (defaults to current signer)
- **`--dpr-deployer`** (optional): DPR deployer address (defaults to current signer)
- **`--dps-tx`** (optional): DPS transaction hash (default: "TBD")
- **`--dpr-tx`** (optional): DPR transaction hash (default: "TBD")
- **`--chainid`** (optional): Chain ID to register (defaults to current network)

#### Features

✅ **Registry Management**: Updates the centralized deployment registry  
✅ **Auto-Detection**: Automatically detects chain ID and deployer addresses  
✅ **Validation**: Ensures all required parameters are provided  
✅ **Integration**: Enables auto-loading for future verification tasks

## Examples

### Scenario 1: First Deployment with Default Settings

```bash
npx hardhat deploy:vanity --network sepolia
```

**Output:**
```
🚀 ESP Vanity Deployment Task
🌐 Network: sepolia

💰 Using default royalty rate: 1/1000th of current gas price
🔍 Contract verification: ENABLED with 5 confirmations wait
🚀 Starting quick & dirty vanity deployment script...

📡 Network: sepolia - ChainId: 11155111
🔍 Contract verification: ENABLED

📋 Deployment Configuration:
DPS Deployer (signer 0): 0xA717E0c570c86387a023ecf95805e2416e6d50EF
DPR Deployer (signer 1): 0xb37Be4AFc1d210c662E8F05FC0AaEd4EddDD809E
DPR Owner (signer 2): 0xDA00006427E534B1Acde93B9E66d8A9d2C66B2d3

...deployment process...

🔍 Starting enhanced contract verification procedure...
⏳ Waiting for 5 confirmations before verification to allow Etherscan indexing...
📊 Current block: 7123456, waiting for block: 7123461
⏳ Current block: 7123457, waiting...
⏳ Current block: 7123458, waiting...
✅ Reached block 7123461, proceeding with verification...

🔍 Verifying contracts on sepolia...
📋 Verifying DataPointStorage...
✅ DataPointStorage verified!
📋 Verifying DataPointRegistry...
✅ DataPointRegistry verified!
🎉 Verification process completed!

🎉 Deployment completed successfully!

📄 Deployment Summary:
============================================================
Network:          sepolia
DataPointStorage: 0xDA7A3A73d3bAf09AE79Bac612f03B4c0d51859dB (deployed)
DataPointRegistry: 0xDA7A6cBEa6113fae8C55165e354bCab49b0923cE (deployed)
Owner:            0xDA00006427E534B1Acde93B9E66d8A9d2C66B2d3
Royalty Rate:     20.0 GWEI
Etherscan:        Contracts verified on block explorer
============================================================

🎉 Vanity deployment completed successfully!
📍 DPS: 0xDA7A3A73d3bAf09AE79Bac612f03B4c0d51859dB
📍 DPR: 0xDA7A6cBEa6113fae8C55165e354bCab49b0923cE
```

### Scenario 2: Deployment with Custom Royalty Rate

```bash
npx hardhat deploy:vanity --royalty 0.01 --network sepolia
```

**Output:**
```
🚀 ESP Vanity Deployment Task
🌐 Network: sepolia

💰 Using custom royalty rate: 0.01 GWEI (10000000 wei)
...deployment process with 0.01 GWEI rate...
```

### Scenario 3: Local Development Deployment

```bash
npx hardhat deploy:vanity --royalty 1.0 --network localhost
```

**Output:**
```
🚀 ESP Vanity Deployment Task
🌐 Network: localhost

💰 Using custom royalty rate: 1.0 GWEI (1000000000 wei)
🚀 Starting vanity deployment script...

📡 Network: localhost
🔍 Contract verification: DISABLED (local network)
...deployment without verification...
```

### Scenario 4: Enhanced Auto Verification

```bash
# Auto-load contract data and verify with default 5 confirmations
npx hardhat deploy:verify --auto --network sepolia
```

**Output:**
```
📋 Auto-loading contract data from esp.deployments.ts...
✅ Loaded deployment for chain ID 11155111
📍 DPS: 0xDA7Adb41ac559e689fE170aE4f2853a450e6E4Cc
📍 DPR: 0xDA7Ae59Fa1DB9B138dddaaFB6153B11B162Cfd8B
👤 Owner: 0xDA00006427E534B1Acde93B9E66d8A9d2C66B2d3
💰 Royalty: 1079 wei

⏳ Waiting for 5 confirmations before verification to allow Etherscan indexing...
📊 Current block: 7123456, waiting for block: 7123461
⏳ Current block: 7123457, waiting...
✅ Reached block 7123461, proceeding with verification...

🔍 Verifying contracts on sepolia...
📋 Verifying DataPointStorage...
ℹ️  DataPointStorage already verified
📋 Verifying DataPointRegistry...
ℹ️  DataPointRegistry already verified
🎉 Verification process completed!
```

### Scenario 5: Manual Verification with Custom Parameters

```bash
# Manual verification with specific parameters
npx hardhat deploy:verify \
  --dps 0xDA7A3A73d3bAf09AE79Bac612f03B4c0d51859dB \
  --dpr 0xDA7A6cBEa6113fae8C55165e354bCab49b0923cE \
  --owner 0xDA00006427E534B1Acde93B9E66d8A9d2C66B2d3 \
  --royalty 10000000 \
  --confirmations 10 \
  --network sepolia
```

## Royalty Rate Guidelines

### Recommended Rates by Network

| Network | Recommended Rate | Reasoning |
|---------|------------------|-----------|
| **Mainnet** | 20-50 GWEI | Balance of affordability and sustainability |
| **Sepolia** | 0.01-1 GWEI | Low cost for testing |
| **Local** | 1-10 GWEI | Arbitrary for development |

### Conversion Reference

```bash
# Common conversions
0.01 GWEI = 10,000,000 wei       # Very low (testing)
0.1 GWEI  = 100,000,000 wei      # Low 
1 GWEI    = 1,000,000,000 wei    # Medium
10 GWEI   = 10,000,000,000 wei   # High
100 GWEI  = 100,000,000,000 wei  # Very high
```

### Calculation Logic

The default royalty rate is calculated as:
```
royaltyRate = currentGasPrice / 1000
```

This ensures the royalty rate scales with network congestion while remaining affordable.

## Account Configuration

The deployment tasks use the following signer configuration:

- **Signer 0**: DPS Deployer (`DPS_DEPLOYER_MNEMONIC`)
- **Signer 1**: DPR Deployer (`DPR_DEPLOYER_MNEMONIC`) 
- **Signer 2**: Contract Owner (`OWNER_MNEMONIC`)

### Environment Variables

Ensure these are set in your `.env` file:
```bash
DPS_DEPLOYER_MNEMONIC="your dps deployer mnemonic"
DPR_DEPLOYER_MNEMONIC="your dpr deployer mnemonic"
OWNER_MNEMONIC="your owner mnemonic"
ETHERSCAN_API_KEY="your etherscan api key"
```

## Integration Features

### Automatic Registry Updates

Successfully deployed contracts are automatically added to `esp.deployments.ts`:

```typescript
export const espDeployments = {
  networks: {
    sepolia: {
      dps: {
        contractAddress: '0xDA7A3A73d3bAf09AE79Bac612f03B4c0d51859dB',
        deployerAddress: '0xA717E0c570c86387a023ecf95805e2416e6d50EF',
        txHash: '0x6ae0d874cbeaeeefeec882c80e65bd55c024dc73e2fe16f6c142b0db71bd0d52',
        deployedAt: '2025-05-31T18:47:24.000Z'
      },
      dpr: {
        contractAddress: '0xDA7A6cBEa6113fae8C55165e354bCab49b0923cE',
        deployerAddress: '0xb37Be4AFc1d210c662E8F05FC0AaEd4EddDD809E',
        txHash: '0x2c30246bb7b7db7cd9d0d147103b2793b660e08110aa2690de727ae49b7e1a93',
        deployedAt: '2025-05-31T18:59:12.000Z',
        constructors: {
          ownerAddress: '0xDA00006427E534B1Acde93B9E66d8A9d2C66B2d3',
          dpsAddress: '0xDA7A3A73d3bAf09AE79Bac612f03B4c0d51859dB',
          royaltyRate: '10000000' // in wei
        }
      }
    }
  }
};
```

## Error Handling

### Common Issues

1. **Insufficient Funds**:
   ```
   ❌ Owner has insufficient funds to cover DPR deployment!
   ```
   **Solution**: Fund the owner account with ETH

2. **Vanity Nonce Error**:
   ```
   ❌ Vanity nonce error: DPR deployer nonce is 1, expected 0
   ```
   **Solution**: Use a fresh deployer account for vanity addresses

3. **Network Not Found**:
   ```
   ❌ No DPR deployment found for network: unknown_network
   ```
   **Solution**: Check network name in hardhat.config.ts

## Best Practices

1. **Test First**: Always deploy to testnets before mainnet
2. **Verify Rates**: Double-check royalty rates before deployment
3. **Fund Accounts**: Ensure all deployer accounts have sufficient ETH
4. **Save Results**: Keep deployment addresses and transaction hashes
5. **Monitor Costs**: Track gas usage for cost optimization

## Troubleshooting

### Compilation Issues
```bash
npx hardhat build
```

### Network Issues
Check RPC endpoints in `hardhat.config.ts`

### Verification Failures
Manually verify using `deploy:verify` task or Etherscan interface

## Integration with Other Tools

These deployment tasks work seamlessly with:
- **Royalty Management**: Use `npx hardhat royalty:set` to modify rates post-deployment
- **Status Checking**: Use existing status scripts to monitor deployments
- **Testing Framework**: Deploy to localhost for testing

The deployment tasks provide a complete, production-ready solution for ESP contract deployment with excellent developer experience and comprehensive safety features. 