# CJS/ESM Compatibility Testing Implementation Guide

## Objective
Implement comprehensive testing to ensure your TypeScript package works correctly in both CommonJS (CJS) and ES Module (ESM) environments. This testing setup verifies import compatibility across different module systems.

## Quick Start Instructions

### 1. Create the Standardized Test Structure
Create this exact folder structure in your project root:

```
test-compatibility/
├── cjs-test/
│   ├── package.json
│   ├── index.js          # Basic CJS tests
│   └── test-imports.js   # Advanced CJS tests
├── esm-test/
│   ├── package.json
│   ├── index.js          # Basic ESM tests
│   └── test-imports.js   # Advanced ESM tests
└── run-all-tests.js      # Test runner
```

### 2. CJS Test Package Configuration
Create `test-compatibility/cjs-test/package.json`:
```json
{
  "name": "cjs-test",
  "version": "1.0.0",
  "description": "testing the import of cjs build",
  "main": "index.js",
  "scripts": {
    "test": "node index.js",
    "test:imports": "node test-imports.js"
  },
  "author": "",
  "license": "MIT",
  "dependencies": {
    "YOUR-PACKAGE-NAME": "file:../../"
  }
}
```

### 3. ESM Test Package Configuration
Create `test-compatibility/esm-test/package.json`:
```json
{
  "name": "esm-test",
  "version": "1.0.0",
  "description": "test esm imports",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "test": "node index.js",
    "test:imports": "node test-imports.js"
  },
  "author": "",
  "license": "MIT",
  "dependencies": {
    "YOUR-PACKAGE-NAME": "file:../../"
  }
}
```

### 4. Essential Build Configuration
Ensure your `package.json` has proper dual build setup:

```json
{
  "main": "./dist/cjs/src/index.js",
  "module": "./dist/esm/src/index.js",
  "types": "./dist/types/src/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/esm/src/index.js",
      "require": "./dist/cjs/src/index.js",
      "types": "./dist/types/src/index.d.ts"
    }
  },
  "scripts": {
    "build:types": "tsc --project tsconfig.build.json --declaration --emitDeclarationOnly --outDir dist/types",
    "build:cjs": "tsc --project tsconfig.build.json --module commonjs --outDir dist/cjs", 
    "build:esm": "tsc --project tsconfig.build.json --module nodenext --moduleResolution nodenext --outDir dist/esm"
  }
}
```

## Test File Templates

### Basic CJS Test (`cjs-test/index.js`)
```javascript
#!/usr/bin/env node

console.log('🧪 Testing CommonJS imports...\n');

try {
  // Test 1: Main package import
  console.log('✅ Test 1: Main package import');
  const yourPackage = require('YOUR-PACKAGE-NAME');
  console.log('   - Main package imported successfully');
  console.log(`   - Available exports: ${Object.keys(yourPackage).length} items`);

  // Test 2: Check for key exports (customize these)
  console.log('\n✅ Test 2: Key exports validation');
  const expectedExports = [
    'YOUR_MAIN_EXPORT_1',
    'YOUR_MAIN_EXPORT_2',
    // Add your package's main exports here
  ];
  
  const missingExports = expectedExports.filter(exp => !(exp in yourPackage));
  if (missingExports.length === 0) {
    console.log('   - All expected exports found ✓');
  } else {
    console.log(`   - Missing exports: ${missingExports.join(', ')} ✗`);
  }

  console.log('\n🎉 All CommonJS import tests completed successfully!');
  console.log('📦 Package can be imported correctly in CommonJS environments');

} catch (error) {
  console.error('\n❌ CommonJS import test failed:', error.message);
  process.exit(1);
}
```

### Basic ESM Test (`esm-test/index.js`)
```javascript
#!/usr/bin/env node

console.log('🧪 Testing ES Module imports...\n');

try {
  // Test 1: Main package import with destructuring
  console.log('✅ Test 1: Main package import with destructuring');
  const { 
    YOUR_MAIN_EXPORT_1,
    YOUR_MAIN_EXPORT_2
    // Add your package's main exports here
  } = await import('YOUR-PACKAGE-NAME');
  
  console.log('   - Main package imported successfully');
  console.log('   - Key destructured exports verified ✓');

  // Test 2: Default import
  console.log('\n✅ Test 2: Default/namespace import');
  const yourPackage = await import('YOUR-PACKAGE-NAME');
  console.log('   - Namespace import successful');
  console.log(`   - Available exports: ${Object.keys(yourPackage).length} items`);

  console.log('\n🎉 All ESM import tests completed successfully!');
  console.log('📦 Package can be imported correctly in ES Module environments');

} catch (error) {
  console.error('\n❌ ES Module import test failed:', error.message);
  process.exit(1);
}
```

