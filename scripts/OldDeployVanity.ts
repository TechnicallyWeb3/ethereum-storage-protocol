import hre from "hardhat";
import { formatEther, formatUnits, parseUnits, toUtf8Bytes } from "ethers";
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
  let feeData = await hardhatRuntime.ethers.provider.getFeeData();
  let gasPrice = feeData.gasPrice || parseUnits("20", "gwei"); // Fallback to 20 gwei
  let maxFeePerGas = feeData.maxFeePerGas || gasPrice;
  let maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || gasPrice;
  console.log(`Current gas price: ${formatUnits(gasPrice, "gwei")} GWEI/gas (${gasPrice.toString()} wei)`);
  console.log(`Current maxFeePerGas: ${formatUnits(maxFeePerGas, "gwei")} GWEI/gas (${maxFeePerGas.toString()} wei)`);
  console.log(`Current maxPriorityFeePerGas: ${formatUnits(maxPriorityFeePerGas, "gwei")} GWEI/gas (${maxPriorityFeePerGas.toString()} wei)\n`);

  // Buffer for gas estimation (25% safety margin)
  const bufferMultiplier = 125n; // 25% (25% buffer)
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
    const fundingBuffer = 125n; // 25% (25% buffer)
    const fundingDivisor = 100n;
    const fundingNeeded = (requiredAmount * fundingBuffer) / fundingDivisor;
    
    console.log(`💰 Checking if owner can fund ${deployerName} deployer...`);
    console.log(`   Funding needed (with 25% buffer): ${formatEther(fundingNeeded)} ETH`);

    // Estimate the gas cost for the funding transaction itself
    const fundingGasEstimate = await owner.estimateGas({
      to: deployerSigner.address,
      value: fundingNeeded
    });
    const fundingTxCost = fundingGasEstimate * maxFeePerGas;
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
        
        // Verify it's actually a DPS contract
        try {
          const version = await dataPointStorage.VERSION();
          console.log(`   Existing DPS version: ${version}`);
          skipDpsDeployment = true;
      } catch (error) {
          throw new Error(`Contract at expected DPS address ${expectedDpsAddress} is not a valid DataPointStorage contract`);
        }
      } else {
        throw new Error(`Vanity nonce error: Nonce not 0 and contract not deployed. Expected DPS at ${expectedDpsAddress} but no contract found.`);
      }
    }

    if (!skipDpsDeployment) {
      console.log("⛽ Estimating DPS deployment cost...");
      // const providerFeeData = await hardhatRuntime.ethers.provider.getFeeData();
      // const providerGasPrice = providerFeeData.gasPrice || parseUnits("20", "gwei");
      // const providerMaxFeePerGas = providerFeeData.maxFeePerGas || providerGasPrice;
      // const providerMaxPriorityFeePerGas = providerFeeData.maxPriorityFeePerGas || providerGasPrice;

      // console.log("🔗 Provider Fee Data:", 
      //   "\n  maxFeePerGas:", `${formatEther(providerMaxFeePerGas)} ETH (${providerMaxFeePerGas.toString()} wei) `,
      //   "\n  maxPriorityFeePerGas:", `${formatEther(providerMaxPriorityFeePerGas)} ETH (${providerMaxPriorityFeePerGas.toString()} wei) `,
      //   "\n  gasPrice:", `${formatEther(providerGasPrice)} ETH (${providerGasPrice.toString()} wei) `,
      // );
      
      const DataPointStorageFactory = await hardhatRuntime.ethers.getContractFactory("DataPointStorage");
      const dpsDeployTx = await DataPointStorageFactory.connect(dpsSigner).getDeployTransaction({
        from: dpsSigner.address,
        maxFeePerGas: maxFeePerGas,
        maxPriorityFeePerGas: maxPriorityFeePerGas,
        nonce: dpsNonce,
        chainId: chainId
      });
      const dpsGasEstimate = await hardhatRuntime.ethers.provider.estimateGas(dpsDeployTx);

      const dpsCostEstimate = (dpsGasEstimate * maxFeePerGas);

      console.log("🔗 DPS Deploy Transaction Estimate:", `${formatEther(dpsCostEstimate)} ETH (${dpsGasEstimate.toString()} gas)`);
      
      const dpsCost = (dpsGasEstimate * maxFeePerGas)
      
      console.log(`💰 DPS deployment cost (with 10% buffer): ~${formatEther(dpsCost)} ETH (${dpsGasEstimate.toString()} gas)`);
      
      // Check and fund DPS deployer if needed
      dpsBalance = await fundDeployerIfNeeded(dpsSigner, dpsBalance, dpsCost, "DPS");
      
      console.log("🚀 Deploying DataPointStorage...");
      
      dataPointStorage = await DataPointStorageFactory.connect(dpsSigner).deploy({gasLimit: dpsGasEstimate}) as DataPointStorage;
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
    const dpsFromRegistry = await dataPointRegistry.DPS();
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


// import hre from "hardhat";
// import { formatEther, parseUnits, toUtf8Bytes } from "ethers";
// import { DataPointStorage, DataPointRegistry } from "../typechain-types";
// import { addDeployment, formatDeploymentData } from './AddDeployment';

// /**
//  * Deploy ESP contracts with vanity addresses
//  * @param hardhatRuntime - Hardhat runtime environment
//  * @param customRoyaltyRate - Custom royalty rate in wei (optional, defaults to 1/1000th of gas price)
//  * @param skipVerification - Skip contract verification (optional, defaults to false)
//  */
// export async function deployWithVanity(
//   hardhatRuntime: typeof hre = hre,
//   customRoyaltyRate?: bigint,
//   skipVerification: boolean = false
// ) {
//   console.log("🚀 Starting vanity deployment script...\n");

//   // Get chain information
//   const network = hardhatRuntime.network.name;
//   const chainId = hardhatRuntime.network.config.chainId;
//   if (chainId === undefined) {
//     throw new Error("ChainId is undefined, please set a chainId in your hardhat.config.ts");
//   }

//   const shouldVerify = chainId !== 31337 && chainId !== 1337 && !skipVerification; // 31337 is localhost 1337 is hardhat
  
//   console.log(`📡 Network: ${network} - ChainId: ${chainId}`);
//   console.log(`🔍 Contract verification: ${shouldVerify ? "ENABLED" : "DISABLED (local network)"}\n`);

//   // Get signers - DPS uses signer(0), DPR uses signer(1)
//   const signers = await hardhatRuntime.ethers.getSigners();
//   const dpsSigner = signers[0]; // DPS deployer
//   const dprSigner = signers[1]; // DPR deployer
//   const owner = signers[2]; // Owner for DPR contract

//   console.log("📋 Deployment Configuration:");
//   console.log(`DPS Deployer (signer 0): ${dpsSigner.address}`);
//   console.log(`DPR Deployer (signer 1): ${dprSigner.address}`);
//   console.log(`DPR Owner (signer 2): ${owner.address}`);

//   // Check nonces for vanity deployment validation
//   const dpsNonce = await hardhatRuntime.ethers.provider.getTransactionCount(dpsSigner.address);
//   const dprNonce = await hardhatRuntime.ethers.provider.getTransactionCount(dprSigner.address);

//   console.log(`DPS Deployer Nonce: ${dpsNonce}`);
//   console.log(`DPR Deployer Nonce: ${dprNonce}`);

//   // Validate DPR nonce (must be 0 for vanity deployment)
//   if (dprNonce > 0) {
//     throw new Error(`Vanity nonce error: DPR deployer nonce is ${dprNonce}, expected 0. DPR deployer has been used before.`);
//   }

//   // Check balances
//   let dpsBalance = await hardhatRuntime.ethers.provider.getBalance(dpsSigner.address);
//   let dprBalance = await hardhatRuntime.ethers.provider.getBalance(dprSigner.address);
//   const ownerBalance = await hardhatRuntime.ethers.provider.getBalance(owner.address);

//   console.log(`DPS Deployer Balance: ${formatEther(dpsBalance)} ETH`);
//   console.log(`DPR Deployer Balance: ${formatEther(dprBalance)} ETH`);
//   console.log(`Owner Balance: ${formatEther(ownerBalance)} ETH\n`);

//   // Get current gas price for calculations
//   const feeData = await hardhatRuntime.ethers.provider.getFeeData();
//   if (!feeData.gasPrice || !feeData.maxFeePerGas || !feeData.maxPriorityFeePerGas) {
//     throw new Error("Failed to get complete fee data from network");
//   }

//   // Get network-specific gas parameters
//   const block = await hardhatRuntime.ethers.provider.getBlock('latest');
//   if (!block) {
//     throw new Error("Failed to get latest block");
//   }

//   const baseFeePerGas = block.baseFeePerGas || feeData.gasPrice;
//   const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
//   const maxFeePerGas = feeData.maxFeePerGas;

//   console.log("\n⛽ Network Gas Parameters:");
//   console.log(`Base Fee: ${formatEther(baseFeePerGas)} ETH/gas (${baseFeePerGas.toString()} wei)`);
//   console.log(`Max Priority Fee: ${formatEther(maxPriorityFeePerGas)} ETH/gas (${maxPriorityFeePerGas.toString()} wei)`);
//   console.log(`Max Fee Per Gas: ${formatEther(maxFeePerGas)} ETH/gas (${maxFeePerGas.toString()} wei)\n`);

//   // Helper function to calculate exact upfront cost using network parameters
//   function calculateUpfrontCost(gasEstimate: bigint): bigint {
//     // Use the network's own maxFeePerGas for upfront calculation
//     return gasEstimate * maxFeePerGas;
//   }

//   // Helper function to calculate actual expected cost
//   function calculateExpectedCost(gasEstimate: bigint): bigint {
//     // Actual cost will be baseFee + priorityFee
//     return gasEstimate * (baseFeePerGas + maxPriorityFeePerGas);
//   }

//   // Helper function to fund deployer if needed
//   async function fundDeployerIfNeeded(
//     deployerSigner: any,
//     deployerBalance: bigint,
//     gasEstimate: bigint,
//     deployerName: string
//   ): Promise<bigint> {
//     const upfrontCost = calculateUpfrontCost(gasEstimate);
//     const expectedCost = calculateExpectedCost(gasEstimate);

//     if (deployerBalance >= upfrontCost) {
//       console.log(`✅ ${deployerName} deployer has sufficient balance`);
//       console.log(`   Required upfront: ${formatEther(upfrontCost)} ETH (${upfrontCost.toString()} wei)`);
//       console.log(`   Expected actual: ${formatEther(expectedCost)} ETH (${expectedCost.toString()} wei)`);
//       console.log(`   Available: ${formatEther(deployerBalance)} ETH (${deployerBalance.toString()} wei)\n`);
//       return deployerBalance;
//     }

//     console.log(`⚠️  ${deployerName} deployer has insufficient balance!`);
//     console.log(`   Required upfront: ${formatEther(upfrontCost)} ETH (${upfrontCost.toString()} wei)`);
//     console.log(`   Expected actual: ${formatEther(expectedCost)} ETH (${expectedCost.toString()} wei)`);
//     console.log(`   Available: ${formatEther(deployerBalance)} ETH (${deployerBalance.toString()} wei)`);
//     console.log(`   Shortfall: ${formatEther(upfrontCost - deployerBalance)} ETH (${(upfrontCost - deployerBalance).toString()} wei)`);

//     // Calculate funding needed (exact upfront amount)
//     const fundingNeeded = upfrontCost;
    
//     console.log(`\n💰 Checking if owner can fund ${deployerName} deployer...`);
//     console.log(`   Funding needed: ${formatEther(fundingNeeded)} ETH (${fundingNeeded.toString()} wei)`);

//     // Preflight check for funding transaction
//     const fundingTxRequest = await owner.populateTransaction({
//       to: deployerSigner.address,
//       value: fundingNeeded,
//       maxFeePerGas,
//       maxPriorityFeePerGas
//     });

//     // Get raw transaction data for analysis
//     console.log("\n🔍 Funding Transaction Analysis:");
//     console.log("Transaction:",
//       "\n  maxFeePerGas:", fundingTxRequest.maxFeePerGas?.toString(),
//       "\n  maxPriorityFeePerGas:", fundingTxRequest.maxPriorityFeePerGas?.toString(),
//       "\n  gasLimit:", fundingTxRequest.gasLimit?.toString(),
//       "\n  nonce:", fundingTxRequest.nonce,
//       "\n  type:", fundingTxRequest.type,
//       "\n  to:", fundingTxRequest.to,
//       "\n  value:", fundingTxRequest.value?.toString(),
//       "\n  from:", fundingTxRequest.from
//     );

//     // Calculate exact gas costs for funding
//     const fundingGasEstimate = await hardhatRuntime.ethers.provider.estimateGas(fundingTxRequest);
//     const fundingUpfrontWithMaxFee = fundingGasEstimate * maxFeePerGas;
//     const fundingUpfrontWithBaseFee = fundingGasEstimate * baseFeePerGas;
//     const fundingUpfrontWithPriorityFee = fundingGasEstimate * maxPriorityFeePerGas;
//     const fundingUpfrontTotal = fundingGasEstimate * (baseFeePerGas + maxPriorityFeePerGas);

//     console.log("\n📊 Funding Gas Analysis:");
//     console.log(`Gas estimate: ${fundingGasEstimate.toString()} gas`);
//     console.log("Potential upfront costs:");
//     console.log(`  With max fee:     ${formatEther(fundingUpfrontWithMaxFee)} ETH (${fundingUpfrontWithMaxFee.toString()} wei)`);
//     console.log(`  With base fee:    ${formatEther(fundingUpfrontWithBaseFee)} ETH (${fundingUpfrontWithBaseFee.toString()} wei)`);
//     console.log(`  With priority:    ${formatEther(fundingUpfrontWithPriorityFee)} ETH (${fundingUpfrontWithPriorityFee.toString()} wei)`);
//     console.log(`  Total (b+p):      ${formatEther(fundingUpfrontTotal)} ETH (${fundingUpfrontTotal.toString()} wei)`);

//     const totalOwnerNeeded = fundingNeeded + fundingUpfrontWithMaxFee;
//     console.log(`   Total owner needs: ${formatEther(totalOwnerNeeded)} ETH (${totalOwnerNeeded.toString()} wei)`);

//     if (ownerBalance < totalOwnerNeeded) {
//       console.error(`❌ Owner has insufficient funds to cover ${deployerName} deployment!`);
//       console.error(`   Owner balance: ${formatEther(ownerBalance)} ETH (${ownerBalance.toString()} wei)`);
//       console.error(`   Total needed: ${formatEther(totalOwnerNeeded)} ETH (${totalOwnerNeeded.toString()} wei)`);
//       console.error(`   Owner shortfall: ${formatEther(totalOwnerNeeded - ownerBalance)} ETH (${(totalOwnerNeeded - ownerBalance).toString()} wei)`);
//       throw new Error(`Insufficient funds for ${deployerName} deployment. Neither deployer nor owner has enough ETH.`);
//     }

//     console.log(`✅ Owner has sufficient funds to cover ${deployerName} deployment`);
//     console.log(`💸 Funding ${deployerName} deployer with exact amount: ${formatEther(fundingNeeded)} ETH...`);

//     // Send exact funding from owner to deployer using the same parameters we estimated with
//     const fundingTx = await owner.sendTransaction(fundingTxRequest);
//     const fundingReceipt = await fundingTx.wait();
//     if (!fundingReceipt) {
//       throw new Error("Failed to get transaction receipt for funding transaction");
//     }
//     console.log(`✅ Successfully funded ${deployerName} deployer (tx: ${fundingReceipt.hash})`);

//     // Return updated balance
//     const newBalance = await hardhatRuntime.ethers.provider.getBalance(deployerSigner.address);
//     console.log(`   New ${deployerName} deployer balance: ${formatEther(newBalance)} ETH (${newBalance.toString()} wei)\n`);
    
//     return newBalance;
//   }

//   let dataPointStorage: DataPointStorage | undefined;
//   let dpsAddress: string | undefined;
//   let skipDpsDeployment = false;

//   try {
//     // ========================================
//     // STEP 1: DPS Nonce Check and Deployment
//     // ========================================
//     console.log("📦 Step 1: DataPointStorage (DPS) Deployment");

//     // Check for existing DPS deployment if nonce != 0
//     if (dpsNonce !== 0) {
//       console.log(`⚠️  DPS deployer nonce is ${dpsNonce}, checking for existing deployment...`);
      
//       // Calculate deterministic address for nonce 0
//       const expectedDpsAddress = hardhatRuntime.ethers.getCreateAddress({
//         from: dpsSigner.address,
//         nonce: 0
//       });
      
//       console.log(`Expected DPS address (nonce 0): ${expectedDpsAddress}`);
      
//       // Check if contract exists at the expected address
//       const contractCode = await hardhatRuntime.ethers.provider.getCode(expectedDpsAddress);
//       const contractExists = contractCode !== "0x";
      
//       if (contractExists) {
//         console.log("✅ Found existing DPS contract at expected address, skipping deployment");
        
//         // Connect to existing contract
//         const DataPointStorageFactory = await hardhatRuntime.ethers.getContractFactory("DataPointStorage");
//         dataPointStorage = DataPointStorageFactory.attach(expectedDpsAddress) as DataPointStorage;
//         dpsAddress = expectedDpsAddress;
//         skipDpsDeployment = true;
        
//         // Verify it's actually a DPS contract
//         try {
//           const version = await dataPointStorage.VERSION();
//           console.log(`   Existing DPS version: ${version}`);
//         } catch (error) {
//           throw new Error(`Contract at expected DPS address ${expectedDpsAddress} is not a valid DataPointStorage contract`);
//         }
//       } else {
//         throw new Error(`Vanity nonce error: Nonce not 0 and contract not deployed. Expected DPS at ${expectedDpsAddress} but no contract found.`);
//       }
//     }

//     if (!skipDpsDeployment) {
//       console.log("🚀 Deploying DataPointStorage...");
      
//       // Get the deployment bytecode first
//       const DataPointStorageFactory = await hardhatRuntime.ethers.getContractFactory("DataPointStorage");
//       const deploymentData = DataPointStorageFactory.bytecode;
      
//       // Preflight check - populate the exact transaction we'll send
//       const deployTx: any = {  // Using any temporarily to avoid complex transaction type definition
//         from: dpsSigner.address,
//         maxFeePerGas,
//         maxPriorityFeePerGas,
//         type: 2, // EIP-1559 transaction
//         nonce: await dpsSigner.getNonce(),
//         data: deploymentData,
//         chainId: chainId
//       };
      
//       // Get the exact gas estimate for our specific transaction
//       const finalGasEstimate = await hardhatRuntime.ethers.provider.estimateGas(deployTx);
      
//       // Set the gas limit with a small buffer for safety (10%)
//       const gasLimit = (finalGasEstimate * 110n) / 100n;
//       deployTx.gasLimit = gasLimit;

//       // Calculate all possible upfront costs
//       const currentBalance = await hardhatRuntime.ethers.provider.getBalance(dpsSigner.address);

//       const upfrontWithMaxFee = gasLimit * maxFeePerGas;
//       const upfrontWithBaseFee = gasLimit * baseFeePerGas;
//       const upfrontWithPriorityFee = gasLimit * maxPriorityFeePerGas;
//       const upfrontTotal = upfrontWithMaxFee + upfrontWithBaseFee + upfrontWithPriorityFee;

//       console.log("\n📊 Preflight Gas Analysis:");
//       console.log(`Final gas estimate: ${finalGasEstimate.toString()} gas`);
//       console.log(`Gas limit (with 10% buffer): ${gasLimit.toString()} gas`);
//       console.log("Potential upfront costs:");
//       console.log(`  With max fee:     ${formatEther(upfrontWithMaxFee)} ETH (${upfrontWithMaxFee.toString()} wei)`);
//       console.log(`  With base fee:    ${formatEther(upfrontWithBaseFee)} ETH (${upfrontWithBaseFee.toString()} wei)`);
//       console.log(`  With priority:    ${formatEther(upfrontWithPriorityFee)} ETH (${upfrontWithPriorityFee.toString()} wei)`);
//       console.log(`  Total (m+b+p):      ${formatEther(upfrontTotal)} ETH (${upfrontTotal.toString()} wei)`);
//       console.log(`Current balance:    ${formatEther(currentBalance)} ETH (${currentBalance.toString()} wei)`);

//       // Get raw transaction data for analysis
//       console.log("\n🔍 Raw Transaction Analysis:");
//       console.log("Transaction:",
//         "\n  maxFeePerGas:", deployTx.maxFeePerGas?.toString(),
//         "\n  maxPriorityFeePerGas:", deployTx.maxPriorityFeePerGas?.toString(),
//         "\n  gasLimit:", deployTx.gasLimit?.toString(),
//         "\n  nonce:", deployTx.nonce,
//         "\n  type:", deployTx.type,
//         "\n  chainId:", deployTx.chainId,
//         "\n  from:", deployTx.from
//         // "\n  data:", deployTx.data // Commented out as it's too long
//       );

//       if (currentBalance < upfrontTotal) {
//         dpsBalance = await fundDeployerIfNeeded(dpsSigner, currentBalance, upfrontTotal, "DPS");
//         if (dpsBalance < upfrontTotal)
//         throw new Error(`Preflight check failed: Insufficient funds after funding.\nRequired: ${upfrontWithMaxFee.toString()} wei\nAvailable: ${currentBalance.toString()} wei`);
//       }
//       throw new Error(`Not Implimented: DPS Deployer Balance: ${formatEther(dpsBalance)} ETH`);
      
//       // Deploy using our fully specified transaction
//       dataPointStorage = await DataPointStorageFactory.connect(dpsSigner).deploy({
//         maxFeePerGas,
//         maxPriorityFeePerGas,
//         gasLimit
//       }) as DataPointStorage;
//       await dataPointStorage.waitForDeployment();
//       dpsAddress = await dataPointStorage.getAddress();

//       console.log(`✅ DataPointStorage deployed to: ${dpsAddress}`);
//       console.log(`   Deployed by: ${dpsSigner.address}`);
//     }
//     throw new Error("Not implemented");

//     // Ensure we have both dataPointStorage and dpsAddress
//     if (!dataPointStorage || !dpsAddress) {
//       throw new Error("Failed to initialize DataPointStorage contract");
//     }

//     console.log(`   Version: ${await dataPointStorage.VERSION()}\n`);

//     // ========================================
//     // STEP 2: DPR Estimation and Deployment
//     // ========================================
//     console.log("📦 Step 2: DataPointRegistry (DPR) Deployment");
//     console.log("⛽ Estimating DPR deployment cost...");
    
//     // Use custom royalty rate or default to 1/1000th of gas price
//     const royaltyRate = customRoyaltyRate || feeData.gasPrice / 1000n;
//     const royaltyRateGwei = hardhatRuntime.ethers.formatUnits(royaltyRate, "gwei");
    
//     console.log(`💰 Royalty rate: ${royaltyRateGwei} GWEI (${royaltyRate.toString()} wei)`);
    
//     const DataPointRegistryFactory = await hardhatRuntime.ethers.getContractFactory("DataPointRegistry");
//     const dprDeployTx = await DataPointRegistryFactory.connect(dprSigner).getDeployTransaction(
//       owner.address,     // Owner of the DPR contract
//       dpsAddress,        // Address of the deployed DPS contract (real address!)
//       royaltyRate        // Royalty rate
//     );
    
//     const dprGasEstimate = await hardhatRuntime.ethers.provider.estimateGas({
//       ...dprDeployTx,
//       from: dprSigner.address
//     });
    
//     // Calculate deployment cost with 20% buffer on gas estimate and 3x max gas price
//     const dprCost = (dprGasEstimate * maxFeePerGas * 120n) / 100n;
    
//     console.log(`💰 DPR deployment cost (with safety margins):`);
//     console.log(`   Base estimate: ${formatEther(dprGasEstimate * feeData.gasPrice)} ETH`);
//     console.log(`   With 3x gas price buffer: ${formatEther(dprGasEstimate * maxFeePerGas)} ETH`);
//     console.log(`   Final (with 20% gas buffer): ${formatEther(dprCost)} ETH (${dprGasEstimate.toString()} gas)`);
    
//     // Get current DPR balance and check/fund if needed
//     const currentDprBalance = await hardhatRuntime.ethers.provider.getBalance(dprSigner.address);
//     await fundDeployerIfNeeded(dprSigner, currentDprBalance, dprGasEstimate, "DPR");
    
//     console.log("🚀 Deploying DataPointRegistry...");
    
//     const dataPointRegistry = await DataPointRegistryFactory.connect(dprSigner).deploy(
//       owner.address,     // Owner of the DPR contract
//       dpsAddress,        // Address of the DPS contract
//       royaltyRate        // Royalty rate
//     ) as DataPointRegistry;
    
//     await dataPointRegistry.waitForDeployment();
//     const dprAddress = await dataPointRegistry.getAddress();

//     console.log(`✅ DataPointRegistry deployed to: ${dprAddress}`);
//     console.log(`   Deployed by: ${dprSigner.address}`);
//     console.log(`   Owner: ${owner.address}`);
//     console.log(`   DPS Address: ${dpsAddress}`);
//     console.log(`   Royalty Rate: ${royaltyRateGwei} GWEI\n`);

//     // ========================================
//     // STEP 3: Verification and Testing
//     // ========================================
//     console.log("🔗 Verifying contract connections...");
//     const dpsFromRegistry = await dataPointRegistry.DPS();
//     const royaltyRateFromRegistry = await dataPointRegistry.royaltyRate();

//     console.log(`DPS address in registry: ${dpsFromRegistry}`);
//     console.log(`Royalty rate in registry: ${hardhatRuntime.ethers.formatUnits(royaltyRateFromRegistry, "gwei")} GWEI`);

//     if (dpsFromRegistry === dpsAddress) {
//       console.log("✅ Contract connection verified successfully!");
//     } else {
//       console.log("❌ Contract connection verification failed!");
//     }

//     // Test basic functionality
//     console.log("\n🧪 Testing basic functionality...");
//     const testData = toUtf8Bytes("Hello ESP!");
//     const calculatedAddress = await dataPointStorage.calculateAddress(testData);
//     console.log(`Test data point address: ${calculatedAddress}`);

//     // Contract verification
//     if (shouldVerify && !skipVerification) {
//       console.log("\n🔍 Starting contract verification...");
      
//       try {
//         // Verify DataPointStorage
//         console.log("📋 Verifying DataPointStorage...");
//         await hardhatRuntime.run("verify:verify", {
//           address: dpsAddress,
//           constructorArguments: [],
//         });
//         console.log("✅ DataPointStorage verified successfully!");
//       } catch (error: any) {
//         if (error.message.includes("Already Verified")) {
//           console.log("ℹ️  DataPointStorage already verified");
//         } else {
//           console.log("❌ DataPointStorage verification failed:", error.message);
//         }
//       }

//       try {
//         // Verify DataPointRegistry  
//         console.log("📋 Verifying DataPointRegistry...");
//         await hardhatRuntime.run("verify:verify", {
//           address: dprAddress,
//           constructorArguments: [
//             owner.address,
//             dpsAddress,
//             royaltyRate.toString()
//           ],
//         });
//         console.log("✅ DataPointRegistry verified successfully!");
//       } catch (error: any) {
//         if (error.message.includes("Already Verified")) {
//           console.log("ℹ️  DataPointRegistry already verified");
//         } else {
//           console.log("❌ DataPointRegistry verification failed:", error.message);
//         }
//       }
//     }

//     // Calculate actual costs spent (get final balances)
//     const finalDpsBalance = await hardhatRuntime.ethers.provider.getBalance(dpsSigner.address);
//     const finalDprBalance = await hardhatRuntime.ethers.provider.getBalance(dprSigner.address);
//     const finalOwnerBalance = await hardhatRuntime.ethers.provider.getBalance(owner.address);
    
//     const actualDpsCost = skipDpsDeployment ? 0n : (dpsBalance - finalDpsBalance);
//     const actualDprCost = dprBalance - finalDprBalance;
//     const ownerSpent = ownerBalance - finalOwnerBalance;

//     console.log("\n🎉 Deployment completed successfully!");
//     console.log("\n📄 Deployment Summary:");
//     console.log("=".repeat(60));
//     console.log(`Network:          ${network}`);
//     console.log(`DataPointStorage: ${dpsAddress} ${skipDpsDeployment ? "(existing)" : "(deployed)"}`);
//     console.log(`DataPointRegistry: ${dprAddress} (deployed)`);
//     console.log(`Owner:            ${owner.address}`);
//     console.log(`Royalty Rate:     ${royaltyRateGwei} GWEI`);
//     console.log(`\nDeployment costs:`);
//     if (!skipDpsDeployment) {
//       console.log(`DPS actual:       ${formatEther(actualDpsCost)} ETH`);
//     } else {
//       console.log(`DPS:              Skipped (existing contract)`);
//     }
//     console.log(`DPR actual:       ${formatEther(actualDprCost)} ETH`);
//     console.log(`Total spent:      ${formatEther(actualDpsCost + actualDprCost)} ETH`);
//     if (ownerSpent > 0n) {
//       console.log(`Owner funding:    ${formatEther(ownerSpent)} ETH`);
//       console.log(`Grand total:      ${formatEther(actualDpsCost + actualDprCost + ownerSpent)} ETH`);
//     }
//     if (shouldVerify && !skipVerification) {
//       console.log(`Etherscan:        Contracts verified on block explorer`);
//     }
//     console.log("=".repeat(60));

//     // ========================================
//     // STEP 4: Update Deployment Registry
//     // ========================================
//     console.log("\n📝 Updating deployment registry...");
    
//     try {
//       const deploymentData = formatDeploymentData(
//         chainId,
//         {
//           address: dpsAddress,
//           deployerAddress: dpsSigner.address,
//           txHash: dataPointStorage.deploymentTransaction()?.hash
//         },
//         {
//           address: dprAddress,
//           deployerAddress: dprSigner.address,
//           txHash: dataPointRegistry.deploymentTransaction()?.hash,
//           owner: owner.address,
//           dpsAddress: dpsAddress,
//           royaltyRate: royaltyRate
//         }
//       );
      
//       await addDeployment(deploymentData);
//       console.log(`🎯 Network '${network}' deployment registered successfully!`);
//     } catch (error: any) {
//       console.log("⚠️  Failed to update deployment registry:", error.message);
//       console.log("📝 You can manually update esp.deployments.ts with the following info:");
//       console.log(`   Network: ${network}`);
//       console.log(`   DPS: ${dpsAddress}`);
//       console.log(`   DPR: ${dprAddress}`);
//       console.log(`   Owner: ${owner.address}`);
//       console.log(`   Royalty Rate: ${royaltyRate.toString()}`);
//     }

//     // Return deployed contracts for potential further use
//     return {
//       dataPointStorage,
//       dataPointRegistry,
//       addresses: {
//         dps: dpsAddress,
//         dpr: dprAddress,
//         owner: owner.address
//       },
//       signers: {
//         dpsSigner,
//         dprSigner,
//         owner
//       },
//       costs: {
//         dps: actualDpsCost,
//         dpr: actualDprCost,
//         total: actualDpsCost + actualDprCost,
//         ownerFunding: ownerSpent,
//         grandTotal: actualDpsCost + actualDprCost + ownerSpent
//       },
//       skipped: {
//         dps: skipDpsDeployment
//       },
//       royaltyRate: {
//         wei: royaltyRate.toString(),
//         gwei: royaltyRateGwei
//       }
//     };

//   } catch (error) {
//     console.error("❌ Deployment failed:", error);
//     throw error;
//   }
// }

// // Legacy main function for direct script execution
// async function main() {
//   return await deployWithVanity();
// }

// // We recommend this pattern to be able to use async/await everywhere
// // and properly handle errors.
// if (require.main === module) {
//   main()
//     .then(() => process.exit(0))
//     .catch((error) => {
//       console.error(error);
//       process.exit(1);
//     });
// }