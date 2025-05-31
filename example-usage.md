# How to Use AddDeployment Helper in DeployVanity.ts

## Add this import at the top of your DeployVanity.ts:

```typescript
import { addDeployment, formatDeploymentData } from './AddDeployment';
```

## Add this at the end of your deployment (after the summary log):

```typescript
// Update deployment registry
console.log("\n📝 Updating deployment registry...");

try {
  const deploymentData = formatDeploymentData(
    network,
    {
      address: dpsAddress,
      deployerAddress: dpsSigner.address,
      txHash: dataPointStorage.deploymentTransaction()?.hash // Get actual tx hash
    },
    {
      address: dprAddress,
      deployerAddress: dprSigner.address,
      txHash: dataPointRegistry.deploymentTransaction()?.hash, // Get actual tx hash
      owner: owner.address,
      dpsAddress: dpsAddress,
      royaltyRate: royaltyRate
    }
  );
  
  await addDeployment(deploymentData);
} catch (error) {
  console.log("⚠️  Failed to update deployment registry:", error.message);
  console.log("You can manually update esp.deployments.ts with the deployment info");
}
```

## The helper will automatically:
- ✅ Add the network to esp.deployments.ts if it doesn't exist
- ✅ Update the network if it already exists  
- ✅ Include transaction hashes and timestamps
- ✅ Format constructor parameters correctly
- ✅ Handle errors gracefully

## Example output in esp.deployments.ts:

```typescript
mainnet: {
  dps: {
    contractAddress: '0x1234...',
    deployerAddress: '0xABCD...',
    txHash: '0x5678...',
    deployedAt: '2024-12-20T15:30:45.123Z'
  },
  dpr: {
    contractAddress: '0x9876...',
    deployerAddress: '0xEFGH...',
    txHash: '0x2468...',
    deployedAt: '2024-12-20T15:31:02.456Z',
    constructors: {
      ownerAddress: '0x1111...',
      dpsAddress: '0x1234...',
      royaltyRate: '1000000000000000'
    }
  }
}
``` 