# Implementation Tasks

## Task 1: Create Separate Local Deployments Storage

**Priority:** High  
**Estimated Effort:** Medium  
**Files to Modify:**
- Create new file: `src/local-deployments.ts`
- Modify: `src/deployments.ts`

**Implementation Steps:**
1. Create a new file `src/local-deployments.ts` with functions for managing local deployments
2. Implement functions to read/write deployments to `~/.esp/local.deployments.json`
3. Modify `getContractAddress` in `src/deployments.ts` to check both official and local deployments
4. Update the CLI command to use the new local deployments storage

**Code Example:**
```typescript
// src/local-deployments.ts
export function getLocalDeploymentsPath(): string {
  const espDir = path.join(os.homedir(), '.esp');
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(espDir)) {
    fs.mkdirSync(espDir, { recursive: true });
  }
  
  return path.join(espDir, 'local.deployments.json');
}

export function addLocalDeployment(deploymentData: LocalDeploymentData, options: any = {}): void {
  // Implementation...
}

// src/deployments.ts
export function getContractAddress(chainId: number, contract: 'dps' | 'dpr'): string | undefined {
  // First check official deployments
  const officialDeployments = require('../esp.deployments').espDeployments;
  const officialAddress = officialDeployments.chains[chainId]?.[contract]?.contractAddress;
  
  if (officialAddress) {
    return officialAddress;
  }
  
  // Then check local deployments
  const { getLocalDeployments } = require('./local-deployments');
  const localDeployments = getLocalDeployments();
  return localDeployments[chainId]?.[contract]?.contractAddress;
}
```

## Task 2: Create Flexible Deployment API

**Priority:** Medium  
**Estimated Effort:** Medium  
**Files to Modify:**
- Create new file: `src/deploy.ts`

**Implementation Steps:**
1. Create a new file `src/deploy.ts` with a function for deploying contracts
2. Implement a function that accepts either hre or provider/signer
3. Implement sensible defaults for deployment parameters
4. Return deployment information for further use

**Code Example:**
```typescript
// src/deploy.ts
export async function deployESP(hreOrOptions: any, options: any = {}) {
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
    // Implementation...
  }
  
  // Deploy contracts
  // Implementation...
  
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
```

## Task 3: Create Unified Deployment Command

**Priority:** Medium  
**Estimated Effort:** Low  
**Files to Modify:**
- Create new file: `tasks/esp-deploy.ts`
- Modify: `hardhat.config.ts`

**Implementation Steps:**
1. Create a new file `tasks/esp-deploy.ts` with a Hardhat task for deploying and registering contracts
2. Import the task in `hardhat.config.ts`
3. Implement the task to use the new deployment API and local deployments storage

**Code Example:**
```typescript
// tasks/esp-deploy.ts
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
  .setAction(async (taskArgs, hre) => {
    // Implementation...
  });

// hardhat.config.ts
import "./tasks/esp-deploy";
```

## Task 4: Update Documentation

**Priority:** Low  
**Estimated Effort:** Low  
**Files to Modify:**
- `README.md`
- Other documentation files

**Implementation Steps:**
1. Update documentation to consistently reference both package names
2. Add clear examples for local deployment scenarios
3. Include information about the default values and how to override them

**Example Documentation:**
```markdown
## Local Deployments

You can deploy ESP contracts to your local environment using the following methods:

### Using Hardhat

```typescript
// Deploy and register in one step
npx hardhat esp:deploy-local --network localhost

// With custom parameters
npx hardhat esp:deploy-local --network localhost --royalty 0.2 --owner 0x123...
```

### Using the Deployment API

```typescript
import { deployESP } from 'ethereum-storage'; // or '@tw3/esp'

// With Hardhat
const { dps, dpr } = await deployESP(hre, { 
  royaltyRate: ethers.parseUnits("0.1", "gwei"),
  owner: deployer.address
});

// With provider
const { dps, dpr } = await deployESP({ 
  provider,
  signer,
  royaltyRate: ethers.parseUnits("0.1", "gwei")
});
```
```

## Task 5: Write Tests

**Priority:** Medium  
**Estimated Effort:** Medium  
**Files to Modify:**
- Create new files in `test/` directory

**Implementation Steps:**
1. Create test files for the new functionality
2. Implement tests for local deployments storage
3. Implement tests for the deployment API
4. Implement tests for the unified deployment command

**Example Test:**
```typescript
// test/local-deployments.test.ts
describe('Local Deployments', function() {
  it('should store and retrieve local deployments', async function() {
    // Implementation...
  });
  
  it('should handle multiple deployments for different chain IDs', async function() {
    // Implementation...
  });
  
  it('should handle invalid deployments appropriately', async function() {
    // Implementation...
  });
});
```