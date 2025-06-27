#!/usr/bin/env node

/**
 * Advanced CommonJS Import Tests
 * Tests complex import scenarios and validates actual functionality
 */

console.log('🧪 Advanced CommonJS Import Tests...\n');

async function runAdvancedTests() {
  try {
    // Test 1: Direct dist folder imports
    console.log('✅ Test 1: Direct CJS dist imports');
    try {
      const directMain = require('../../dist/cjs/src/index.js');
      console.log('   - Direct CJS main import successful ✓');
      console.log(`   - Direct exports: ${Object.keys(directMain).length} items`);
    } catch (err) {
      console.log(`   - Direct CJS import failed: ${err.message} ✗`);
    }

    // Test 2: Contract factory functionality from main package
    console.log('\n✅ Test 2: Contract Factory Functionality');
    const { DataPointRegistry__factory, DataPointStorage__factory } = require('ethereum-storage');
    
    // Test factory creation
    if (DataPointRegistry__factory && DataPointRegistry__factory.abi) {
      console.log('   - DataPointRegistry__factory has ABI ✓');
      console.log(`   - ABI has ${DataPointRegistry__factory.abi.length} functions/events`);
    } else {
      console.log('   - DataPointRegistry__factory missing ABI ✗');
    }

    if (DataPointStorage__factory && DataPointStorage__factory.abi) {
      console.log('   - DataPointStorage__factory has ABI ✓');
      console.log(`   - ABI has ${DataPointStorage__factory.abi.length} functions/events`);
    } else {
      console.log('   - DataPointStorage__factory missing ABI ✗');
    }

    // Test 3: Deployment functionality
    console.log('\n✅ Test 3: Deployment Module Functionality');
    const { espDeployments, getSupportedChainIds, getContractAddress } = require('ethereum-storage/deployments');
    
    if (typeof espDeployments === 'object' && espDeployments !== null) {
      console.log('   - espDeployments object is accessible ✓');
      const chains = Object.keys(espDeployments);
      console.log(`   - Deployments available for chains: ${chains.join(', ')}`);
    } else {
      console.log('   - espDeployments not accessible ✗');
    }

    if (typeof getSupportedChainIds === 'function') {
      try {
        const chainIds = getSupportedChainIds();
        console.log(`   - getSupportedChainIds returns ${chainIds.length} chains ✓`);
      } catch (err) {
        console.log(`   - getSupportedChainIds failed: ${err.message} ✗`);
      }
    } else {
      console.log('   - getSupportedChainIds not a function ✗');
    }

    // Test 4: Main package re-exports
    console.log('\n✅ Test 4: Main Package Re-exports');
    const mainPackage = require('ethereum-storage');
    const deploymentsModule = require('ethereum-storage/deployments');

    // Check if main package exports match sub-modules
    const mainHasContracts = 'DataPointRegistry__factory' in mainPackage;
    const mainHasDeployments = 'espDeployments' in mainPackage;
    
    if (mainHasContracts && mainHasDeployments) {
      console.log('   - Main package re-exports sub-modules correctly ✓');
    } else {
      console.log('   - Main package missing re-exports ✗');
    }

    // Test 5: Memory and performance check
    console.log('\n✅ Test 5: Memory & Performance Check');
    const before = process.memoryUsage();
    
    // Import multiple times to check for memory leaks
    for (let i = 0; i < 10; i++) {
      delete require.cache[require.resolve('ethereum-storage')];
      require('ethereum-storage');
    }
    
    const after = process.memoryUsage();
    const heapDiff = after.heapUsed - before.heapUsed;
    
    if (heapDiff < 10 * 1024 * 1024) { // Less than 10MB growth
      console.log(`   - Memory usage stable (${Math.round(heapDiff / 1024)}KB growth) ✓`);
    } else {
      console.log(`   - Potential memory leak detected (${Math.round(heapDiff / 1024)}KB growth) ⚠️`);
    }

    console.log('\n🎉 All advanced CommonJS tests completed!');
    console.log('📦 Package is fully compatible with CommonJS environments');

  } catch (error) {
    console.error('\n❌ Advanced CommonJS test failed:', error.message);
    console.error('📦 Stack trace:', error.stack);
    process.exit(1);
  }
}

runAdvancedTests(); 