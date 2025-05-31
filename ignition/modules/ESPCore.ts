// This module deploys a WTTP site using Hardhat Ignition
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ethers } from "hardhat";

const ESPCoreModule = buildModule("ESPCoreModule", (m) => {

  // Deploy the DataPointStorage if not provided
  const dataPointStorage = m.contract("DataPointStorage");
  // Get parameters with defaults
  const owner = m.getParameter("owner", m.getAccount(0));
  // Set royalty rate (0.1 gwei per gas)
  const royaltyRate = m.getParameter("royalty", ethers.parseUnits("0.1", "gwei"));
  
  // Deploy the DataPointRegistry if not provided
  const dataPointRegistry = m.contract("DataPointRegistry", [
        owner,
        dataPointStorage,
        royaltyRate
      ]);
  
  return { 
    dataPointStorage,
    dataPointRegistry
  };
});

export default ESPCoreModule;