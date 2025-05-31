import { expect } from "chai";
import { ethers } from "hardhat";
import { DataPointStorage } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("DataPointStorage Security Audit", function () {
  let dataPointStorage: DataPointStorage;
  let attacker: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  
  beforeEach(async function () {
    [attacker, user1, user2] = await ethers.getSigners();
    const DataPointStorageFactory = await ethers.getContractFactory("DataPointStorage");
    dataPointStorage = await DataPointStorageFactory.deploy();
  });

  describe("Hash Collision Attacks", function () {
    it("Should handle potential hash collisions gracefully", async function () {
      // While finding actual SHA3 collisions is computationally infeasible,
      // we can test the contract's behavior with similar-looking data
      const data1 = ethers.toUtf8Bytes("collision_test_1");
      const data2 = ethers.toUtf8Bytes("collision_test_2");
      
      const addr1 = await dataPointStorage.calculateAddress(data1);
      const addr2 = await dataPointStorage.calculateAddress(data2);
      
      // These should be different (extremely high probability)
      expect(addr1).to.not.equal(addr2);
      
      // Both should be storable
      await dataPointStorage.writeDataPoint(data1);
      await dataPointStorage.writeDataPoint(data2);
      
      // Verify both are stored correctly
      const retrieved1 = await dataPointStorage.readDataPoint(addr1);
      const retrieved2 = await dataPointStorage.readDataPoint(addr2);
      
      expect(ethers.toUtf8String(retrieved1)).to.equal("collision_test_1");
      expect(ethers.toUtf8String(retrieved2)).to.equal("collision_test_2");
    });

    it("Should detect actual duplicates correctly", async function () {
      const data = ethers.toUtf8Bytes("duplicate_test");
      const address = await dataPointStorage.calculateAddress(data);
      
      // First write succeeds
      await dataPointStorage.writeDataPoint(data);
      
      // Second write with identical data should fail
      await expect(dataPointStorage.writeDataPoint(data))
        .to.be.revertedWithCustomError(dataPointStorage, "DataExists")
        .withArgs(address);
    });
  });

  describe("Data Manipulation Attacks", function () {
    it("Should prevent data replacement attacks", async function () {
      const originalData = ethers.toUtf8Bytes("original data");
      const maliciousData = ethers.toUtf8Bytes("malicious data");
      
      // Store original data
      await dataPointStorage.connect(user1).writeDataPoint(originalData);
      const address = await dataPointStorage.calculateAddress(originalData);
      
      // Attacker tries to overwrite with different data having same address
      // This should fail because the address is already occupied
      await expect(dataPointStorage.connect(attacker).writeDataPoint(originalData))
        .to.be.revertedWithCustomError(dataPointStorage, "DataExists")
        .withArgs(address);
      
      // Verify original data is intact
      const retrievedData = await dataPointStorage.readDataPoint(address);
      expect(ethers.toUtf8String(retrievedData)).to.equal("original data");
    });

    it("Should handle concurrent writes from different users", async function () {
      const data1 = ethers.toUtf8Bytes("user1_data");
      const data2 = ethers.toUtf8Bytes("user2_data");
      
      // Both users write different data simultaneously (in same block)
      const tx1 = dataPointStorage.connect(user1).writeDataPoint(data1);
      const tx2 = dataPointStorage.connect(user2).writeDataPoint(data2);
      
      // Both should succeed since they have different addresses
      await Promise.all([tx1, tx2]);
      
      // Verify both are stored correctly
      const addr1 = await dataPointStorage.calculateAddress(data1);
      const addr2 = await dataPointStorage.calculateAddress(data2);
      
      const retrieved1 = await dataPointStorage.readDataPoint(addr1);
      const retrieved2 = await dataPointStorage.readDataPoint(addr2);
      
      expect(ethers.toUtf8String(retrieved1)).to.equal("user1_data");
      expect(ethers.toUtf8String(retrieved2)).to.equal("user2_data");
    });
  });

  describe("Resource Exhaustion Attacks", function () {
    it("Should handle storage of many small data points", async function () {
      const numDataPoints = 50; // Reasonable number for testing
      
      for (let i = 0; i < numDataPoints; i++) {
        const data = ethers.toUtf8Bytes(`data_point_${i}`);
        await dataPointStorage.writeDataPoint(data);
      }
      
      // Verify all data points are stored correctly
      for (let i = 0; i < numDataPoints; i++) {
        const data = ethers.toUtf8Bytes(`data_point_${i}`);
        const address = await dataPointStorage.calculateAddress(data);
        const retrieved = await dataPointStorage.readDataPoint(address);
        expect(ethers.toUtf8String(retrieved)).to.equal(`data_point_${i}`);
      }
    });

    it("Should estimate gas costs for large data storage", async function () {
      const sizes = [1000, 5000, 10000];
      
      for (const size of sizes) {
        const largeData = ethers.toUtf8Bytes("x".repeat(size));
        const gasEstimate = await dataPointStorage.writeDataPoint.estimateGas(largeData);
        
        console.log(`Gas estimate for ${size} bytes: ${gasEstimate.toString()}`);
        
        // Ensure gas estimate is reasonable (not hitting block gas limit)
        expect(gasEstimate).to.be.greaterThan(0);
        expect(gasEstimate).to.be.lessThan(15000000); // Typical block gas limit
      }
    });
  });

  describe("Input Validation and Edge Cases", function () {
    it("Should reject empty data", async function () {
      const emptyData = "0x";
      
      // Should reject empty data
      await expect(dataPointStorage.writeDataPoint(emptyData))
        .to.be.revertedWithCustomError(dataPointStorage, "InvalidData");
    });

    it("Should handle maximum uint8 version in standalone function", async function () {
      const data = ethers.toUtf8Bytes("max version test");
      
      // Test with maximum uint8 value (255)
      const address = ethers.keccak256(
        ethers.concat([data, ethers.toBeArray(255)])
      );
      
      expect(address).to.be.properHex(64);
    });

    it("Should handle special byte sequences", async function () {
      // Test with various special byte sequences
      const specialSequences = [
        new Uint8Array([0x00, 0x01, 0x02, 0x03]),
        new Uint8Array([0xFF, 0xFE, 0xFD, 0xFC]),
        new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF]),
        new Uint8Array([0x00]), // Single null byte
        new Uint8Array([0xFF]), // Single max byte
      ];
      
      for (let i = 0; i < specialSequences.length; i++) {
        const data = specialSequences[i];
        await dataPointStorage.writeDataPoint(data);
        
        const address = await dataPointStorage.calculateAddress(data);
        const retrieved = await dataPointStorage.readDataPoint(address);
        
        expect(retrieved).to.equal(ethers.hexlify(data));
      }
    });
  });

  describe("State Consistency Attacks", function () {
    it("Should maintain consistency across view and state-changing functions", async function () {
      const data = ethers.toUtf8Bytes("consistency test");
      
      // Calculate address before storing
      const expectedAddress = await dataPointStorage.calculateAddress(data);
      
      // Store the data
      const tx = await dataPointStorage.writeDataPoint(data);
      const receipt = await tx.wait();
      
      // Extract emitted event
      const event = receipt!.logs.find(
        log => log.topics[0] === dataPointStorage.interface.getEvent("DataPointWritten").topicHash
      );
      const decodedEvent = dataPointStorage.interface.parseLog(event!);
      const emittedAddress = decodedEvent!.args.dataPointAddress;
      
      // All addresses should match
      expect(emittedAddress).to.equal(expectedAddress);
      
      // Verify data can be read back correctly
      const retrieved = await dataPointStorage.readDataPoint(expectedAddress);
      expect(ethers.toUtf8String(retrieved)).to.equal("consistency test");
    });

    it("Should handle rapid sequential writes correctly", async function () {
      const dataPoints = [
        ethers.toUtf8Bytes("rapid_1"),
        ethers.toUtf8Bytes("rapid_2"),
        ethers.toUtf8Bytes("rapid_3"),
        ethers.toUtf8Bytes("rapid_4"),
        ethers.toUtf8Bytes("rapid_5")
      ];
      
      // Write all data points in rapid succession
      const promises = dataPoints.map(data => 
        dataPointStorage.writeDataPoint(data)
      );
      
      await Promise.all(promises);
      
      // Verify all are stored correctly
      for (let i = 0; i < dataPoints.length; i++) {
        const address = await dataPointStorage.calculateAddress(dataPoints[i]);
        const retrieved = await dataPointStorage.readDataPoint(address);
        expect(ethers.toUtf8String(retrieved)).to.equal(`rapid_${i + 1}`);
      }
    });
  });

  describe("Access Control and Permission Tests", function () {
    it("Should allow any address to write unique data", async function () {
      // Multiple users should be able to write different data
      const userData = [
        { user: user1, data: ethers.toUtf8Bytes("user1_unique_data") },
        { user: user2, data: ethers.toUtf8Bytes("user2_unique_data") },
        { user: attacker, data: ethers.toUtf8Bytes("attacker_unique_data") }
      ];
      
      for (const { user, data } of userData) {
        await dataPointStorage.connect(user).writeDataPoint(data);
        
        const address = await dataPointStorage.calculateAddress(data);
        const retrieved = await dataPointStorage.readDataPoint(address);
        expect(retrieved).to.equal(ethers.hexlify(data));
      }
    });

    it("Should prevent any user from overwriting existing data", async function () {
      const data = ethers.toUtf8Bytes("protected data");
      
      // User1 writes data
      await dataPointStorage.connect(user1).writeDataPoint(data);
      const address = await dataPointStorage.calculateAddress(data);
      
      // User2 and attacker try to overwrite
      await expect(dataPointStorage.connect(user2).writeDataPoint(data))
        .to.be.revertedWithCustomError(dataPointStorage, "DataExists")
        .withArgs(address);
        
      await expect(dataPointStorage.connect(attacker).writeDataPoint(data))
        .to.be.revertedWithCustomError(dataPointStorage, "DataExists")
        .withArgs(address);
    });
  });

  describe("Contract Invariants", function () {
    it("Should maintain that stored data always matches calculated address", async function () {
      const testData = [
        ethers.toUtf8Bytes("invariant_test_1"),
        ethers.toUtf8Bytes("invariant_test_2"),
        new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05])
      ];
      
      for (const data of testData) {
        await dataPointStorage.writeDataPoint(data);
        
        const calculatedAddress = await dataPointStorage.calculateAddress(data);
        const storedData = await dataPointStorage.readDataPoint(calculatedAddress);
        const size = await dataPointStorage.dataPointSize(calculatedAddress);
        
        // Invariants that must always hold:
        expect(storedData).to.equal(ethers.hexlify(data)); // Data integrity
        expect(size).to.equal(data.length); // Size consistency
        expect(size).to.equal(ethers.getBytes(storedData).length); // Size matches actual data
      }
    });

    it("Should maintain that non-existent addresses return empty data", async function () {
      const nonExistentAddresses = [
        ethers.keccak256(ethers.toUtf8Bytes("non_existent_1")),
        ethers.keccak256(ethers.toUtf8Bytes("non_existent_2")),
        ethers.ZeroHash,
        "0x1234567890123456789012345678901234567890123456789012345678901234"
      ];
      
      for (const address of nonExistentAddresses) {
        const data = await dataPointStorage.readDataPoint(address);
        const size = await dataPointStorage.dataPointSize(address);
        
        expect(data).to.equal("0x");
        expect(size).to.equal(0);
      }
    });
  });
}); 