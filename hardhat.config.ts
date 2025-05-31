import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-contract-sizer";
import dotenv from "dotenv";
import { ethers } from "ethers";

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

const dpsKey = ethers.Wallet.fromPhrase(dpsMnemonic).privateKey;
const dprKey = ethers.Wallet.fromPhrase(dprMnemonic).privateKey;
const tw3Key = ethers.Wallet.fromPhrase(tw3Mnemonic).privateKey;
const user1Key = ethers.Wallet.fromPhrase(tw3Mnemonic).deriveChild(1).privateKey;
const user2Key = ethers.Wallet.fromPhrase(tw3Mnemonic).deriveChild(2).privateKey;
const user3Key = ethers.Wallet.fromPhrase(tw3Mnemonic).deriveChild(3).privateKey;

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

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  networks: {
    hardhat: {
      accounts: espDeployersHardhat,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      accounts: espDeployerKeys,
    },
    sepolia: {
      url: "https://ethereum-sepolia-rpc.publicnode.com",
      accounts: espDeployerKeys,
    },
    mainnet: {
      url: "https://ethereum-rpc.publicnode.com",
      accounts: espDeployerKeys,
    },
    polygon: {
      url: "https://polygon-bor-rpc.publicnode.com",
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
