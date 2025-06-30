// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title SignatureLibrary
 * @dev Library for signature validation functions
 */
library SignatureLibrary {
    // --- Constants ---
    bytes32 public constant BALLOT_TYPEHASH = keccak256("Ballot(uint256 proposalId,uint8 support)");
    bytes32 public constant EXTENDED_BALLOT_TYPEHASH = keccak256("ExtendedBallot(uint256 proposalId,uint8 support,string reason,bytes params)");
    bytes32 public constant REVEAL_VOTE_TYPEHASH = keccak256("RevealVote(uint256 proposalId,uint8 support,uint256 salt)");
    
    // --- Signature Validation Functions ---
    function validateVoteSig(
        bytes32 domainSeparator,
        uint256 proposalId,
        uint8 support,
        address voter,
        bytes memory signature
    ) internal pure returns (bool) {
        bytes32 structHash = keccak256(abi.encode(
            BALLOT_TYPEHASH,
            proposalId,
            support
        ));
        bytes32 digest = _hashTypedData(domainSeparator, structHash);
        address signer = ECDSA.recover(digest, signature);
        return signer == voter;
    }
    
    function validateExtendedVoteSig(
        bytes32 domainSeparator,
        uint256 proposalId,
        uint8 support,
        address voter,
        string calldata reason,
        bytes memory params,
        bytes memory signature
    ) internal pure returns (bool) {
        bytes32 structHash = keccak256(abi.encode(
            EXTENDED_BALLOT_TYPEHASH,
            proposalId,
            support,
            keccak256(bytes(reason)),
            keccak256(params)
        ));
        bytes32 digest = _hashTypedData(domainSeparator, structHash);
        address signer = ECDSA.recover(digest, signature);
        return signer == voter;
    }
    
    function validateRevealVoteSig(
        bytes32 domainSeparator,
        uint256 proposalId,
        uint8 support,
        uint256 salt,
        address voter,
        bytes memory signature
    ) internal pure returns (bool) {
        bytes32 structHash = keccak256(abi.encode(
            REVEAL_VOTE_TYPEHASH,
            proposalId,
            support,
            salt
        ));
        bytes32 digest = _hashTypedData(domainSeparator, structHash);
        address signer = ECDSA.recover(digest, signature);
        return signer == voter;
    }
    
    // --- Helper Functions ---
    function _hashTypedData(bytes32 domainSeparator, bytes32 structHash) private pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    }
} 