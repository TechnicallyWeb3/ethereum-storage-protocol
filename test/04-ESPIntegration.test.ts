import { expect } from "chai";
import { ethers } from "hardhat";
import { DataPointRegistry, DataPointStorage } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Ethereum Storage Protocol - Full System Integration Audit", function () {
  let registry: DataPointRegistry;
  let storage: DataPointStorage;
  let owner: HardhatEthersSigner;
  let publisher1: HardhatEthersSigner;
  let publisher2: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let user3: HardhatEthersSigner;
  
  const ROYALTY_RATE = ethers.parseEther("0.001"); // 0.001 ETH per gas unit
  
  beforeEach(async function () {
    [owner, publisher1, publisher2, user1, user2, user3] = await ethers.getSigners();
    // console.log("owner", await owner.getAddress());
    // console.log("publisher1", await publisher1.getAddress());
    // console.log("publisher2", await publisher2.getAddress());
    // console.log("user1", await user1.getAddress());
    // console.log("user2", await user2.getAddress());
    // console.log("user3", await user3.getAddress());
    
    // Deploy complete system
    const StorageFactory = await ethers.getContractFactory("DataPointStorage");
    storage = await StorageFactory.deploy();
    
    const RegistryFactory = await ethers.getContractFactory("DataPointRegistry");
    registry = await RegistryFactory.deploy(
      await owner.getAddress(),
      await storage.getAddress(),
      ROYALTY_RATE
    );
  });

  describe("System Architecture Validation", function () {
    it("Should have correct contract relationships", async function () {
      // Verify registry points to correct storage
      expect(await registry.DPS()).to.equal(await storage.getAddress());
      
      // Verify storage is independent
      expect(await storage.VERSION()).to.equal(2);
      
      // Verify registry has correct owner
      expect(await registry.owner()).to.equal(await owner.getAddress());
    });

    it("Should maintain interface compatibility", async function () {
      const testData = ethers.toUtf8Bytes("interface test");
      
      // Storage interface compatibility
      const storageAddress = await storage.calculateAddress(testData);
      expect(storageAddress).to.be.properHex(64);
      
      // Registry interface compatibility  
      const registryAddress = await registry.registerDataPoint.staticCall(testData, await publisher1.getAddress());
      expect(registryAddress).to.equal(storageAddress);
    });
  });

  describe("End-to-End Data Lifecycle", function () {
    it("Should handle complete data publication workflow", async function () {
      const testData = ethers.toUtf8Bytes("Complete workflow test data");
      
      // 1. Publisher registers new data
      const tx1 = await registry.connect(publisher1).registerDataPoint(testData, await publisher1.getAddress());
      const receipt1 = await tx1.wait();
      const dataAddress = await storage.calculateAddress(testData);
      
      // Verify data is stored
      expect(await storage.dataPointSize(dataAddress)).to.equal(testData.length);
      expect(await storage.readDataPoint(dataAddress)).to.equal(ethers.hexlify(testData));
      
      // Verify royalty record created
      const royalty = await registry.getDataPointRoyalty(dataAddress);
      expect(royalty).to.be.greaterThan(0);
      
      // 2. User accesses existing data (pays royalties)
      const royaltyCost = await registry.getDataPointRoyalty(dataAddress);
      const initialPublisherBalance = await registry.royaltyBalance(await publisher1.getAddress());
      
      await registry.connect(user1).registerDataPoint(testData, ethers.ZeroAddress, {
        value: royaltyCost
      });
      
      // Verify publisher received payment (90% after 10% fee)
      const expectedPayment = royaltyCost * BigInt(9) / BigInt(10);
      const finalPublisherBalance = await registry.royaltyBalance(await publisher1.getAddress());
      expect(finalPublisherBalance - initialPublisherBalance).to.equal(expectedPayment);
      
      // 3. Publisher collects royalties
      await registry.connect(publisher1).collectRoyalties(expectedPayment, await publisher1.getAddress());
      expect(await registry.royaltyBalance(await publisher1.getAddress())).to.equal(0);
      
      console.log(`Complete workflow gas: Registration=${receipt1!.gasUsed}, Access=${royaltyCost / ROYALTY_RATE} gas units`);
    });

    it("Should handle multiple publishers and data points", async function () {
      const data1 = ethers.toUtf8Bytes("Publisher 1 data");
      const data2 = ethers.toUtf8Bytes("Publisher 2 data");
      const data3 = ethers.toUtf8Bytes("Shared access data");
      
      // Multiple publishers register different data
      await registry.connect(publisher1).registerDataPoint(data1, await publisher1.getAddress());
      await registry.connect(publisher2).registerDataPoint(data2, await publisher2.getAddress());
      await registry.connect(user1).registerDataPoint(data3, await publisher1.getAddress());
      
      // Verify all data is accessible
      expect(await storage.dataPointSize(await storage.calculateAddress(data1))).to.equal(data1.length);
      expect(await storage.dataPointSize(await storage.calculateAddress(data2))).to.equal(data2.length);
      expect(await storage.dataPointSize(await storage.calculateAddress(data3))).to.equal(data3.length);
      
      // Cross-access: users pay royalties to different publishers
      const royalty1 = await registry.getDataPointRoyalty(await storage.calculateAddress(data1));
      const royalty2 = await registry.getDataPointRoyalty(await storage.calculateAddress(data2));
      
      await registry.connect(user2).registerDataPoint(data1, ethers.ZeroAddress, { value: royalty1 });
      await registry.connect(user3).registerDataPoint(data2, ethers.ZeroAddress, { value: royalty2 });
      
      // Verify both publishers have balances
      expect(await registry.royaltyBalance(await publisher1.getAddress())).to.be.greaterThan(0);
      expect(await registry.royaltyBalance(await publisher2.getAddress())).to.be.greaterThan(0);
    });
  });

  describe("Cross-Contract Security", function () {
    it("Should prevent unauthorized storage access through registry", async function () {
      const testData = ethers.toUtf8Bytes("Security test data");
      
      // Register data through registry
      await registry.connect(publisher1).registerDataPoint(testData, await publisher1.getAddress());
      
      // Direct storage access should still work (storage is permissionless)
      const dataAddress = await storage.calculateAddress(testData);
      expect(await storage.readDataPoint(dataAddress)).to.equal(ethers.hexlify(testData));
      
      // But duplicate writes should fail
      await expect(storage.connect(user1).writeDataPoint(testData))
        .to.be.revertedWithCustomError(storage, "DataExists");
    });

    it("Should handle registry upgrade scenarios", async function () {
      const testData = ethers.toUtf8Bytes("Upgrade test data");
      
      // Register data with current registry
      await registry.connect(publisher1).registerDataPoint(testData, await publisher1.getAddress());
      
      // Deploy new registry pointing to same storage
      const NewRegistryFactory = await ethers.getContractFactory("DataPointRegistry");
      const newRegistry = await NewRegistryFactory.deploy(
        await owner.getAddress(),
        await storage.getAddress(),
        ROYALTY_RATE * BigInt(2) // Different royalty rate
      );
      
      // Data should still be accessible through new registry
      const dataAddress = await storage.calculateAddress(testData);
      expect(await storage.readDataPoint(dataAddress)).to.equal(ethers.hexlify(testData));
      
      // But royalty calculation would be different (no royalty record in new registry)
      expect(await newRegistry.getDataPointRoyalty(dataAddress)).to.equal(0);
    });

    it("Should maintain data integrity across system interactions", async function () {
      const originalData = ethers.toUtf8Bytes("Data integrity test - original content");
      const modifiedData = ethers.toUtf8Bytes("Data integrity test - modified content");
      
      // Register original data
      await registry.connect(publisher1).registerDataPoint(originalData, await publisher1.getAddress());
      const originalAddress = await storage.calculateAddress(originalData);
      
      // Attempt to register modified data (should get different address)
      await registry.connect(publisher2).registerDataPoint(modifiedData, await publisher2.getAddress());
      const modifiedAddress = await storage.calculateAddress(modifiedData);
      
      // Verify addresses are different
      expect(originalAddress).to.not.equal(modifiedAddress);
      
      // Verify both data points exist independently
      expect(await storage.readDataPoint(originalAddress)).to.equal(ethers.hexlify(originalData));
      expect(await storage.readDataPoint(modifiedAddress)).to.equal(ethers.hexlify(modifiedData));
      
      // Verify royalties are tracked separately
      expect(await registry.getDataPointRoyalty(originalAddress)).to.be.greaterThan(0);
      expect(await registry.getDataPointRoyalty(modifiedAddress)).to.be.greaterThan(0);
    });
  });

  describe("Economic Model Integration", function () {
    it("Should handle complex royalty scenarios", async function () {
      const data = ethers.toUtf8Bytes("Complex royalty test");
      
      // Publisher registers data
      await registry.connect(publisher1).registerDataPoint(data, await publisher1.getAddress());
      const dataAddress = await storage.calculateAddress(data);
      const royaltyCost = await registry.getDataPointRoyalty(dataAddress);
      
      // Multiple users access the data
      const numUsers = 5;
      for (let i = 0; i < numUsers; i++) {
        const user = [user1, user2, user3, publisher2, owner][i];
        await registry.connect(user).registerDataPoint(data, ethers.ZeroAddress, {
          value: royaltyCost
        });
      }
      
      // Calculate expected publisher earnings (90% of each payment)
      const expectedEarnings = (royaltyCost * BigInt(9) / BigInt(10)) * BigInt(numUsers);
      const actualBalance = await registry.royaltyBalance(await publisher1.getAddress());
      expect(actualBalance).to.equal(expectedEarnings);
      
      // Calculate expected owner earnings (10% of each payment)
      const expectedOwnerEarnings = (royaltyCost / BigInt(10)) * BigInt(numUsers);
      const ownerBalance = await registry.royaltyBalance(await owner.getAddress());
      expect(ownerBalance).to.equal(expectedOwnerEarnings);
    });

    it("Should handle publisher address changes", async function () {
      const data = ethers.toUtf8Bytes("Publisher change test");
      
      // Original publisher registers data
      await registry.connect(publisher1).registerDataPoint(data, await publisher1.getAddress());
      const dataAddress = await storage.calculateAddress(data);
      
      // Publisher changes their address
      await registry.connect(publisher1).updatePublisherAddress(dataAddress, await publisher2.getAddress());
      
      // User pays royalties
      const royaltyCost = await registry.getDataPointRoyalty(dataAddress);
      await registry.connect(user1).registerDataPoint(data, ethers.ZeroAddress, {
        value: royaltyCost
      });
      
      // New publisher address should receive the payment
      const expectedPayment = royaltyCost * BigInt(9) / BigInt(10);
      expect(await registry.royaltyBalance(await publisher2.getAddress())).to.equal(expectedPayment);
      expect(await registry.royaltyBalance(await publisher1.getAddress())).to.equal(0);
    });
  });

  describe("System Limits and Performance", function () {
    it("Should handle large data efficiently", async function () {
      // Test with 10KB data
      const largeData = new Uint8Array(10000);
      for (let i = 0; i < largeData.length; i++) {
        largeData[i] = i % 256;
      }
      
      const tx = await registry.connect(publisher1).registerDataPoint(largeData, await publisher1.getAddress());
      const receipt = await tx.wait();
      
      const dataAddress = await storage.calculateAddress(largeData);
      expect(await storage.dataPointSize(dataAddress)).to.equal(largeData.length);
      
      console.log(`Large data (10KB) registration gas: ${receipt!.gasUsed}`);
    });

    it("Should handle many small data points", async function () {
      const numDataPoints = 10;
      const gasUsed: bigint[] = [];
      
      for (let i = 0; i < numDataPoints; i++) {
        const data = ethers.toUtf8Bytes(`Small data point ${i}`);
        const tx = await registry.connect(publisher1).registerDataPoint(data, await publisher1.getAddress());
        const receipt = await tx.wait();
        gasUsed.push(receipt!.gasUsed);
      }
      
      // Gas usage should be relatively consistent
      const avgGas = gasUsed.reduce((a, b) => a + b, 0n) / BigInt(numDataPoints);
      console.log(`Average gas for small data points: ${avgGas}`);
      
      // Verify all data points are accessible
      for (let i = 0; i < numDataPoints; i++) {
        const data = ethers.toUtf8Bytes(`Small data point ${i}`);
        const dataAddress = await storage.calculateAddress(data);
        expect(await storage.dataPointSize(dataAddress)).to.equal(data.length);
      }
    });
  });

  describe("Error Handling and Edge Cases", function () {
    it("Should handle system-wide error scenarios", async function () {
      // Test empty data rejection
      await expect(registry.connect(user1).registerDataPoint("0x", await publisher1.getAddress()))
        .to.be.revertedWithCustomError(storage, "InvalidData");
      
      // Test insufficient payment
      const data = ethers.toUtf8Bytes("Payment test");
      await registry.connect(publisher1).registerDataPoint(data, await publisher1.getAddress());
      
      const royaltyCost = await registry.getDataPointRoyalty(await storage.calculateAddress(data));
      await expect(registry.connect(user1).registerDataPoint(data, ethers.ZeroAddress, {
        value: royaltyCost - 1n
      })).to.be.revertedWithCustomError(registry, "InsufficientRoyaltyPayment");
    });

    it("Should handle zero-royalty scenarios", async function () {
      const data = ethers.toUtf8Bytes("Zero royalty test");
      
      // Register with zero address publisher (no royalties)
      await registry.connect(user1).registerDataPoint(data, ethers.ZeroAddress);
      
      const dataAddress = await storage.calculateAddress(data);
      expect(await registry.getDataPointRoyalty(dataAddress)).to.equal(0);
      
      // Anyone should be able to access without payment
      await registry.connect(user2).registerDataPoint(data, ethers.ZeroAddress);
      await registry.connect(user3).registerDataPoint(data, await publisher1.getAddress());
    });
  });

  describe("Gas Optimization Analysis", function () {
    it("Should provide comprehensive gas analysis", async function () {
      const testData = ethers.toUtf8Bytes("Gas analysis test data");
      
      // New registration
      const newTx = await registry.connect(publisher1).registerDataPoint(testData, await publisher1.getAddress());
      const newReceipt = await newTx.wait();
      
      // Existing access
      const royaltyCost = await registry.getDataPointRoyalty(await storage.calculateAddress(testData));
      const accessTx = await registry.connect(user1).registerDataPoint(testData, ethers.ZeroAddress, {
        value: royaltyCost
      });
      const accessReceipt = await accessTx.wait();
      
      // Royalty collection
      const balance = await registry.royaltyBalance(await publisher1.getAddress());
      const collectTx = await registry.connect(publisher1).collectRoyalties(balance, await publisher1.getAddress());
      const collectReceipt = await collectTx.wait();
      
      console.log("=== SYSTEM GAS ANALYSIS ===");
      console.log(`New data registration: ${newReceipt!.gasUsed} gas`);
      console.log(`Existing data access: ${accessReceipt!.gasUsed} gas`);
      console.log(`Royalty collection: ${collectReceipt!.gasUsed} gas`);
      console.log(`Storage write cost: ${royaltyCost / ROYALTY_RATE} gas units`);
      console.log(`Contract sizes: Storage=${await storage.getAddress()}, Registry=${await registry.getAddress()}`);
    });
  });
}); 