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
  .setAction(async (taskArgs, hre) => {
    console.log(`🚀 ESP Vanity Deployment Task`);
    console.log(`🌐 Network: ${hre.network.name}\n`);

    const { royalty, skipVerify } = taskArgs;
    
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
      console.log(`🔍 Contract verification: ${shouldSkipVerification ? "DISABLED" : "ENABLED"}`);
      
      // Call the deployment function
      const result = await deployWithVanity(hre, royaltyRateWei, shouldSkipVerification);
      
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
      
      // Verify contracts if not skipped
      if (!skipVerify && hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
        console.log(`\n🔍 Verifying contracts...`);
        
        try {
          await hre.run("deploy:verify", {
            dps: dpsAddress,
            dpr: dprAddress,
            owner: ownerAddress,
            royalty: royaltyRateWei.toString()
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
  .addParam("dps", "DataPointStorage contract address", undefined, types.string)
  .addParam("dpr", "DataPointRegistry contract address", undefined, types.string)
  .addParam("owner", "Owner address used in DPR constructor", undefined, types.string)
  .addParam("royalty", "Royalty rate used in DPR constructor (in wei)", undefined, types.string)
  .setAction(async (taskArgs, hre) => {
    const { dps, dpr, owner, royalty } = taskArgs;
    
    console.log(`🔍 Verifying contracts on ${hre.network.name}...`);
    
    try {
      // Verify DataPointStorage
      console.log("📋 Verifying DataPointStorage...");
      await hre.run("verify:verify", {
        address: dps,
        constructorArguments: [],
      });
      console.log("✅ DataPointStorage verified!");
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
        address: dpr,
        constructorArguments: [owner, dps, royalty],
      });
      console.log("✅ DataPointRegistry verified!");
    } catch (error: any) {
      if (error.message.includes("Already Verified")) {
        console.log("ℹ️  DataPointRegistry already verified");
      } else {
        console.log("❌ DataPointRegistry verification failed:", error.message);
      }
    }
  }); 