/**
 * Publish ESP Packages Script
 * 
 * Publishes the package under two names:
 * 1. ethereum-storage (public package)
 * 2. @tw3/esp (organization scoped package)
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface PublishOptions {
  dryRun?: boolean;
  tag?: string;
  access?: 'public' | 'restricted';
}

function backupFile(filePath: string): string {
  const backupPath = `${filePath}.backup`;
  if (fs.existsSync(filePath)) {
    fs.copyFileSync(filePath, backupPath);
  }
  return backupPath;
}

function restoreFile(filePath: string, backupPath: string): void {
  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, filePath);
    fs.unlinkSync(backupPath);
  }
}

function publishPackage(
  packageName: string, 
  packageJsonPath: string, 
  options: PublishOptions = {}
): void {
  console.log(`\n🚀 Publishing ${packageName}...`);
  
  // Backup current package.json
  const mainPackageJson = 'package.json';
  const backupPath = backupFile(mainPackageJson);
  
  try {
    // Copy the specific package.json
    fs.copyFileSync(packageJsonPath, mainPackageJson);
    
    // Build the publish command
    let publishCmd = 'npm publish';
    
    if (options.dryRun) {
      publishCmd += ' --dry-run';
    }
    
    if (options.tag) {
      publishCmd += ` --tag ${options.tag}`;
    }
    
    if (options.access) {
      publishCmd += ` --access ${options.access}`;
    }
    
    console.log(`Executing: ${publishCmd}`);
    
    // Execute publish command
    execSync(publishCmd, { stdio: 'inherit' });
    
    console.log(`✅ Successfully published ${packageName}`);
    
  } catch (error) {
    console.error(`❌ Failed to publish ${packageName}:`, error);
    throw error;
  } finally {
    // Restore original package.json
    restoreFile(mainPackageJson, backupPath);
  }
}

function main(): void {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const tag = args.find(arg => arg.startsWith('--tag='))?.split('=')[1];
  
  console.log('🏗️  Building packages...');
  
  // Ensure build is up to date
  execSync('npm run build', { stdio: 'inherit' });
  
  const options: PublishOptions = {
    dryRun,
    tag,
    access: 'public'
  };
  
  try {
    // Publish public package
    publishPackage('ethereum-storage', 'package.json', options);
    
    // Publish organization scoped package  
    publishPackage('@tw3/esp', 'package.tw3.json', options);
    
    console.log('\n🎉 All packages published successfully!');
    
    if (!dryRun) {
      console.log('\n📋 Installation commands:');
      console.log('npm install ethereum-storage');
      console.log('npm install @tw3/esp');
    }
    
  } catch (error) {
    console.error('\n💥 Publishing failed:', error);
    process.exit(1);
  }
}

// Handle command line execution
if (require.main === module) {
  main();
}

export { publishPackage, PublishOptions }; 