import { task, types } from "hardhat/config";

task("deploy:vanity", "Deploy ESP contracts with vanity addresses")
  .addOptionalParam(
    "royalty",
    "Royalty rate in GWEI (defaults to 1/1000th of current gas price)",
    undefined,
    types.string
  )
  .addFlag(
    "verify",
    "Verify contracts on block explorer (auto-enabled for non-local networks)"
  )
  .setAction(async (taskArgs, hre) => {
    console.log(`🚀 ESP Vanity Deployment Task`);
    console.log(`🌐 Network: ${hre.network.name}\n`);

    const { royalty } = taskArgs;
    
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
      
      // Call the deployment function
      const result = await deployWithVanity(hre, royaltyRateWei);
      
      console.log(`\n🎉 Vanity deployment completed successfully!`);
      console.log(`📍 DPS: ${result.addresses.dps}`);
      console.log(`📍 DPR: ${result.addresses.dpr}`);
      
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