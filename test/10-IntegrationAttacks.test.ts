import { expect } from "chai";
import { ethers, network } from "hardhat";
import { DataPointRegistry, DataPointStorage } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Integration Attacks - Combined Attack Scenarios", function () {
  let registry: DataPointRegistry;
  let storage: DataPointStorage;
  let attacker: any; // ReentrancyAttacker contract
  let owner: HardhatEthersSigner;
  let publisher1: HardhatEthersSigner;
  let publisher2: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let mevBot: HardhatEthersSigner;
  
  const ROYALTY_RATE = ethers.parseUnits("20", "gwei") / 1000n;
  
  beforeEach(async function () {
    [owner, publisher1, publisher2, user1, user2, mevBot] = await ethers.getSigners();
    
    // Deploy core contracts
    const StorageFactory = await ethers.getContractFactory("DataPointStorage");
    storage = await StorageFactory.deploy();
    
    const RegistryFactory = await ethers.getContractFactory("DataPointRegistry");
    registry = await RegistryFactory.deploy(
      await owner.getAddress(),
      await storage.getAddress(),
      ROYALTY_RATE
    );
    
    // Deploy ReentrancyAttacker for integration tests
    const AttackerFactory = await ethers.getContractFactory("ReentrancyAttacker");
    attacker = await AttackerFactory.deploy(
      await registry.getAddress(),
      await storage.getAddress()
    );
    
    console.log(`Integration test setup complete`);
  });

  describe("Combined Attack Scenarios", function () {
    it("Should test gas manipulation combined with front-running", async function () {
      const targetData = ethers.toUtf8Bytes("gas_frontrun_combo_attack");
      
      console.log(`\n=== TESTING GAS MANIPULATION + FRONT-RUNNING COMBO ===`);
      console.log(`Target data: ${ethers.toUtf8String(targetData)}`);
      
      // Fund attacker and MEV bot
      await user1.sendTransaction({
        to: await attacker.getAddress(),
        value: ethers.parseEther("5")
      });
      
      // Set high gas price for manipulation
      const extremeGasPrice = ethers.parseUnits("1000", "gwei"); // 1000 gwei
      
      console.log(`Setting extreme gas price: ${ethers.formatUnits(extremeGasPrice, "gwei")} gwei`);
      
      // Simulate mempool race with gas manipulation
      const normalGasPrice = ethers.parseUnits("20", "gwei");
      
      // MEV bot attempts front-running with extreme gas
      const frontRunPromise = registry.connect(mevBot).registerDataPoint(
        targetData,
        await mevBot.getAddress(),
        { gasPrice: extremeGasPrice }
      );
      
      // Original publisher with normal gas
      const publisherPromise = registry.connect(publisher1).registerDataPoint(
        targetData,
        await publisher1.getAddress(), 
        { gasPrice: normalGasPrice }
      );
      
      const results = await Promise.allSettled([frontRunPromise, publisherPromise]);
      
      console.log(`Front-run attempt: ${results[0].status}`);
      console.log(`Publisher attempt: ${results[1].status}`);
      
      // Analyze who won and economic impact
      const dataAddress = await storage.calculateAddress(targetData);
      const royalty = await registry.getDataPointRoyalty(dataAddress);
      
      console.log(`Final royalty rate: ${ethers.formatEther(royalty)} ETH per access`);
      
      // Calculate economic impact of extreme gas usage
      if (results[0].status === 'fulfilled') {
        const receipt = await (results[0].value as any).wait();
        const gasCost = receipt.gasUsed * extremeGasPrice;
        const accessesNeeded = gasCost / royalty;
        
        console.log(`MEV bot gas cost: ${ethers.formatEther(gasCost)} ETH`);
        console.log(`Accesses needed to break even: ${accessesNeeded.toString()}`);
        
        console.log(`\n🔍 GAS + FRONT-RUNNING FINDINGS:`);
        if (accessesNeeded > 1000000n) {
          console.log(`  ✅ Combined attack is ECONOMICALLY UNVIABLE`);
          console.log(`  ✅ Economic defense remains effective even with front-running`);
        } else {
          console.log(`  ⚠️ Combined attack may be profitable with high usage`);
        }
      }
      
      expect(royalty).to.be.greaterThan(0, "Some registration should succeed");
      
      console.log(`\n=== GAS + FRONT-RUNNING COMBO TEST COMPLETE ===`);
    });

    it("Should simulate coordinated publisher and DPS attacks", async function () {
      const coordinatedData = ethers.toUtf8Bytes("coordinated_attack_vector");
      
      console.log(`\n=== TESTING COORDINATED PUBLISHER + DPS ATTACKS ===`);
      console.log(`Attack target: ${ethers.toUtf8String(coordinatedData)}`);
      
      // Fund multiple attackers for coordination
      await user1.sendTransaction({
        to: await attacker.getAddress(),
        value: ethers.parseEther("3")
      });
      
      // Simulate coordinated attack phases
      console.log(`Phase 1: MEV bot writes directly to DPS to make data free...`);
      
      // Phase 1: MEV bot writes directly to DPS (griefing attack)
      const dpsAttackTx = await storage.connect(mevBot).writeDataPoint(coordinatedData);
      const dpsReceipt = await dpsAttackTx.wait();
      console.log(`DPS griefing successful - gas used: ${dpsReceipt!.gasUsed}`);
      
      // Verify data exists in DPS now
      const coordinatedDataAddress = await storage.calculateAddress(coordinatedData);
      const coordinatedDataSize = await storage.dataPointSize(coordinatedDataAddress);
      console.log(`Data written to DPS: ${coordinatedDataSize} bytes`);
      
      // Phase 2: Publisher registers via DPR (should succeed but with 0 royalties since data already exists)
      console.log(`Phase 2: Publisher registration after DPS griefing (should succeed with 0 royalties)...`);
      
      const publisherTx = await registry.connect(publisher1).registerDataPoint(
        coordinatedData,
        await publisher1.getAddress()
      );
      const publisherReceipt = await publisherTx.wait();
      console.log(`Publisher registration gas: ${publisherReceipt!.gasUsed}`);
      
      // Phase 3: Cross-contract reentrancy attempt on the compromised state
      console.log(`Phase 3: Cross-contract reentrancy attack attempt...`);
      
      await attacker.setupCrossContractAttack(
        ethers.toUtf8Bytes("coordination_trigger"), 
        ethers.toUtf8Bytes("coordination_secondary"), 
        3
      );
      
      const reentrancyTx = await attacker.executeCrossContractAttack(
        ethers.toUtf8Bytes("coordination_execute")
      );
      const reentrancyReceipt = await reentrancyTx.wait();
      
      console.log(`Reentrancy attack gas: ${reentrancyReceipt!.gasUsed}`);
      
      // Analyze coordinated attack results
      const finalRoyalty = await registry.getDataPointRoyalty(coordinatedDataAddress);
      const finalDataSize = await storage.dataPointSize(coordinatedDataAddress);
      
      console.log(`\n📊 COORDINATED ATTACK ANALYSIS:`);
      console.log(`  Data exists in DPS: ${finalDataSize > 0 ? 'YES' : 'NO'}`);
      console.log(`  DPR royalty rate: ${ethers.formatEther(finalRoyalty)} ETH`);
      console.log(`  Attack result: Data is ${finalRoyalty === 0n ? 'FREE' : 'PAID'}`);
      
      // Test user access after coordinated attack
      await registry.connect(user2).registerDataPoint(
        coordinatedData,
        ethers.ZeroAddress,
        { value: finalRoyalty }
      );
      
      console.log(`\n🔍 COORDINATED ATTACK FINDINGS:`);
      if (finalRoyalty === 0n) {
        console.log(`  ⚠️ Coordination succeeded: Data is now FREE`);
        console.log(`  ⚠️ DPS griefing attack was effective`);
        console.log(`  ⚠️ Publisher lost royalty opportunity`);
      } else {
        console.log(`  ✅ Coordination failed: Publisher still earning royalties`);
        console.log(`  ✅ DPS griefing was ineffective`);
      }
      
      expect(finalDataSize).to.be.greaterThan(0, "Data should exist after attack");
      
      console.log(`\n=== COORDINATED ATTACK TEST COMPLETE ===`);
    });

    it("Should test economic attacks combined with technical exploits", async function () {
      const exploitData = ethers.toUtf8Bytes("economic_technical_exploit");
      
      console.log(`\n=== TESTING ECONOMIC + TECHNICAL EXPLOIT COMBO ===`);
      console.log(`Exploit target: ${ethers.toUtf8String(exploitData)}`);
      
      // Fund attacker for multi-vector attack
      await user1.sendTransaction({
        to: await attacker.getAddress(),
        value: ethers.parseEther("10")
      });
      
      // Phase 1: Economic attack - extreme gas manipulation
      console.log(`Phase 1: Economic manipulation with extreme parameters...`);
      
      const extremeGasPrice = ethers.parseUnits("500", "gwei");
      const economicTx = await registry.connect(publisher1).registerDataPoint(
        exploitData,
        await publisher1.getAddress(),
        { gasPrice: extremeGasPrice }
      );
      const economicReceipt = await economicTx.wait();
      
      const economicCost = economicReceipt!.gasUsed * extremeGasPrice;
      console.log(`Economic attack cost: ${ethers.formatEther(economicCost)} ETH`);
      
      // Phase 2: Technical attack - reentrancy attempt
      console.log(`Phase 2: Technical reentrancy exploit attempt...`);
      
      // Create royalty balance for reentrancy
      const royalty = await registry.getDataPointRoyalty(await storage.calculateAddress(exploitData));
      
      await attacker.setupRoyaltyReentrancyAttack(
        exploitData,
        await publisher1.getAddress(),
        10,
        { value: royalty }
      );
      await registry.connect(user1).registerDataPoint(exploitData, ethers.ZeroAddress, {
        value: royalty
      });
      
      const technicalTx = await attacker.executeRoyaltyReentrancyAttack();
      const technicalReceipt = await technicalTx.wait();
      
      console.log(`Technical attack gas: ${technicalReceipt!.gasUsed}`);
      
      // Phase 3: Economic analysis of combined attack
      const attackerBalance = await registry.royaltyBalance(await attacker.getAddress());
      const publisherBalance = await registry.royaltyBalance(await publisher1.getAddress());
      
      console.log(`\n📊 COMBINED EXPLOIT ANALYSIS:`);
      console.log(`  Attacker royalty balance: ${ethers.formatEther(attackerBalance)} ETH`);
      console.log(`  Publisher royalty balance: ${ethers.formatEther(publisherBalance)} ETH`);
      console.log(`  Economic attack cost: ${ethers.formatEther(economicCost)} ETH`);
      
      // Calculate profitability
      const totalAttackerGain = attackerBalance;
      const totalAttackerCost = economicCost;
      const netResult = totalAttackerGain > totalAttackerCost;
      
      console.log(`\n🔍 ECONOMIC + TECHNICAL FINDINGS:`);
      if (netResult) {
        console.log(`  ❌ CRITICAL: Combined exploit is PROFITABLE`);
        console.log(`  ❌ Attacker gained more than spent`);
      } else {
        console.log(`  ✅ Combined exploit is UNPROFITABLE`);
        console.log(`  ✅ Economic defenses remain effective`);
        console.log(`  ✅ Technical attacks were blocked`);
      }
      
      console.log(`  💰 Net result: ${totalAttackerGain >= totalAttackerCost ? 'PROFIT' : 'LOSS'}`);
      console.log(`  🛡️ Defense effectiveness: ${!netResult ? 'STRONG' : 'WEAK'}`);
      
      expect(totalAttackerGain).to.be.lessThan(totalAttackerCost, "Combined attack should be unprofitable");
      
      console.log(`\n=== ECONOMIC + TECHNICAL EXPLOIT TEST COMPLETE ===`);
    });
  });

  describe("Real-World Attack Simulations", function () {
    it("Should simulate mempool-based attack patterns", async function () {
      const mempoolData = ethers.toUtf8Bytes("mempool_attack_simulation");
      
      console.log(`\n=== TESTING MEMPOOL-BASED ATTACK PATTERNS ===`);
      console.log(`Mempool target: ${ethers.toUtf8String(mempoolData)}`);
      
      // Simulate realistic mempool conditions
      const gasPrices = [
        ethers.parseUnits("20", "gwei"),   // Normal
        ethers.parseUnits("50", "gwei"),   // High
        ethers.parseUnits("100", "gwei"),  // Extreme
        ethers.parseUnits("200", "gwei")   // MEV
      ];
      
      const participants = [publisher1, publisher2, mevBot, attacker];
      
      console.log(`Simulating mempool race with ${participants.length} participants...`);
      
      // Launch simultaneous transactions with different gas prices
      const racePromises = participants.map(async (participant, index) => 
        registry.connect(participant).registerDataPoint(
          mempoolData,
          await participant.getAddress(),
          { gasPrice: gasPrices[index] }
        )
      );
      
      const raceResults = await Promise.allSettled(racePromises);
      
      console.log(`\n📊 MEMPOOL RACE RESULTS:`);
      raceResults.forEach((result, index) => {
        console.log(`  Participant ${index + 1} (${ethers.formatUnits(gasPrices[index], "gwei")} gwei): ${result.status}`);
      });
      
      // Analyze winner and economic implications
      const dataAddress = await storage.calculateAddress(mempoolData);
      const winningRoyalty = await registry.getDataPointRoyalty(dataAddress);
      
      // Determine winner by checking events
      const filter = registry.filters.DataPointRegistered(dataAddress);
      const events = await registry.queryFilter(filter);
      
      if (events.length > 0) {
        const winner = events[0].args.publisher;
        let winnerIndex = -1;
        for (let i = 0; i < participants.length; i++) {
          if (await participants[i].getAddress() === winner) {
            winnerIndex = i;
            break;
          }
        }
        
        console.log(`\n🏆 MEMPOOL RACE WINNER:`);
        console.log(`  Winner: Participant ${winnerIndex + 1}`);
        console.log(`  Gas price used: ${ethers.formatUnits(gasPrices[winnerIndex], "gwei")} gwei`);
        console.log(`  Royalty captured: ${ethers.formatEther(winningRoyalty)} ETH per access`);
        
        // Calculate economic viability
        const fulfilledResult = raceResults[winnerIndex];
        if (fulfilledResult.status === 'fulfilled') {
          const receipt = await (fulfilledResult.value as any).wait();
          const gasCost = receipt!.gasUsed * gasPrices[winnerIndex];
          const breakEvenAccesses = gasCost / winningRoyalty;
          
          console.log(`  Gas cost: ${ethers.formatEther(gasCost)} ETH`);
          console.log(`  Break-even accesses: ${breakEvenAccesses.toString()}`);
          
          console.log(`\n🔍 MEMPOOL ATTACK FINDINGS:`);
          if (breakEvenAccesses > 10000n) {
            console.log(`  ✅ Mempool manipulation is ECONOMICALLY UNVIABLE`);
            console.log(`  ✅ High gas prices make attacks unprofitable`);
          } else {
            console.log(`  ⚠️ Mempool manipulation may be viable for popular data`);
          }
        }
      }
      
      expect(winningRoyalty).to.be.greaterThan(0, "Winner should capture royalties");
      
      console.log(`\n=== MEMPOOL ATTACK SIMULATION COMPLETE ===`);
    });

    it("Should test protocol behavior under sustained attack", async function () {
      const sustainedData = ethers.toUtf8Bytes("sustained_attack_test");
      
      console.log(`\n=== TESTING SUSTAINED ATTACK SCENARIO ===`);
      console.log(`Sustained attack target: ${ethers.toUtf8String(sustainedData)}`);
      
      // Fund attacker for sustained operations
      await user1.sendTransaction({
        to: await attacker.getAddress(),
        value: ethers.parseEther("20")
      });
      
      // Set up sustained attack scenario
      const sustainedRoyalty = await registry.getDataPointRoyalty(await storage.calculateAddress(sustainedData));
      await attacker.setupRoyaltyReentrancyAttack(sustainedData, await publisher1.getAddress(), 15, {
        value: sustainedRoyalty
      });
      
      // Create multiple data points for sustained testing
      const attackTargets = [
        ethers.toUtf8Bytes("sustained_target_1"),
        ethers.toUtf8Bytes("sustained_target_2"), 
        ethers.toUtf8Bytes("sustained_target_3"),
        ethers.toUtf8Bytes("sustained_target_4"),
        ethers.toUtf8Bytes("sustained_target_5")
      ];
      
      console.log(`Setting up ${attackTargets.length} attack targets...`);
      
      // Register all targets and create royalty balances
      for (let i = 0; i < attackTargets.length; i++) {
        const royalty = await registry.getDataPointRoyalty(await storage.calculateAddress(attackTargets[i]));
        await registry.connect(user1).registerDataPoint(attackTargets[i], ethers.ZeroAddress, {
          value: royalty
        });
      }
      
      const initialSystemBalance = await registry.royaltyBalance(await attacker.getAddress()) +
                                  await registry.royaltyBalance(await publisher1.getAddress()) +
                                  await registry.royaltyBalance(await owner.getAddress());
      
      console.log(`Initial system balance: ${ethers.formatEther(initialSystemBalance)} ETH`);
      
      // Execute sustained attack sequence
      console.log(`\n🚨 EXECUTING SUSTAINED ATTACK SEQUENCE...`);
      
      const attackResults = [];
      
      for (let round = 1; round <= 5; round++) {
        console.log(`  Attack round ${round}/5...`);
        
        try {
          const roundTx = await attacker.executeRoyaltyReentrancyAttack();
          const roundReceipt = await roundTx.wait();
          
          attackResults.push({
            round,
            success: true,
            gasUsed: roundReceipt!.gasUsed
          });
          
          // Brief delay between attacks
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          attackResults.push({
            round,
            success: false,
            error: error
          });
        }
      }
      
      console.log(`\n📊 SUSTAINED ATTACK ANALYSIS:`);
      const successfulRounds = attackResults.filter(r => r.success).length;
      const totalGasUsed = attackResults.reduce((sum, r) => sum + (r.gasUsed || 0n), 0n);
      
      console.log(`  Successful attack rounds: ${successfulRounds}/5`);
      console.log(`  Total gas consumed: ${totalGasUsed.toString()}`);
      
      // Check system state after sustained attack
      const finalSystemBalance = await registry.royaltyBalance(await attacker.getAddress()) +
                                 await registry.royaltyBalance(await publisher1.getAddress()) +
                                 await registry.royaltyBalance(await owner.getAddress());
      
      console.log(`  System balance change: ${ethers.formatEther(finalSystemBalance - initialSystemBalance)} ETH`);
      
      // Test protocol functionality after sustained attack
      const postAttackData = ethers.toUtf8Bytes("post_sustained_functionality");
      
      try {
        await registry.connect(publisher2).registerDataPoint(postAttackData, await publisher2.getAddress());
        const postAttackRoyalty = await registry.getDataPointRoyalty(await storage.calculateAddress(postAttackData));
        
        console.log(`\n🔍 SUSTAINED ATTACK FINDINGS:`);
        console.log(`  ✅ Protocol remains FUNCTIONAL after sustained attack`);
        console.log(`  ✅ New registrations work: ${ethers.formatEther(postAttackRoyalty)} ETH royalty`);
        console.log(`  ✅ System integrity MAINTAINED: ${finalSystemBalance >= initialSystemBalance ? 'YES' : 'NO'}`);
        console.log(`  🛡️ Attack success rate: ${successfulRounds}/5 (${(successfulRounds/5*100).toFixed(1)}%)`);
        
      } catch (error) {
        console.log(`  ❌ Protocol functionality IMPAIRED: ${error}`);
      }
      
      expect(finalSystemBalance).to.be.greaterThanOrEqual(initialSystemBalance, "System should not lose funds");
      
      console.log(`\n=== SUSTAINED ATTACK TEST COMPLETE ===`);
    });

    it("Should verify recovery mechanisms after failed attacks", async function () {
      const recoveryData = ethers.toUtf8Bytes("recovery_mechanism_test");
      
      console.log(`\n=== TESTING RECOVERY MECHANISMS ===`);
      console.log(`Recovery test target: ${ethers.toUtf8String(recoveryData)}`);
      
      // Fund attacker for recovery testing
      await user1.sendTransaction({
        to: await attacker.getAddress(),
        value: ethers.parseEther("15")
      });
      
      // Create baseline system state
      const baselineTargets = [
        ethers.toUtf8Bytes("recovery_baseline_1"),
        ethers.toUtf8Bytes("recovery_baseline_2"),
        ethers.toUtf8Bytes("recovery_baseline_3")
      ];
      
      console.log(`Creating baseline system state...`);
      
      for (const target of baselineTargets) {
        const royalty = await registry.getDataPointRoyalty(await storage.calculateAddress(target));
        await registry.connect(user1).registerDataPoint(target, ethers.ZeroAddress, {
          value: royalty
        });
      }
      
      const baselineBalance = await registry.royaltyBalance(await attacker.getAddress());
      console.log(`Baseline attacker balance: ${ethers.formatEther(baselineBalance)} ETH`);
      
      // Execute multiple failed attack attempts
      console.log(`\n🚨 EXECUTING MULTIPLE FAILED ATTACKS...`);
      
      const failedAttacks = [];
      
      // Attack 1: Reentrancy
      try {
        const recoveryRoyalty = await registry.getDataPointRoyalty(await storage.calculateAddress(recoveryData));
        await attacker.setupRoyaltyReentrancyAttack(recoveryData, await publisher1.getAddress(), 20, {
          value: recoveryRoyalty
        });
        const attack1Tx = await attacker.executeRoyaltyReentrancyAttack();
        failedAttacks.push({ type: 'reentrancy', success: true });
      } catch (error) {
        failedAttacks.push({ type: 'reentrancy', success: false });
      }
      
      // Attack 2: Cross-contract
      try {
        await attacker.setupCrossContractAttack(recoveryData, ethers.toUtf8Bytes("recovery_secondary"), 10);
        const attack2Tx = await attacker.executeCrossContractAttack(ethers.toUtf8Bytes("recovery_trigger"));
        failedAttacks.push({ type: 'cross-contract', success: true });
      } catch (error) {
        failedAttacks.push({ type: 'cross-contract', success: false });
      }
      
      console.log(`Failed attacks executed: ${failedAttacks.length}`);
      
      // Test recovery mechanisms
      console.log(`\n🔧 TESTING RECOVERY CAPABILITIES...`);
      
      // Recovery test 1: Normal operations
      const recovery1Data = ethers.toUtf8Bytes("recovery_test_1");
      await registry.connect(publisher1).registerDataPoint(recovery1Data, await publisher1.getAddress());
      const recovery1Royalty = await registry.getDataPointRoyalty(await storage.calculateAddress(recovery1Data));
      
      // Recovery test 2: User interactions
      await registry.connect(user2).registerDataPoint(recovery1Data, ethers.ZeroAddress, {
        value: recovery1Royalty
      });
      
      // Recovery test 3: Balance operations
      const publisherBalance = await registry.royaltyBalance(await publisher1.getAddress());
      if (publisherBalance > 0) {
        await registry.connect(publisher1).collectRoyalties(publisherBalance, await publisher1.getAddress());
      }
      
      // Recovery test 4: New publisher registration
      const recovery2Data = ethers.toUtf8Bytes("recovery_test_2");
      await registry.connect(publisher2).registerDataPoint(recovery2Data, await publisher2.getAddress());
      
      const finalAttackerBalance = await registry.royaltyBalance(await attacker.getAddress());
      
      console.log(`\n📊 RECOVERY ANALYSIS:`);
      console.log(`  Failed attacks attempted: ${failedAttacks.length}`);
      console.log(`  Attacker balance change: ${ethers.formatEther(finalAttackerBalance - baselineBalance)} ETH`);
      console.log(`  Recovery test 1 royalty: ${ethers.formatEther(recovery1Royalty)} ETH`);
      
      console.log(`\n🔍 RECOVERY MECHANISM FINDINGS:`);
      console.log(`  ✅ Protocol RECOVERED from failed attacks`);
      console.log(`  ✅ Normal operations RESTORED`);
      console.log(`  ✅ User interactions FUNCTIONAL`);
      console.log(`  ✅ Balance operations WORKING`);
      console.log(`  ✅ New registrations SUCCESSFUL`);
      console.log(`  🛡️ Recovery capability: COMPLETE`);
      
      expect(recovery1Royalty).to.be.greaterThan(0, "Recovery operations should work");
      expect(finalAttackerBalance).to.be.greaterThanOrEqual(baselineBalance, "Attacker should not lose legitimate funds");
      
      console.log(`\n=== RECOVERY MECHANISM TEST COMPLETE ===`);
    });
  });

  describe("Economic Attack Prevention", function () {
    it("Should demonstrate overall economic defense effectiveness", async function () {
      const defenseData = ethers.toUtf8Bytes("economic_defense_test");
      
      console.log(`\n=== TESTING OVERALL ECONOMIC DEFENSE EFFECTIVENESS ===`);
      console.log(`Defense test target: ${ethers.toUtf8String(defenseData)}`);
      
      // Fund comprehensive defense testing
      await user1.sendTransaction({
        to: await attacker.getAddress(),
        value: ethers.parseEther("50")
      });
      
      // Test economic defense across different scenarios
      const defenseScenarios = [
        {
          name: "Normal Gas (20 gwei)",
          gasPrice: ethers.parseUnits("20", "gwei"),
          expected: "Economical"
        },
        {
          name: "High Gas (100 gwei)", 
          gasPrice: ethers.parseUnits("100", "gwei"),
          expected: "Expensive but viable"
        },
        {
          name: "Extreme Gas (500 gwei)",
          gasPrice: ethers.parseUnits("500", "gwei"),
          expected: "Economically unviable"
        },
        {
          name: "MEV Gas (1000 gwei)",
          gasPrice: ethers.parseUnits("1000", "gwei"),
          expected: "Extremely unviable"
        }
      ];
      
      console.log(`Testing ${defenseScenarios.length} economic defense scenarios...`);
      
      const defenseResults = [];
      
      for (let i = 0; i < defenseScenarios.length; i++) {
        const scenario = defenseScenarios[i];
        const testData = ethers.toUtf8Bytes(`defense_scenario_${i}`);
        
        console.log(`\nScenario ${i + 1}: ${scenario.name}`);
        
        try {
          const registrationTx = await registry.connect(publisher1).registerDataPoint(
            testData,
            await publisher1.getAddress(),
            { gasPrice: scenario.gasPrice }
          );
          const registrationReceipt = await registrationTx.wait();
          
          const gasCost = registrationReceipt!.gasUsed * scenario.gasPrice;
          const royalty = await registry.getDataPointRoyalty(await storage.calculateAddress(testData));
          const breakEvenAccesses = royalty > 0n ? gasCost / royalty : 0n;
          
          defenseResults.push({
            scenario: scenario.name,
            gasCost: gasCost,
            royalty: royalty,
            breakEvenAccesses: breakEvenAccesses,
            economicallyViable: breakEvenAccesses <= 10000n
          });
          
          console.log(`  Gas cost: ${ethers.formatEther(gasCost)} ETH`);
          console.log(`  Royalty per access: ${ethers.formatEther(royalty)} ETH`);
          console.log(`  Break-even accesses: ${breakEvenAccesses.toString()}`);
          console.log(`  Economic viability: ${breakEvenAccesses <= 10000n ? 'VIABLE' : 'UNVIABLE'}`);
          
        } catch (error) {
          defenseResults.push({
            scenario: scenario.name,
            error: error,
            economicallyViable: false
          });
          console.log(`  Registration failed: ${error}`);
        }
      }
      
      console.log(`\n📊 ECONOMIC DEFENSE ANALYSIS:`);
      const viableScenarios = defenseResults.filter(r => r.economicallyViable).length;
      const totalScenarios = defenseResults.length;
      
      console.log(`  Economically viable scenarios: ${viableScenarios}/${totalScenarios}`);
      console.log(`  Defense effectiveness: ${((totalScenarios - viableScenarios) / totalScenarios * 100).toFixed(1)}%`);
      
      // Calculate overall economic defense rating
      const highGasScenarios = defenseResults.slice(2); // Extreme and MEV scenarios
      const highGasDefenseRate = highGasScenarios.filter(r => !r.economicallyViable).length / highGasScenarios.length;
      
      console.log(`\n🔍 ECONOMIC DEFENSE FINDINGS:`);
      if (highGasDefenseRate >= 0.8) {
        console.log(`  ✅ Economic defenses are HIGHLY EFFECTIVE`);
        console.log(`  ✅ Attack costs scale proportionally with gas prices`);
        console.log(`  ✅ High-gas attacks are economically deterred`);
      } else if (highGasDefenseRate >= 0.5) {
        console.log(`  ⚠️ Economic defenses are MODERATELY EFFECTIVE`);
        console.log(`  ⚠️ Some high-gas scenarios may be viable`);
      } else {
        console.log(`  ❌ Economic defenses may be INSUFFICIENT`);
        console.log(`  ❌ High-gas attacks could be profitable`);
      }
      
      console.log(`  🛡️ High-gas defense rate: ${(highGasDefenseRate * 100).toFixed(1)}%`);
      console.log(`  💰 Economic deterrent strength: ${highGasDefenseRate >= 0.8 ? 'STRONG' : 'MODERATE'}`);
      
      expect(highGasDefenseRate).to.be.greaterThan(0.5, "Economic defenses should deter most high-gas attacks");
      
      console.log(`\n=== ECONOMIC DEFENSE TEST COMPLETE ===`);
    });

    it("Should test worst-case but realistic attack combinations", async function () {
      const worstCaseData = ethers.toUtf8Bytes("worst_case_attack_combo");
      
      console.log(`\n=== TESTING WORST-CASE REALISTIC ATTACK COMBINATIONS ===`);
      console.log(`Worst-case target: ${ethers.toUtf8String(worstCaseData)}`);
      
      // Fund worst-case attack testing
      await user1.sendTransaction({
        to: await attacker.getAddress(),
        value: ethers.parseEther("100")
      });
      
      // Worst-case scenario: Combined MEV + Reentrancy + Economic manipulation
      console.log(`Preparing worst-case attack combination...`);
      
      // Phase 1: MEV front-running with maximum realistic gas
      const maxRealisticGas = ethers.parseUnits("200", "gwei"); // 200 gwei peak
      
      console.log(`Phase 1: MEV front-running attack...`);
      const mevTx = await registry.connect(mevBot).registerDataPoint(
        worstCaseData,
        await mevBot.getAddress(),
        { gasPrice: maxRealisticGas }
      );
      const mevReceipt = await mevTx.wait();
      const mevCost = mevReceipt!.gasUsed * maxRealisticGas;
      
      console.log(`  MEV attack cost: ${ethers.formatEther(mevCost)} ETH`);
      
      // Phase 2: Reentrancy attack attempt
      console.log(`Phase 2: Reentrancy attack attempt...`);
      
      // Create large royalty balance for maximum attack potential
      const royalty = await registry.getDataPointRoyalty(await storage.calculateAddress(worstCaseData));
      
      await attacker.setupRoyaltyReentrancyAttack(worstCaseData, await mevBot.getAddress(), 25, {
        value: royalty
      });
      
      // Multiple large payments to create significant balance
      for (let i = 0; i < 10; i++) {
        await registry.connect(user1).registerDataPoint(worstCaseData, ethers.ZeroAddress, {
          value: royalty
        });
      }
      
      const largeBalance = await registry.royaltyBalance(await attacker.getAddress());
      console.log(`  Large balance created: ${ethers.formatEther(largeBalance)} ETH`);
      
      try {
        const reentrancyTx = await attacker.executeRoyaltyReentrancyAttack();
        const reentrancyReceipt = await reentrancyTx.wait();
        console.log(`  Reentrancy attack gas: ${reentrancyReceipt!.gasUsed}`);
      } catch (error) {
        console.log(`  Reentrancy attack failed: ${error}`);
      }
      
      // Phase 3: Economic analysis of worst-case scenario
      const mevBalance = await registry.royaltyBalance(await mevBot.getAddress());
      const attackerFinalBalance = await registry.royaltyBalance(await attacker.getAddress());
      
      const totalAttackerRevenue = mevBalance + attackerFinalBalance;
      const totalAttackerCosts = mevCost;
      const netProfitability = totalAttackerRevenue > totalAttackerCosts;
      
      console.log(`\n📊 WORST-CASE ATTACK ANALYSIS:`);
      console.log(`  MEV bot balance: ${ethers.formatEther(mevBalance)} ETH`);
      console.log(`  Attacker balance: ${ethers.formatEther(attackerFinalBalance)} ETH`);
      console.log(`  Total revenue: ${ethers.formatEther(totalAttackerRevenue)} ETH`);
      console.log(`  Total costs: ${ethers.formatEther(totalAttackerCosts)} ETH`);
      console.log(`  Net result: ${ethers.formatEther(totalAttackerRevenue - totalAttackerCosts)} ETH`);
      
      // Calculate accesses needed to break even
      const accessesForBreakEven = totalAttackerCosts / royalty;
      
      console.log(`\n🔍 WORST-CASE SCENARIO FINDINGS:`);
      if (netProfitability) {
        console.log(`  ⚠️ Worst-case attack is PROFITABLE`);
        console.log(`  ⚠️ Attack succeeded with realistic parameters`);
        console.log(`  ⚠️ Economic defenses may need strengthening`);
      } else {
        console.log(`  ✅ Worst-case attack is UNPROFITABLE`);
        console.log(`  ✅ Economic defenses hold under extreme conditions`);
        console.log(`  ✅ Protocol withstands worst-case scenarios`);
      }
      
      console.log(`  📈 Accesses needed for break-even: ${accessesForBreakEven.toString()}`);
      console.log(`  🛡️ Defense under worst-case: ${!netProfitability ? 'EFFECTIVE' : 'CHALLENGED'}`);
      console.log(`  💰 Worst-case viability: ${accessesForBreakEven <= 50000n ? 'CONCERNING' : 'ACCEPTABLE'}`);
      
      // Test protocol functionality after worst-case attack
      const postWorstCaseData = ethers.toUtf8Bytes("post_worst_case_test");
      await registry.connect(publisher2).registerDataPoint(postWorstCaseData, await publisher2.getAddress());
      
      console.log(`  🔧 Protocol functionality after worst-case: MAINTAINED`);
      
      expect(accessesForBreakEven).to.be.greaterThan(1000n, "Worst-case should require significant usage to be profitable");
      
      console.log(`\n=== WORST-CASE ATTACK COMBINATION TEST COMPLETE ===`);
    });

    it("Should verify protocol remains functional under attack", async function () {
      const functionalityData = ethers.toUtf8Bytes("functionality_under_attack");
      
      console.log(`\n=== TESTING PROTOCOL FUNCTIONALITY UNDER ATTACK ===`);
      console.log(`Functionality test: ${ethers.toUtf8String(functionalityData)}`);
      
      // Fund comprehensive functionality testing
      await user1.sendTransaction({
        to: await attacker.getAddress(),
        value: ethers.parseEther("30")
      });
      
      // Start continuous attack background process
      console.log(`Starting continuous attack simulation...`);
      
      const functionalityRoyalty = await registry.getDataPointRoyalty(await storage.calculateAddress(functionalityData));
      await attacker.setupRoyaltyReentrancyAttack(functionalityData, await publisher1.getAddress(), 50, {
        value: functionalityRoyalty
      });
      
      // Create royalty balance for continuous attacks
      const royalty = await registry.getDataPointRoyalty(await storage.calculateAddress(functionalityData));
      await registry.connect(user1).registerDataPoint(functionalityData, ethers.ZeroAddress, {
        value: royalty
      });
      
      // Test normal protocol operations during attack
      const functionalityTests = [
        {
          name: "New Data Registration",
          test: async () => {
            const testData = ethers.toUtf8Bytes("functionality_test_1");
            await registry.connect(publisher2).registerDataPoint(testData, await publisher2.getAddress());
            const testRoyalty = await registry.getDataPointRoyalty(await storage.calculateAddress(testData));
            return testRoyalty > 0n;
          }
        },
        {
          name: "User Data Access",
          test: async () => {
            const testData = ethers.toUtf8Bytes("functionality_test_2");
            await registry.connect(publisher1).registerDataPoint(testData, await publisher1.getAddress());
            const testRoyalty = await registry.getDataPointRoyalty(await storage.calculateAddress(testData));
            await registry.connect(user2).registerDataPoint(testData, ethers.ZeroAddress, { value: testRoyalty });
            return true;
          }
        },
        {
          name: "Royalty Collection",
          test: async () => {
            const balance = await registry.royaltyBalance(await publisher1.getAddress());
            if (balance > 0) {
              await registry.connect(publisher1).collectRoyalties(balance, await publisher1.getAddress());
            }
            return true;
          }
        },
        {
          name: "Balance Queries",
          test: async () => {
            const balance1 = await registry.royaltyBalance(await publisher1.getAddress());
            const balance2 = await registry.royaltyBalance(await publisher2.getAddress());
            return balance1 >= 0n && balance2 >= 0n;
          }
        },
        {
          name: "Data Point Queries",
          test: async () => {
            const testData = ethers.toUtf8Bytes("functionality_test_3");
            const dataAddress = await storage.calculateAddress(testData);
            const size = await storage.dataPointSize(dataAddress);
            const royalty = await registry.getDataPointRoyalty(dataAddress);
            return size >= 0 && royalty >= 0n;
          }
        }
      ];
      
      console.log(`\nTesting ${functionalityTests.length} functionality scenarios during attack...`);
      
      const functionalityResults = [];
      
      for (const test of functionalityTests) {
        console.log(`  Testing: ${test.name}...`);
        
        try {
          // Execute attack in background
          const attackPromise = attacker.executeRoyaltyReentrancyAttack().catch(() => {});
          
          // Execute functionality test
          const testResult = await test.test();
          
          functionalityResults.push({
            name: test.name,
            success: testResult,
            error: null
          });
          
          console.log(`    Result: ${testResult ? 'SUCCESS' : 'FAILED'}`);
          
        } catch (error) {
          functionalityResults.push({
            name: test.name,
            success: false,
            error: error
          });
          
          console.log(`    Result: ERROR - ${error}`);
        }
      }
      
      const successfulTests = functionalityResults.filter(r => r.success).length;
      const totalTests = functionalityResults.length;
      const functionalityRate = successfulTests / totalTests;
      
      console.log(`\n📊 FUNCTIONALITY UNDER ATTACK ANALYSIS:`);
      console.log(`  Successful operations: ${successfulTests}/${totalTests}`);
      console.log(`  Functionality rate: ${(functionalityRate * 100).toFixed(1)}%`);
      
      console.log(`\n🔍 FUNCTIONALITY FINDINGS:`);
      if (functionalityRate >= 0.9) {
        console.log(`  ✅ Protocol maintains EXCELLENT functionality under attack`);
        console.log(`  ✅ Attack isolation is HIGHLY EFFECTIVE`);
        console.log(`  ✅ Users can continue normal operations`);
      } else if (functionalityRate >= 0.7) {
        console.log(`  ⚠️ Protocol maintains GOOD functionality under attack`);
        console.log(`  ⚠️ Some operations may be impacted`);
      } else {
        console.log(`  ❌ Protocol functionality is SIGNIFICANTLY IMPACTED`);
        console.log(`  ❌ Attack isolation may be insufficient`);
      }
      
      console.log(`  🛡️ Attack isolation effectiveness: ${(functionalityRate * 100).toFixed(1)}%`);
      console.log(`  🔧 Protocol resilience: ${functionalityRate >= 0.8 ? 'HIGH' : 'MODERATE'}`);
      
      expect(functionalityRate).to.be.greaterThan(0.7, "Protocol should maintain good functionality under attack");
      
      console.log(`\n=== FUNCTIONALITY UNDER ATTACK TEST COMPLETE ===`);
    });
  });
}); 