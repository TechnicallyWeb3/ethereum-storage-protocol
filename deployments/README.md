# ESP Local Deployments

This directory contains deployment information for local development environments.

## Structure

Each file in this directory represents a deployment on a specific network:

- `localhost.json`: Deployments on localhost (Hardhat node)

## Format

The deployment files follow this format:

```json
{
  "chainId": 31337,
  "name": "localhost",
  "dps": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  "dpr": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  "owner": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "royaltyRate": "100000000000000"
}
```

## Usage

When the ESP package is installed, you can add your local deployments to this directory using the CLI:

```bash
npx ethereum-storage add-localhost \
  --dps 0x5FbDB2315678afecb367f032d93F642f64180aa3 \
  --dpr 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512 \
  --owner 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
  --royalty 100000000000000 \
  --description "Local test deployment"
```

Or you can manually create a JSON file in this directory with the required information.