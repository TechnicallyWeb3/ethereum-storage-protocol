# ESP NPM Package Publishing Guide

## Package Overview

The `ethereum-storage-protocol` NPM package provides TypeScript types, contract interfaces, and deployment information for the Ethereum Storage Protocol. It's designed to be a comprehensive SDK for developers integrating ESP into their applications.

## What's Included

### 📦 Package Contents

- **Contract Types**: TypeScript interfaces for all ESP contracts
- **Contract Factories**: TypeChain-generated factories for contract deployment and connection
- **Contract ABIs**: JSON ABIs for all ESP contracts
- **Deployment Information**: Network addresses and deployment metadata
- **Utility Functions**: Helper functions for working with deployments
- **Source Contracts**: Original Solidity contract files (excluding tests)

### 🏗️ Build Outputs

The package supports multiple module formats:

- **CommonJS** (`dist/cjs/`): For Node.js environments
- **ES Modules** (`dist/esm/`): For modern bundlers and browsers
- **TypeScript Declarations** (`dist/types/`): For TypeScript support

### 📁 Directory Structure

```
dist/
├── cjs/                    # CommonJS build
├── esm/                    # ES Modules build
├── types/                  # TypeScript declarations
└── contracts/              # Solidity source files
    ├── DataPointRegistry.sol
    ├── DataPointStorage.sol
    └── interfaces/
        ├── ESPTypes.sol
        ├── IDataPointRegistry.sol
        └── IDataPointStorage.sol
```

## Publishing Steps

### 1. Pre-Publishing Checklist

- [ ] All tests pass (`npm test`)
- [ ] Build completes successfully (`npm run build`)
- [ ] Package contents are correct (`npm pack --dry-run`)
- [ ] Version number is updated in `package.json`
- [ ] README.md is up to date
- [ ] CHANGELOG.md is updated (if applicable)

### 2. Version Management

```bash
# Patch version (bug fixes)
npm version patch

# Minor version (new features)
npm version minor

# Major version (breaking changes)
npm version major
```

### 3. Publishing to NPM

```bash
# Login to NPM (if not already logged in)
npm login

# Publish the package
npm publish

# For beta/alpha releases
npm publish --tag beta
npm publish --tag alpha
```

### 4. Post-Publishing

- [ ] Verify package on npmjs.com
- [ ] Test installation: `npm install ethereum-storage-protocol`
- [ ] Update documentation
- [ ] Create GitHub release
- [ ] Announce to community

## Package Configuration

### Entry Points

The package provides multiple entry points for different use cases:

```json
{
  "main": "./dist/cjs/index.js",           // CommonJS entry
  "module": "./dist/esm/index.js",         // ES Module entry
  "types": "./dist/types/index.d.ts",      // TypeScript declarations
  "exports": {
    ".": {                                 // Main package
      "import": "./dist/esm/index.js",
      "require": "./dist/cjs/index.js",
      "types": "./dist/types/index.d.ts"
    },
    "./contracts": {                       // Contract utilities
      "import": "./dist/esm/contracts/index.js",
      "require": "./dist/cjs/contracts/index.js",
      "types": "./dist/types/contracts/index.d.ts"
    },
    "./types": {                          // TypeScript types only
      "import": "./dist/esm/types/index.js",
      "require": "./dist/cjs/types/index.js",
      "types": "./dist/types/types/index.d.ts"
    },
    "./deployments": {                    // Deployment utilities
      "import": "./dist/esm/deployments.js",
      "require": "./dist/cjs/deployments.js",
      "types": "./dist/types/deployments.d.ts"
    }
  }
}
```

### Dependencies

- **Peer Dependencies**: `@openzeppelin/contracts` (required by users)
- **Dev Dependencies**: Build tools and testing frameworks
- **No Runtime Dependencies**: Package is self-contained

## Usage Examples

### Basic Usage

```typescript
import { 
  DataPointRegistry__factory, 
  DataPointStorage__factory,
  getContractAddress 
} from 'ethereum-storage-protocol';

// Connect to deployed contracts
const dpsAddress = getContractAddress('sepolia', 'dps');
const dataPointStorage = DataPointStorage__factory.connect(dpsAddress, signer);
```

### Contract ABIs Only

```typescript
import { 
  DataPointRegistryABI,
  DataPointStorageABI 
} from 'ethereum-storage-protocol/contracts';

// Use with ethers.js
const contract = new ethers.Contract(address, DataPointRegistryABI, signer);
```

### TypeScript Types

```typescript
import type { 
  DataPointRegistry,
  ContractTransaction 
} from 'ethereum-storage-protocol/types';

// Use for type annotations
async function registerData(
  registry: DataPointRegistry, 
  data: string
): Promise<ContractTransaction> {
  return registry.registerDataPoint(ethers.toUtf8Bytes(data), signer.address);
}
```

## Maintenance

### Regular Updates

1. **Contract Updates**: When contracts are modified, regenerate TypeChain types
2. **Deployment Updates**: Update `esp.deployments.ts` with new network deployments
3. **Version Bumps**: Follow semantic versioning for all releases
4. **Security Updates**: Keep dependencies updated

### Build Process

The build process is automated through npm scripts:

```bash
npm run clean          # Remove dist directory
npm run build:types    # Generate TypeScript declarations
npm run build:cjs      # Build CommonJS modules
npm run build:esm      # Build ES modules
npm run copy:contracts # Copy Solidity files
npm run build          # Run all build steps
```

## Troubleshooting

### Common Issues

1. **TypeChain Types Missing**: Ensure `typechain-types` directory exists and is populated
2. **Build Failures**: Check TypeScript configuration and dependencies
3. **Import Errors**: Verify export paths in package.json
4. **Size Issues**: Use `.npmignore` to exclude unnecessary files

### Support

- GitHub Issues: Report bugs and feature requests
- Documentation: Keep README.md updated with examples
- Community: Engage with users for feedback and improvements 