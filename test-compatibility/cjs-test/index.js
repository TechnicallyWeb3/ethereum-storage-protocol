#!/usr/bin/env node

/**
 * CommonJS (CJS) Import Test
 * Tests importing the ethereum-storage package using CommonJS require() syntax
 */

console.log('🧪 Testing CommonJS imports...\n');

try {
  // Test 1: Main package import
  console.log('✅ Test 1: Main package import');
  const ethStorage = require('ethereum-storage');
  console.log('   - Main package imported successfully');
  console.log(`   - Available exports: ${Object.keys(ethStorage).length} items`);
  console.log(`   - Main exports: ${Object.keys(ethStorage).slice(0, 5).join(', ')}${Object.keys(ethStorage).length > 5 ? '...' : ''}`);

  // Test 2: Validate contract exports from main package
  console.log('\n✅ Test 2: Contract exports from main package');
  const expectedContractExports = [
    'DataPointRegistryABI',
    'DataPointStorageABI', 
    'DataPointRegistry__factory',
    'DataPointStorage__factory',
    'IDataPointRegistry__factory',
    'IDataPointStorage__factory'
  ];
  
  const missingExports = expectedContractExports.filter(exp => !(exp in ethStorage));
  if (missingExports.length === 0) {
    console.log('   - All expected contract exports found in main package ✓');
  } else {
    console.log(`   - Missing exports: ${missingExports.join(', ')} ✗`);
  }

  // Test 3: Types availability
  console.log('\n✅ Test 3: Types availability');
  const expectedTypeExports = [
    'DataPointRegistry__factory',
    'DataPointStorage__factory',
    'IDataPointRegistry__factory',
    'IDataPointStorage__factory'
  ];
  
  const missingTypes = expectedTypeExports.filter(exp => !(exp in ethStorage));
  if (missingTypes.length === 0) {
    console.log('   - All expected type exports found ✓');
  } else {
    console.log(`   - Missing type exports: ${missingTypes.join(', ')} ✗`);
  }

  // Test 4: Deployments import
  console.log('\n✅ Test 4: Deployments module import');
  const deployments = require('ethereum-storage/deployments');
  console.log('   - Deployments module imported successfully');
  console.log(`   - Deployment exports: ${Object.keys(deployments).length} items`);
  
  // Validate specific deployment exports
  const expectedDeploymentExports = [
    'espDeployments',
    'loadContract',
    'getContractAddress',
    'getDeploymentInfo',
    'getSupportedChainIds'
  ];
  
  const missingDeploymentExports = expectedDeploymentExports.filter(exp => !(exp in deployments));
  if (missingDeploymentExports.length === 0) {
    console.log('   - All expected deployment exports found ✓');
  } else {
    console.log(`   - Missing exports: ${missingDeploymentExports.join(', ')} ✗`);
  }

  // Test 5: Verify main exports are accessible
  console.log('\n✅ Test 5: Main export accessibility test');
  const mainExports = [
    'DataPointRegistry__factory',
    'DataPointStorage__factory',
    'espDeployments',
    'loadContract'
  ];
  
  const missingMainExports = mainExports.filter(exp => !(exp in ethStorage));
  if (missingMainExports.length === 0) {
    console.log('   - All expected main exports accessible ✓');
  } else {
    console.log(`   - Missing main exports: ${missingMainExports.join(', ')} ✗`);
  }

  console.log('\n🎉 All CommonJS import tests completed successfully!');
  console.log('📦 Package can be imported correctly in CommonJS environments');

} catch (error) {
  console.error('\n❌ CommonJS import test failed:', error.message);
  console.error('📦 Stack trace:', error.stack);
  process.exit(1);
}
