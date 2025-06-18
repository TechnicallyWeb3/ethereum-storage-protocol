import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-contract-sizer";
import dotenv from "dotenv";
import { ethers } from "ethers";
import "hardhat-build"

// Import custom tasks
import "./tasks/royalty";
import "./tasks/deploy";

dotenv.config();

const defaultMnemonic = 'test test test test test test test test test test test junk';
const dpsMnemonic = process.env.DPS_DEPLOYER_MNEMONIC || defaultMnemonic;
const dprMnemonic = process.env.DPR_DEPLOYER_MNEMONIC || defaultMnemonic;
const tw3Mnemonic = process.env.OWNER_MNEMONIC || defaultMnemonic;

if (dpsMnemonic === defaultMnemonic) {
  console.error('DPS_DEPLOYER_MNEMONIC is not set, using default mnemonic, DO NOT DEPLOY TO A LIVE NETWORK!');
}
if (dprMnemonic === defaultMnemonic) {
  console.error('DPR_DEPLOYER_MNEMONIC is not set, using default mnemonic, DO NOT DEPLOY TO A LIVE NETWORK!');
}
if (tw3Mnemonic === defaultMnemonic) {
  console.error('TW3_MNEMONIC is not set, using default mnemonic, DO NOT DEPLOY TO A LIVE NETWORK!');
}

const testKey = ethers.HDNodeWallet.fromPhrase(defaultMnemonic).privateKey;
const testKey1 = ethers.HDNodeWallet.fromPhrase(defaultMnemonic, undefined, `m/44'/60'/0'/0/1`).privateKey;
const testKey2 = ethers.HDNodeWallet.fromPhrase(defaultMnemonic, undefined, `m/44'/60'/0'/0/2`).privateKey;

const dpsKey = ethers.Wallet.fromPhrase(dpsMnemonic).privateKey;
const dprKey = ethers.Wallet.fromPhrase(dprMnemonic).privateKey;
const tw3Key = ethers.HDNodeWallet.fromPhrase(tw3Mnemonic).privateKey;
const user1Key = ethers.HDNodeWallet.fromPhrase(tw3Mnemonic, undefined, `m/44'/60'/0'/0/1`).privateKey;
const user2Key = ethers.HDNodeWallet.fromPhrase(tw3Mnemonic, undefined, `m/44'/60'/0'/0/2`).privateKey;
const user3Key = ethers.HDNodeWallet.fromPhrase(tw3Mnemonic, undefined, `m/44'/60'/0'/0/3`).privateKey;

// For hardhat network - with balance configuration
const espDeployersHardhat = [
  { privateKey: dpsKey, balance: "10000000000000000000000" },
  { privateKey: dprKey, balance: "10000000000000000000000" },
  { privateKey: tw3Key, balance: "10000000000000000000000" },
  { privateKey: user1Key, balance: "10000000000000000000000" },
  { privateKey: user2Key, balance: "10000000000000000000000" },
  { privateKey: user3Key, balance: "10000000000000000000000" }
];

// For other networks - just private keys
const espDeployerKeys = [
  dpsKey,
  dprKey,
  tw3Key,
  user1Key,
  user2Key,
  user3Key
];

const testDeployerHardhat = [
  { privateKey: testKey, balance: "10000000000000000000000" },
  { privateKey: testKey1, balance: "10000000000000000000000" },
  { privateKey: testKey2, balance: "10000000000000000000000" },
  { privateKey: testKey, balance: "10000000000000000000000" },
  { privateKey: testKey, balance: "10000000000000000000000" },
  { privateKey: testKey, balance: "10000000000000000000000" },
];

const testDeployerKeys = [
  dpsKey,
  dprKey,
  testKey2,
  testKey,
  testKey,
  testKey,
];

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  networks: {
    hardhat: {
      accounts: testDeployerHardhat,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      accounts: espDeployerKeys,
      gasPrice: 20000000000, // 20 gwei
    },
    sepolia: {
      url: "https://ethereum-sepolia-rpc.publicnode.com",
      chainId: 11155111,
      accounts: espDeployerKeys,
    },
    mainnet: {
      url: "https://ethereum-rpc.publicnode.com",
      chainId: 1,
      accounts: espDeployerKeys,
    },
    polygon: {
      url: "https://polygon-bor-rpc.publicnode.com",
      chainId: 137,
      accounts: espDeployerKeys,
    },
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY || "",
      sepolia: process.env.ETHERSCAN_API_KEY || "",
      polygon: process.env.POLYGONSCAN_API_KEY || "",
    }
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
    only: [],
  }
};

export default config;
