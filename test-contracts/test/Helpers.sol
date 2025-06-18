/*
 * Ethereum Storage Protocol (ESP) - Test Helpers
 * Copyright (C) 2025 TechnicallyWeb3
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 * 
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "../../contracts/DataPointStorage.sol";

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