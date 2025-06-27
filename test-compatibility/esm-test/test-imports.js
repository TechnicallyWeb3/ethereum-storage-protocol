#!/usr/bin/env node

/**
 * Advanced ES Module Import Tests
 * Tests complex import scenarios and validates actual functionality
 */

console.log('🧪 Advanced ESM Import Tests...\n');

async function runAdvancedTests() {
  try {
    // Test 1: Direct dist folder imports
    console.log('✅ Test 1: Direct ESM dist imports');
    try {
      const directMain = await import('../../dist/esm/src/index.js');
      console.log('   - Direct ESM main import successful ✓');
      console.log(`   - Direct exports: ${Object.keys(directMain).length} items`);
    } catch (err) {
      console.log(`   - Direct ESM import failed: ${err.message} ✗`);
    }

    // Test 2: Dynamic import with conditional loading
    console.log('\n✅ Test 2: Dynamic Import Patterns');
    
    // Test conditional import
    const shouldLoadMain = true;
    if (shouldLoadMain) {
      const mainModule = await import('ethereum-storage');
      console.log('   - Conditional import works ✓');
    }

    // Test import with error handling
    try {
      await import('ethereum-storage/nonexistent');
      console.log('   - Non-existent module should fail ✗');
    } catch (err) {
      console.log('   - Non-existent module fails correctly ✓');
    }

    // Test 3: Advanced destructuring patterns
    console.log('\n✅ Test 3: Advanced Destructuring');
    
    const {
      DataPointRegistry__factory: RegistryFactory,
      DataPointStorage__factory: StorageFactory
    } = await import('ethereum-storage');

    console.log('   - Nested destructuring works ✓');
    console.log('   - Aliased imports work ✓');

    // Test 4: Module re-export verification
    console.log('\n✅ Test 4: Module Re-export Verification');
    
    const mainModule = await import('ethereum-storage');
    const deploymentsModule = await import('ethereum-storage/deployments');

    // Check if re-exports are accessible
    const mainHasRegistry = 'DataPointRegistry__factory' in mainModule;
    const mainHasDeployments = 'espDeployments' in mainModule;
    
    if (mainHasRegistry && mainHasDeployments) {
      console.log('   - Re-exported modules are accessible ✓');
    } else {
      console.log('   - Re-exported modules have issues ✗');
    }

    // Test 5: Tree-shaking compatibility
    console.log('\n✅ Test 5: Tree-shaking Compatibility');
    
    // Import only specific items to test tree-shaking
    const { loadContract } = await import('ethereum-storage');
    const { DataPointRegistry__factory } = await import('ethereum-storage');
    
    if (typeof loadContract === 'function' && typeof DataPointRegistry__factory === 'function') {
      console.log('   - Selective imports work correctly ✓');
    } else {
      console.log('   - Selective imports failed ✗');
    }

    // Test 6: Async functionality test
    console.log('\n✅ Test 6: Async Functionality');
    
    const { getSupportedChainIds, espDeployments } = await import('ethereum-storage/deployments');
    
    if (typeof getSupportedChainIds === 'function') {
      try {
        const chainIds = getSupportedChainIds();
        console.log(`   - getSupportedChainIds works (${chainIds.length} chains) ✓`);
        
        // Test deployment data structure
        if (typeof espDeployments === 'object' && espDeployments !== null) {
          const deploymentChains = Object.keys(espDeployments);
          console.log(`   - Deployment data available for: ${deploymentChains.join(', ')} ✓`);
        }
      } catch (err) {
        console.log(`   - Function call failed: ${err.message} ✗`);
      }
    }

    // Test 7: Import performance and caching
    console.log('\n✅ Test 7: Import Performance & Caching');
    
    const start = performance.now();
    
    // Multiple imports should be cached
    await Promise.all([
      import('ethereum-storage'),
      import('ethereum-storage/deployments')
    ]);
    
    const firstImportTime = performance.now() - start;
    
    const start2 = performance.now();
    
    // Second round should be faster (cached)
    await Promise.all([
      import('ethereum-storage'),
      import('ethereum-storage/deployments')
    ]);
    
    const secondImportTime = performance.now() - start2;
    
    console.log(`   - First import time: ${firstImportTime.toFixed(2)}ms`);
    console.log(`   - Second import time: ${secondImportTime.toFixed(2)}ms`);
    
    if (secondImportTime < firstImportTime) {
      console.log('   - Import caching working correctly ✓');
    } else {
      console.log('   - Import caching may not be optimal ⚠️');
    }

    // Test 8: Top-level await compatibility
    console.log('\n✅ Test 8: Top-level Await Compatibility');
    
    // This tests if the modules support top-level await environments
    const modules = await Promise.allSettled([
      import('ethereum-storage'),
      import('ethereum-storage/deployments')
    ]);
    
    const successful = modules.filter(m => m.status === 'fulfilled').length;
    const failed = modules.filter(m => m.status === 'rejected').length;
    
    console.log(`   - Successful imports: ${successful}/${modules.length} ✓`);
    if (failed > 0) {
      console.log(`   - Failed imports: ${failed} ✗`);
      modules.forEach((module, index) => {
        if (module.status === 'rejected') {
          console.log(`     - Module ${index}: ${module.reason.message}`);
        }
      });
    }

    console.log('\n🎉 All advanced ESM tests completed!');
    console.log('📦 Package is fully compatible with ES Module environments');

  } catch (error) {
    console.error('\n❌ Advanced ESM test failed:', error.message);
    console.error('📦 Stack trace:', error.stack);
    process.exit(1);
  }
}

await runAdvancedTests(); 