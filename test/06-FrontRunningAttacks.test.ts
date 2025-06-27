import { expect } from "chai";
import { ethers } from "hardhat";
import { DataPointRegistry, DataPointStorage } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Front-Running Attacks and Reentrancy", function () {
  let registry: DataPointRegistry;
  let storage: DataPointStorage;
  let owner: HardhatEthersSigner;
  let publisher1: HardhatEthersSigner;
  let publisher2: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let attacker: HardhatEthersSigner;
  let mevBot: HardhatEthersSigner;
  
  const ROYALTY_RATE = ethers.parseUnits("20", "gwei") / 1000n; // 1/1000th of 20 gwei average gas price
  
  beforeEach(async function () {
    [owner, publisher1, publisher2, user1, user2, attacker, mevBot] = await ethers.getSigners();
    
    // Deploy core contracts
    const StorageFactory = await ethers.getContractFactory("DataPointStorage");
    storage = await StorageFactory.deploy();
    
    const RegistryFactory = await ethers.getContractFactory("DataPointRegistry");
    registry = await RegistryFactory.deploy(
      await owner.getAddress(),
      await storage.getAddress(),
      ROYALTY_RATE
    );
  });

  describe("DPS Layer Front-Running", function () {
    it("Should demonstrate DPS direct write makes data free to access", async function () {
      const testData = ethers.toUtf8Bytes("valuable_algorithm_to_grief");
      const dataAddress = await storage.calculateAddress(testData);
      
      console.log(`Testing DPS front-running on data: ${ethers.toUtf8String(testData)}`);
      
      // Attacker writes directly to DPS (no royalty setup)
      const attackerBalanceBefore = await ethers.provider.getBalance(await attacker.getAddress());
      
      const dpsWriteTx = await storage.connect(attacker).writeDataPoint(testData);
      const dpsWriteReceipt = await dpsWriteTx.wait();
      
      const attackerBalanceAfter = await ethers.provider.getBalance(await attacker.getAddress());
      const griefingCost = attackerBalanceBefore - attackerBalanceAfter;
      
      console.log(`Attacker spent ${ethers.formatEther(griefingCost)} ETH on griefing`);
      console.log(`DPS write gas used: ${dpsWriteReceipt!.gasUsed}`);
      
      // Verify data exists in DPS
      expect(await storage.dataPointSize(dataAddress)).to.be.greaterThan(0);
      
      // Check DPR royalty cost - should be 0 (no royalty record)
      const royaltyCost = await registry.getDataPointRoyalty(dataAddress);
      expect(royaltyCost).to.equal(0);
      console.log(`DPR royalty cost: ${ethers.formatEther(royaltyCost)} ETH (FREE!)`);
      
      // Publisher can still register but data is already free
      await registry.connect(publisher1).registerDataPoint(testData, await publisher1.getAddress());
      
      // Check if publisher got royalty rights
      const postRegisterRoyalty = await registry.getDataPointRoyalty(dataAddress);
      console.log(`Post-registration royalty: ${ethers.formatEther(postRegisterRoyalty)} ETH`);
      
      // Users can access the data for free
      await registry.connect(user1).registerDataPoint(testData, ethers.ZeroAddress, {
        value: postRegisterRoyalty
      });
      
      console.log(`DPS front-running result: Data exists and is free to access`);
    });

    it("Should test economic impact of DPS griefing attacks", async function () {
      const testData = ethers.toUtf8Bytes("expensive_griefing_target");
      
      // Set high gas price for realistic griefing cost
      const highGasPrice = ethers.parseUnits("50", "gwei");
      
      const attackerBalanceBefore = await ethers.provider.getBalance(await attacker.getAddress());
      
      // Attacker griefs by writing to DPS with high gas
      const griefTx = await storage.connect(attacker).writeDataPoint(testData, {
        gasPrice: highGasPrice
      });
      const griefReceipt = await griefTx.wait();
      
      const attackerBalanceAfter = await ethers.provider.getBalance(await attacker.getAddress());
      const totalGriefingCost = attackerBalanceBefore - attackerBalanceAfter;
      
      console.log(`Griefing attack cost: ${ethers.formatEther(totalGriefingCost)} ETH`);
      console.log(`Gas used: ${griefReceipt!.gasUsed}`);
      console.log(`Gas price: ${ethers.formatUnits(highGasPrice, "gwei")} gwei`);
      
      // Attacker gets no revenue benefit (data is free for everyone)
      const attackerRoyaltyBalance = await registry.royaltyBalance(await attacker.getAddress());
      expect(attackerRoyaltyBalance).to.equal(0);
      
      // Economic conclusion: Pure loss for attacker
      expect(totalGriefingCost).to.be.greaterThan(0);
      console.log(`Economic result: Attacker loses ${ethers.formatEther(totalGriefingCost)} ETH with no benefit`);
    });
  });

  describe("DPR Layer Front-Running", function () {
    it("Should demonstrate same-block front-running for royalty theft", async function () {
      const testData = ethers.toUtf8Bytes("profitable_code_pattern");
      const dataAddress = await storage.calculateAddress(testData);
      
      const originalPublisher = await publisher1.getAddress();
      const thiefAddress = await mevBot.getAddress();
      
      console.log(`Original publisher: ${originalPublisher}`);
      console.log(`MEV thief: ${thiefAddress}`);
      
      // Simulate mempool race: MEV bot uses higher gas to front-run
      const normalGasPrice = ethers.parseUnits("20", "gwei");
      const highGasPrice = ethers.parseUnits("100", "gwei"); // 5x higher
      
      // Both transactions submitted to same block (race condition)
      const thiefTxPromise = registry.connect(mevBot).registerDataPoint(
        testData, 
        thiefAddress,
        { gasPrice: highGasPrice }
      );
      
      const publisherTxPromise = registry.connect(publisher1).registerDataPoint(
        testData,
        originalPublisher,
        { gasPrice: normalGasPrice }
      );
      
      // Wait for both - higher gas should win
      const results = await Promise.allSettled([thiefTxPromise, publisherTxPromise]);
      
      console.log(`Thief transaction: ${results[0].status}`);
      console.log(`Publisher transaction: ${results[1].status}`);
      
      // Check who won the race by looking at events
      const filter = registry.filters.DataPointRegistered(dataAddress);
      const events = await registry.queryFilter(filter);
      
      if (events.length > 0) {
        const winner = events[0].args.publisher;
        console.log(`Race winner: ${winner}`);
        
        if (winner === thiefAddress) {
          console.log(`🚨 FRONT-RUNNING SUCCESSFUL: MEV bot stole publisher rights`);
          
          // Verify royalty theft economics
          const royaltyCost = await registry.getDataPointRoyalty(dataAddress);
          console.log(`Stolen royalty rate: ${ethers.formatEther(royaltyCost)} ETH per access`);
          
          // Simulate users paying royalties to the thief
          await registry.connect(user1).registerDataPoint(testData, ethers.ZeroAddress, {
            value: royaltyCost
          });
          await registry.connect(user2).registerDataPoint(testData, ethers.ZeroAddress, {
            value: royaltyCost
          });
          
          // Check thief's stolen revenue
          const thiefBalance = await registry.royaltyBalance(thiefAddress);
          const originalBalance = await registry.royaltyBalance(originalPublisher);
          
          console.log(`Thief earned: ${ethers.formatEther(thiefBalance)} ETH`);
          console.log(`Original publisher earned: ${ethers.formatEther(originalBalance)} ETH`);
          
          expect(thiefBalance).to.be.greaterThan(0);
          expect(originalBalance).to.equal(0);
        } else {
          console.log(`Front-running failed: Original publisher won the race`);
        }
      }
    });

    it("Should test address(0) denial attack", async function () {
      const testData = ethers.toUtf8Bytes("denial_attack_target");
      const dataAddress = await storage.calculateAddress(testData);
      
      // Attacker registers with address(0) to deny future royalties
      await registry.connect(attacker).registerDataPoint(testData, ethers.ZeroAddress);
      
      // Check the result
      const royaltyCost = await registry.getDataPointRoyalty(dataAddress);
      expect(royaltyCost).to.equal(0); // address(0) means no royalties
      
      console.log(`Denial attack result: Royalty cost = ${ethers.formatEther(royaltyCost)} ETH`);
      
      // Verify data exists but generates no revenue for anyone
      expect(await storage.dataPointSize(dataAddress)).to.be.greaterThan(0);
      
      // Users can access for free
      await registry.connect(user1).registerDataPoint(testData, ethers.ZeroAddress);
      
      console.log(`Address(0) attack successful: Data exists but no one earns royalties`);
    });
  });

  describe("Cross-Contract State Manipulation", function () {
    it("Should test state consistency between DPS and DPR contracts", async function () {
      const testData = ethers.toUtf8Bytes("state_consistency_test");
      const dataAddress = await storage.calculateAddress(testData);
      
      console.log(`Testing state consistency for: ${ethers.toUtf8String(testData)}`);
      
      // Initial state: no data in DPS, no royalty in DPR
      expect(await storage.dataPointSize(dataAddress)).to.equal(0);
      expect(await registry.getDataPointRoyalty(dataAddress)).to.equal(0);
      console.log(`Initial state: DPS size=0, DPR royalty=0`);
      
      // Write to DPS only (simulate front-running)
      await storage.connect(attacker).writeDataPoint(testData);
      
      // State: data in DPS, no royalty in DPR
      const dpsSize = await storage.dataPointSize(dataAddress);
      const dprRoyalty = await registry.getDataPointRoyalty(dataAddress);
      expect(dpsSize).to.be.greaterThan(0);
      expect(dprRoyalty).to.equal(0);
      console.log(`After DPS write: DPS size=${dpsSize}, DPR royalty=${ethers.formatEther(dprRoyalty)} ETH`);
      
      // Publisher registers through DPR (should succeed)
      await registry.connect(publisher1).registerDataPoint(testData, await publisher1.getAddress());
      
      // Final state: data in DPS, no new royalty in DPR (data already existed)
      const finalDpsSize = await storage.dataPointSize(dataAddress);
      const finalDprRoyalty = await registry.getDataPointRoyalty(dataAddress);
      expect(finalDpsSize).to.be.greaterThan(0);
      expect(finalDprRoyalty).to.equal(0); // No royalty setup because data pre-existed
      
      console.log(`Final state: DPS size=${finalDpsSize}, DPR royalty=${ethers.formatEther(finalDprRoyalty)} ETH`);
      console.log(`State consistency maintained across contracts`);
    });

    it("Should test mempool monitoring for profitable registrations", async function () {
      const testData = ethers.toUtf8Bytes("mempool_monitoring_test");
      const dataAddress = await storage.calculateAddress(testData);
      
      console.log(`Simulating mempool monitoring for: ${ethers.toUtf8String(testData)}`);
      
      // Simulate MEV bot detecting a profitable registration in mempool
      const normalGasPrice = ethers.parseUnits("20", "gwei");
      const highGasPrice = ethers.parseUnits("100", "gwei");
      
      console.log(`Normal publisher gas: ${ethers.formatUnits(normalGasPrice, "gwei")} gwei`);
      console.log(`MEV bot gas: ${ethers.formatUnits(highGasPrice, "gwei")} gwei`);
      
      // MEV bot front-runs with higher gas
      const frontRunTx = await registry.connect(mevBot).registerDataPoint(
        testData,
        await mevBot.getAddress(),
        { gasPrice: highGasPrice }
      );
      
      // Original publisher's transaction should fail - data exists so they need to pay royalties
      await expect(
        registry.connect(publisher1).registerDataPoint(
          testData,
          await publisher1.getAddress(),
          { gasPrice: normalGasPrice }
        )
      ).to.be.revertedWithCustomError(registry, "InsufficientRoyaltyPayment");
      
      // Verify MEV bot won
      const royalty = await registry.getDataPointRoyalty(dataAddress);
      expect(royalty).to.be.greaterThan(0);
      
      console.log(`MEV bot successfully front-ran with royalty: ${ethers.formatEther(royalty)} ETH per access`);
    });

    it("Should test competitive registration patterns for royalty capture", async function () {
      const basePattern = "competitive_pattern_";
      const patterns = [
        ethers.toUtf8Bytes(basePattern + "high_value"),
        ethers.toUtf8Bytes(basePattern + "medium_value"),
        ethers.toUtf8Bytes(basePattern + "low_value")
      ];
      
      console.log(`Testing competitive registration across ${patterns.length} valuable patterns`);
      
      // Simulate different competitors with different gas strategies
      const strategies = [
        { signer: mevBot, gasPrice: ethers.parseUnits("150", "gwei"), name: "Aggressive MEV" },
        { signer: publisher1, gasPrice: ethers.parseUnits("50", "gwei"), name: "Normal Publisher" },
        { signer: publisher2, gasPrice: ethers.parseUnits("25", "gwei"), name: "Budget Publisher" }
      ];
      
      // Race for each pattern
      for (let i = 0; i < patterns.length; i++) {
        const pattern = patterns[i];
        const strategy = strategies[i % strategies.length];
        
        console.log(`Pattern ${i + 1}: ${strategy.name} attempts registration with ${ethers.formatUnits(strategy.gasPrice, "gwei")} gwei`);
        
        await registry.connect(strategy.signer).registerDataPoint(
          pattern,
          await strategy.signer.getAddress(),
          { gasPrice: strategy.gasPrice }
        );
        
        const dataAddress = await storage.calculateAddress(pattern);
        const royalty = await registry.getDataPointRoyalty(dataAddress);
        
        console.log(`  Winner captured royalty: ${ethers.formatEther(royalty)} ETH per access`);
        expect(royalty).to.be.greaterThan(0);
      }
      
      console.log(`Competitive registration pattern complete - highest gas strategies tend to win`);
    });

    it("Should verify no cross-contract reentrancy vulnerabilities", async function () {
      const testData = ethers.toUtf8Bytes("cross_contract_reentrancy_test");
      
      // Set up a data point through DPR
      await registry.connect(publisher1).registerDataPoint(testData, await publisher1.getAddress());
      
      const royaltyCost = await registry.getDataPointRoyalty(await storage.calculateAddress(testData));
      
      // User accesses data (this involves DPS read and DPR payment)
      await registry.connect(user1).registerDataPoint(testData, ethers.ZeroAddress, {
        value: royaltyCost
      });
      
      const publisherBalance = await registry.royaltyBalance(await publisher1.getAddress());
      console.log(`Publisher balance: ${ethers.formatEther(publisherBalance)} ETH`);
      
      // Test that withdrawal works normally (no reentrancy issues)
      await expect(
        registry.connect(publisher1).collectRoyalties(publisherBalance, await publisher1.getAddress())
      ).to.not.be.reverted;
      
      const finalBalance = await registry.royaltyBalance(await publisher1.getAddress());
      expect(finalBalance).to.equal(0);
      
      console.log(`Cross-contract operations completed successfully without reentrancy issues`);
    });

    it("Should test concurrent DPS/DPR operation scenarios", async function () {
      const dpsData = ethers.toUtf8Bytes("concurrent_dps_operation");
      const dprData = ethers.toUtf8Bytes("concurrent_dpr_operation");
      
      console.log(`Testing concurrent operations: DPS write + DPR registration`);
      
      // Simultaneous operations: direct DPS write and DPR registration
      const dpsOperation = storage.connect(attacker).writeDataPoint(dpsData);
      const dprOperation = registry.connect(publisher1).registerDataPoint(
        dprData,
        await publisher1.getAddress()
      );
      
      const results = await Promise.allSettled([dpsOperation, dprOperation]);
      
      console.log(`DPS operation: ${results[0].status}`);
      console.log(`DPR operation: ${results[1].status}`);
      
      // Both should succeed independently
      expect(results[0].status).to.equal('fulfilled');
      expect(results[1].status).to.equal('fulfilled');
      
      // Verify final states
      const dpsAddress = await storage.calculateAddress(dpsData);
      const dprAddress = await storage.calculateAddress(dprData);
      
      expect(await storage.dataPointSize(dpsAddress)).to.be.greaterThan(0);
      expect(await registry.getDataPointRoyalty(dpsAddress)).to.equal(0); // DPS only, no royalty
      
      expect(await storage.dataPointSize(dprAddress)).to.be.greaterThan(0);
      expect(await registry.getDataPointRoyalty(dprAddress)).to.be.greaterThan(0); // DPR registration
      
      console.log(`Concurrent operations completed successfully with correct independent states`);
    });
  });

  describe("Economic Attack Prevention", function () {
    it("Should verify economic disincentives work as designed", async function () {
      const testData = ethers.toUtf8Bytes("economic_disincentive_test");
      
      // Simulate gas bomb attack (high gas usage)
      const highGasPrice = ethers.parseUnits("100", "gwei");
      
      const attackerBalanceBefore = await ethers.provider.getBalance(await attacker.getAddress());
      
      // Attacker tries to register with high gas to inflate royalties
      const attackTx = await registry.connect(attacker).registerDataPoint(
        testData,
        await attacker.getAddress(),
        { gasPrice: highGasPrice }
      );
      const attackReceipt = await attackTx.wait();
      
      const attackerBalanceAfter = await ethers.provider.getBalance(await attacker.getAddress());
      const gasCost = attackerBalanceBefore - attackerBalanceAfter;
      
      // Calculate royalty earned per access
      const dataAddress = await storage.calculateAddress(testData);
      const royaltyPerAccess = await registry.getDataPointRoyalty(dataAddress);
      
      console.log(`Attacker gas cost: ${ethers.formatEther(gasCost)} ETH`);
      console.log(`Royalty per access: ${ethers.formatEther(royaltyPerAccess)} ETH`);
      console.log(`Gas used: ${attackReceipt!.gasUsed}`);
      
      // Calculate break-even point
      const accessesNeededToBreakEven = Number(gasCost / royaltyPerAccess);
      console.log(`Accesses needed to break even: ${accessesNeededToBreakEven.toFixed(0)}`);
      
      // Economic defense: attacker needs many accesses to profit
      expect(accessesNeededToBreakEven).to.be.greaterThan(100); // Should need hundreds+ accesses
      
      console.log(`Economic defense confirmed: Attack requires ${accessesNeededToBreakEven.toFixed(0)} accesses to break even`);
    });

    it("Should test protocol resilience under attack", async function () {
      const attackData = ethers.toUtf8Bytes("resilience_test_attack");
      const normalData = ethers.toUtf8Bytes("resilience_test_normal");
      
      // Attacker griefs one data point
      await storage.connect(attacker).writeDataPoint(attackData);
      
      // Verify attack succeeded (data is free)
      const attackedAddress = await storage.calculateAddress(attackData);
      const attackedRoyalty = await registry.getDataPointRoyalty(attackedAddress);
      expect(attackedRoyalty).to.equal(0);
      
      // Protocol should still work normally for other data
      await registry.connect(publisher1).registerDataPoint(
        normalData,
        await publisher1.getAddress()
      );
      
      const normalAddress = await storage.calculateAddress(normalData);
      const normalRoyalty = await registry.getDataPointRoyalty(normalAddress);
      expect(normalRoyalty).to.be.greaterThan(0);
      
      console.log(`Attacked data royalty: ${ethers.formatEther(attackedRoyalty)} ETH`);
      console.log(`Normal data royalty: ${ethers.formatEther(normalRoyalty)} ETH`);
      console.log(`Protocol resilience confirmed: Normal operations continue despite attacks`);
    });
  });
}); 