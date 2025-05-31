// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "../DataPointStorage.sol";

/// @title Test Helper Contract
/// @notice Provides access to standalone functions for testing
contract TestHelpers {
    
    /// @notice Wrapper to test the standalone calculateDataPointAddress function
    /// @param _data The data point
    /// @param _version The version of the data point
    /// @return bytes32 The calculated address
    function testCalculateDataPointAddress(
        bytes memory _data,
        uint8 _version
    ) external pure returns (bytes32) {
        return calculateDataPointAddress(_data, _version);
    }
} 