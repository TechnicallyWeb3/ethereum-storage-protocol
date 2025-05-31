# DPR Royalty Rate Management

This document explains how to manage royalty rates for the DataPointRegistry (DPR) contract using the provided scripts and Hardhat tasks.

## Overview

The DPR contract has a `royaltyRate` parameter that determines the cost for accessing existing data points. Only the contract owner can modify this rate using the `setRoyaltyRate(uint256 _royaltyRate)` function.

## Available Tools

### 1. Script: `SetRoyaltyRate.ts`

Located in `scripts/SetRoyaltyRate.ts`, this script provides programmatic access to royalty rate management.

#### Usage with environment variables:

```bash
# Get current royalty rate
ACTION=get npx hardhat run scripts/SetRoyaltyRate.ts --network sepolia

# Set new royalty rate
ACTION=set ROYALTY_RATE=1000000000000000 npx hardhat run scripts/SetRoyaltyRate.ts --network sepolia

# Set royalty rate with custom signer
ACTION=set ROYALTY_RATE=2000000000000000 SIGNER_INDEX=2 npx hardhat run scripts/SetRoyaltyRate.ts --network sepolia
```

### 2. Hardhat Tasks

#### Main Task: `royalty`

```bash
# Get current royalty rate
npx hardhat royalty get --network sepolia

# Set new royalty rate
npx hardhat royalty set --rate 1000000000000000 --network sepolia

# Set royalty rate with custom signer
npx hardhat royalty set --rate 1000000000000000 --signer 2 --network sepolia
```

#### Convenience Tasks:

```bash
# Get current royalty rate (shorthand)
npx hardhat royalty:get --network sepolia

# Set new royalty rate (shorthand)
npx hardhat royalty:set --rate 1000000000000000 --network sepolia
```

## Parameters

### Royalty Rate
- **Format**: Wei (string)
- **Example**: `"1000000000000000"` = 0.001 ETH = 1,000 GWEI
- **Purpose**: Cost charged for accessing existing data points

### Signer Index
- **Default**: 2 (TW3 owner account)
- **Range**: 0-5 (based on hardhat config)
- **Account mapping**:
  - 0: DPS Deployer
  - 1: DPR Deployer  
  - 2: TW3 Owner (default)
  - 3: User 1
  - 4: User 2
  - 5: User 3

## Network Support

The tools automatically detect deployed contracts using the `esp.deployments.ts` registry. Currently supported networks:
- `sepolia` (Ethereum testnet)
- `localhost` (for local development)
- `hardhat` (for testing)

## Security Features

1. **Owner Verification**: Scripts verify that the signer is the contract owner before attempting to modify the royalty rate
2. **Network Detection**: Automatically connects to the correct contract based on the selected network
3. **Transaction Confirmation**: Waits for transaction confirmation and reports gas usage
4. **Rate Comparison**: Checks if the new rate differs from the current rate to avoid unnecessary transactions

## Examples

### Scenario 1: Check Current Rate

```bash
npx hardhat royalty:get --network sepolia
```

Output:
```
📊 Getting current royalty rate on sepolia network...
📍 DPR Contract Address: 0xDA7A6cBEa6113fae8C55165e354bCab49b0923cE
📊 Current royalty rate: 1000000000000000 wei
💰 In GWEI: 1000.0 GWEI
```

### Scenario 2: Update Royalty Rate

```bash
npx hardhat royalty:set --rate 2000000000000000 --network sepolia
```

Output:
```
🌐 Network: sepolia
👤 Using signer index: 2
🔧 Setting royalty rate on sepolia network...
📍 DPR Contract Address: 0xDA7A6cBEa6113fae8C55165e354bCab49b0923cE
💰 New Royalty Rate: 2000000000000000 wei
👤 Using signer: 0xDA00006427E534B1Acde93B9E66d8A9d2C66B2d3
📊 Current royalty rate: 1000000000000000 wei
🚀 Sending transaction to set new royalty rate...
⏳ Transaction hash: 0x...
⏳ Waiting for confirmation...
✅ Royalty rate successfully updated!
📊 Previous rate: 1000000000000000 wei
📊 New rate: 2000000000000000 wei
⛽ Gas used: 28956
🧾 Block number: 7234567
```

### Scenario 3: Rate Already Set

```bash
npx hardhat royalty:set --rate 1000000000000000 --network sepolia
```

Output:
```
✅ Royalty rate is already set to 1000000000000000 wei. No change needed.
```

## Error Handling

### Common Errors

1. **Network not found**:
   ```
   ❌ No DPR deployment found for network: unknown_network
   ```

2. **Access denied**:
   ```
   ❌ Access denied: 0x123... is not the contract owner (0x456...)
   ```

3. **Invalid signer index**:
   ```
   ❌ Signer index 10 out of range. Available signers: 0-5
   ```

4. **Missing rate parameter**:
   ```
   ❌ Rate parameter is required for 'set' action. Use --rate <value_in_wei>
   ```

## Rate Calculation Helper

To convert between units for royalty rates:

```javascript
// In Node.js or browser console with ethers
const { ethers } = require('ethers');

// Convert 1000 GWEI to wei
const rateInWei = ethers.parseUnits("1000", "gwei").toString();
console.log(rateInWei); // "1000000000000"

// Convert 0.001 ETH to wei (same as 1000 GWEI)
const rateInWei2 = ethers.parseEther("0.001").toString();
console.log(rateInWei2); // "1000000000000000"

// Convert wei back to GWEI for verification
const rateInGwei = ethers.formatUnits("1000000000000000", "gwei");
console.log(rateInGwei); // "1000.0"

// Convert wei back to ETH for verification
const rateInEth = ethers.formatEther("1000000000000000");
console.log(rateInEth); // "0.001"
```

## Integration in Other Scripts

You can import and use the functions in other scripts:

```typescript
import { setRoyaltyRate, getCurrentRoyaltyRate } from './scripts/SetRoyaltyRate';

// Get current rate
const currentRate = await getCurrentRoyaltyRate('sepolia');

// Set new rate
await setRoyaltyRate('sepolia', '2000000000000000', 2);
```

## Best Practices

1. **Test on testnets first**: Always test royalty rate changes on Sepolia before mainnet
2. **Use appropriate rates**: Consider gas costs and user experience when setting rates
3. **Monitor impact**: Track data point access patterns after rate changes
4. **Document changes**: Keep records of rate changes and their business justification
5. **Coordinate with team**: Ensure rate changes align with protocol economics

## Troubleshooting

### Compilation Issues
If you encounter TypeScript compilation errors, make sure:
```bash
npx hardhat compile
```

### Network Connection Issues
Verify your network configuration in `hardhat.config.ts` and ensure RPC endpoints are accessible.

### Permission Issues
Ensure you're using the correct signer account that owns the DPR contract. Check the deployment registry for the correct owner address. 