 import hre from "hardhat";
import { formatEther } from "ethers";

async function main() {
  console.log("🔍 Checking deployment status...\n");

  const network = hre.network.name;
  console.log(`📡 Network: ${network}\n`);

  // Get the same signers as the deployment script
  const signers = await hre.ethers.getSigners();
  const dpsSigner = signers[0]; // DPS deployer
  const dprSigner = signers[1]; // DPR deployer
  const owner = signers[2]; // Owner

  console.log("📋 Checking Deployer Addresses:");
  console.log(`DPS Deployer: ${dpsSigner.address}`);
  console.log(`DPR Deployer: ${dprSigner.address}`);
  console.log(`Owner: ${owner.address}\n`);

  // Check nonces
  console.log("🔢 Checking current nonces:");
  const dpsNonce = await hre.ethers.provider.getTransactionCount(dpsSigner.address);
  const dprNonce = await hre.ethers.provider.getTransactionCount(dprSigner.address);
  const ownerNonce = await hre.ethers.provider.getTransactionCount(owner.address);

  console.log(`DPS Deployer nonce: ${dpsNonce}`);
  console.log(`DPR Deployer nonce: ${dprNonce}`);
  console.log(`Owner nonce: ${ownerNonce}\n`);

  // Check pending nonces (includes pending transactions)
  console.log("⏳ Checking pending nonces (includes pending txs):");
  const dpsPendingNonce = await hre.ethers.provider.getTransactionCount(dpsSigner.address, "pending");
  const dprPendingNonce = await hre.ethers.provider.getTransactionCount(dprSigner.address, "pending");
  const ownerPendingNonce = await hre.ethers.provider.getTransactionCount(owner.address, "pending");

  console.log(`DPS Deployer pending nonce: ${dpsPendingNonce}`);
  console.log(`DPR Deployer pending nonce: ${dprPendingNonce}`);
  console.log(`Owner pending nonce: ${ownerPendingNonce}\n`);

  // Analyze the situation
  console.log("📊 Analysis:");
  
  if (dpsNonce > 0) {
    console.log("✅ DPS deployment completed (nonce > 0)");
    
    // Try to find the DPS contract
    const expectedDpsAddress = hre.ethers.getCreateAddress({
      from: dpsSigner.address,
      nonce: 0
    });
    console.log(`Expected DPS address: ${expectedDpsAddress}`);
    
    const dpsCode = await hre.ethers.provider.getCode(expectedDpsAddress);
    if (dpsCode !== "0x") {
      console.log("✅ DPS contract confirmed deployed and accessible");
    } else {
      console.log("❌ DPS contract not found at expected address");
    }
  } else {
    console.log("❌ DPS deployment not confirmed yet");
  }

  if (dprPendingNonce > dprNonce) {
    console.log("⏳ DPR deployment transaction is PENDING in mempool");
    console.log(`   Confirmed nonce: ${dprNonce}, Pending nonce: ${dprPendingNonce}`);
    console.log("   → Transaction submitted but not confirmed yet");
  } else if (dprNonce > 0) {
    console.log("✅ DPR deployment transaction confirmed");
    
    // Try to find the DPR contract
    const expectedDprAddress = hre.ethers.getCreateAddress({
      from: dprSigner.address,
      nonce: 0
    });
    console.log(`Expected DPR address: ${expectedDprAddress}`);
    
    const dprCode = await hre.ethers.provider.getCode(expectedDprAddress);
    if (dprCode !== "0x") {
      console.log("✅ DPR contract confirmed deployed and accessible");
    } else {
      console.log("❌ DPR contract not found at expected address");
    }
  } else {
    console.log("❌ DPR deployment not started or transaction not submitted");
  }

  // Check balances
  console.log("\n💰 Current balances:");
  const dpsBalance = await hre.ethers.provider.getBalance(dpsSigner.address);
  const dprBalance = await hre.ethers.provider.getBalance(dprSigner.address);
  const ownerBalance = await hre.ethers.provider.getBalance(owner.address);

  console.log(`DPS Deployer: ${formatEther(dpsBalance)} ETH`);
  console.log(`DPR Deployer: ${formatEther(dprBalance)} ETH`);
  console.log(`Owner: ${formatEther(ownerBalance)} ETH`);

  // Get current gas price
  const feeData = await hre.ethers.provider.getFeeData();
  const gasPrice = feeData.gasPrice;
  console.log(`\n⛽ Current gas price: ${gasPrice?.toString()} wei`);

  // Recommendations
  console.log("\n🎯 Recommendations:");
  
  if (dprPendingNonce > dprNonce) {
    console.log("1. ✅ Your transaction IS submitted and pending");
    console.log("2. ⏳ Wait for network confirmation (this is normal)");
    console.log("3. 🔍 You can check the transaction on block explorer");
    console.log("4. ⚠️  If stuck for >10 minutes, gas might be too low");
  } else if (dprNonce === 0 && dprPendingNonce === 0) {
    console.log("1. ❌ No DPR transaction detected in mempool");
    console.log("2. 🔄 The deployment script may have failed silently");
    console.log("3. 🛑 Cancel the current script and restart deployment");
  } else {
    console.log("1. ✅ Check if deployment completed successfully");
    console.log("2. 🔍 Verify contracts are accessible at expected addresses");
  }

  // Check if we're on a testnet and can provide explorer links
  if (network === "sepolia") {
    console.log("\n🔗 Sepolia Explorer Links:");
    console.log(`DPS Deployer: https://sepolia.etherscan.io/address/${dpsSigner.address}`);
    console.log(`DPR Deployer: https://sepolia.etherscan.io/address/${dprSigner.address}`);
    
    if (dpsNonce > 0) {
      const expectedDpsAddress = hre.ethers.getCreateAddress({
        from: dpsSigner.address,
        nonce: 0
      });
      console.log(`Expected DPS: https://sepolia.etherscan.io/address/${expectedDpsAddress}`);
    }
    
    if (dprNonce > 0 || dprPendingNonce > 0) {
      const expectedDprAddress = hre.ethers.getCreateAddress({
        from: dprSigner.address,
        nonce: 0
      });
      console.log(`Expected DPR: https://sepolia.etherscan.io/address/${expectedDprAddress}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Status check failed:", error);
    process.exit(1);
  }); 