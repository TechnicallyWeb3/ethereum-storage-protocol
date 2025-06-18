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
    "New royalty rate in GWEI (required for 'set' action)",
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
    
    // Map network name to chain ID
    const networkToChainId: { [key: string]: number } = {
      'sepolia': 11155111,
      'mainnet': 1,
      'polygon': 137,
      'bsc': 56,
      'arbitrum': 42161,
      'optimism': 10,
      'localhost': 31337,
      'hardhat': 31337
    };
    
    const chainId = networkToChainId[networkName];
    if (!chainId) {
      throw new Error(`❌ Unknown network: ${networkName}. Supported networks: ${Object.keys(networkToChainId).join(', ')}`);
    }

    console.log(`🌐 Network: ${networkName} (Chain ID: ${chainId})`);
    console.log(`🎯 Action: ${action}`);

    try {
      if (action === "get") {
        await getCurrentRoyaltyRate(chainId);
      } else if (action === "set") {
        if (!rate) {
          throw new Error("❌ Rate parameter is required for 'set' action. Use --rate <value_in_gwei>");
        }
        // Convert GWEI to wei
        const rateInWei = hre.ethers.parseUnits(rate, "gwei").toString();
        console.log(`👤 Using signer index: ${signer}`);
        console.log(`💰 Converting ${rate} GWEI to ${rateInWei} wei`);
        await setRoyaltyRate(chainId, rateInWei, signer);
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
    
    // Map network name to chain ID
    const networkToChainId: { [key: string]: number } = {
      'sepolia': 11155111,
      'mainnet': 1,
      'polygon': 137,
      'bsc': 56,
      'arbitrum': 42161,
      'optimism': 10,
      'localhost': 31337,
      'hardhat': 31337
    };
    
    const networkName = hre.network.name;
    const chainId = networkToChainId[networkName];
    if (!chainId) {
      throw new Error(`❌ Unknown network: ${networkName}. Supported networks: ${Object.keys(networkToChainId).join(', ')}`);
    }
    
    await getCurrentRoyaltyRate(chainId);
  });

task("royalty:set", "Set new royalty rate")
  .addParam("rate", "New royalty rate in GWEI", undefined, types.string)
  .addOptionalParam(
    "signer", 
    "Index of the signer account to use (default: 2 for TW3 owner)",
    2,
    types.int
  )
  .setAction(async (taskArgs, hre) => {
    const { setRoyaltyRate } = await import("../scripts/SetRoyaltyRate");
    const { rate, signer } = taskArgs;
    
    // Map network name to chain ID
    const networkToChainId: { [key: string]: number } = {
      'sepolia': 11155111,
      'mainnet': 1,
      'polygon': 137,
      'bsc': 56,
      'arbitrum': 42161,
      'optimism': 10,
      'localhost': 31337,
      'hardhat': 31337
    };
    
    const networkName = hre.network.name;
    const chainId = networkToChainId[networkName];
    if (!chainId) {
      throw new Error(`❌ Unknown network: ${networkName}. Supported networks: ${Object.keys(networkToChainId).join(', ')}`);
    }
    
    console.log(`🌐 Network: ${networkName} (Chain ID: ${chainId})`);
    console.log(`👤 Using signer index: ${signer}`);
    
    // Convert GWEI to wei
    const rateInWei = hre.ethers.parseUnits(rate, "gwei").toString();
    console.log(`💰 Converting ${rate} GWEI to ${rateInWei} wei`);
    await setRoyaltyRate(chainId, rateInWei, signer);
  }); 