import hre from "hardhat";
import { formatEther, parseUnits, toUtf8Bytes } from "ethers";
import { DataPointStorage, DataPointRegistry } from "../typechain-types";

async function main() {
  console.log("🚀 Starting vanity deployment script...\n");

  // Get network information
  const network = hre.network.name;
  const shouldVerify = network !== "hardhat" && network !== "localhost";
  
  console.log(`📡 Network: ${network}`);
  console.log(`🔍 Contract verification: ${shouldVerify ? "ENABLED" : "DISABLED (local network)"}\n`);

  // Get signers - DPS uses signer(0), DPR uses signer(1)
  const signers = await hre.ethers.getSigners();
  const dpsSigner = signers[0]; // DPS deployer
  const dprSigner = signers[1]; // DPR deployer
  const owner = signers[2]; // Owner for DPR contract

  console.log("📋 Deployment Configuration:");
  console.log(`DPS Deployer (signer 0): ${dpsSigner.address}`);
  console.log(`DPR Deployer (signer 1): ${dprSigner.address}`);
  console.log(`DPR Owner (signer 2): ${owner.address}`);

  // Check balances
  let dpsBalance = await hre.ethers.provider.getBalance(dpsSigner.address);
  let dprBalance = await hre.ethers.provider.getBalance(dprSigner.address);
  const ownerBalance = await hre.ethers.provider.getBalance(owner.address);

  console.log(`DPS Deployer Balance: ${formatEther(dpsBalance)} ETH`);
  console.log(`DPR Deployer Balance: ${formatEther(dprBalance)} ETH`);
  console.log(`Owner Balance: ${formatEther(ownerBalance)} ETH\n`);

  // Get current gas price for calculations
  const feeData = await hre.ethers.provider.getFeeData();
  const gasPrice = feeData.gasPrice || parseUnits("20", "gwei"); // Fallback to 20 gwei
  console.log(`Current gas price: ${formatEther(gasPrice * 1000000000n)} ETH/gas (${gasPrice.toString()} wei)\n`);

  // Buffer for gas estimation (10% safety margin)
  const bufferMultiplier = 110n; // 110% (10% buffer)
  const divisor = 100n;

  // Helper function to fund deployer if needed
  async function fundDeployerIfNeeded(
    deployerSigner: any,
    deployerBalance: bigint,
    requiredAmount: bigint,
    deployerName: string
  ): Promise<bigint> {
    if (deployerBalance >= requiredAmount) {
      console.log(`✅ ${deployerName} deployer has sufficient balance (${formatEther(deployerBalance)} ETH >= ${formatEther(requiredAmount)} ETH)`);
      return deployerBalance;
    }

    console.log(`⚠️  ${deployerName} deployer has insufficient balance!`);
    console.log(`   Required: ${formatEther(requiredAmount)} ETH`);
    console.log(`   Available: ${formatEther(deployerBalance)} ETH`);
    console.log(`   Shortfall: ${formatEther(requiredAmount - deployerBalance)} ETH`);

    // Calculate funding needed with 15% buffer
    const fundingBuffer = 115n; // 115% (15% buffer)
    const fundingDivisor = 100n;
    const fundingNeeded = (requiredAmount * fundingBuffer) / fundingDivisor;
    
    console.log(`💰 Checking if owner can fund ${deployerName} deployer...`);
    console.log(`   Funding needed (with 15% buffer): ${formatEther(fundingNeeded)} ETH`);

    // Estimate the gas cost for the funding transaction itself
    const fundingGasEstimate = 21000n; // Standard ETH transfer gas
    const fundingTxCost = fundingGasEstimate * gasPrice;
    const totalOwnerNeeded = fundingNeeded + fundingTxCost;

    console.log(`   Funding transaction cost: ~${formatEther(fundingTxCost)} ETH`);
    console.log(`   Total owner needs: ${formatEther(totalOwnerNeeded)} ETH`);

    if (ownerBalance < totalOwnerNeeded) {
      console.error(`❌ Owner has insufficient funds to cover ${deployerName} deployment!`);
      console.error(`   Owner balance: ${formatEther(ownerBalance)} ETH`);
      console.error(`   Total needed: ${formatEther(totalOwnerNeeded)} ETH`);
      console.error(`   Owner shortfall: ${formatEther(totalOwnerNeeded - ownerBalance)} ETH`);
      throw new Error(`Insufficient funds for ${deployerName} deployment. Neither deployer nor owner has enough ETH.`);
    }

    console.log(`✅ Owner has sufficient funds to cover ${deployerName} deployment`);
    console.log(`💸 Funding ${deployerName} deployer with ${formatEther(fundingNeeded)} ETH...`);

    // Send funding from owner to deployer
    const fundingTx = await owner.sendTransaction({
      to: deployerSigner.address,
      value: fundingNeeded,
      gasLimit: fundingGasEstimate
    });

    await fundingTx.wait();
    console.log(`✅ Successfully funded ${deployerName} deployer (tx: ${fundingTx.hash})`);

    // Return updated balance
    const newBalance = await hre.ethers.provider.getBalance(deployerSigner.address);
    console.log(`   New ${deployerName} deployer balance: ${formatEther(newBalance)} ETH\n`);
    
    return newBalance;
  }

  try {
    // ========================================
    // STEP 1: DPS Estimation and Deployment
    // ========================================
    console.log("📦 Step 1: DataPointStorage (DPS) Deployment");
    console.log("⛽ Estimating DPS deployment cost...");
    
    const DataPointStorageFactory = await hre.ethers.getContractFactory("DataPointStorage");
    const dpsDeployTx = await DataPointStorageFactory.connect(dpsSigner).getDeployTransaction();
    const dpsGasEstimate = await hre.ethers.provider.estimateGas({
      ...dpsDeployTx,
      from: dpsSigner.address
    });
    
    const dpsCost = (dpsGasEstimate * gasPrice * bufferMultiplier) / divisor;
    
    console.log(`💰 DPS deployment cost (with 10% buffer): ~${formatEther(dpsCost)} ETH (${dpsGasEstimate.toString()} gas)`);
    
    // Check and fund DPS deployer if needed
    dpsBalance = await fundDeployerIfNeeded(dpsSigner, dpsBalance, dpsCost, "DPS");
    
    console.log("🚀 Deploying DataPointStorage...");
    
    const dataPointStorage = await DataPointStorageFactory.connect(dpsSigner).deploy() as DataPointStorage;
    await dataPointStorage.waitForDeployment();
    const dpsAddress = await dataPointStorage.getAddress();

    console.log(`✅ DataPointStorage deployed to: ${dpsAddress}`);
    console.log(`   Deployed by: ${dpsSigner.address}`);
    console.log(`   Version: ${await dataPointStorage.VERSION()}\n`);

    // ========================================
    // STEP 2: DPR Estimation and Deployment
    // ========================================
    console.log("📦 Step 2: DataPointRegistry (DPR) Deployment");
    console.log("⛽ Estimating DPR deployment cost...");
    
    // Default royalty rate
    const royaltyRate = parseUnits("0.001", "ether"); // 0.001 ETH in wei
    
    const DataPointRegistryFactory = await hre.ethers.getContractFactory("DataPointRegistry");
    const dprDeployTx = await DataPointRegistryFactory.connect(dprSigner).getDeployTransaction(
      owner.address,     // Owner of the DPR contract
      dpsAddress,        // Address of the deployed DPS contract (real address!)
      royaltyRate        // Royalty rate
    );
    
    const dprGasEstimate = await hre.ethers.provider.estimateGas({
      ...dprDeployTx,
      from: dprSigner.address
    });
    
    const dprCost = (dprGasEstimate * gasPrice * bufferMultiplier) / divisor;
    
    console.log(`💰 DPR deployment cost (with 10% buffer): ~${formatEther(dprCost)} ETH (${dprGasEstimate.toString()} gas)`);
    
    // Get current DPR balance and check/fund if needed
    const currentDprBalance = await hre.ethers.provider.getBalance(dprSigner.address);
    await fundDeployerIfNeeded(dprSigner, currentDprBalance, dprCost, "DPR");
    
    console.log("🚀 Deploying DataPointRegistry...");
    
    const dataPointRegistry = await DataPointRegistryFactory.connect(dprSigner).deploy(
      owner.address,     // Owner of the DPR contract
      dpsAddress,        // Address of the DPS contract
      royaltyRate        // Royalty rate
    ) as DataPointRegistry;
    
    await dataPointRegistry.waitForDeployment();
    const dprAddress = await dataPointRegistry.getAddress();

    console.log(`✅ DataPointRegistry deployed to: ${dprAddress}`);
    console.log(`   Deployed by: ${dprSigner.address}`);
    console.log(`   Owner: ${owner.address}`);
    console.log(`   DPS Address: ${dpsAddress}`);
    console.log(`   Royalty Rate: ${formatEther(royaltyRate)} ETH\n`);

    // ========================================
    // STEP 3: Verification and Testing
    // ========================================
    console.log("🔗 Verifying contract connections...");
    const dpsFromRegistry = await dataPointRegistry.DPS_();
    const royaltyRateFromRegistry = await dataPointRegistry.royaltyRate();

    console.log(`DPS address in registry: ${dpsFromRegistry}`);
    console.log(`Royalty rate in registry: ${formatEther(royaltyRateFromRegistry)} ETH`);

    if (dpsFromRegistry === dpsAddress) {
      console.log("✅ Contract connection verified successfully!");
    } else {
      console.log("❌ Contract connection verification failed!");
    }

    // Test basic functionality
    console.log("\n🧪 Testing basic functionality...");
    const testData = toUtf8Bytes("Hello ESP!");
    const calculatedAddress = await dataPointStorage.calculateAddress(testData);
    console.log(`Test data point address: ${calculatedAddress}`);

    // Contract verification
    if (shouldVerify) {
      console.log("\n🔍 Starting contract verification...");
      
      try {
        // Verify DataPointStorage
        console.log("📋 Verifying DataPointStorage...");
        await hre.run("verify:verify", {
          address: dpsAddress,
          constructorArguments: [],
        });
        console.log("✅ DataPointStorage verified successfully!");
      } catch (error: any) {
        if (error.message.includes("Already Verified")) {
          console.log("ℹ️  DataPointStorage already verified");
        } else {
          console.log("❌ DataPointStorage verification failed:", error.message);
        }
      }

      try {
        // Verify DataPointRegistry  
        console.log("📋 Verifying DataPointRegistry...");
        await hre.run("verify:verify", {
          address: dprAddress,
          constructorArguments: [
            owner.address,
            dpsAddress,
            royaltyRate.toString()
          ],
        });
        console.log("✅ DataPointRegistry verified successfully!");
      } catch (error: any) {
        if (error.message.includes("Already Verified")) {
          console.log("ℹ️  DataPointRegistry already verified");
        } else {
          console.log("❌ DataPointRegistry verification failed:", error.message);
        }
      }
    }

    // Calculate actual costs spent (get final balances)
    const finalDpsBalance = await hre.ethers.provider.getBalance(dpsSigner.address);
    const finalDprBalance = await hre.ethers.provider.getBalance(dprSigner.address);
    const finalOwnerBalance = await hre.ethers.provider.getBalance(owner.address);
    
    const actualDpsCost = dpsBalance - finalDpsBalance;
    const actualDprCost = dprBalance - finalDprBalance;
    const ownerSpent = ownerBalance - finalOwnerBalance;

    console.log("\n🎉 Deployment completed successfully!");
    console.log("\n📄 Deployment Summary:");
    console.log("=".repeat(60));
    console.log(`Network:          ${network}`);
    console.log(`DataPointStorage: ${dpsAddress}`);
    console.log(`DataPointRegistry: ${dprAddress}`);
    console.log(`Owner:            ${owner.address}`);
    console.log(`Royalty Rate:     ${formatEther(royaltyRate)} ETH`);
    console.log(`\nDeployment costs:`);
    console.log(`DPS estimated:    ${formatEther(dpsCost)} ETH`);
    console.log(`DPS actual:       ${formatEther(actualDpsCost)} ETH`);
    console.log(`DPR estimated:    ${formatEther(dprCost)} ETH`);
    console.log(`DPR actual:       ${formatEther(actualDprCost)} ETH`);
    console.log(`Total spent:      ${formatEther(actualDpsCost + actualDprCost)} ETH`);
    if (ownerSpent > 0n) {
      console.log(`Owner funding:    ${formatEther(ownerSpent)} ETH`);
      console.log(`Grand total:      ${formatEther(actualDpsCost + actualDprCost + ownerSpent)} ETH`);
    }
    if (shouldVerify) {
      console.log(`Etherscan:        Contracts verified on block explorer`);
    }
    console.log("=".repeat(60));

    // Return deployed contracts for potential further use
    return {
      dataPointStorage,
      dataPointRegistry,
      addresses: {
        dps: dpsAddress,
        dpr: dprAddress,
        owner: owner.address
      },
      signers: {
        dpsSigner,
        dprSigner,
        owner
      },
      costs: {
        dps: actualDpsCost,
        dpr: actualDprCost,
        total: actualDpsCost + actualDprCost,
        ownerFunding: ownerSpent,
        grandTotal: actualDpsCost + actualDprCost + ownerSpent
      }
    };

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    throw error;
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
