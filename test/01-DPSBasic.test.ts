import { expect } from "chai";
import { ethers } from "hardhat";
import { DataPointStorage, TestHelpers } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("DataPointStorage Contract Audit", function () {
  let dataPointStorage: DataPointStorage;
  let owner: HardhatEthersSigner;
  let addr1: HardhatEthersSigner;
  let addr2: HardhatEthersSigner;
  
  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    const DataPointStorageFactory = await ethers.getContractFactory("DataPointStorage");
    dataPointStorage = await DataPointStorageFactory.deploy();
  });

  describe("Contract Deployment", function () {
    it("Should deploy with correct VERSION", async function () {
      expect(await dataPointStorage.VERSION()).to.equal(2);
    });

    it("Should have correct contract interface", async function () {
      expect(dataPointStorage.calculateAddress).to.be.a("function");
      expect(dataPointStorage.writeDataPoint).to.be.a("function");
      expect(dataPointStorage.readDataPoint).to.be.a("function");
      expect(dataPointStorage.dataPointSize).to.be.a("function");
    });
  });

  describe("Address Calculation", function () {
    it("Should calculate consistent addresses for same data", async function () {
      const data = ethers.toUtf8Bytes("test data");
      const address1 = await dataPointStorage.calculateAddress(data);
      const address2 = await dataPointStorage.calculateAddress(data);
      expect(address1).to.equal(address2);
    });

    it("Should calculate different addresses for different data", async function () {
      const data1 = ethers.toUtf8Bytes("test data 1");
      const data2 = ethers.toUtf8Bytes("test data 2");
      const address1 = await dataPointStorage.calculateAddress(data1);
      const address2 = await dataPointStorage.calculateAddress(data2);
      expect(address1).to.not.equal(address2);
    });

    it("Should calculate different addresses for same data with different case", async function () {
      const data1 = ethers.toUtf8Bytes("Test Data");
      const data2 = ethers.toUtf8Bytes("test data");
      const address1 = await dataPointStorage.calculateAddress(data1);
      const address2 = await dataPointStorage.calculateAddress(data2);
      expect(address1).to.not.equal(address2);
    });

    it("Should handle empty data", async function () {
      const emptyData = "0x";
      const address = await dataPointStorage.calculateAddress(emptyData);
      expect(address).to.be.properHex(64);
    });

    it("Should handle large data", async function () {
      const largeData = ethers.toUtf8Bytes("x".repeat(10000));
      const address = await dataPointStorage.calculateAddress(largeData);
      expect(address).to.be.properHex(64);
    });
  });

  describe("Data Point Writing", function () {
    it("Should successfully write a data point", async function () {
      const data = ethers.toUtf8Bytes("test data");
      const tx = await dataPointStorage.writeDataPoint(data);
      const receipt = await tx.wait();
      
      expect(receipt).to.not.be.null;
      expect(receipt!.status).to.equal(1);
    });

    it("Should emit DataPointWritten event", async function () {
      const data = ethers.toUtf8Bytes("test data");
      const expectedAddress = await dataPointStorage.calculateAddress(data);
      
      await expect(dataPointStorage.writeDataPoint(data))
        .to.emit(dataPointStorage, "DataPointWritten")
        .withArgs(expectedAddress);
    });

    it("Should return correct address when writing", async function () {
      const data = ethers.toUtf8Bytes("test data");
      const expectedAddress = await dataPointStorage.calculateAddress(data);
      
      const returnedAddress = await dataPointStorage.writeDataPoint.staticCall(data);
      expect(returnedAddress).to.equal(expectedAddress);
    });

    it("Should prevent writing duplicate data points", async function () {
      const data = ethers.toUtf8Bytes("test data");
      const expectedAddress = await dataPointStorage.calculateAddress(data);
      
      // First write should succeed
      await dataPointStorage.writeDataPoint(data);
      
      // Second write should fail
      await expect(dataPointStorage.writeDataPoint(data))
        .to.be.revertedWithCustomError(dataPointStorage, "DataExists")
        .withArgs(expectedAddress);
    });

    it("Should allow different users to write different data", async function () {
      const data1 = ethers.toUtf8Bytes("user1 data");
      const data2 = ethers.toUtf8Bytes("user2 data");
      
      await dataPointStorage.connect(addr1).writeDataPoint(data1);
      await dataPointStorage.connect(addr2).writeDataPoint(data2);
      
      const storedData1 = await dataPointStorage.readDataPoint(
        await dataPointStorage.calculateAddress(data1)
      );
      const storedData2 = await dataPointStorage.readDataPoint(
        await dataPointStorage.calculateAddress(data2)
      );
      
      expect(ethers.toUtf8String(storedData1)).to.equal("user1 data");
      expect(ethers.toUtf8String(storedData2)).to.equal("user2 data");
    });
  });

  describe("Data Point Reading", function () {
    it("Should read stored data correctly", async function () {
      const originalData = ethers.toUtf8Bytes("test data for reading");
      await dataPointStorage.writeDataPoint(originalData);
      
      const address = await dataPointStorage.calculateAddress(originalData);
      const retrievedData = await dataPointStorage.readDataPoint(address);
      
      expect(retrievedData).to.equal(ethers.hexlify(originalData));
      expect(ethers.toUtf8String(retrievedData)).to.equal("test data for reading");
    });

    it("Should return empty bytes for non-existent data point", async function () {
      const nonExistentAddress = ethers.keccak256(ethers.toUtf8Bytes("non-existent"));
      const retrievedData = await dataPointStorage.readDataPoint(nonExistentAddress);
      expect(retrievedData).to.equal("0x");
    });

    it("Should handle reading empty data points", async function () {
      // Empty data is now rejected, so test non-existent address instead
      const nonExistentAddress = ethers.keccak256(ethers.toUtf8Bytes("non-existent"));
      const retrievedData = await dataPointStorage.readDataPoint(nonExistentAddress);
      expect(retrievedData).to.equal("0x");
    });
  });

  describe("Data Point Size", function () {
    it("Should return correct size for stored data", async function () {
      const data = ethers.toUtf8Bytes("test data");
      await dataPointStorage.writeDataPoint(data);
      
      const address = await dataPointStorage.calculateAddress(data);
      const size = await dataPointStorage.dataPointSize(address);
      expect(size).to.equal(data.length);
    });

    it("Should return 0 for non-existent data point", async function () {
      const nonExistentAddress = ethers.keccak256(ethers.toUtf8Bytes("non-existent"));
      const size = await dataPointStorage.dataPointSize(nonExistentAddress);
      expect(size).to.equal(0);
    });

    it("Should return 0 for empty data point", async function () {
      // Empty data is now rejected, so test with non-existent address instead
      const nonExistentAddress = ethers.keccak256(ethers.toUtf8Bytes("non-existent-size-test"));
      const size = await dataPointStorage.dataPointSize(nonExistentAddress);
      expect(size).to.equal(0);
    });
  });

  describe("Edge Cases and Security", function () {
    it("Should handle maximum size data points", async function () {
      // Test with large data (be careful with gas limits)
      const largeData = ethers.toUtf8Bytes("x".repeat(1000)); // Reasonable size for testing
      await dataPointStorage.writeDataPoint(largeData);
      
      const address = await dataPointStorage.calculateAddress(largeData);
      const retrievedData = await dataPointStorage.readDataPoint(address);
      const size = await dataPointStorage.dataPointSize(address);
      
      expect(size).to.equal(largeData.length);
      expect(ethers.toUtf8String(retrievedData)).to.equal("x".repeat(1000));
    });

    it("Should handle special characters and encoding", async function () {
      const specialData = ethers.toUtf8Bytes("Special chars: àáâãäå æç èéêë ìíîï");
      await dataPointStorage.writeDataPoint(specialData);
      
      const address = await dataPointStorage.calculateAddress(specialData);
      const retrievedData = await dataPointStorage.readDataPoint(address);
      
      expect(ethers.toUtf8String(retrievedData)).to.equal("Special chars: àáâãäå æç èéêë ìíîï");
    });

    it("Should handle binary data", async function () {
      const binaryData = new Uint8Array([0, 1, 255, 128, 64, 32, 16, 8, 4, 2, 1]);
      await dataPointStorage.writeDataPoint(binaryData);
      
      const address = await dataPointStorage.calculateAddress(binaryData);
      const retrievedData = await dataPointStorage.readDataPoint(address);
      
      expect(retrievedData).to.equal(ethers.hexlify(binaryData));
    });

    it("Should maintain data integrity across multiple operations", async function () {
      const testData = [
        ethers.toUtf8Bytes("data1"),
        ethers.toUtf8Bytes("data2"),
        ethers.toUtf8Bytes("data3")
      ];
      
      // Write all data points
      for (const data of testData) {
        await dataPointStorage.writeDataPoint(data);
      }
      
      // Verify all data points
      for (let i = 0; i < testData.length; i++) {
        const address = await dataPointStorage.calculateAddress(testData[i]);
        const retrievedData = await dataPointStorage.readDataPoint(address);
        expect(ethers.toUtf8String(retrievedData)).to.equal(`data${i + 1}`);
      }
    });
  });

  describe("Critical Bug Testing", function () {
    it("CRITICAL: Should reject empty data", async function () {
      const emptyData = "0x";
      
      // Writing empty data should fail
      await expect(dataPointStorage.writeDataPoint(emptyData))
        .to.be.revertedWithCustomError(dataPointStorage, "InvalidData");
    });

    it("CRITICAL: Version consistency between function and contract", async function () {
      const data = ethers.toUtf8Bytes("version test");
      const contractAddress = await dataPointStorage.calculateAddress(data);
      
      // Manual calculation using the standalone function logic
      const manualAddress = ethers.keccak256(
        ethers.concat([data, ethers.toBeArray(2)])
      );
      
      expect(contractAddress).to.equal(manualAddress);
    });

    it("Should handle collision attempts gracefully", async function () {
      // This tests the collision detection mechanism
      const data1 = ethers.toUtf8Bytes("collision test 1");
      const data2 = ethers.toUtf8Bytes("collision test 2");
      
      // Ensure these have different addresses (they should)
      const addr1 = await dataPointStorage.calculateAddress(data1);
      const addr2 = await dataPointStorage.calculateAddress(data2);
      expect(addr1).to.not.equal(addr2);
      
      // Write both should succeed
      await dataPointStorage.writeDataPoint(data1);
      await dataPointStorage.writeDataPoint(data2);
    });
  });

  describe("Gas Usage Analysis", function () {
    it("Should measure gas usage for different data sizes", async function () {
      const sizes = [10, 100, 1000];
      
      for (const size of sizes) {
        const data = ethers.toUtf8Bytes("x".repeat(size));
        const tx = await dataPointStorage.writeDataPoint(data);
        const receipt = await tx.wait();
        
        console.log(`Gas used for ${size} bytes: ${receipt!.gasUsed.toString()}`);
        expect(receipt!.gasUsed).to.be.greaterThan(0);
      }
    });

    it("Should measure gas for read operations", async function () {
      const data = ethers.toUtf8Bytes("gas test data");
      await dataPointStorage.writeDataPoint(data);
      
      const address = await dataPointStorage.calculateAddress(data);
      
      // Estimate gas for read operations
      const readGas = await dataPointStorage.readDataPoint.estimateGas(address);
      const sizeGas = await dataPointStorage.dataPointSize.estimateGas(address);
      const calcGas = await dataPointStorage.calculateAddress.estimateGas(data);
      
      console.log(`Read gas: ${readGas.toString()}`);
      console.log(`Size gas: ${sizeGas.toString()}`);
      console.log(`Calculate gas: ${calcGas.toString()}`);
      
      expect(readGas).to.be.greaterThan(0);
      expect(sizeGas).to.be.greaterThan(0);
      expect(calcGas).to.be.greaterThan(0);
    });
  });

  describe("Standalone Function Testing", function () {
    it("Should test standalone calculateDataPointAddress function", async function () {
      // Deploy the test helper contract
      const TestHelpersFactory = await ethers.getContractFactory("TestHelpers");
      const testHelpers = await TestHelpersFactory.deploy() as TestHelpers;
      
      const data = ethers.toUtf8Bytes("standalone test");
      const version = 2;
      
      const standaloneResult = await testHelpers.testCalculateDataPointAddress(data, version);
      const contractResult = await dataPointStorage.calculateAddress(data);
      
      expect(standaloneResult).to.equal(contractResult);
    });

    it("Should test standalone function with different versions", async function () {
      const TestHelpersFactory = await ethers.getContractFactory("TestHelpers");
      const testHelpers = await TestHelpersFactory.deploy() as TestHelpers;
      
      const data = ethers.toUtf8Bytes("version test data");
      
      const result_v1 = await testHelpers.testCalculateDataPointAddress(data, 1);
      const result_v2 = await testHelpers.testCalculateDataPointAddress(data, 2);
      const result_v3 = await testHelpers.testCalculateDataPointAddress(data, 3);
      
      // Different versions should produce different addresses
      expect(result_v1).to.not.equal(result_v2);
      expect(result_v2).to.not.equal(result_v3);
      expect(result_v1).to.not.equal(result_v3);
      
      // Contract uses version 2, so should match v2 result
      const contractResult = await dataPointStorage.calculateAddress(data);
      expect(contractResult).to.equal(result_v2);
    });
  });

  describe("Event Testing", function () {
    it("Should emit events with correct parameters", async function () {
      const data = ethers.toUtf8Bytes("event test data");
      const expectedAddress = await dataPointStorage.calculateAddress(data);
      
      const tx = await dataPointStorage.writeDataPoint(data);
      const receipt = await tx.wait();
      
      const event = receipt!.logs.find(
        log => log.topics[0] === dataPointStorage.interface.getEvent("DataPointWritten").topicHash
      );
      
      expect(event).to.not.be.undefined;
      const decodedEvent = dataPointStorage.interface.parseLog(event!);
      expect(decodedEvent!.args.dataPointAddress).to.equal(expectedAddress);
    });
  });
}); 