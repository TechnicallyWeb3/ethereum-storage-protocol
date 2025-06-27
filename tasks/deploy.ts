import { task, types } from "hardhat/config";

task("deploy:vanity", "Deploy ESP contracts with vanity addresses")
  .addOptionalParam(
    "royalty",
    "Royalty rate in GWEI (defaults to 1/1000th of current gas price)",
    undefined,
    types.string
  )
  .addFlag(
    "skipVerify",
    "Skip contract verification on block explorer (verification enabled by default)"
  )
  .addOptionalParam(
    "confirmations",
    "Number of confirmations to wait before verification (default: 5)",
    "5",
    types.string
  )
  .setAction(async (taskArgs, hre) => {
    console.log(`🚀 ESP Vanity Deployment Task`);
    console.log(`🌐 Network: ${hre.network.name}\n`);

    const { royalty, skipVerify, confirmations } = taskArgs;
    
    try {
      // Import the deployment logic inside the task to avoid circular imports
      const { deployWithVanity } = await import("../scripts/DeployVanity");
      
      // Convert royalty rate if provided
      let royaltyRateWei: bigint | undefined;
      if (royalty) {
        // Convert GWEI to wei
        royaltyRateWei = hre.ethers.parseUnits(royalty, "gwei");
        console.log(`💰 Using custom royalty rate: ${royalty} GWEI (${royaltyRateWei.toString()} wei)`);
      } else {
        console.log(`💰 Using default royalty rate: 1/1000th of current gas price`);
      }

      // Determine verification setting
      const shouldSkipVerification = skipVerify || false;
      console.log(`🔍 Contract verification: ${shouldSkipVerification ? "DISABLED" : "ENABLED with " + confirmations + " confirmations wait"}`);
      
      // Call the deployment function
      const result = await deployWithVanity(hre, royaltyRateWei, shouldSkipVerification, confirmations);
      
      console.log(`\n🎉 Vanity deployment completed successfully!`);
      console.log(`📍 DPS: ${result.addresses.dps}`);
      console.log(`📍 DPR: ${result.addresses.dpr}`);
      
    } catch (error) {
      console.error("❌ Deployment failed:", error);
      process.exit(1);
    }
  });

task("deploy:ignition", "Deploy ESP contracts using Hardhat Ignition")
  .addOptionalParam(
    "royalty",
    "Royalty rate in GWEI (defaults to 0.1 GWEI)",
    "0.1",
    types.string
  )
  .addOptionalParam(
    "owner",
    "Contract owner address (defaults to deployer)",
    undefined,
    types.string
  )
  .addFlag(
    "skipVerify",
    "Skip contract verification on block explorer (verification enabled by default)"
  )
  .setAction(async (taskArgs, hre) => {
    console.log(`🚀 ESP Ignition Deployment Task`);
    console.log(`🌐 Network: ${hre.network.name}\n`);

    const { royalty, owner, skipVerify } = taskArgs;
    
    try {
      // Import the ignition module
      const ESPCoreModule = (await import("../ignition/modules/ESPCore")).default;
      
      // Convert royalty rate from GWEI to wei
      const royaltyRateWei = hre.ethers.parseUnits(royalty, "gwei");
      console.log(`💰 Royalty rate: ${royalty} GWEI (${royaltyRateWei.toString()} wei)`);
      
      // Get deployer if owner not specified
      const signers = await hre.ethers.getSigners();
      const ownerAddress = owner || signers[0].address;
      console.log(`👤 Contract owner: ${ownerAddress}`);
      
      // Deploy using ignition
      console.log(`🚀 Deploying contracts using Hardhat Ignition...`);
      
      const { dataPointStorage, dataPointRegistry } = await hre.ignition.deploy(
        ESPCoreModule,
        { 
          parameters: {
            ESPCoreModule: {
              owner: ownerAddress,
              royalty: royaltyRateWei
            }
          }
        }
      );
      
      const dpsAddress = await dataPointStorage.getAddress();
      const dprAddress = await dataPointRegistry.getAddress();
      
      console.log(`\n✅ Deployment completed successfully!`);
      console.log(`📍 DataPointStorage: ${dpsAddress}`);
      console.log(`📍 DataPointRegistry: ${dprAddress}`);
      console.log(`👤 Owner: ${ownerAddress}`);
      console.log(`💰 Royalty Rate: ${royalty} GWEI`);
      
      // Verify contracts if not skipped using enhanced verification with confirmation waiting
      if (!skipVerify && hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
        console.log(`\n🔍 Verifying contracts with enhanced procedure...`);
        
        try {
          await hre.run("deploy:verify", {
            dps: dpsAddress,
            dpr: dprAddress,
            owner: ownerAddress,
            royalty: royaltyRateWei.toString(),
            confirmations: "5" // Wait for 5 confirmations before verification
          });
        } catch (verifyError) {
          console.log(`⚠️  Verification failed: ${verifyError}`);
          console.log(`You can verify manually using:`);
          console.log(`npx hardhat deploy:verify --dps ${dpsAddress} --dpr ${dprAddress} --owner ${ownerAddress} --royalty ${royaltyRateWei.toString()} --network ${hre.network.name}`);
        }
      }
      
    } catch (error) {
      console.error("❌ Deployment failed:", error);
      process.exit(1);
    }
  });

