/**
 * Copy ESP Contracts Script
 * 
 * Copies only ESP-specific contracts to the dist directory,
 * excluding test contracts and OpenZeppelin contracts.
 */

import * as fs from 'fs';
import * as path from 'path';

// Ensure dist directory exists
function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Copy file with directory structure
function copyFile(src: string, dest: string): void {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  console.log(`Copied: ${src} -> ${dest}`);
}

// Check if path should be excluded
function shouldExclude(filePath: string, excludePaths: string[]): boolean {
  return excludePaths.some(excludePath => {
    return filePath.includes(excludePath) || 
           filePath.toLowerCase().includes(excludePath.toLowerCase()) ||
           path.basename(filePath).toLowerCase().includes(excludePath.toLowerCase());
  });
}

// Copy directory recursively, excluding test directories and files
function copyDir(src: string, dest: string, excludePaths: string[] = []): void {
  if (!fs.existsSync(src)) {
    console.log(`Source directory does not exist: ${src}`);
    return;
  }

  ensureDir(dest);
  
  const items = fs.readdirSync(src);
  
  for (const item of items) {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    
    // Skip excluded paths
    if (shouldExclude(srcPath, excludePaths)) {
      console.log(`Skipping excluded path: ${srcPath}`);
      continue;
    }
    
    const stat = fs.statSync(srcPath);
    
    if (stat.isDirectory()) {
      copyDir(srcPath, destPath, excludePaths);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

// Main copy operation
function main(): void {
  console.log('Starting contract copy process...');
  
  const distDir = 'dist';
  ensureDir(distDir);
  
  // Copy ESP contracts (excluding test directory and files)
  copyDir(
    'contracts',
    path.join(distDir, 'contracts'),
    ['test', 'Test', 'Helper', 'Mock', 'mock', 'helper'] // Exclude test-related directories and files
  );
  
  console.log('Contract copy process completed!');
}

main(); 