// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "./interfaces/IDAOVoting.sol";
import "./interfaces/IDAOGovernanceCore.sol";
import "./DAOVotingLibrary.sol";
import "./DAOSignatureLibrary.sol";

/**
 * @title DAOVoting
 * @dev Implementation of voting functionality for the DAO with tokenless voting
 */
contract DAOVoting is IDAOVoting, Ownable, EIP712 {
    // --- Custom Errors ---
    error AlreadyCommitted(address voter);
    error NotCommitted(address voter);
    error AlreadyRevealed(address voter);
    error InvalidSignature();
    error CommitmentMismatch();
    error RevealWindowClosed();
    error CommitWindowClosed();
    error InvalidVoteType();
    error NotGovernanceContract();
    error NotDAOMember();

    // --- State Variables ---
    mapping(uint256 => DAOVotingLibrary.VoteCounts) private _proposalVotes;
    mapping(address => DAOVotingLibrary.VoterStats) private _voterStats;

    // Consolidated mappings for vote tracking
    mapping(uint256 => mapping(address => bytes32)) public voteCommits;
    mapping(uint256 => mapping(address => uint8)) public revealedVoteSupport;
    mapping(uint256 => mapping(address => bool)) public hasRevealed;
    mapping(uint256 => address[]) public votersList;
    
    // User stats tracking
    mapping(address => uint8) public votingWeight;
    mapping(address => bool) private committed;
    
    // Governance contract reference
    address private _governanceContract;
    bool private _initialized;
    
    // --- Modifiers ---
    modifier onlyGovernance() {
        if (msg.sender != _governanceContract) revert NotGovernanceContract();
        _;
    }

    // --- Constructor ---
    constructor(address initialOwner) 
        Ownable(initialOwner)
        EIP712("DAOVoting", "1")
    {
        _initialized = false;
    }
    
    // --- External Functions ---
    function setGovernanceContract(address governanceContract_) external {
        // Allow owner to set the governance contract only during initialization
        // After that, only the governance contract itself can update it
        if (_initialized) {
            require(msg.sender == _governanceContract, "Only governance can update");
        } else {
            require(msg.sender == owner(), "Only owner can initialize");
            _initialized = true;
        }
        
        require(governanceContract_ != address(0), "Invalid governance contract address");
        _governanceContract = governanceContract_;
    }
    
    function governanceContract() external view returns (address) {
        return _governanceContract;
    }

    // --- Voting Functions ---
    function commitVote(uint256 proposalId, bytes32 commitment) external {
        // Check if user is a DAO member
        if (!IDAOGovernanceCore(_governanceContract).isMember(msg.sender)) revert NotDAOMember();
        
        uint256 _commitDeadline = IDAOGovernanceCore(_governanceContract).commitDeadline(proposalId);
        if (block.timestamp > _commitDeadline) revert CommitWindowClosed();
        if (voteCommits[proposalId][msg.sender] != bytes32(0)) revert AlreadyCommitted(msg.sender);
        
        voteCommits[proposalId][msg.sender] = commitment;
        emit VoteCommitted(proposalId, msg.sender, commitment);
    }

    // Direct vote revelation function for testing
    function revealVote(uint256 proposalId, uint8 support, uint256 salt) external {
        // Check if user is a DAO member
        if (!IDAOGovernanceCore(_governanceContract).isMember(msg.sender)) revert NotDAOMember();
        
        IDAOGovernanceCore governance = IDAOGovernanceCore(_governanceContract);
        uint256 _commitDeadline = governance.commitDeadline(proposalId);
        uint256 _proposalDeadline = governance.proposalDeadline(proposalId);
        
        if (block.timestamp > _proposalDeadline) revert RevealWindowClosed();
        if (block.timestamp <= _commitDeadline) revert CommitWindowClosed();

        if (voteCommits[proposalId][msg.sender] == bytes32(0)) revert NotCommitted(msg.sender);
        if (hasRevealed[proposalId][msg.sender]) revert AlreadyRevealed(msg.sender);

        bytes32 expectedCommitment = DAOVotingLibrary.createCommitHash(support, salt);
        if (voteCommits[proposalId][msg.sender] != expectedCommitment) revert CommitmentMismatch();
        
        hasRevealed[proposalId][msg.sender] = true;
        revealedVoteSupport[proposalId][msg.sender] = support;
        votersList[proposalId].push(msg.sender);

        // Use the voting weight if set, otherwise default to 1 (equal voting)
        uint256 weight = votingWeight[msg.sender] > 0 ? votingWeight[msg.sender] : 1;
        _countVote(proposalId, msg.sender, support, weight);
        
        emit VoteRevealedByRelayer(proposalId, msg.sender, support);
    }

    function revealVoteBySig(
        address voter,
        uint256 proposalId,
        uint8 support,
        uint256 salt,
        bytes memory signature
    ) external {
        // Check if user is a DAO member
        if (!IDAOGovernanceCore(_governanceContract).isMember(voter)) revert NotDAOMember();
        
        IDAOGovernanceCore governance = IDAOGovernanceCore(_governanceContract);
        uint256 _commitDeadline = governance.commitDeadline(proposalId);
        uint256 _proposalDeadline = governance.proposalDeadline(proposalId);
        
        if (block.timestamp > _proposalDeadline) revert RevealWindowClosed();
        if (block.timestamp <= _commitDeadline) revert CommitWindowClosed();

        if (voteCommits[proposalId][voter] == bytes32(0)) revert NotCommitted(voter);
        if (hasRevealed[proposalId][voter]) revert AlreadyRevealed(voter);

        if (!DAOSignatureLibrary.validateRevealVoteSig(_domainSeparatorV4(), proposalId, support, salt, voter, signature)) {
            revert InvalidSignature();
        }

        bytes32 expectedCommitment = DAOVotingLibrary.createCommitHash(support, salt);
        if (voteCommits[proposalId][voter] != expectedCommitment) revert CommitmentMismatch();
        
        hasRevealed[proposalId][voter] = true;
        revealedVoteSupport[proposalId][voter] = support;
        votersList[proposalId].push(voter);

        // Use the voting weight if set, otherwise default to 1 (equal voting)
        uint256 weight = votingWeight[voter] > 0 ? votingWeight[voter] : 1;
        _countVote(proposalId, voter, support, weight);
        
        emit VoteRevealedByRelayer(proposalId, voter, support);
    }

    // --- Vote Counting ---
    function _countVote(
        uint256 proposalId,
        address /* voter */,
        uint8 support,
        uint256 weight
    ) internal returns (uint256, uint256, uint256) {
        if (weight == 0) {
            weight = 1; // Default weight if not set
        }
        return DAOVotingLibrary.countVote(_proposalVotes[proposalId], support, weight);
    }

    function countVoteForTest(
        uint256 proposalId,
        address voter,
        uint8 support,
        uint256 weight
    ) external returns (uint256, uint256, uint256) {
        return _countVote(proposalId, voter, support, weight);
    }

    function _updateVoterStats(uint256 proposalId, bool proposalSucceeded) private {
        address[] memory voters = votersList[proposalId];
        for (uint i = 0; i < voters.length; i++) {
            address voter = voters[i];
            uint8 support = revealedVoteSupport[proposalId][voter];
            
            DAOVotingLibrary.updateVoterStats(_voterStats, voter, support, proposalSucceeded);
        }
    }

    // --- Voter Stats Functions ---
    function getGovernorStats(address governor) external view returns (uint256 successfulVotes, uint256 failedVotes, uint8 streak) {
        require(governor != address(0), "Invalid governor address");
        DAOVotingLibrary.VoterStats storage stats = _voterStats[governor];
        successfulVotes = stats.successfulVotes;
        failedVotes = stats.failedVotes;
        streak = stats.winStreak;
    }

    function maxFailurestreak() external view returns (bool) {
        return DAOVotingLibrary.hasMaxFailureStreak(_voterStats[msg.sender], 5);
    }

    function governorSuccesfulvotes(address governor) external view returns (uint256) {
        return _voterStats[governor].successfulVotes;
    }

    function governorfailedvotes(address governor) external view returns (uint256) {
        return _voterStats[governor].failedVotes;
    }

    function governorStreak(address governor) external view returns (uint8) {
        return _voterStats[governor].winStreak;
    }
    
    function governorSuccessfulVotes(address governor) external view returns (uint256) {
        return _voterStats[governor].successfulVotes;
    }

    // --- Testing and Helper Functions ---
    function setCommitted(address voter, bool isCommitted) external {
        committed[voter] = isCommitted;
    }
    
    function storeCommitment(uint256 proposalId, address voter, bytes32 commitment) external {
        voteCommits[proposalId][voter] = commitment;
    }
    
    function setHasRevealed(uint256 proposalId, address voter, bool revealed) external {
        hasRevealed[proposalId][voter] = revealed;
    }
    
    function setVoterLossStreak(address voter, uint8 streak) external {
        _voterStats[voter].lossStreak = streak;
    }
    
    function setVotingWeight(address voter, uint8 weight) external {
        votingWeight[voter] = weight;
    }
    
    function setRevealedVoteSupport(uint256 proposalId, address voter, uint8 support) external {
        revealedVoteSupport[proposalId][voter] = support;
    }
    
    function addVoterToList(uint256 proposalId, address voter) external {
        votersList[proposalId].push(voter);
    }
    
    function updateVoterStatsForTest(uint256 proposalId, bool proposalSucceeded) external {
        _updateVoterStats(proposalId, proposalSucceeded);
    }
    
    function getProposalVotes(uint256 proposalId) external view returns (DAOVotingLibrary.VoteCounts memory) {
        return _proposalVotes[proposalId];
    }
} 