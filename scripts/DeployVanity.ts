import hre from "hardhat";
import { formatEther, parseUnits, toUtf8Bytes } from "ethers";
import { DataPointStorage, DataPointRegistry } from "../typechain-types";
import { addDeployment, formatDeploymentData } from './AddDeployment';

/**
 * Deploy ESP contracts with vanity addresses
 * @param hardhatRuntime - Hardhat runtime environment
 * @param customRoyaltyRate - Custom royalty rate in wei (optional, defaults to 1/1000th of gas price)
 * @param skipVerification - Skip contract verification (optional, defaults to false)
 */
export async function deployWithVanity(
  hardhatRuntime: typeof hre = hre,
  customRoyaltyRate?: bigint,
  skipVerification: boolean = false
) {
  console.log("🚀 Starting vanity deployment script...\n");

  // Get chain information
  const network = hardhatRuntime.network.name;
  const chainId = hardhatRuntime.network.config.chainId;
  if (chainId === undefined) {
    throw new Error("ChainId is undefined, please set a chainId in your hardhat.config.ts");
  }

  const shouldVerify = chainId !== 31337 && chainId !== 1337 && !skipVerification; // 31337 is localhost 1337 is hardhat
  
  console.log(`📡 Network: ${network} - ChainId: ${chainId}`);
  console.log(`🔍 Contract verification: ${shouldVerify ? "ENABLED" : "DISABLED (local network)"}\n`);

  // Get signers - DPS uses signer(0), DPR uses signer(1)
  const signers = await hardhatRuntime.ethers.getSigners();
  const dpsSigner = signers[0]; // DPS deployer
  const dprSigner = signers[1]; // DPR deployer
  const owner = signers[2]; // Owner for DPR contract

  console.log("📋 Deployment Configuration:");
  console.log(`DPS Deployer (signer 0): ${dpsSigner.address}`);
  console.log(`DPR Deployer (signer 1): ${dprSigner.address}`);
  console.log(`DPR Owner (signer 2): ${owner.address}`);

  // Check nonces for vanity deployment validation
  const dpsNonce = await hardhatRuntime.ethers.provider.getTransactionCount(dpsSigner.address);
  const dprNonce = await hardhatRuntime.ethers.provider.getTransactionCount(dprSigner.address);

  console.log(`DPS Deployer Nonce: ${dpsNonce}`);
  console.log(`DPR Deployer Nonce: ${dprNonce}`);

  // Validate DPR nonce (must be 0 for vanity deployment)
  if (dprNonce > 0) {
    throw new Error(`Vanity nonce error: DPR deployer nonce is ${dprNonce}, expected 0. DPR deployer has been used before.`);
  }

  // Check balances
  let dpsBalance = await hardhatRuntime.ethers.provider.getBalance(dpsSigner.address);
  let dprBalance = await hardhatRuntime.ethers.provider.getBalance(dprSigner.address);
  const ownerBalance = await hardhatRuntime.ethers.provider.getBalance(owner.address);

  console.log(`DPS Deployer Balance: ${formatEther(dpsBalance)} ETH`);
  console.log(`DPR Deployer Balance: ${formatEther(dprBalance)} ETH`);
  console.log(`Owner Balance: ${formatEther(ownerBalance)} ETH\n`);

  // Get current gas price for calculations
  const feeData = await hardhatRuntime.ethers.provider.getFeeData();
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
    const newBalance = await hardhatRuntime.ethers.provider.getBalance(deployerSigner.address);
    console.log(`   New ${deployerName} deployer balance: ${formatEther(newBalance)} ETH\n`);
    
    return newBalance;
  }

  let dataPointStorage: DataPointStorage | undefined;
  let dpsAddress: string | undefined;
  let skipDpsDeployment = false;

  try {
    // ========================================
    // STEP 1: DPS Nonce Check and Deployment
    // ========================================
    console.log("📦 Step 1: DataPointStorage (DPS) Deployment");

    // Check for existing DPS deployment if nonce != 0
    if (dpsNonce !== 0) {
      console.log(`⚠️  DPS deployer nonce is ${dpsNonce}, checking for existing deployment...`);
      
      // Calculate deterministic address for nonce 0
      const expectedDpsAddress = hardhatRuntime.ethers.getCreateAddress({
        from: dpsSigner.address,
        nonce: 0
      });
      
      console.log(`Expected DPS address (nonce 0): ${expectedDpsAddress}`);
      
      // Check if contract exists at the expected address
      const contractCode = await hardhatRuntime.ethers.provider.getCode(expectedDpsAddress);
      const contractExists = contractCode !== "0x";
      
      if (contractExists) {
        console.log("✅ Found existing DPS contract at expected address, skipping deployment");
        
        // Connect to existing contract
        const DataPointStorageFactory = await hardhatRuntime.ethers.getContractFactory("DataPointStorage");
        dataPointStorage = DataPointStorageFactory.attach(expectedDpsAddress) as DataPointStorage;
        dpsAddress = expectedDpsAddress;
        skipDpsDeployment = true;
        
        // Verify it's actually a DPS contract
        try {
          const version = await dataPointStorage.VERSION();
          console.log(`   Existing DPS version: ${version}`);
        } catch (error) {
          throw new Error(`Contract at expected DPS address ${expectedDpsAddress} is not a valid DataPointStorage contract`);
        }
      } else {
        throw new Error(`Vanity nonce error: Nonce not 0 and contract not deployed. Expected DPS at ${expectedDpsAddress} but no contract found.`);
      }
    }

    if (!skipDpsDeployment) {
      console.log("⛽ Estimating DPS deployment cost...");
      
      const DataPointStorageFactory = await hardhatRuntime.ethers.getContractFactory("DataPointStorage");
      const dpsDeployTx = await DataPointStorageFactory.connect(dpsSigner).getDeployTransaction();
      const dpsGasEstimate = await hardhatRuntime.ethers.provider.estimateGas({
        ...dpsDeployTx,
        from: dpsSigner.address
      });
      
      const dpsCost = (dpsGasEstimate * gasPrice * bufferMultiplier) / divisor;
      
      console.log(`💰 DPS deployment cost (with 10% buffer): ~${formatEther(dpsCost)} ETH (${dpsGasEstimate.toString()} gas)`);
      
      // Check and fund DPS deployer if needed
      dpsBalance = await fundDeployerIfNeeded(dpsSigner, dpsBalance, dpsCost, "DPS");
      
      console.log("🚀 Deploying DataPointStorage...");
      
      dataPointStorage = await DataPointStorageFactory.connect(dpsSigner).deploy() as DataPointStorage;
      await dataPointStorage.waitForDeployment();
      dpsAddress = await dataPointStorage.getAddress();

      console.log(`✅ DataPointStorage deployed to: ${dpsAddress}`);
      console.log(`   Deployed by: ${dpsSigner.address}`);
    }

    // Ensure we have both dataPointStorage and dpsAddress
    if (!dataPointStorage || !dpsAddress) {
      throw new Error("Failed to initialize DataPointStorage contract");
    }

    console.log(`   Version: ${await dataPointStorage.VERSION()}\n`);

    // ========================================
    // STEP 2: DPR Estimation and Deployment
    // ========================================
    console.log("📦 Step 2: DataPointRegistry (DPR) Deployment");
    console.log("⛽ Estimating DPR deployment cost...");
    
    // Use custom royalty rate or default to 1/1000th of gas price
    const royaltyRate = customRoyaltyRate || gasPrice / 1000n;
    const royaltyRateGwei = hardhatRuntime.ethers.formatUnits(royaltyRate, "gwei");
    
    console.log(`💰 Royalty rate: ${royaltyRateGwei} GWEI (${royaltyRate.toString()} wei)`);
    
    const DataPointRegistryFactory = await hardhatRuntime.ethers.getContractFactory("DataPointRegistry");
    const dprDeployTx = await DataPointRegistryFactory.connect(dprSigner).getDeployTransaction(
      owner.address,     // Owner of the DPR contract
      dpsAddress,        // Address of the deployed DPS contract (real address!)
      royaltyRate        // Royalty rate
    );
    
    const dprGasEstimate = await hardhatRuntime.ethers.provider.estimateGas({
      ...dprDeployTx,
      from: dprSigner.address
    });
    
    const dprCost = (dprGasEstimate * gasPrice * bufferMultiplier) / divisor;
    
    console.log(`💰 DPR deployment cost (with 10% buffer): ~${formatEther(dprCost)} ETH (${dprGasEstimate.toString()} gas)`);
    
    // Get current DPR balance and check/fund if needed
    const currentDprBalance = await hardhatRuntime.ethers.provider.getBalance(dprSigner.address);
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
    console.log(`   Royalty Rate: ${royaltyRateGwei} GWEI\n`);

    // ========================================
    // STEP 3: Verification and Testing
    // ========================================
    console.log("🔗 Verifying contract connections...");
    const dpsFromRegistry = await dataPointRegistry.DPS_();
    const royaltyRateFromRegistry = await dataPointRegistry.royaltyRate();

    console.log(`DPS address in registry: ${dpsFromRegistry}`);
    console.log(`Royalty rate in registry: ${hardhatRuntime.ethers.formatUnits(royaltyRateFromRegistry, "gwei")} GWEI`);

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
    if (shouldVerify && !skipVerification) {
      console.log("\n🔍 Starting contract verification...");
      
      try {
        // Verify DataPointStorage
        console.log("📋 Verifying DataPointStorage...");
        await hardhatRuntime.run("verify:verify", {
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
        await hardhatRuntime.run("verify:verify", {
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
    const finalDpsBalance = await hardhatRuntime.ethers.provider.getBalance(dpsSigner.address);
    const finalDprBalance = await hardhatRuntime.ethers.provider.getBalance(dprSigner.address);
    const finalOwnerBalance = await hardhatRuntime.ethers.provider.getBalance(owner.address);
    
    const actualDpsCost = skipDpsDeployment ? 0n : (dpsBalance - finalDpsBalance);
    const actualDprCost = dprBalance - finalDprBalance;
    const ownerSpent = ownerBalance - finalOwnerBalance;

    console.log("\n🎉 Deployment completed successfully!");
    console.log("\n📄 Deployment Summary:");
    console.log("=".repeat(60));
    console.log(`Network:          ${network}`);
    console.log(`DataPointStorage: ${dpsAddress} ${skipDpsDeployment ? "(existing)" : "(deployed)"}`);
    console.log(`DataPointRegistry: ${dprAddress} (deployed)`);
    console.log(`Owner:            ${owner.address}`);
    console.log(`Royalty Rate:     ${royaltyRateGwei} GWEI`);
    console.log(`\nDeployment costs:`);
    if (!skipDpsDeployment) {
      console.log(`DPS actual:       ${formatEther(actualDpsCost)} ETH`);
    } else {
      console.log(`DPS:              Skipped (existing contract)`);
    }
    console.log(`DPR actual:       ${formatEther(actualDprCost)} ETH`);
    console.log(`Total spent:      ${formatEther(actualDpsCost + actualDprCost)} ETH`);
    if (ownerSpent > 0n) {
      console.log(`Owner funding:    ${formatEther(ownerSpent)} ETH`);
      console.log(`Grand total:      ${formatEther(actualDpsCost + actualDprCost + ownerSpent)} ETH`);
    }
    if (shouldVerify && !skipVerification) {
      console.log(`Etherscan:        Contracts verified on block explorer`);
    }
    console.log("=".repeat(60));

    // ========================================
    // STEP 4: Update Deployment Registry
    // ========================================
    console.log("\n📝 Updating deployment registry...");
    
    try {
      const deploymentData = formatDeploymentData(
        chainId,
        {
          address: dpsAddress,
          deployerAddress: dpsSigner.address,
          txHash: dataPointStorage.deploymentTransaction()?.hash
        },
        {
          address: dprAddress,
          deployerAddress: dprSigner.address,
          txHash: dataPointRegistry.deploymentTransaction()?.hash,
          owner: owner.address,
          dpsAddress: dpsAddress,
          royaltyRate: royaltyRate
        }
      );
      
      await addDeployment(deploymentData);
      console.log(`🎯 Network '${network}' deployment registered successfully!`);
    } catch (error: any) {
      console.log("⚠️  Failed to update deployment registry:", error.message);
      console.log("📝 You can manually update esp.deployments.ts with the following info:");
      console.log(`   Network: ${network}`);
      console.log(`   DPS: ${dpsAddress}`);
      console.log(`   DPR: ${dprAddress}`);
      console.log(`   Owner: ${owner.address}`);
      console.log(`   Royalty Rate: ${royaltyRate.toString()}`);
    }

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
      },
      skipped: {
        dps: skipDpsDeployment
      },
      royaltyRate: {
        wei: royaltyRate.toString(),
        gwei: royaltyRateGwei
      }
    };

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    throw error;
  }
}

// Legacy main function for direct script execution
async function main() {
  return await deployWithVanity();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
