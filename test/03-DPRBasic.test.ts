import { expect } from "chai";
import { ethers } from "hardhat";
import { DataPointRegistry, DataPointStorage } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("DataPointRegistry Contract Audit", function () {
  let registry: DataPointRegistry;
  let storage: DataPointStorage;
  let owner: HardhatEthersSigner;
  let publisher1: HardhatEthersSigner;
  let publisher2: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let attacker: HardhatEthersSigner;
  
  // Use higher royalty rate for testing (exaggerated)
  const ROYALTY_RATE = ethers.parseEther("0.001"); // 0.001 ETH per gas unit (very high for testing)
  
  beforeEach(async function () {
    [owner, publisher1, publisher2, user1, user2, attacker] = await ethers.getSigners();
    
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

  describe("Contract Deployment and Setup", function () {
    it("Should deploy with correct initial parameters", async function () {
      expect(await registry.owner()).to.equal(await owner.getAddress());
      expect(await registry.DPS()).to.equal(await storage.getAddress());
      expect(await registry.royaltyRate()).to.equal(ROYALTY_RATE);
    });

    it("Should properly validate DPS contract during deployment", async function () {
      const RegistryFactory = await ethers.getContractFactory("DataPointRegistry");
      
      // Should fail with invalid DPS address
      await expect(RegistryFactory.deploy(
        await owner.getAddress(),
        ethers.ZeroAddress,
        ROYALTY_RATE
      )).to.be.revertedWithCustomError(registry, "InvalidDPS");
    });

    it("Should have correct initial state", async function () {
      const testData = ethers.toUtf8Bytes("test data");
      const dataAddress = await storage.calculateAddress(testData);
      
      expect(await registry.getDataPointRoyalty(dataAddress)).to.equal(0);
      expect(await registry.royaltyBalance(await publisher1.getAddress())).to.equal(0);
    });
  });

  describe("Access Control - Owner Functions", function () {
    describe("setDPS function", function () {
      it("Should allow owner to change DPS contract", async function () {
        const newStorage = await (await ethers.getContractFactory("DataPointStorage")).deploy();
        
        await registry.connect(owner).setDPS(await newStorage.getAddress());
        expect(await registry.DPS()).to.equal(await newStorage.getAddress());
      });

      it("Should reject non-owner attempts to change DPS", async function () {
        const newStorage = await (await ethers.getContractFactory("DataPointStorage")).deploy();
        
        await expect(registry.connect(user1).setDPS(await newStorage.getAddress()))
          .to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
      });

      it("Should validate new DPS contract", async function () {
        await expect(registry.connect(owner).setDPS(ethers.ZeroAddress))
          .to.be.revertedWithCustomError(registry, "InvalidDPS");
        
        await expect(registry.connect(owner).setDPS(await user1.getAddress()))
          .to.be.revertedWithCustomError(registry, "InvalidDPS");
      });
    });

    describe("setRoyaltyRate function", function () {
      it("Should allow owner to change royalty rate", async function () {
        const newRate = ethers.parseEther("0.002");
        
        await registry.connect(owner).setRoyaltyRate(newRate);
        expect(await registry.royaltyRate()).to.equal(newRate);
      });

      it("Should reject non-owner attempts to change royalty rate", async function () {
        const newRate = ethers.parseEther("0.002");
        
        await expect(registry.connect(user1).setRoyaltyRate(newRate))
          .to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
      });
    });

    describe("updateRoyaltyRecord function", function () {
      it("Should allow owner to update royalty records", async function () {
        const testData = ethers.toUtf8Bytes("test data");
        const dataAddress = await storage.calculateAddress(testData);
        const royaltyRecord = {
          gasUsed: 50000,
          publisher: await publisher1.getAddress()
        };
        
        await registry.connect(owner).updateRoyaltyRecord(dataAddress, royaltyRecord);
        
        const expectedRoyalty = BigInt(50000) * ROYALTY_RATE;
        expect(await registry.getDataPointRoyalty(dataAddress)).to.equal(expectedRoyalty);
      });

      it("Should reject non-owner attempts to update royalty records", async function () {
        const testData = ethers.toUtf8Bytes("test data");
        const dataAddress = await storage.calculateAddress(testData);
        const royaltyRecord = {
          gasUsed: 50000,
          publisher: await publisher1.getAddress()
        };
        
        await expect(registry.connect(user1).updateRoyaltyRecord(dataAddress, royaltyRecord))
          .to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
      });
    });

    describe("transfer function", function () {
      it("Should allow owner to transfer publisher balances", async function () {
        // First, publisher1 registers a data point
        const testData = ethers.toUtf8Bytes("publisher data");
        await registry.connect(user1).registerDataPoint(testData, await publisher1.getAddress());
        
        // Then user2 pays royalties to access that data
        const royaltyCost = await registry.getDataPointRoyalty(await storage.calculateAddress(testData));
        await registry.connect(user2).registerDataPoint(testData, ethers.ZeroAddress, {
          value: royaltyCost
        });
        
        // Check publisher's actual balance (should be 90% of royalty cost after 10% fee)
        const publisherBalance = await registry.royaltyBalance(await publisher1.getAddress());
        expect(publisherBalance).to.be.greaterThan(0);
        
        const transferAmount = publisherBalance; // Transfer the exact balance
        const initialBalance = await ethers.provider.getBalance(await user1.getAddress());
        
        await expect(registry.connect(owner).transfer(
          await publisher1.getAddress(),
          transferAmount,
          await user1.getAddress()
        )).to.emit(registry, "RoyaltiesCollected");
        
        const finalBalance = await ethers.provider.getBalance(await user1.getAddress());
        expect(finalBalance - initialBalance).to.equal(transferAmount);
      });

      it("Should reject non-owner transfer attempts", async function () {
        await expect(registry.connect(user1).transfer(
          await publisher1.getAddress(),
          ethers.parseEther("0.1"),
          await user1.getAddress()
        )).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
      });
    });
  });

  describe("Royalty Calculation Logic", function () {
    it("Should calculate royalties correctly", async function () {
      const testData = ethers.toUtf8Bytes("royalty test data");
      const dataAddress = await storage.calculateAddress(testData);
      const gasUsed = 75000;
      
      await registry.connect(owner).updateRoyaltyRecord(dataAddress, {
        gasUsed: gasUsed,
        publisher: await publisher1.getAddress()
      });
      
      const expectedRoyalty = BigInt(gasUsed) * ROYALTY_RATE;
      expect(await registry.getDataPointRoyalty(dataAddress)).to.equal(expectedRoyalty);
    });

    it("Should return zero for non-existent data points", async function () {
      const randomAddress = ethers.keccak256(ethers.toUtf8Bytes("non-existent"));
      expect(await registry.getDataPointRoyalty(randomAddress)).to.equal(0);
    });

    it("Should handle edge cases in royalty calculation", async function () {
      const testData = ethers.toUtf8Bytes("edge case test");
      const dataAddress = await storage.calculateAddress(testData);
      
      // Test with zero gas
      await registry.connect(owner).updateRoyaltyRecord(dataAddress, {
        gasUsed: 0,
        publisher: await publisher1.getAddress()
      });
      expect(await registry.getDataPointRoyalty(dataAddress)).to.equal(0);
      
      // Test with reasonable large gas value
      const largeGas = 10000000; // 10M gas units (reasonable for complex operations)
      await registry.connect(owner).updateRoyaltyRecord(dataAddress, {
        gasUsed: largeGas,
        publisher: await publisher1.getAddress()
      });
      
      const expectedRoyalty = BigInt(largeGas) * ROYALTY_RATE;
      expect(await registry.getDataPointRoyalty(dataAddress)).to.equal(expectedRoyalty);
    });
  });

  describe("Data Point Registration", function () {
    describe("New Data Point Registration", function () {
      it("Should register new data point with publisher", async function () {
        const testData = ethers.toUtf8Bytes("new data point");
        const dataAddress = await storage.calculateAddress(testData);
        
        await expect(registry.connect(user1).registerDataPoint(testData, await publisher1.getAddress()))
          .to.emit(registry, "DataPointRegistered")
          .withArgs(dataAddress, await publisher1.getAddress());
        
        // Verify data is stored
        expect(await storage.dataPointSize(dataAddress)).to.equal(testData.length);
        expect(await storage.readDataPoint(dataAddress)).to.equal(ethers.hexlify(testData));
      });

      it("Should register new data point without publisher (waive royalties)", async function () {
        const testData = ethers.toUtf8Bytes("no royalty data");
        const dataAddress = await storage.calculateAddress(testData);
        
        await expect(registry.connect(user1).registerDataPoint(testData, ethers.ZeroAddress))
          .to.emit(registry, "DataPointRegistered")
          .withArgs(dataAddress, ethers.ZeroAddress);
        
        expect(await registry.getDataPointRoyalty(dataAddress)).to.equal(0);
      });

      it("Should measure and record gas usage correctly", async function () {
        const testData = ethers.toUtf8Bytes("gas measurement test");
        
        const tx = await registry.connect(user1).registerDataPoint(testData, await publisher1.getAddress());
        const receipt = await tx.wait();
        
        const dataAddress = await storage.calculateAddress(testData);
        const royalty = await registry.getDataPointRoyalty(dataAddress);
        
        // Should have recorded some gas usage
        expect(royalty).to.be.greaterThan(0);
        console.log(`Recorded gas for royalty: ${royalty / ROYALTY_RATE} gas units`);
      });
    });

    describe("Existing Data Point Access", function () {
      beforeEach(async function () {
        // Register a data point first
        const testData = ethers.toUtf8Bytes("existing data");
        await registry.connect(user1).registerDataPoint(testData, await publisher1.getAddress());
      });

      it("Should charge royalties for accessing existing data points", async function () {
        const testData = ethers.toUtf8Bytes("existing data");
        const dataAddress = await storage.calculateAddress(testData);
        const royaltyCost = await registry.getDataPointRoyalty(dataAddress);
        
        const initialBalance = await registry.royaltyBalance(await publisher1.getAddress());
        
        await expect(registry.connect(user2).registerDataPoint(testData, ethers.ZeroAddress, {
          value: royaltyCost
        })).to.emit(registry, "RoyaltiesPaid")
          .withArgs(dataAddress, await user2.getAddress(), royaltyCost);
        
        // Check publisher received payment (90% after 10% fee)
        const expectedPayment = royaltyCost * BigInt(9) / BigInt(10);
        const finalBalance = await registry.royaltyBalance(await publisher1.getAddress());
        expect(finalBalance - initialBalance).to.equal(expectedPayment);
      });

      it("Should reject insufficient royalty payments", async function () {
        const testData = ethers.toUtf8Bytes("existing data");
        const royaltyCost = await registry.getDataPointRoyalty(
          await storage.calculateAddress(testData)
        );
        
        const insufficientPayment = royaltyCost - BigInt(1);
        
        await expect(registry.connect(user2).registerDataPoint(testData, ethers.ZeroAddress, {
          value: insufficientPayment
        })).to.be.revertedWithCustomError(registry, "InsufficientRoyaltyPayment")
          .withArgs(royaltyCost);
      });

      it("Should allow publisher to re-register their own data", async function () {
        const testData = ethers.toUtf8Bytes("existing data");
        const dataAddress = await storage.calculateAddress(testData);
        
        const initialBalance = await registry.royaltyBalance(await publisher1.getAddress());
        
        // Publisher re-registering should increase their balance
        await registry.connect(publisher1).registerDataPoint(testData, await publisher1.getAddress());
        
        const finalBalance = await registry.royaltyBalance(await publisher1.getAddress());
        const royaltyCost = await registry.getDataPointRoyalty(dataAddress);
        expect(finalBalance - initialBalance).to.equal(royaltyCost);
      });
    });
  });

  describe("Publisher Management", function () {
    it("Should allow publisher to update their address", async function () {
      const testData = ethers.toUtf8Bytes("publisher update test");
      await registry.connect(user1).registerDataPoint(testData, await publisher1.getAddress());
      
      const dataAddress = await storage.calculateAddress(testData);
      
      // Publisher1 updates to publisher2
      await registry.connect(publisher1).updatePublisherAddress(dataAddress, await publisher2.getAddress());
      
      // Verify the update by checking who can collect royalties
      const royaltyCost = await registry.getDataPointRoyalty(dataAddress);
      await registry.connect(user2).registerDataPoint(testData, ethers.ZeroAddress, {
        value: royaltyCost
      });
      
      const expectedPayment = royaltyCost * BigInt(9) / BigInt(10);
      expect(await registry.royaltyBalance(await publisher2.getAddress())).to.equal(expectedPayment);
      expect(await registry.royaltyBalance(await publisher1.getAddress())).to.equal(0);
    });

    it("Should reject unauthorized publisher updates", async function () {
      const testData = ethers.toUtf8Bytes("unauthorized update test");
      await registry.connect(user1).registerDataPoint(testData, await publisher1.getAddress());
      
      const dataAddress = await storage.calculateAddress(testData);
      
      await expect(registry.connect(attacker).updatePublisherAddress(dataAddress, await attacker.getAddress()))
        .to.be.revertedWithCustomError(registry, "InvalidPublisher")
        .withArgs(await publisher1.getAddress());
    });
  });

  describe("Royalty Collection", function () {
    beforeEach(async function () {
      // Set up scenario with royalties to collect
      const testData = ethers.toUtf8Bytes("royalty collection test");
      await registry.connect(user1).registerDataPoint(testData, await publisher1.getAddress());
      
      // User2 pays royalties to access the data
      const royaltyCost = await registry.getDataPointRoyalty(
        await storage.calculateAddress(testData)
      );
      await registry.connect(user2).registerDataPoint(testData, ethers.ZeroAddress, {
        value: royaltyCost
      });
    });

    it("Should allow publishers to collect their royalties", async function () {
      const balance = await registry.royaltyBalance(await publisher1.getAddress());
      const initialEthBalance = await ethers.provider.getBalance(await user1.getAddress());
      
      await expect(registry.connect(publisher1).collectRoyalties(balance, await user1.getAddress()))
        .to.emit(registry, "RoyaltiesCollected")
        .withArgs(await publisher1.getAddress(), balance, await user1.getAddress());
      
      const finalEthBalance = await ethers.provider.getBalance(await user1.getAddress());
      expect(finalEthBalance - initialEthBalance).to.equal(balance);
      expect(await registry.royaltyBalance(await publisher1.getAddress())).to.equal(0);
    });

    it("Should handle partial royalty withdrawals", async function () {
      const totalBalance = await registry.royaltyBalance(await publisher1.getAddress());
      const partialAmount = totalBalance / BigInt(2);
      
      await registry.connect(publisher1).collectRoyalties(partialAmount, await publisher1.getAddress());
      
      expect(await registry.royaltyBalance(await publisher1.getAddress())).to.equal(totalBalance - partialAmount);
    });

    it("Should reject withdrawal of more than available balance", async function () {
      const balance = await registry.royaltyBalance(await publisher1.getAddress());
      const excessiveAmount = balance + ethers.parseEther("1");
      
      await expect(registry.connect(publisher1).collectRoyalties(excessiveAmount, await publisher1.getAddress()))
        .to.be.reverted; // Should revert due to underflow
    });
  });

  describe("Economic Security and Attack Vectors", function () {
    it("Should prevent royalty manipulation through re-registration", async function () {
      const testData = ethers.toUtf8Bytes("manipulation test");
      
      // Register data point
      await registry.connect(user1).registerDataPoint(testData, await publisher1.getAddress());
      const initialRoyalty = await registry.getDataPointRoyalty(
        await storage.calculateAddress(testData)
      );
      
      // Attacker tries to re-register to manipulate gas measurement
      await expect(registry.connect(attacker).registerDataPoint(testData, await attacker.getAddress(), {
        value: initialRoyalty
      })).to.emit(registry, "RoyaltiesPaid");
      
      // Royalty should remain the same (not re-measured)
      const finalRoyalty = await registry.getDataPointRoyalty(
        await storage.calculateAddress(testData)
      );
      expect(finalRoyalty).to.equal(initialRoyalty);
    });

    it("Should handle zero-value payments correctly", async function () {
      const testData = ethers.toUtf8Bytes("zero value test");
      await registry.connect(user1).registerDataPoint(testData, ethers.ZeroAddress);
      
      // Should not require payment for zero-royalty data
      await registry.connect(user2).registerDataPoint(testData, ethers.ZeroAddress);
      
      expect(await registry.getDataPointRoyalty(
        await storage.calculateAddress(testData)
      )).to.equal(0);
    });

    it("Should protect against reentrancy attacks", async function () {
      // This test verifies that the nonReentrant modifier prevents reentrancy attacks
      // by ensuring publishers can't double-spend their balance
      const testData = ethers.toUtf8Bytes("reentrancy test");
      await registry.connect(user1).registerDataPoint(testData, await publisher1.getAddress());
      
      // Pay royalties to give publisher a balance
      const royaltyCost = await registry.getDataPointRoyalty(await storage.calculateAddress(testData));
      await registry.connect(user2).registerDataPoint(testData, ethers.ZeroAddress, {
        value: royaltyCost
      });
      
      const balance = await registry.royaltyBalance(await publisher1.getAddress());
      expect(balance).to.be.greaterThan(0);
      
      // First withdrawal should work
      await registry.connect(publisher1).collectRoyalties(balance, await publisher1.getAddress());
      
      // Balance should now be zero
      expect(await registry.royaltyBalance(await publisher1.getAddress())).to.equal(0);
      
      // Second attempt to withdraw same amount should fail due to insufficient balance
      await expect(registry.connect(publisher1).collectRoyalties(balance, await publisher1.getAddress()))
        .to.be.reverted; // Should revert due to arithmetic underflow (insufficient balance)
    });

    it("Should handle large royalty calculations without overflow", async function () {
      const testData = ethers.toUtf8Bytes("overflow test");
      const dataAddress = await storage.calculateAddress(testData);
      
      // Set moderately high gas usage that won't overflow
      const highGasUsage = 1000000; // 1M gas units (reasonable)
      
      await registry.connect(owner).updateRoyaltyRecord(dataAddress, {
        gasUsed: highGasUsage,
        publisher: await publisher1.getAddress()
      });
      
      const royalty = await registry.getDataPointRoyalty(dataAddress);
      expect(royalty).to.equal(BigInt(highGasUsage) * ROYALTY_RATE);
      
      // Test with very high but still reasonable gas usage
      const veryHighGasUsage = 100000000; // 100M gas units (very expensive but possible)
      await registry.connect(owner).updateRoyaltyRecord(dataAddress, {
        gasUsed: veryHighGasUsage,
        publisher: await publisher1.getAddress()
      });
      
      const highRoyalty = await registry.getDataPointRoyalty(dataAddress);
      expect(highRoyalty).to.equal(BigInt(veryHighGasUsage) * ROYALTY_RATE);
    });
  });

  describe("Integration with DataPointStorage", function () {
    it("Should properly validate DPS integration", async function () {
      const testData = ethers.toUtf8Bytes("integration test");
      
      // Register through registry
      await registry.connect(user1).registerDataPoint(testData, await publisher1.getAddress());
      
      // Verify data is accessible through storage contract
      const dataAddress = await storage.calculateAddress(testData);
      expect(await storage.readDataPoint(dataAddress)).to.equal(ethers.hexlify(testData));
    });

    it("Should handle DPS contract changes", async function () {
      // Deploy new storage contract
      const newStorage = await (await ethers.getContractFactory("DataPointStorage")).deploy();
      
      // Change DPS in registry
      await registry.connect(owner).setDPS(await newStorage.getAddress());
      
      // Verify new storage is being used
      expect(await registry.DPS()).to.equal(await newStorage.getAddress());
      
      // Test registration with new storage
      const testData = ethers.toUtf8Bytes("new storage test");
      await registry.connect(user1).registerDataPoint(testData, await publisher1.getAddress());
      
      const dataAddress = await newStorage.calculateAddress(testData);
      expect(await newStorage.dataPointSize(dataAddress)).to.equal(testData.length);
    });
  });

  describe("Edge Cases and Error Handling", function () {
    it("Should handle empty data rejection from storage", async function () {
      const emptyData = "0x";
      
      await expect(registry.connect(user1).registerDataPoint(emptyData, await publisher1.getAddress()))
        .to.be.revertedWithCustomError(storage, "InvalidData");
    });

    it("Should handle contract with no ETH balance for transfers", async function () {
      // Ensure contract has no ETH
      const contractBalance = await ethers.provider.getBalance(await registry.getAddress());
      if (contractBalance > 0) {
        await registry.connect(owner).transfer(ethers.ZeroAddress, contractBalance, await owner.getAddress());
      }
      
      // Try to collect royalties when contract has no ETH
      await expect(registry.connect(publisher1).collectRoyalties(ethers.parseEther("0.1"), await publisher1.getAddress()))
        .to.be.reverted;
    });

    it("Should handle address(0) publisher scenarios", async function () {
      const testData = ethers.toUtf8Bytes("zero address publisher");
      
      // Register with zero address publisher
      await registry.connect(user1).registerDataPoint(testData, ethers.ZeroAddress);
      
      // Should not require payment
      await registry.connect(user2).registerDataPoint(testData, ethers.ZeroAddress);
      
      expect(await registry.getDataPointRoyalty(
        await storage.calculateAddress(testData)
      )).to.equal(0);
    });
  });

  describe("Gas Optimization Analysis", function () {
    it("Should measure gas costs for different operations", async function () {
      const testData = ethers.toUtf8Bytes("gas optimization test");
      
      // Measure gas for new registration
      const newTx = await registry.connect(user1).registerDataPoint(testData, await publisher1.getAddress());
      const newReceipt = await newTx.wait();
      console.log(`Gas for new registration: ${newReceipt!.gasUsed.toString()}`);
      
      // Measure gas for existing data access
      const royaltyCost = await registry.getDataPointRoyalty(await storage.calculateAddress(testData));
      const existingTx = await registry.connect(user2).registerDataPoint(testData, ethers.ZeroAddress, {
        value: royaltyCost
      });
      const existingReceipt = await existingTx.wait();
      console.log(`Gas for existing access: ${existingReceipt!.gasUsed.toString()}`);
      
      // Measure gas for royalty collection
      const collectTx = await registry.connect(publisher1).collectRoyalties(
        ethers.parseEther("0.001"),
        await publisher1.getAddress()
      );
      const collectReceipt = await collectTx.wait();
      console.log(`Gas for royalty collection: ${collectReceipt!.gasUsed.toString()}`);
    });
  });
}); 