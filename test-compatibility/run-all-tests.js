#!/usr/bin/env node

/**
 * Comprehensive Import Compatibility Test Runner
 * Runs all tests for both CommonJS and ES Module environments
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting Comprehensive Import Compatibility Tests\n');

// Test configuration
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
    
    // Check if directory exists
    if (!fs.existsSync(testDir)) {
      console.log(`❌ Test directory not found: ${testDir}`);
      reject(new Error(`Directory not found: ${testDir}`));
      return;
    }

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
    // Install dependencies first
    await installDependencies();
    
    // Run all tests
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

    // Summary
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
      console.log('\n✅ Import compatibility verified:');
      console.log('   • CommonJS require() syntax ✓');
      console.log('   • ES Module import syntax ✓');
      console.log('   • Direct dist folder imports ✓');
      console.log('   • Package.json exports configuration ✓');
      console.log('   • Cross-module compatibility ✓');
      console.log('   • Error handling and edge cases ✓');
    } else {
      console.log('\n❌ SOME TESTS FAILED');
      console.log('📦 Check the output above for specific error details');
      
      results.forEach(result => {
        if (result.status === 'FAILED') {
          console.log(`   • ${result.test}: ${result.error || 'Unknown error'}`);
        }
      });
      
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Test runner failed:', error.message);
    process.exit(1);
  }
}

main(); 