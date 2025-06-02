const { execSync } = require('child_process');

// Mock contract addresses for testing
const dpsAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const dprAddress = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
const ownerAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const royaltyRate = '100000000000000'; // 0.0001 ETH

async function main() {
  try {
    // Install the ethereum-storage package from the local directory
    console.log('Installing ethereum-storage from local directory...');
    execSync('npm install ../ethereum-storage-protocol', { stdio: 'inherit' });
    
    // Register the deployment using the CLI
    console.log('\nRegistering deployment with ethereum-storage CLI...');
    const cliCommand = `npx ethereum-storage add-localhost --dps ${dpsAddress} --dpr ${dprAddress} --owner ${ownerAddress} --royalty ${royaltyRate} --description "Test local deployment"`;
    console.log(`Running: ${cliCommand}`);
    execSync(cliCommand, { stdio: 'inherit' });
    
    // Test using the deployment
    console.log('\nTesting the deployment...');
    const { getContractAddress } = require('ethereum-storage');
    
    const registeredDpsAddress = getContractAddress(31337, 'dps');
    const registeredDprAddress = getContractAddress(31337, 'dpr');
    
    console.log(`Registered DPS address: ${registeredDpsAddress}`);
    console.log(`Registered DPR address: ${registeredDprAddress}`);
    
    if (registeredDpsAddress === dpsAddress && registeredDprAddress === dprAddress) {
      console.log('✅ Deployment registration successful!');
    } else {
      console.log('❌ Deployment registration failed!');
    }
    
    console.log('\nTest completed successfully!');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });