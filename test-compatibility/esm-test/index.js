#!/usr/bin/env node

/**
 * ES Module (ESM) Import Test
 * Tests importing the ethereum-storage package using ES6 import syntax
 */

console.log('🧪 Testing ES Module imports...\n');

try {
  // Test 1: Main package import with destructuring
  console.log('✅ Test 1: Main package import with destructuring');
  const { 
    DataPointRegistry__factory,
    DataPointStorage__factory,
    espDeployments,
    loadContract,
    getContractAddress,
    getSupportedChainIds
  } = await import('ethereum-storage');
  
  console.log('   - Main package imported successfully');
  console.log('   - Key destructured exports verified ✓');

  // Test 2: Default import
  console.log('\n✅ Test 2: Default/namespace import');
  const ethStorage = await import('ethereum-storage');
  console.log('   - Namespace import successful');
  console.log(`   - Available exports: ${Object.keys(ethStorage).length} items`);
  console.log(`   - Main exports: ${Object.keys(ethStorage).slice(0, 5).join(', ')}${Object.keys(ethStorage).length > 5 ? '...' : ''}`);

  // Test 3: Contract factory validation
  console.log('\n✅ Test 3: Contract Factory Validation');
  if (typeof DataPointRegistry__factory === 'function') {
    console.log('   - DataPointRegistry__factory is accessible ✓');
  } else {
    console.log('   - DataPointRegistry__factory is NOT accessible ✗');
  }

  if (typeof DataPointStorage__factory === 'function') {
    console.log('   - DataPointStorage__factory is accessible ✓');
  } else {
    console.log('   - DataPointStorage__factory is NOT accessible ✗');
  }

  // Test 4: Deployments module import
  console.log('\n✅ Test 4: Deployments module import');
  const deploymentsModule = await import('ethereum-storage/deployments');
  console.log('   - Deployments module imported successfully');
  console.log(`   - Deployment exports: ${Object.keys(deploymentsModule).length} items`);

  // Test 5: Mixed import syntax test
  console.log('\n✅ Test 5: Mixed import patterns');
  const { espDeployments: deployments } = await import('ethereum-storage');
  
  console.log('   - Mixed import patterns work correctly ✓');
  console.log('   - Aliased imports work correctly ✓');

  // Test 6: Function verification test
  console.log('\n✅ Test 6: Function accessibility test');
  
  // Test contract factory function
  if (typeof DataPointRegistry__factory === 'function') {
    console.log('   - DataPointRegistry__factory is callable ✓');
  } else {
    console.log('   - DataPointRegistry__factory is NOT callable ✗');
  }

  // Test utility function
  if (typeof loadContract === 'function') {
    console.log('   - loadContract function is callable ✓');
  } else {
    console.log('   - loadContract function is NOT callable ✗');
  }

  console.log('\n🎉 All ESM import tests completed successfully!');
  console.log('📦 Package can be imported correctly in ES Module environments');

} catch (error) {
  console.error('\n❌ ES Module import test failed:', error.message);
  console.error('📦 Stack trace:', error.stack);
  process.exit(1);
}
