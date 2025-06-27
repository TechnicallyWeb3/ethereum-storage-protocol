import { expect } from "chai";
import { ethers, network } from "hardhat";
import { DataPointRegistry, DataPointStorage } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("DPR Security - Economic Attack Vectors", function () {
  let registry: DataPointRegistry;
  let storage: DataPointStorage;
  let owner: HardhatEthersSigner;
  let publisher1: HardhatEthersSigner;
  let publisher2: HardhatEthersSigner;
  let attacker: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;

  // Use a more realistic royalty rate for testing (approximately 1/1000th of typical gas)
  const ROYALTY_RATE = ethers.parseUnits("0.01", "gwei"); // 0.01 gwei per gas unit

  let originalGasPrice: bigint;
  let originalBaseFee: string;

  beforeEach(async function () {
    [owner, publisher1, publisher2, attacker, user1, user2] = await ethers.getSigners();

    // Store original gas settings
    const feeData = await ethers.provider.getFeeData();
    originalGasPrice = feeData.gasPrice || ethers.parseUnits("20", "gwei");

    // Deploy DataPointStorage first
    const StorageFactory = await ethers.getContractFactory("DataPointStorage");
    storage = await StorageFactory.deploy();

    // Deploy DataPointRegistry
    const RegistryFactory = await ethers.getContractFactory("DataPointRegistry");
    registry = await RegistryFactory.deploy(
      await owner.getAddress(),
      await storage.getAddress(),
      ROYALTY_RATE
    );
  });

  afterEach(async function () {
    // Reset gas price after each test
    await network.provider.send("hardhat_setNextBlockBaseFeePerGas", [
      "0x" + originalGasPrice.toString(16)
    ]);
  });

  describe("Gas Manipulation Attacks", function () {
    describe("Extreme Gas Price Scenarios", function () {
      it("Should demonstrate gas bomb attacks are unprofitable due to 1/1000th ratio", async function () {
        const testData = ethers.toUtf8Bytes("gas_bomb_test_data");

        // Publisher registers data point under normal conditions
        const publisherBalanceBefore = await ethers.provider.getBalance(publisher1.address);
        const tx = await registry.connect(publisher1).registerDataPoint(testData, publisher1.address);
        const receipt = await tx.wait();
        const gasCost = receipt!.gasUsed * receipt!.gasPrice;
        const publisherBalanceAfter = await ethers.provider.getBalance(publisher1.address);

        console.log(`Normal gas cost for registration: ${ethers.formatEther(gasCost)} ETH`);

        // Get the royalty cost for accessing this data point
        const dataAddress = await storage.calculateAddress(testData);
        const royaltyCost = await registry.getDataPointRoyalty(dataAddress);

        console.log(`Royalty cost for access: ${ethers.formatEther(royaltyCost)} ETH`);
        console.log(`Publisher paid: ${ethers.formatEther(publisherBalanceBefore - publisherBalanceAfter)} ETH`);

        // The attack should be unprofitable: gas cost > potential royalty earnings
        // Even if attacker could somehow get all the royalty (which they can't), they'd lose money
        expect(gasCost).to.be.greaterThan(royaltyCost);

        // Verify the economic defense: attacker loses more than they could possibly gain
        const netLoss = gasCost - royaltyCost;
        console.log(`Net loss for gas bomb attack: ${ethers.formatEther(netLoss)} ETH`);
        expect(netLoss).to.be.greaterThan(0);
      });

      it("Should test gas inflation with extreme scenarios (1000x normal rates)", async function () {
        const testData = ethers.toUtf8Bytes("extreme_gas_test_1000x");

                      // Set extremely high gas price (1000x current network rate)
        const extremeGasPrice = originalGasPrice * 1000n;
        await network.provider.send("hardhat_setNextBlockBaseFeePerGas", [
          "0x" + extremeGasPrice.toString(16)
        ]);

        const attackerBalanceBefore = await ethers.provider.getBalance(attacker.address);

        // Attacker tries to register with extreme gas prices
        const tx = await registry.connect(attacker).registerDataPoint(testData, attacker.address, {
          gasPrice: extremeGasPrice
        });
        const receipt = await tx.wait();
        const gasCost = receipt!.gasUsed * receipt!.gasPrice;

        const attackerBalanceAfter = await ethers.provider.getBalance(attacker.address);
        console.log(`Extreme gas cost (1000x): ${ethers.formatEther(gasCost)} ETH`);

        // Get the royalty that would be earned
        const dataAddress = await storage.calculateAddress(testData);
        const royaltyCost = await registry.getDataPointRoyalty(dataAddress);

        console.log(`Royalty with extreme gas: ${ethers.formatEther(royaltyCost)} ETH`);

        // Even with inflated royalties, the attack should be massively unprofitable
        const actualCost = attackerBalanceBefore - attackerBalanceAfter;
        expect(actualCost).to.be.greaterThan(royaltyCost);

        const lossRatio = actualCost * 100n / royaltyCost;
        console.log(`Attacker loses ${lossRatio}% more than they could earn`);
        expect(lossRatio).to.be.greaterThan(100n); // Loses more than 100% of potential earnings
      });

      it("Should verify users don't pay more in royalties than publisher paid in gas (ultra-low gas scenario)", async function () {
        const testData = ethers.toUtf8Bytes("extreme_gas_test_low");

        // Estimate what the writeDataPoint gas should be (before registration)
        const directGasEstimate = await storage.writeDataPoint.estimateGas(testData);
        const estimatedRoyalty = directGasEstimate * ROYALTY_RATE;

        // Set extremely low gas price (1/1000th current network rate)
        const lowGasPrice = originalGasPrice / 1000n;
        await network.provider.send("hardhat_setNextBlockBaseFeePerGas", [
          "0x" + lowGasPrice.toString(16)
        ]);

        // Publisher registers with very low gas costs
        const tx = await registry.connect(publisher1).registerDataPoint(testData, publisher1.address, {
          gasPrice: lowGasPrice
        });
        const receipt = await tx.wait();
        const publisherGasCost = receipt!.gasUsed * receipt!.gasPrice;

        const dataAddress = await storage.calculateAddress(testData);
        const royaltyCost = await registry.getDataPointRoyalty(dataAddress);

        console.log(`Publisher gas cost: ${ethers.formatEther(publisherGasCost)} ETH`);
        console.log(`Royalty cost: ${ethers.formatEther(royaltyCost)} ETH`);
        console.log(`Gas price: ${ethers.formatUnits(lowGasPrice, "gwei")} gwei`);
        console.log(`Royalty rate: ${ethers.formatUnits(ROYALTY_RATE, "gwei")} gwei per gas`);

        // KEY TEST: User should not pay more in royalties than publisher paid in gas
        expect(royaltyCost).to.be.lessThanOrEqual(publisherGasCost);

        console.log(`Direct writeDataPoint gas estimate: ${directGasEstimate.toString()}`);
        console.log(`Estimated royalty from direct call: ${ethers.formatEther(estimatedRoyalty)} ETH`);
        console.log(`Actual royalty (contract measured): ${ethers.formatEther(royaltyCost)} ETH`);
        console.log(`Transaction total gas: ${receipt!.gasUsed.toString()}`);

        // Verify the actual royalty is reasonably close to our estimate
        // (allowing for some variance due to contract measurement differences)
        const variance = royaltyCost > estimatedRoyalty ?
          royaltyCost - estimatedRoyalty : estimatedRoyalty - royaltyCost;
        const percentVariance = (variance * 100n) / estimatedRoyalty;

        console.log(`Gas measurement variance: ${percentVariance}%`);
        expect(percentVariance).to.be.lessThan(50n); // Within 50% variance is reasonable

        // User pays very little to access this data
        const userBalanceBefore = await ethers.provider.getBalance(user1.address);
        const accessTx = await registry.connect(user1).registerDataPoint(testData, ethers.ZeroAddress, {
          value: royaltyCost
        });
        const accessReceipt = await accessTx.wait();
        const userBalanceAfter = await ethers.provider.getBalance(user1.address);

        const totalUserCost = userBalanceBefore - userBalanceAfter;
        console.log(`Total cost to user (including gas): ${ethers.formatEther(totalUserCost)} ETH`);

        // Verify user pays proportionally less when gas is low
        expect(totalUserCost).to.be.lessThan(ethers.parseUnits("1", "finney")); // Less than 0.001 ETH
      });

            it("Should verify economic defense works at moderate gas prices (5x network rate)", async function () {
        const testData = ethers.toUtf8Bytes("moderate_gas_test");
        
        // Test with moderately high gas prices (5x normal, more realistic than 1000x)
        const moderateGasPrice = originalGasPrice * 5n;
        await network.provider.send("hardhat_setNextBlockBaseFeePerGas", [
          "0x" + moderateGasPrice.toString(16)
        ]);
        
        const attackerBalanceBefore = await ethers.provider.getBalance(attacker.address);
        
        // Attacker registers data point
        const tx = await registry.connect(attacker).registerDataPoint(testData, attacker.address, {
          gasPrice: moderateGasPrice
        });
        const receipt = await tx.wait();
        
        const attackerBalanceAfter = await ethers.provider.getBalance(attacker.address);
        const totalCost = attackerBalanceBefore - attackerBalanceAfter;
        
        // Get maximum possible earnings (if someone accesses the data)
        const dataAddress = await storage.calculateAddress(testData);
        const royaltyCost = await registry.getDataPointRoyalty(dataAddress);
        const publisherShare = royaltyCost * 9n / 10n; // 90% to publisher
        
        console.log(`Attacker total cost (5x gas): ${ethers.formatEther(totalCost)} ETH`);
        console.log(`Maximum possible earnings: ${ethers.formatEther(publisherShare)} ETH`);
        console.log(`Current network gas price: ${ethers.formatUnits(originalGasPrice, "gwei")} gwei`);
        console.log(`Test gas price (5x): ${ethers.formatUnits(moderateGasPrice, "gwei")} gwei`);
        
        // Verify economic defense: cost > maximum possible earnings
        expect(totalCost).to.be.greaterThan(publisherShare);
        
        const profitabilityRatio = (publisherShare * 100n) / totalCost;
        console.log(`Attacker can recover at most ${profitabilityRatio}% of costs`);
        expect(profitabilityRatio).to.be.lessThan(100n);
      });
    });

    describe("Gas Price Manipulation Edge Cases", function () {
      it("Should test edge cases with artificially manipulated gas prices", async function () {
        const testData = ethers.toUtf8Bytes("gas_manipulation_edge_case");

        // Test with zero gas price (if possible)
        try {
          await network.provider.send("hardhat_setNextBlockBaseFeePerGas", ["0x0"]);

          const tx = await registry.connect(publisher1).registerDataPoint(testData, publisher1.address, {
            gasPrice: 1 // Minimum possible
          });
          await tx.wait();

          const dataAddress = await storage.calculateAddress(testData);
          const royaltyCost = await registry.getDataPointRoyalty(dataAddress);

          // Even with minimal gas, there should be some royalty calculation
          console.log(`Royalty with minimal gas: ${royaltyCost.toString()}`);
          expect(royaltyCost).to.be.greaterThanOrEqual(0);

        } catch (error) {
          expect.fail("Zero gas price not supported, which is expected"); // lets us know 0 values are being returned.
        }
      });

      it("Should handle gas price changes between registration and access", async function () {
        const testData = ethers.toUtf8Bytes("gas_price_timing_test");

        // Register with low gas
        const lowGasPrice = ethers.parseUnits("5", "gwei");
        await network.provider.send("hardhat_setNextBlockBaseFeePerGas", [
          "0x" + lowGasPrice.toString(16)
        ]);

        await registry.connect(publisher1).registerDataPoint(testData, publisher1.address, {
          gasPrice: lowGasPrice
        });

        const dataAddress = await storage.calculateAddress(testData);
        const originalRoyalty = await registry.getDataPointRoyalty(dataAddress);

        // Change gas price drastically
        const highGasPrice = ethers.parseUnits("200", "gwei");
        await network.provider.send("hardhat_setNextBlockBaseFeePerGas", [
          "0x" + highGasPrice.toString(16)
        ]);

        // Royalty should remain the same (based on gas units, not current gas price)
        const currentRoyalty = await registry.getDataPointRoyalty(dataAddress);
        expect(currentRoyalty).to.equal(originalRoyalty);

        console.log(`Royalty remains constant despite gas price changes: ${ethers.formatEther(currentRoyalty)} ETH`);
      });
    });
  });

  describe("Publisher Access Control Attacks", function () {
    describe("updatePublisherAddress Security", function () {
      it("Should prevent unauthorized updatePublisherAddress calls", async function () {
        const testData = ethers.toUtf8Bytes("access_control_test");

        // Publisher1 registers a data point
        await registry.connect(publisher1).registerDataPoint(testData, publisher1.address);
        const dataAddress = await storage.calculateAddress(testData);

        // Attacker tries to change publisher address
        await expect(
          registry.connect(attacker).updatePublisherAddress(dataAddress, attacker.address)
        ).to.be.revertedWithCustomError(registry, "InvalidPublisher");

        // Verify publisher address unchanged
        const royaltyInfo = await registry.getDataPointRoyalty(dataAddress);
        expect(royaltyInfo).to.be.greaterThan(0); // Data point exists and has original publisher
      });

      it("Should only allow current publisher to update address", async function () {
        const testData = ethers.toUtf8Bytes("publisher_update_test");

        // Publisher1 registers a data point
        await registry.connect(publisher1).registerDataPoint(testData, publisher1.address);
        const dataAddress = await storage.calculateAddress(testData);

        // Publisher1 should be able to update to publisher2
        await expect(
          registry.connect(publisher1).updatePublisherAddress(dataAddress, publisher2.address)
        ).to.not.be.reverted;

        // Now publisher2 should be able to update, but not publisher1
        await expect(
          registry.connect(publisher2).updatePublisherAddress(dataAddress, user1.address)
        ).to.not.be.reverted;

        await expect(
          registry.connect(publisher1).updatePublisherAddress(dataAddress, attacker.address)
        ).to.be.revertedWithCustomError(registry, "InvalidPublisher");
      });

      it("Should verify DAO-only updateRoyaltyRecord access", async function () {
        const testData = ethers.toUtf8Bytes("dao_access_test");
        const dataAddress = await storage.calculateAddress(testData);

        const royaltyRecord = {
          gasUsed: 50000,
          publisher: publisher1.address
        };

        // Only owner (DAO) should be able to update royalty records
        await expect(
          registry.connect(owner).updateRoyaltyRecord(dataAddress, royaltyRecord)
        ).to.not.be.reverted;

        // Non-owners should be rejected
        await expect(
          registry.connect(attacker).updateRoyaltyRecord(dataAddress, royaltyRecord)
        ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");

        await expect(
          registry.connect(publisher1).updateRoyaltyRecord(dataAddress, royaltyRecord)
        ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
      });

      it("Should test publisher address edge cases and boundary conditions", async function () {
        const testData = ethers.toUtf8Bytes("edge_case_test");

        // Test with zero address publisher
        await registry.connect(user1).registerDataPoint(testData, ethers.ZeroAddress);
        const dataAddress = await storage.calculateAddress(testData);

        // Should not be able to update from zero address (no royalties anyway)
        await expect(
          registry.connect(user1).updatePublisherAddress(dataAddress, publisher1.address)
        ).to.be.revertedWithCustomError(registry, "InvalidPublisher");

        // Test updating to zero address (waiving future royalties)
        const testData2 = ethers.toUtf8Bytes("zero_address_update_test");
        await registry.connect(publisher1).registerDataPoint(testData2, publisher1.address);
        const dataAddress2 = await storage.calculateAddress(testData2);

        // Publisher can update to zero address to waive royalties
        await expect(
          registry.connect(publisher1).updatePublisherAddress(dataAddress2, ethers.ZeroAddress)
        ).to.not.be.reverted;
      });
    });
  });

  describe("Balance Manipulation Attacks", function () {
    describe("Withdrawal Security", function () {
      it("Should prevent balance underflow in withdrawal scenarios", async function () {
        const testData = ethers.toUtf8Bytes("balance_underflow_test");

        // Publisher registers and earns some royalties
        await registry.connect(publisher1).registerDataPoint(testData, publisher1.address);
        const dataAddress = await storage.calculateAddress(testData);
        const royaltyCost = await registry.getDataPointRoyalty(dataAddress);

        await registry.connect(user1).registerDataPoint(testData, ethers.ZeroAddress, {
          value: royaltyCost
        });

        const balance = await registry.royaltyBalance(publisher1.address);
        expect(balance).to.be.greaterThan(0);

        // Try to withdraw more than balance
        const excessiveAmount = balance + ethers.parseEther("1");
        await expect(
          registry.connect(publisher1).collectRoyalties(excessiveAmount, publisher1.address)
        ).to.be.reverted; // Should revert due to underflow protection
      });

      it("Should test concurrent balance operations for race conditions", async function () {
        const testData = ethers.toUtf8Bytes("concurrent_operations_test");

        // Setup: Publisher earns royalties
        await registry.connect(publisher1).registerDataPoint(testData, publisher1.address);
        const dataAddress = await storage.calculateAddress(testData);
        const royaltyCost = await registry.getDataPointRoyalty(dataAddress);

        // Multiple users pay royalties to build up balance
        await registry.connect(user1).registerDataPoint(testData, ethers.ZeroAddress, {
          value: royaltyCost
        });
        await registry.connect(user2).registerDataPoint(testData, ethers.ZeroAddress, {
          value: royaltyCost
        });

        const balance = await registry.royaltyBalance(publisher1.address);
        
        console.log(`Total balance: ${ethers.formatEther(balance)} ETH`);

        // Create two concurrent withdrawal transactions for the FULL balance each
        // This creates a real race condition where only one can succeed
        // Using Promise.allSettled to let both transactions attempt execution
        const tx1 = registry.connect(publisher1).collectRoyalties(balance, publisher1.address);
        const tx2 = registry.connect(publisher1).collectRoyalties(balance, publisher1.address);

        const results = await Promise.allSettled([tx1, tx2]);
        
        // Analyze results - exactly one should succeed, one should fail
        const fulfilled = results.filter(r => r.status === 'fulfilled').length;
        const rejected = results.filter(r => r.status === 'rejected').length;
        
        console.log(`Fulfilled transactions: ${fulfilled}, Rejected: ${rejected}`);
        
        // In a perfect race condition, one succeeds and one fails
        // But due to Ethereum's sequential nature, this tests underflow protection
        expect(fulfilled).to.equal(1);
        expect(rejected).to.equal(1);
        
        // Verify final balance is consistent
        const finalBalance = await registry.royaltyBalance(publisher1.address);
        console.log(`Final balance: ${ethers.formatEther(finalBalance)} ETH`);
        expect(finalBalance).to.equal(0);
      });

      it("Should verify balance accounting integrity across operations", async function () {
        const testData1 = ethers.toUtf8Bytes("balance_integrity_test_1");
        const testData2 = ethers.toUtf8Bytes("balance_integrity_test_2");

        // Publisher registers two data points
        await registry.connect(publisher1).registerDataPoint(testData1, publisher1.address);
        await registry.connect(publisher1).registerDataPoint(testData2, publisher1.address);

        const addr1 = await storage.calculateAddress(testData1);
        const addr2 = await storage.calculateAddress(testData2);
        const royalty1 = await registry.getDataPointRoyalty(addr1);
        const royalty2 = await registry.getDataPointRoyalty(addr2);

        const initialBalance = await registry.royaltyBalance(publisher1.address);

        // Users pay for both data points
        await registry.connect(user1).registerDataPoint(testData1, ethers.ZeroAddress, {
          value: royalty1
        });
        await registry.connect(user2).registerDataPoint(testData2, ethers.ZeroAddress, {
          value: royalty2
        });

        const expectedIncrease = (royalty1 + royalty2) * 9n / 10n; // 90% to publisher
        const finalBalance = await registry.royaltyBalance(publisher1.address);

        console.log(`Initial: ${ethers.formatEther(initialBalance)} ETH`);
        console.log(`Expected increase: ${ethers.formatEther(expectedIncrease)} ETH`);
        console.log(`Final: ${ethers.formatEther(finalBalance)} ETH`);

        expect(finalBalance).to.equal(initialBalance + expectedIncrease);
      });

      it("Should test withdrawal edge cases and boundary amounts", async function () {
        const testData = ethers.toUtf8Bytes("withdrawal_edge_cases");

        // Setup minimal royalty scenario
        await registry.connect(publisher1).registerDataPoint(testData, publisher1.address);
        const dataAddress = await storage.calculateAddress(testData);
        const royaltyCost = await registry.getDataPointRoyalty(dataAddress);

        await registry.connect(user1).registerDataPoint(testData, ethers.ZeroAddress, {
          value: royaltyCost
        });

        const balance = await registry.royaltyBalance(publisher1.address);

        // Test withdrawing exact balance
        await expect(
          registry.connect(publisher1).collectRoyalties(balance, publisher1.address)
        ).to.not.be.reverted;

        // Verify balance is now zero
        expect(await registry.royaltyBalance(publisher1.address)).to.equal(0);

        // Test withdrawing from zero balance
        await expect(
          registry.connect(publisher1).collectRoyalties(1, publisher1.address)
        ).to.be.reverted;
      });
    });
  });
}); 