task("deploy:verify", "Verify deployed contracts on block explorer")
  .addOptionalParam("dps", "DataPointStorage contract address", undefined, types.string)
  .addOptionalParam("dpr", "DataPointRegistry contract address", undefined, types.string)
  .addOptionalParam("owner", "Owner address used in DPR constructor", undefined, types.string)
  .addOptionalParam("royalty", "Royalty rate used in DPR constructor (in wei)", undefined, types.string)
  .addOptionalParam("chainid", "Chain ID to verify (defaults to current network)", undefined, types.string)
  .addOptionalParam("confirmations", "Number of confirmations to wait before verifying (default: 5)", "5", types.string)
  .addFlag("auto", "Automatically load contract addresses from esp.deployments.ts")
  .addFlag("skipWait", "Skip waiting for confirmations before verification")
  .setAction(async (taskArgs, hre) => {
    function delay(ms: number): Promise<void> {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    const { dps, dpr, owner, royalty, chainid, auto, confirmations, skipWait } = taskArgs;
    
    let contractDps = dps;
    let contractDpr = dpr;
    let ownerAddress = owner;
    let royaltyRate = royalty;
    
    // Auto-load from deployments file if requested or if no manual params provided
    const shouldAutoLoad = auto || (!dps && !dpr && !owner && !royalty);
    
    if (shouldAutoLoad) {
      console.log(`📋 Auto-loading contract data from esp.deployments.ts...`);
      
      try {
        const { espDeployments } = await import("../esp.deployments");
        const targetChainId = chainid ? parseInt(chainid) : hre.network.config.chainId;
        
        if (!targetChainId) {
          throw new Error("Could not determine chain ID");
        }
        
        const deployment = espDeployments.chains[targetChainId];
        
        if (!deployment) {
          console.error(`❌ No deployment found for chain ID ${targetChainId}`);
          console.log(`Available chain IDs: ${Object.keys(espDeployments.chains).join(', ')}`);
          return;
        }
        
        contractDps = deployment.dps.contractAddress;
        contractDpr = deployment.dpr.contractAddress;
        ownerAddress = deployment.dpr.constructors.ownerAddress;
        royaltyRate = deployment.dpr.constructors.royaltyRate;
        
        console.log(`✅ Loaded deployment for chain ID ${targetChainId}`);
        console.log(`📍 DPS: ${contractDps}`);
        console.log(`📍 DPR: ${contractDpr}`);
        console.log(`👤 Owner: ${ownerAddress}`);
        console.log(`💰 Royalty: ${royaltyRate} wei`);
        
      } catch (error) {
        console.error(`❌ Failed to auto-load deployment data:`, error);
        console.log(`Please provide manual parameters or check esp.deployments.ts`);
        return;
      }
    }
    
    // Validate required parameters
    if (!contractDps || !contractDpr || !ownerAddress || !royaltyRate) {
      console.error(`❌ Missing required parameters. Either use --auto flag or provide:`);
      console.log(`--dps <address> --dpr <address> --owner <address> --royalty <wei>`);
      return;
    }
    
    // Wait for confirmations if not skipped
    if (!skipWait && hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
      const confirmationsToWait = parseInt(confirmations);
      console.log(`⏳ Waiting for ${confirmationsToWait} confirmations before verification to allow Etherscan indexing...`);
      
      try {
        // Get the current block number
        const currentBlock = await hre.ethers.provider.getBlockNumber();
        const targetBlock = currentBlock + confirmationsToWait;
        
        console.log(`📊 Current block: ${currentBlock}, waiting for block: ${targetBlock}`);
        
        // Wait for the target block
        await new Promise((resolve) => {
          const checkBlock = async () => {
            const latestBlock = await hre.ethers.provider.getBlockNumber();
            if (latestBlock >= targetBlock) {
              console.log(`✅ Reached block ${latestBlock}, proceeding with verification...`);
              resolve(undefined);
            } else {
              console.log(`⏳ Current block: ${latestBlock}, waiting...`);
              setTimeout(checkBlock, 10000); // Check every 10 seconds
            }
          };
          checkBlock();
        });
      } catch (error) {
        console.log(`⚠️  Could not wait for confirmations: ${error}`);
        console.log(`Proceeding with verification anyway...`);
      }
    }

    console.log(`\n🔍 Verifying contracts on ${hre.network.name}...`);
    
    try {
      // Verify DataPointStorage
      console.log("📋 Verifying DataPointStorage...");
      await hre.run("verify:verify", {
        address: contractDps,
        constructorArguments: [],
      });
      console.log("✅ DataPointStorage verified!");
    } catch (error: any) {
      if (error.message.includes("already been verified") || error.message.includes("Already Verified")) {
        console.log("ℹ️  DataPointStorage already verified");
      } else {
        console.log("❌ DataPointStorage verification failed:", error.message);
      }
    }
    await delay(2000);

    try {
      // Verify DataPointRegistry
      console.log("📋 Verifying DataPointRegistry...");
      console.log(`Constructor args: [${ownerAddress}, ${contractDps}, ${royaltyRate}]`);
      await hre.run("verify:verify", {
        address: contractDpr,
        constructorArguments: [ownerAddress, contractDps, royaltyRate],
      });
      console.log("✅ DataPointRegistry verified!");
    } catch (error: any) {
      if (error.message.includes("already been verified") || error.message.includes("Already Verified")) {
        console.log("ℹ️  DataPointRegistry already verified");
      } else {
        console.log("❌ DataPointRegistry verification failed:", error.message);
      }
    }
    
    console.log("\n🎉 Verification process completed!");
  });

task("deploy:register", "Register deployed contracts in esp.deployments.ts")
  .addParam("dps", "DataPointStorage contract address", undefined, types.string)
  .addParam("dpr", "DataPointRegistry contract address", undefined, types.string)
  .addOptionalParam("dpsDeployer", "DPS deployer address (defaults to current signer)", undefined, types.string)
  .addOptionalParam("dprDeployer", "DPR deployer address (defaults to current signer)", undefined, types.string)
  .addOptionalParam("dpsTx", "DPS transaction hash", "TBD", types.string)
  .addOptionalParam("dprTx", "DPR transaction hash", "TBD", types.string)
  .addParam("owner", "Owner address used in DPR constructor", undefined, types.string)
  .addParam("royalty", "Royalty rate used in DPR constructor (in wei)", undefined, types.string)
  .addOptionalParam("chainid", "Chain ID to register (defaults to current network)", undefined, types.string)
  .setAction(async (taskArgs, hre) => {
    const { dps, dpr, dpsDeployer, dprDeployer, dpsTx, dprTx, owner, royalty, chainid } = taskArgs;
    
    // Get chain ID
    const targetChainId = chainid ? parseInt(chainid) : hre.network.config.chainId;
    
    if (!targetChainId) {
      console.error(`❌ Could not determine chain ID. Please specify --chainid`);
      return;
    }
    
    // Get deployer addresses if not provided
    const signers = await hre.ethers.getSigners();
    const defaultDeployer = signers[0].address;
    
    const finalDpsDeployer = dpsDeployer || defaultDeployer;
    const finalDprDeployer = dprDeployer || defaultDeployer;
    
    console.log(`📝 Registering deployment for chain ID ${targetChainId} (${hre.network.name})`);
    console.log(`📍 DPS: ${dps} (deployer: ${finalDpsDeployer})`);
    console.log(`📍 DPR: ${dpr} (deployer: ${finalDprDeployer})`);
    console.log(`👤 Owner: ${owner}`);
    console.log(`💰 Royalty: ${royalty} wei`);
    
    try {
      // Import the AddDeployment functionality
      const { addDeployment, formatDeploymentData } = await import("../scripts/AddDeployment");
      
      // Format the deployment data
      const deploymentData = formatDeploymentData(
        targetChainId,
        {
          address: dps,
          deployerAddress: finalDpsDeployer,
          txHash: dpsTx
        },
        {
          address: dpr,
          deployerAddress: finalDprDeployer,
          txHash: dprTx,
          owner: owner,
          dpsAddress: dps,
          royaltyRate: BigInt(royalty)
        }
      );
      
      // Add to registry
      await addDeployment(deploymentData);
      
      console.log(`✅ Deployment registered successfully in esp.deployments.ts!`);
      console.log(`🔍 You can now verify using: npx hardhat deploy:verify --auto --network ${hre.network.name}`);
      
    } catch (error) {
      console.error(`❌ Failed to register deployment:`, error);
      throw error;
    }
  }); 