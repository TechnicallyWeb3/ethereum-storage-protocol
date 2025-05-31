// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

event DataPointWritten(bytes32 indexed dataPointAddress);

error DataExists(bytes32 dataPointAddress);

error InvalidDPS();
error InsufficientRoyaltyPayment(uint256 royaltyCost);
error InvalidPublisher(address publisher);

event RoyaltiesCollected(address indexed publisher, uint256 amount, address indexed withdrawTo);
event RoyaltiesPaid(bytes32 indexed dataPointAddress, address indexed payer, uint256 amount);
event DataPointRegistered(bytes32 indexed dataPointAddress, address indexed publisher);


/// @notice Calculates a unique address for a data point
/// @dev Uses keccak256 hash of concatenated version and data
/// @param _data The data point
/// @param _version The version of the data point
/// @return bytes32 The calculated address
function calculateDataPointAddress(
    bytes memory _data,
    uint8 _version
) pure returns (bytes32) {
    return keccak256(abi.encodePacked(_data, _version));
}