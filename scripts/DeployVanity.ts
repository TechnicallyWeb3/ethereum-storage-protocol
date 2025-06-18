import hre from "hardhat";
import { formatEther, formatUnits, parseUnits, toUtf8Bytes } from "ethers";
import { DataPointStorage, DataPointRegistry } from "../typechain-types";
import { addDeployment, formatDeploymentData } from './AddDeployment';

/**
 * Deploy ESP contracts with vanity addresses using try-catch funding strategy
 * @param hardhatRuntime - Hardhat runtime environment
 * @param customRoyaltyRate - Custom royalty rate in wei (optional, defaults to 1/1000th of gas price)
 * @param skipVerification - Skip contract verification (optional, defaults to false)
 */
export async function deployWithVanity(
  hardhatRuntime: typeof hre = hre,
  customRoyaltyRate?: bigint,
  skipVerification: boolean = false,
  confirmations: string = "5"
) {
  console.log("🚀 Starting quick & dirty vanity deployment script...\n");

  // Get chain information
  const network = hardhatRuntime.network.name;
  const chainId = hardhatRuntime.network.config.chainId;
  if (chainId === undefined) {
    throw new Error("ChainId is undefined, please set a chainId in your hardhat.config.ts");
  }

  const shouldVerify = chainId !== 31337 && chainId !== 1337 && !skipVerification;
  
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

  // Check initial balances
  const initialDpsBalance = await hardhatRuntime.ethers.provider.getBalance(dpsSigner.address);
  const initialDprBalance = await hardhatRuntime.ethers.provider.getBalance(dprSigner.address);
  const initialOwnerBalance = await hardhatRuntime.ethers.provider.getBalance(owner.address);

  console.log(`DPS Deployer Balance: ${formatEther(initialDpsBalance)} ETH`);
  console.log(`DPR Deployer Balance: ${formatEther(initialDprBalance)} ETH`);
  console.log(`Owner Balance: ${formatEther(initialOwnerBalance)} ETH\n`);
  
  // Get current gas price for royalty rate calculation
  const feeData = await hardhatRuntime.ethers.provider.getFeeData();
  const gasPrice = feeData.gasPrice || parseUnits("20", "gwei");
  console.log(`Current gas price: ${formatUnits(gasPrice, "gwei")} GWEI\n`);

     /**
    * Parse insufficient funds error and extract required amount
    */
   function parseInsufficientFundsError(error: any): bigint | null {
     const errorMsg = error.message || error.toString();
     console.log(`🔍 Parsing: ${errorMsg}`);
     
     // Explicit pattern matching for known formats
     
     // 1. Provider-specific format: "ProviderError: Sender doesn't have enough funds to send tx. The max upfront cost is: 17156179590000000 and the sender's balance is: 4265999968225256"
     const providerPattern = /max upfront cost is: (\d+) and the sender's balance is: (\d+)/;
     const providerMatch = errorMsg.match(providerPattern);
     if (providerMatch) {
       const maxUpfront = BigInt(providerMatch[1]);
       const balance = BigInt(providerMatch[2]);
       const needed = maxUpfront - balance;
       console.log(`📊 Provider format - Max upfront: ${formatEther(maxUpfront)} ETH, Balance: ${formatEther(balance)} ETH, Needed: ${formatEther(needed)} ETH`);
       return needed;
     }
     
     // 2. Testnet format: "insufficient funds for gas * price + value: balance 0, tx cost 344209543464, overshot 344209543464"
     const testnetPattern = /insufficient funds for gas \* price \+ value: balance (\d+), tx cost (\d+), overshot (\d+)/;
     const testnetMatch = errorMsg.match(testnetPattern);
     if (testnetMatch) {
       const balance = BigInt(testnetMatch[1]);
       const txCost = BigInt(testnetMatch[2]);
       const overshot = BigInt(testnetMatch[3]);
       console.log(`📊 Testnet format - Balance: ${formatEther(balance)} ETH, TX Cost: ${formatEther(txCost)} ETH, Overshot: ${formatEther(overshot)} ETH`);
       return overshot; // The overshot amount is what we need
     }
     
     // 3. Standard have/want format: "insufficient funds for gas * price + value: address 0x... have 12345 want 67890"
     const standardPattern = /insufficient funds for gas \* price \+ value: address .* have (\d+) want (\d+)/;
     const standardMatch = errorMsg.match(standardPattern);
     if (standardMatch) {
       const have = BigInt(standardMatch[1]);
       const want = BigInt(standardMatch[2]);
       const needed = want - have;
       console.log(`📊 Standard format - Have: ${formatEther(have)} ETH, Want: ${formatEther(want)} ETH, Needed: ${formatEther(needed)} ETH`);
       return needed;
     }
     
     // Fallback: Generic patterns for other formats
     console.log("🔄 No explicit pattern matched, trying fallback patterns...");
     const fallbackPatterns = [
       /insufficient funds: address .* have (\d+) want (\d+)/,
       /insufficient funds for transfer: address .* have (\d+) want (\d+)/,
       /insufficient funds.*?want (\d+)/,
       /need (\d+) have (\d+)/
     ];

     for (const pattern of fallbackPatterns) {
       const match = errorMsg.match(pattern);
       if (match) {
         console.log(`📊 Fallback pattern matched with ${match.length - 1} capture groups`);
         if (match.length >= 3) {
           // Two numbers: typically have, want
           const have = BigInt(match[1]);
           const want = BigInt(match[2]);
           const needed = want - have;
           console.log(`📊 Fallback - Have: ${formatEther(have)} ETH, Want: ${formatEther(want)} ETH, Needed: ${formatEther(needed)} ETH`);
           return needed;
         } else if (match.length >= 2) {
           // One number: assume it's the needed amount
           const needed = BigInt(match[1]);
           console.log(`📊 Fallback - Needed: ${formatEther(needed)} ETH`);
           return needed;
         }
       }
     }
     
     console.log("❌ Could not parse required amount from error");
     return null;
   }

  /**
   * Fund deployer with parsed amount plus buffer
   */
  async function fundDeployer(deployerSigner: any, requiredAmount: bigint, deployerName: string): Promise<void> {
    // Add 10% buffer for safety
    const fundingAmount = (requiredAmount * 110n) / 100n;
    
    console.log(`💰 Funding ${deployerName} deployer with ${formatEther(fundingAmount)} ETH (10% buffer)...`);
    
    const ownerBalance = await hardhatRuntime.ethers.provider.getBalance(owner.address);
    if (ownerBalance < fundingAmount) {
      throw new Error(`Owner has insufficient funds: need ${formatEther(fundingAmount)} ETH but only have ${formatEther(ownerBalance)} ETH`);
    }

    const fundingTx = await owner.sendTransaction({
      to: deployerSigner.address,
      value: fundingAmount
    });

    await fundingTx.wait();
    console.log(`✅ Successfully funded ${deployerName} deployer (tx: ${fundingTx.hash})`);
    
    const newBalance = await hardhatRuntime.ethers.provider.getBalance(deployerSigner.address);
    console.log(`   New ${deployerName} deployer balance: ${formatEther(newBalance)} ETH\n`);
  }

  /**
   * Deploy contract with automatic funding on failure
   */
  async function deployWithRetry<T>(
    deployerSigner: any,
    deployFunction: () => Promise<T>,
    deployerName: string,
    contractName: string
  ): Promise<T> {
    console.log(`🚀 Attempting to deploy ${contractName}...`);
    
    try {
      // First attempt
      return await deployFunction();
    } catch (error: any) {
      console.log(`⚠️  ${contractName} deployment failed, checking if it's a funding issue...`);
      
      const requiredAmount = parseInsufficientFundsError(error);
      if (!requiredAmount) {
        console.log("❌ Error is not related to insufficient funds, re-throwing...");
        throw error;
      }
      
      console.log(`💸 Funding ${deployerName} deployer and retrying deployment...`);
      await fundDeployer(deployerSigner, requiredAmount, deployerName);
      
      try {
        // Second attempt after funding
        console.log(`🔄 Retrying ${contractName} deployment...`);
        return await deployFunction();
      } catch (retryError: any) {
        console.log(`❌ ${contractName} deployment failed again after funding`);
        throw retryError;
      }
    }
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
      const DataPointStorageFactory = await hardhatRuntime.ethers.getContractFactory("DataPointStorage");
      
      dataPointStorage = await deployWithRetry(
        dpsSigner,
        async () => {
          const contract = await DataPointStorageFactory.connect(dpsSigner).deploy() as DataPointStorage;
          await contract.waitForDeployment();
          return contract;
        },
        "DPS",
        "DataPointStorage"
      );
      
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
    
    // Use custom royalty rate or default to 1/1000th of gas price
    const royaltyRate = customRoyaltyRate || gasPrice / 1000n;
    const royaltyRateGwei = hardhatRuntime.ethers.formatUnits(royaltyRate, "gwei");
    
    console.log(`💰 Royalty rate: ${royaltyRateGwei} GWEI (${royaltyRate.toString()} wei)`);
    
    const DataPointRegistryFactory = await hardhatRuntime.ethers.getContractFactory("DataPointRegistry");
    
         const dataPointRegistry = await deployWithRetry(
       dprSigner,
       async () => {
         if (!dpsAddress) {
           throw new Error("DPS address is required for DPR deployment");
         }
         const contract = await DataPointRegistryFactory.connect(dprSigner).deploy(
           owner.address,     // Owner of the DPR contract
           dpsAddress,        // Address of the DPS contract
           royaltyRate        // Royalty rate
         ) as DataPointRegistry;
         await contract.waitForDeployment();
         return contract;
       },
       "DPR",
       "DataPointRegistry"
     );
    
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

    // Contract verification using enhanced procedure with confirmation waiting
    if (shouldVerify && !skipVerification) {
      console.log("\n🔍 Starting enhanced contract verification procedure...");
      
      try {
        // Use the enhanced deploy:verify task with confirmation waiting
        await hardhatRuntime.run("deploy:verify", {
          dps: dpsAddress,
          dpr: dprAddress,
          owner: owner.address,
          royalty: royaltyRate.toString(),
          confirmations: confirmations // Use the specified number of confirmations
        });
        console.log("✅ Enhanced contract verification completed successfully!");
      } catch (error: any) {
        console.log("❌ Enhanced verification failed:", error.message);
        console.log("🔄 Falling back to direct verification without confirmation waiting...");
        
        // Fallback to direct verification if the task fails
        try {
          // Verify DataPointStorage
          if (!skipDpsDeployment) {
            console.log("📋 Verifying DataPointStorage...");
            await hardhatRuntime.run("verify:verify", {
              address: dpsAddress,
              constructorArguments: [],
            });
            console.log("✅ DataPointStorage verified successfully!");
          }
        } catch (error: any) {
          if (error.message.includes("Already Verified") || error.message.includes("already been verified")) {
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
          if (error.message.includes("Already Verified") || error.message.includes("already been verified")) {
            console.log("ℹ️  DataPointRegistry already verified");
          } else {
            console.log("❌ DataPointRegistry verification failed:", error.message);
          }
        }
      }
    }

    // Calculate actual costs spent (get final balances)
    const finalDpsBalance = await hardhatRuntime.ethers.provider.getBalance(dpsSigner.address);
    const finalDprBalance = await hardhatRuntime.ethers.provider.getBalance(dprSigner.address);
    const finalOwnerBalance = await hardhatRuntime.ethers.provider.getBalance(owner.address);
    
    const actualDpsCost = skipDpsDeployment ? 0n : (initialDpsBalance - finalDpsBalance);
    const actualDprCost = initialDprBalance - finalDprBalance;
    const ownerSpent = initialOwnerBalance - finalOwnerBalance;

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
