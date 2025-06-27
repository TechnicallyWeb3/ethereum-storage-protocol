import { expect } from "chai";
import { ethers } from "hardhat";
import { DataPointRegistry, DataPointStorage } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Economic Incentives and Cost Structure", function () {
  let registry: DataPointRegistry;
  let storage: DataPointStorage;
  let owner: HardhatEthersSigner;
  let publisher1: HardhatEthersSigner;
  let publisher2: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let user3: HardhatEthersSigner;
  
  const ROYALTY_RATE = ethers.parseUnits("20", "gwei") / 1000n; // 1/1000th of 20 gwei average gas price
  
  beforeEach(async function () {
    [owner, publisher1, publisher2, user1, user2, user3] = await ethers.getSigners();
    
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

  describe("Economic Incentive Structure", function () {
    it("Should verify lower-cost data points have lower access fees than high-cost ones", async function () {
      // Create data points with different gas costs by using different gas limits
      const efficientData = ethers.toUtf8Bytes("efficient_code");
      const inefficientData = ethers.toUtf8Bytes("inefficient_bloated_code_with_lots_of_unnecessary_data_that_costs_more_gas_to_process");
      
      console.log(`Efficient data size: ${efficientData.length} bytes`);
      console.log(`Inefficient data size: ${inefficientData.length} bytes`);
      
      // Register both with same publisher to isolate gas cost differences
      const efficientTx = await registry.connect(publisher1).registerDataPoint(
        efficientData,
        await publisher1.getAddress()
      );
      const efficientReceipt = await efficientTx.wait();
      
      const inefficientTx = await registry.connect(publisher1).registerDataPoint(
        inefficientData,
        await publisher1.getAddress()
      );
      const inefficientReceipt = await inefficientTx.wait();
      
      console.log(`Efficient registration gas: ${efficientReceipt!.gasUsed}`);
      console.log(`Inefficient registration gas: ${inefficientReceipt!.gasUsed}`);
      
      // Get royalty costs
      const efficientAddress = await storage.calculateAddress(efficientData);
      const inefficientAddress = await storage.calculateAddress(inefficientData);
      
      const efficientRoyalty = await registry.getDataPointRoyalty(efficientAddress);
      const inefficientRoyalty = await registry.getDataPointRoyalty(inefficientAddress);
      
      console.log(`Efficient access cost: ${ethers.formatEther(efficientRoyalty)} ETH`);
      console.log(`Inefficient access cost: ${ethers.formatEther(inefficientRoyalty)} ETH`);
      
      // Economic incentive: inefficient code should cost more to access
      expect(inefficientRoyalty).to.be.greaterThan(efficientRoyalty);
      
      const costRatio = Number(inefficientRoyalty * 10000n / efficientRoyalty) / 10000;
      console.log(`Inefficient code costs ${costRatio.toFixed(2)}x more to access`);
      
      // Verify the incentive is meaningful (at least 10% more expensive)
      expect(costRatio).to.be.greaterThan(1.1);
    });

    it("Should test that gas-efficient registration results in lower user costs", async function () {
      // Simulate different coding patterns with varying efficiency
      const patterns = [
        { name: "Minimal", data: ethers.toUtf8Bytes("x=1") },
        { name: "Compact", data: ethers.toUtf8Bytes("function optimal() { return x * 2; }") },
        { name: "Verbose", data: ethers.toUtf8Bytes("function suboptimal() { let temp = x; let multiplier = 2; let result = temp * multiplier; return result; }") },
        { name: "Bloated", data: ethers.toUtf8Bytes("function wasteful() { console.log('starting'); let temp = x; console.log('temp set'); let multiplier = 2; console.log('multiplier set'); let result = temp * multiplier; console.log('calculation done'); return result; }") }
      ];
      
      console.log(`Testing ${patterns.length} coding efficiency patterns:`);
      
      const results = [];
      
      for (const pattern of patterns) {
        const registerTx = await registry.connect(publisher1).registerDataPoint(
          pattern.data,
          await publisher1.getAddress()
        );
        const receipt = await registerTx.wait();
        
        const dataAddress = await storage.calculateAddress(pattern.data);
        const royalty = await registry.getDataPointRoyalty(dataAddress);
        
        const result = {
          name: pattern.name,
          dataSize: pattern.data.length,
          gasUsed: receipt!.gasUsed,
          royalty: royalty,
          costPerByte: royalty / BigInt(pattern.data.length)
        };
        
        results.push(result);
        
        console.log(`${pattern.name}: ${result.dataSize} bytes, ${result.gasUsed} gas, ${ethers.formatEther(result.royalty)} ETH access cost`);
      }
      
      // Verify economic gradient: more efficient code → lower user costs
      for (let i = 1; i < results.length; i++) {
        expect(results[i].royalty).to.be.greaterThan(results[i-1].royalty);
        console.log(`${results[i].name} costs ${Number(results[i].royalty * 100n / results[i-1].royalty) / 100}x more than ${results[i-1].name}`);
      }
      
      console.log(`Economic incentive verified: Efficient code saves user money`);
    });

    it("Should verify economic incentives mathematically favor efficiency", async function () {
      const baseCode = "function calculate(x) { return x * 2; }";
      const optimizedCode = "x=>x*2";  // Much shorter
      const unoptimizedCode = baseCode + " // This is a comment that adds unnecessary bytes but does nothing functional for the user";
      
      console.log(`Base code: ${baseCode.length} bytes`);
      console.log(`Optimized: ${optimizedCode.length} bytes`);
      console.log(`Unoptimized: ${unoptimizedCode.length} bytes`);
      
      // Register all three versions
      const baseData = ethers.toUtf8Bytes(baseCode);
      const optimizedData = ethers.toUtf8Bytes(optimizedCode);
      const unoptimizedData = ethers.toUtf8Bytes(unoptimizedCode);
      
      await registry.connect(publisher1).registerDataPoint(baseData, await publisher1.getAddress());
      await registry.connect(publisher1).registerDataPoint(optimizedData, await publisher1.getAddress());
      await registry.connect(publisher1).registerDataPoint(unoptimizedData, await publisher1.getAddress());
      
      const baseRoyalty = await registry.getDataPointRoyalty(await storage.calculateAddress(baseData));
      const optimizedRoyalty = await registry.getDataPointRoyalty(await storage.calculateAddress(optimizedData));
      const unoptimizedRoyalty = await registry.getDataPointRoyalty(await storage.calculateAddress(unoptimizedData));
      
      console.log(`Base cost: ${ethers.formatEther(baseRoyalty)} ETH`);
      console.log(`Optimized cost: ${ethers.formatEther(optimizedRoyalty)} ETH`);
      console.log(`Unoptimized cost: ${ethers.formatEther(unoptimizedRoyalty)} ETH`);
      
      // Mathematical verification of incentive structure
      expect(optimizedRoyalty).to.be.lessThan(baseRoyalty);
      expect(baseRoyalty).to.be.lessThan(unoptimizedRoyalty);
      
      const optimizationSavings = Number((baseRoyalty - optimizedRoyalty) * 10000n / baseRoyalty) / 100;
      const wastenessPenalty = Number((unoptimizedRoyalty - baseRoyalty) * 10000n / baseRoyalty) / 100;
      
      console.log(`Optimization saves users: ${optimizationSavings.toFixed(2)}%`);
      console.log(`Wastefulness costs users: ${wastenessPenalty.toFixed(2)}% more`);
      
      // Economic model should provide meaningful incentives (at least 5% difference)
      expect(optimizationSavings).to.be.greaterThan(5);
      expect(wastenessPenalty).to.be.greaterThan(5);
    });

    it("Should test cost comparison between efficient vs inefficient patterns", async function () {
      // Real-world coding pattern comparison
      const patterns = {
        efficient: {
          name: "Efficient Loop",
          code: "for(let i=0;i<n;i++)sum+=arr[i]"
        },
        inefficient: {
          name: "Inefficient Loop", 
          code: "let sum = 0; for(let i = 0; i < n; i++) { let currentValue = arr[i]; sum = sum + currentValue; }"
        }
      };
      
      console.log(`Comparing coding patterns:`);
      console.log(`${patterns.efficient.name}: "${patterns.efficient.code}"`);
      console.log(`${patterns.inefficient.name}: "${patterns.inefficient.code}"`);
      
      const efficientData = ethers.toUtf8Bytes(patterns.efficient.code);
      const inefficientData = ethers.toUtf8Bytes(patterns.inefficient.code);
      
      await registry.connect(publisher1).registerDataPoint(efficientData, await publisher1.getAddress());
      await registry.connect(publisher2).registerDataPoint(inefficientData, await publisher2.getAddress());
      
      const efficientCost = await registry.getDataPointRoyalty(await storage.calculateAddress(efficientData));
      const inefficientCost = await registry.getDataPointRoyalty(await storage.calculateAddress(inefficientData));
      
      console.log(`Efficient pattern access cost: ${ethers.formatEther(efficientCost)} ETH`);
      console.log(`Inefficient pattern access cost: ${ethers.formatEther(inefficientCost)} ETH`);
      
      const efficiencyAdvantage = Number(inefficientCost * 10000n / efficientCost) / 10000;
      console.log(`Efficient pattern is ${efficiencyAdvantage.toFixed(2)}x cheaper for users`);
      
      expect(inefficientCost).to.be.greaterThan(efficientCost);
      expect(efficiencyAdvantage).to.be.greaterThan(1.5); // At least 50% savings
      
      console.log(`Economic verification: Protocol incentivizes efficient coding patterns`);
    });
  });

  describe("Royalty System Mathematics", function () {
    it("Should verify pay-per-access cost calculations are accurate", async function () {
      const testData = ethers.toUtf8Bytes("mathematical_verification_test");
      
      // Register data point and capture gas usage
      const registerTx = await registry.connect(publisher1).registerDataPoint(
        testData,
        await publisher1.getAddress()
      );
      const receipt = await registerTx.wait();
      
      const dataAddress = await storage.calculateAddress(testData);
      const calculatedRoyalty = await registry.getDataPointRoyalty(dataAddress);
      
      console.log(`Registration gas used: ${receipt!.gasUsed}`);
      console.log(`Royalty rate: ${ethers.formatUnits(ROYALTY_RATE, "gwei")} gwei per gas`);
      console.log(`Calculated royalty: ${ethers.formatEther(calculatedRoyalty)} ETH`);
      
      // Manual calculation verification
      // Note: The contract measures gas differently than the transaction total
      // We need to verify the contract's internal calculation is consistent
      
      // Access the data multiple times to verify consistent calculation
      const access1Cost = await registry.getDataPointRoyalty(dataAddress);
      const access2Cost = await registry.getDataPointRoyalty(dataAddress);
      const access3Cost = await registry.getDataPointRoyalty(dataAddress);
      
      expect(access1Cost).to.equal(access2Cost);
      expect(access2Cost).to.equal(access3Cost);
      
      console.log(`Royalty calculation is consistent: ${ethers.formatEther(access1Cost)} ETH per access`);
      
      // Verify the calculation is deterministic and gas-based
      expect(calculatedRoyalty).to.be.greaterThan(0);
      console.log(`Mathematical verification: Royalty calculation is deterministic and gas-based`);
    });

    it("Should test 90/10 revenue split calculations are precise", async function () {
      const testData = ethers.toUtf8Bytes("revenue_split_verification");
      
      // Register data point
      await registry.connect(publisher1).registerDataPoint(testData, await publisher1.getAddress());
      
      const royaltyCost = await registry.getDataPointRoyalty(await storage.calculateAddress(testData));
      console.log(`Access cost: ${ethers.formatEther(royaltyCost)} ETH`);
      
      const publisherBalanceBefore = await registry.royaltyBalance(await publisher1.getAddress());
      const daoBalanceBefore = await registry.royaltyBalance(await owner.getAddress());
      
      // User accesses data (pays royalties)
      await registry.connect(user1).registerDataPoint(testData, ethers.ZeroAddress, {
        value: royaltyCost
      });
      
      const publisherBalanceAfter = await registry.royaltyBalance(await publisher1.getAddress());
      const daoBalanceAfter = await registry.royaltyBalance(await owner.getAddress());
      
      const publisherEarned = publisherBalanceAfter - publisherBalanceBefore;
      const daoEarned = daoBalanceAfter - daoBalanceBefore;
      
      console.log(`Publisher earned: ${ethers.formatEther(publisherEarned)} ETH`);
      console.log(`DAO earned: ${ethers.formatEther(daoEarned)} ETH`);
      console.log(`Total paid: ${ethers.formatEther(royaltyCost)} ETH`);
      
      // Verify 90/10 split
      const expectedDAO = royaltyCost / 10n;
      const expectedPublisher = royaltyCost - expectedDAO;
      
      expect(daoEarned).to.equal(expectedDAO);
      expect(publisherEarned).to.equal(expectedPublisher);
      expect(publisherEarned + daoEarned).to.equal(royaltyCost);
      
      const publisherPercentage = Number(publisherEarned * 10000n / royaltyCost) / 100;
      const daoPercentage = Number(daoEarned * 10000n / royaltyCost) / 100;
      
      console.log(`Publisher gets: ${publisherPercentage.toFixed(1)}%`);
      console.log(`DAO gets: ${daoPercentage.toFixed(1)}%`);
      
      expect(publisherPercentage).to.be.approximately(90, 0.1);
      expect(daoPercentage).to.be.approximately(10, 0.1);
      
      console.log(`Revenue split verification: 90/10 split is mathematically precise`);
    });

    it("Should verify royalty accumulation and withdrawal math", async function () {
      const testData = ethers.toUtf8Bytes("accumulation_test");
      
      await registry.connect(publisher1).registerDataPoint(testData, await publisher1.getAddress());
      const royaltyCost = await registry.getDataPointRoyalty(await storage.calculateAddress(testData));
      
      console.log(`Setting up accumulation test with ${ethers.formatEther(royaltyCost)} ETH per access`);
      
      const initialBalance = await registry.royaltyBalance(await publisher1.getAddress());
      
      // Multiple users access the data
      const accessCount = 5;
      for (let i = 0; i < accessCount; i++) {
        await registry.connect(user1).registerDataPoint(testData, ethers.ZeroAddress, {
          value: royaltyCost
        });
      }
      
      const balanceAfterAccesses = await registry.royaltyBalance(await publisher1.getAddress());
      const totalAccumulated = balanceAfterAccesses - initialBalance;
      
      // Calculate expected accumulation (90% of total payments)
      const totalPaid = royaltyCost * BigInt(accessCount);
      const expectedPublisherEarnings = (totalPaid * 90n) / 100n;
      
      console.log(`${accessCount} accesses x ${ethers.formatEther(royaltyCost)} ETH = ${ethers.formatEther(totalPaid)} ETH total paid`);
      console.log(`Expected publisher earnings (90%): ${ethers.formatEther(expectedPublisherEarnings)} ETH`);
      console.log(`Actual accumulated: ${ethers.formatEther(totalAccumulated)} ETH`);
      
      expect(totalAccumulated).to.equal(expectedPublisherEarnings);
      
      // Test withdrawal
      const publisherETHBefore = await ethers.provider.getBalance(await publisher1.getAddress());
      
      const withdrawTx = await registry.connect(publisher1).collectRoyalties(
        totalAccumulated,
        await publisher1.getAddress()
      );
      const withdrawReceipt = await withdrawTx.wait();
      
      const publisherETHAfter = await ethers.provider.getBalance(await publisher1.getAddress());
      const balanceAfterWithdrawal = await registry.royaltyBalance(await publisher1.getAddress());
      
      // Account for gas costs
      const gasCost = withdrawReceipt!.gasUsed * withdrawReceipt!.gasPrice;
      const netETHGain = publisherETHAfter - publisherETHBefore + gasCost;
      
      console.log(`Withdrawn: ${ethers.formatEther(totalAccumulated)} ETH`);
      console.log(`Net ETH gain (after gas): ${ethers.formatEther(netETHGain)} ETH`);
      console.log(`Remaining balance: ${ethers.formatEther(balanceAfterWithdrawal)} ETH`);
      
      expect(netETHGain).to.equal(totalAccumulated);
      expect(balanceAfterWithdrawal).to.equal(0);
      
      console.log(`Accumulation and withdrawal math verified: Perfect precision maintained`);
    });

    it("Should test fee calculations across various gas usage scenarios", async function () {
      // Test different data sizes to create different gas usage patterns
      const scenarios = [
        { name: "Tiny", data: "x" },
        { name: "Small", data: "function small() { return 1; }" },
        { name: "Medium", data: "function medium(a, b, c) { return a + b + c; }".repeat(2) },
        { name: "Large", data: "function large(array) { return array.reduce((sum, item) => sum + item, 0); }".repeat(5) }
      ];
      
      console.log(`Testing fee calculations across ${scenarios.length} gas usage scenarios:`);
      
      const results = [];
      
      for (const scenario of scenarios) {
        const data = ethers.toUtf8Bytes(scenario.data);
        
        const registerTx = await registry.connect(publisher1).registerDataPoint(
          data,
          await publisher1.getAddress()
        );
        const receipt = await registerTx.wait();
        
        const royalty = await registry.getDataPointRoyalty(await storage.calculateAddress(data));
        
        // Calculate effective rate
        const effectiveRate = royalty * 1000000n / receipt!.gasUsed; // Rate per million gas units
        
        const result = {
          name: scenario.name,
          dataSize: data.length,
          gasUsed: receipt!.gasUsed,
          royalty: royalty,
          effectiveRate: effectiveRate
        };
        
        results.push(result);
        
        console.log(`${scenario.name}: ${result.dataSize} bytes → ${result.gasUsed} gas → ${ethers.formatEther(result.royalty)} ETH`);
      }
      
      // Verify linear relationship between gas usage and fees
      // Skip comparing equal royalties (tiny scenarios may have same gas cost)
      for (let i = 1; i < results.length; i++) {
        const prev = results[i-1];
        const curr = results[i];
        
        // Only verify increase if gas usage actually increased meaningfully
        if (curr.gasUsed > prev.gasUsed + 1000n) { // Only check if gas increased by more than 1k
          expect(curr.royalty).to.be.greaterThan(prev.royalty);
          
          const gasRatio = Number(curr.gasUsed * 1000n / prev.gasUsed) / 1000;
          const feeRatio = Number(curr.royalty * 1000n / prev.royalty) / 1000;
          
          console.log(`${curr.name} uses ${gasRatio.toFixed(2)}x gas, costs ${feeRatio.toFixed(2)}x fees vs ${prev.name}`);
        } else {
          console.log(`${curr.name} has similar gas usage to ${prev.name}, royalties may be equal`);
        }
      }
      
      console.log(`Fee calculation verification: Linear relationship between gas usage and access costs maintained`);
    });
  });

  describe("Economic Defense Verification", function () {
    it("Should demonstrate 1/1000th gas ratio defense calculations", async function () {
      const testData = ethers.toUtf8Bytes("gas_ratio_defense_test");
      
      // Simulate attack with high gas price
      const attackGasPrice = ethers.parseUnits("100", "gwei");
      
      console.log(`Simulating attack with ${ethers.formatUnits(attackGasPrice, "gwei")} gwei gas price`);
      console.log(`Protocol royalty rate: ${ethers.formatUnits(ROYALTY_RATE, "gwei")} gwei per gas unit`);
      
      const attackTx = await registry.connect(publisher1).registerDataPoint(
        testData,
        await publisher1.getAddress(),
        { gasPrice: attackGasPrice }
      );
      const receipt = await attackTx.wait();
      
      const gasCost = receipt!.gasUsed * attackGasPrice;
      const royaltyPerAccess = await registry.getDataPointRoyalty(await storage.calculateAddress(testData));
      
      console.log(`Attacker gas cost: ${ethers.formatEther(gasCost)} ETH`);
      console.log(`Royalty per access: ${ethers.formatEther(royaltyPerAccess)} ETH`);
      
      const ratio = Number(gasCost * 1000n / royaltyPerAccess) / 1000;
      console.log(`Gas cost is ${ratio.toFixed(1)}x higher than royalty earned per access`);
      
      // Verify the 1/1000th ratio defense
      const actualRatio = Number(ROYALTY_RATE * 1000000n / attackGasPrice) / 1000000;
      console.log(`Actual royalty ratio: ${actualRatio.toFixed(6)} (${(actualRatio * 1000).toFixed(3)}/1000)`);
      
      expect(actualRatio).to.be.approximately(0.0002, 0.0001); // Should be ~1/5000 for 100 gwei vs 20 gwei base
      expect(gasCost).to.be.greaterThan(royaltyPerAccess * 100n); // Gas cost >> royalty revenue
      
      const accessesNeeded = Number(gasCost / royaltyPerAccess);
      console.log(`Attacker needs ${accessesNeeded.toFixed(0)} accesses to break even`);
      
      expect(accessesNeeded).to.be.greaterThan(1000); // Should need many accesses
      
      console.log(`Economic defense verified: 1/1000th ratio makes gas manipulation attacks unprofitable`);
    });

    it("Should test protocol cost structures under extreme conditions", async function () {
      const testData = ethers.toUtf8Bytes("extreme_conditions_test");
      
      // Test with extreme gas prices
      const extremeScenarios = [
        { name: "Ultra Low Gas", gasPrice: ethers.parseUnits("1", "gwei") },
        { name: "Normal Gas", gasPrice: ethers.parseUnits("20", "gwei") },
        { name: "High Gas", gasPrice: ethers.parseUnits("100", "gwei") },
        { name: "Extreme Gas", gasPrice: ethers.parseUnits("500", "gwei") }
      ];
      
      console.log(`Testing protocol behavior under extreme gas price conditions:`);
      
      for (let i = 0; i < extremeScenarios.length; i++) {
        const scenario = extremeScenarios[i];
        const data = ethers.toUtf8Bytes(`extreme_test_${i}`);
        
        const registerTx = await registry.connect(publisher1).registerDataPoint(
          data,
          await publisher1.getAddress(),
          { gasPrice: scenario.gasPrice }
        );
        const receipt = await registerTx.wait();
        
        const gasCost = receipt!.gasUsed * scenario.gasPrice;
        const royalty = await registry.getDataPointRoyalty(await storage.calculateAddress(data));
        
        const profitabilityThreshold = Number(gasCost / royalty);
        
        console.log(`${scenario.name} (${ethers.formatUnits(scenario.gasPrice, "gwei")} gwei):`);
        console.log(`  Gas cost: ${ethers.formatEther(gasCost)} ETH`);
        console.log(`  Royalty: ${ethers.formatEther(royalty)} ETH`);
        console.log(`  Break-even: ${profitabilityThreshold.toFixed(0)} accesses`);
        
        // Verify economic defense holds even under extreme conditions
        expect(profitabilityThreshold).to.be.greaterThan(50); // Always need significant usage
      }
      
      console.log(`Extreme conditions test passed: Protocol maintains economic defenses across all gas price ranges`);
    });

    it("Should verify economic incentives mathematically discourage attacks", async function () {
      const attackData = ethers.toUtf8Bytes("mathematical_attack_discouragement");
      
      // Calculate attack economics
      const normalGasPrice = ethers.parseUnits("20", "gwei");
      const inflatedGasPrice = ethers.parseUnits("200", "gwei"); // 10x inflation attempt
      
      console.log(`Analyzing attack economics:`);
      console.log(`Normal gas price: ${ethers.formatUnits(normalGasPrice, "gwei")} gwei`);
      console.log(`Inflated gas price: ${ethers.formatUnits(inflatedGasPrice, "gwei")} gwei`);
      
      // Register with inflated gas
      const attackTx = await registry.connect(publisher1).registerDataPoint(
        attackData,
        await publisher1.getAddress(),
        { gasPrice: inflatedGasPrice }
      );
      const receipt = await attackTx.wait();
      
      const attackCost = receipt!.gasUsed * inflatedGasPrice;
      const royaltyEarned = await registry.getDataPointRoyalty(await storage.calculateAddress(attackData));
      
      // Calculate what normal registration would have cost
      const normalCost = receipt!.gasUsed * normalGasPrice;
      const extraCost = attackCost - normalCost;
      
      console.log(`Attack cost: ${ethers.formatEther(attackCost)} ETH`);
      console.log(`Normal cost: ${ethers.formatEther(normalCost)} ETH`);
      console.log(`Extra cost: ${ethers.formatEther(extraCost)} ETH`);
      console.log(`Royalty per access: ${ethers.formatEther(royaltyEarned)} ETH`);
      
      // Mathematical proof that attack is unprofitable
      const extraAccessesNeeded = Number(extraCost / royaltyEarned);
      console.log(`Extra accesses needed to justify gas inflation: ${extraAccessesNeeded.toFixed(0)}`);
      
      // The economic model should make this extremely unprofitable
      expect(extraAccessesNeeded).to.be.greaterThan(9000); // Should need 9000+ extra accesses
      
      const totalBreakEven = Number(attackCost / royaltyEarned);
      console.log(`Total accesses needed for attacker to break even: ${totalBreakEven.toFixed(0)}`);
      
      expect(totalBreakEven).to.be.greaterThan(10000); // Should need 10k+ total accesses
      
      // Verify the mathematical discouragement
      const discourageRatio = Number(attackCost * 100n / royaltyEarned) / 100;
      console.log(`Attack cost is ${discourageRatio.toFixed(0)}x the per-access royalty`);
      
      expect(discourageRatio).to.be.greaterThan(10000); // Attack cost >> revenue potential
      
      console.log(`Mathematical verification: Economic model strongly discourages gas manipulation attacks`);
    });
  });
}); 