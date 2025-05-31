import { task, types } from "hardhat/config";

task("royalty", "Manage DPR contract royalty rates")
  .addPositionalParam(
    "action", 
    "Action to perform: 'get' to view current rate, 'set' to update rate",
    undefined,
    types.string
  )
  .addOptionalParam(
    "rate", 
    "New royalty rate in wei (required for 'set' action)",
    undefined,
    types.string
  )
  .addOptionalParam(
    "signer", 
    "Index of the signer account to use (default: 2 for TW3 owner)",
    2,
    types.int
  )
  .setAction(async (taskArgs, hre) => {
    // Import inside the task action to avoid circular imports
    const { setRoyaltyRate, getCurrentRoyaltyRate } = await import("../scripts/SetRoyaltyRate");
    
    const { action, rate, signer } = taskArgs;
    const networkName = hre.network.name;

    console.log(`🌐 Network: ${networkName}`);
    console.log(`🎯 Action: ${action}`);

    try {
      if (action === "get") {
        await getCurrentRoyaltyRate(networkName);
      } else if (action === "set") {
        if (!rate) {
          throw new Error("❌ Rate parameter is required for 'set' action. Use --rate <value_in_wei>");
        }
        console.log(`👤 Using signer index: ${signer}`);
        await setRoyaltyRate(networkName, rate, signer);
      } else {
        throw new Error(`❌ Invalid action: ${action}. Use 'get' or 'set'`);
      }
    } catch (error) {
      console.error("❌ Task failed:", error);
      process.exit(1);
    }
  });

// Helper subtasks for specific actions
task("royalty:get", "Get current royalty rate")
  .setAction(async (_, hre) => {
    const { getCurrentRoyaltyRate } = await import("../scripts/SetRoyaltyRate");
    await getCurrentRoyaltyRate(hre.network.name);
  });

task("royalty:set", "Set new royalty rate")
  .addParam("rate", "New royalty rate in wei", undefined, types.string)
  .addOptionalParam(
    "signer", 
    "Index of the signer account to use (default: 2 for TW3 owner)",
    2,
    types.int
  )
  .setAction(async (taskArgs, hre) => {
    const { setRoyaltyRate } = await import("../scripts/SetRoyaltyRate");
    const { rate, signer } = taskArgs;
    console.log(`🌐 Network: ${hre.network.name}`);
    console.log(`👤 Using signer index: ${signer}`);
    await setRoyaltyRate(hre.network.name, rate, signer);
  }); 