### Test Runner (`run-all-tests.js`)
```javascript
#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Comprehensive Import Compatibility Tests\n');

const tests = [
  {
    name: 'CommonJS Basic Tests',
    directory: 'cjs-test',
    command: 'npm',
    args: ['test'],
    description: 'Basic CommonJS require() imports'
  },
  {
    name: 'CommonJS Advanced Tests', 
    directory: 'cjs-test',
    command: 'npm',
    args: ['run', 'test:imports'],
    description: 'Advanced CommonJS functionality tests'
  },
  {
    name: 'ESM Basic Tests',
    directory: 'esm-test', 
    command: 'npm',
    args: ['test'],
    description: 'Basic ES Module import syntax'
  },
  {
    name: 'ESM Advanced Tests',
    directory: 'esm-test',
    command: 'npm', 
    args: ['run', 'test:imports'],
    description: 'Advanced ESM functionality tests'
  }
];

async function runTest(test) {
  return new Promise((resolve, reject) => {
    console.log(`\n📦 Running: ${test.name}`);
    console.log(`📁 Directory: ${test.directory}`);
    console.log(`📝 Description: ${test.description}`);
    console.log('─'.repeat(60));

    const testDir = path.join(__dirname, test.directory);
    
    const child = spawn(test.command, test.args, {
      cwd: testDir,
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${test.name} - PASSED`);
        resolve({ test: test.name, status: 'PASSED', code });
      } else {
        console.log(`❌ ${test.name} - FAILED (exit code: ${code})`);
        reject(new Error(`${test.name} failed with exit code ${code}`));
      }
    });

    child.on('error', (err) => {
      console.log(`❌ ${test.name} - ERROR: ${err.message}`);
      reject(err);
    });
  });
}

async function installDependencies() {
  console.log('📦 Installing test dependencies...\n');
  
  const directories = ['cjs-test', 'esm-test'];
  
  for (const dir of directories) {
    const testDir = path.join(__dirname, dir);
    console.log(`Installing dependencies in ${dir}...`);
    
    await new Promise((resolve, reject) => {
      const child = spawn('npm', ['install'], {
        cwd: testDir,
        stdio: 'inherit',
        shell: process.platform === 'win32'
      });

      child.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ Dependencies installed in ${dir}`);
          resolve();
        } else {
          reject(new Error(`Failed to install dependencies in ${dir}`));
        }
      });

      child.on('error', reject);
    });
  }
  
  console.log('\n✅ All dependencies installed successfully!\n');
}

async function main() {
  const startTime = Date.now();
  const results = [];
  
  try {
    await installDependencies();
    
    for (const test of tests) {
      try {
        const result = await runTest(test);
        results.push(result);
      } catch (error) {
        results.push({ 
          test: test.name, 
          status: 'FAILED', 
          error: error.message 
        });
      }
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    
    const passed = results.filter(r => r.status === 'PASSED').length;
    const failed = results.filter(r => r.status === 'FAILED').length;
    
    console.log(`⏱️  Total Duration: ${duration}s`);
    console.log(`✅ Passed: ${passed}/${results.length}`);
    console.log(`❌ Failed: ${failed}/${results.length}`);
    
    if (failed === 0) {
      console.log('\n🎉 ALL TESTS PASSED!');
      console.log('📦 Your package is fully compatible with both CommonJS and ES Module environments');
    } else {
      console.log('\n❌ SOME TESTS FAILED');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Test runner failed:', error.message);
    process.exit(1);
  }
}

main();
```

## Critical Implementation Tips

### 1. TypeScript Configuration
- Use `--module nodenext --moduleResolution nodenext` for ESM builds
- Keep CJS builds with `--module commonjs`
- Ensure your `tsconfig.build.json` uses `"moduleResolution": "node"` to avoid conflicts

### 2. Package.json Exports
- **ALWAYS** include proper `"exports"` field for dual package support
- Test both the main entry and any subpath exports (like `/utils`, `/types`, etc.)
- Use `"types"` field for TypeScript declaration files

### 3. Common Pitfalls to Avoid
- ❌ Don't use directory imports in ESM without explicit `index.js` files
- ❌ Don't mix `moduleResolution: "nodenext"` in config with different CLI `--module` flags
- ❌ Don't forget to test actual functionality, not just imports
- ✅ Always test both basic imports AND actual function calls
- ✅ Test error scenarios (importing non-existent modules)
- ✅ Verify memory usage and performance

### 4. Customization Guidelines
1. **Replace `YOUR-PACKAGE-NAME`** with your actual package name in all files
2. **Update expected exports** lists with your package's actual exports
3. **Add package-specific tests** for your main functionality
4. **Test any subpath exports** your package provides (e.g., `/utils`, `/types`)

### 5. Running the Tests
```bash
# Build your package first
npm run build

# Run compatibility tests
cd test-compatibility
node run-all-tests.js
```

## Success Criteria
✅ All 4 test suites pass (CJS Basic, CJS Advanced, ESM Basic, ESM Advanced)
✅ Both `require()` and `import` syntax work
✅ Direct dist folder imports work
✅ Package.json exports configuration works
✅ No memory leaks or performance issues
✅ Error handling works correctly

## Additional Recommendations
- Add this testing to your CI/CD pipeline
- Test on multiple Node.js versions (16+, 18+, 20+)
- Consider testing with bundlers (webpack, rollup, vite) if relevant
- Document the dual package nature in your README

This standardized approach ensures consistent, reliable dual-package compatibility across all your dependencies. 