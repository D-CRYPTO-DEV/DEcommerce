/// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.27;

import {Governor} from "@openzeppelin/contracts/governance/Governor.sol";
import {GovernorCountingSimple} from "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import {GovernorSettings} from "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import {GovernorStorage} from "@openzeppelin/contracts/governance/extensions/GovernorStorage.sol";
import {GovernorTimelockControl} from "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import {GovernorVotes} from "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import {GovernorVotesQuorumFraction} from "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";

// Import custom libraries - use only one set of libraries
import "./DAOVotingLibrary.sol";
import "./DAOSignatureLibrary.sol";

// Remove duplicate imports
// import "./VotingLibrary.sol";
// import "./SignatureLibrary.sol";

interface IpaymentContract {
    function getPaymentToDAO(address _useradd) external view returns (uint256);
}

contract MyGovernor is Governor, GovernorSettings, GovernorCountingSimple, GovernorStorage, GovernorVotes, GovernorVotesQuorumFraction, GovernorTimelockControl {
    // --- Custom Errors ---
    error AlreadyCommitted(address voter);
    error NotCommitted(address voter);
    error AlreadyRevealed(address voter);
    error InvalidSignature();
    error CommitmentMismatch();
    error RevealWindowClosed();
    error CommitWindowClosed();
    error InvalidVoteType();

    // --- State Variables ---
    mapping(uint256 => DAOVotingLibrary.VoteCounts) private _myProposalVotes;
    
    // Use library structs
    mapping(address => DAOVotingLibrary.VoterStats) private _voterStats;

    // Consolidated mappings for vote tracking
    mapping(uint256 => mapping(address => bytes32)) public voteCommits;
    mapping(uint256 => mapping(address => uint8)) public revealedVoteSupport;
    mapping(uint256 => mapping(address => bool)) public hasRevealed;
    mapping(uint256 => address[]) public votersList;
    
    // User stats tracking
    mapping(address => uint8) public votingWeight;
    mapping(address => bool) private committed;
    
    // Remove redundant mappings
    // mapping(uint256 => mapping(address => uint8)) voteReveals;
    // mapping(uint256 => address[]) votersListMap;
    // mapping(address => uint256) voterSuccessfulVotes;
    // mapping(address => uint256) voterFailedVotes;
    // mapping(address => uint8) voterWinStreak;
    // mapping(address => uint8) voterLossStreak;

    IpaymentContract public paymentContract;
    
    uint256 public standardTransactionPower;
    
    // Remove unused state variables
    // uint256 proposalStartTimes;
    // uint256 proposalEndTimes;
    // address[] private tempVotersList;

    // --- EIP-712 ---
    bytes32 public constant REVEALVOTE_TYPEHASH = keccak256(
        "RevealVote(uint256 proposalId,uint8 support,uint256 salt)"
    );

    // --- Events ---
    event JoinedDAO(address DAOApplicant, address _DAOAddress);
    event VoteCommitted(uint256 indexed proposalId, address indexed voter, bytes32 commit);
    event VoteRevealedByRelayer(uint256 indexed proposalId, address indexed voter, uint8 support);

    constructor(
        IVotes _token, 
        TimelockController _timelock, 
        address _paymentContract,
        uint256 _standardTransactionPower
    )
        Governor("MyGovernor")
        GovernorSettings(4 hours, 2 hours, 0)
        GovernorVotes(_token)
        GovernorVotesQuorumFraction(4)
        GovernorTimelockControl(_timelock)
    { 
        require(_paymentContract != address(0), "Invalid payment contract address");
        
        paymentContract = IpaymentContract(_paymentContract);
        standardTransactionPower = _standardTransactionPower;
    }

    function state(uint256 proposalId)
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (ProposalState)
    {
        return super.state(proposalId);
    }

    function proposalNeedsQueuing(uint256 proposalId)
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (bool)
    {
        return super.proposalNeedsQueuing(proposalId);
    }

    function proposalThreshold()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.proposalThreshold();
    }

    function _propose(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, string memory description, address proposer)
        internal
        override(Governor, GovernorStorage)
        returns (uint256)
    {

        return super._propose(targets, values, calldatas, description, proposer);
    }

    function _queueOperations(uint256 proposalId, address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash)
        internal
        override(Governor, GovernorTimelockControl)
        returns (uint48)
    {
        return super._queueOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _executeOperations(uint256 proposalId, address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash)
        internal
        override(Governor, GovernorTimelockControl)
    {
        super._executeOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _cancel(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash)
        internal
        override(Governor, GovernorTimelockControl)
        returns (uint256)
    {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor()
        internal
        view
        override(Governor, GovernorTimelockControl)
        returns (address)
    {
        return super._executor();
    }

    function joinDAO(address _DAOAddress) external {
        require(_DAOAddress != address(0), "Invalid DAO address");
        require(paymentContract.getPaymentToDAO(msg.sender) > standardTransactionPower , "You must have made a payment to the DAO to join");
        votingWeight[msg.sender] = 1; // Minting 1000 governance tokens to the user as as voting power
        // Logic to join the DAO, such as transferring tokens or registering
        // This is a placeholder for actual DAO joining logic   
        emit JoinedDAO(msg.sender, _DAOAddress);
    }

    function _removeMemberFromDAO(address _memberAddress) internal {
        require(_memberAddress != address(0), "Invalid member address");
        require(votingWeight[_memberAddress] > 0, "Member does not hold governance tokens");
        // Logic to remove the member from the DAO
        // This is a placeholder for actual DAO removal logic
        votingWeight[_memberAddress] = 0; // Burn the governance tokens of the member
    }   

    function commitDeadline(uint256 proposalId) public view virtual returns (uint256) {
        return proposalDeadline(proposalId)/2;
    }

    function commitVote(uint256 proposalId, bytes32 commitment) public {
        if (block.number > commitDeadline(proposalId)) revert CommitWindowClosed();
        if (voteCommits[proposalId][msg.sender] != bytes32(0)) revert AlreadyCommitted(msg.sender);
        
        voteCommits[proposalId][msg.sender] = commitment;
        emit VoteCommitted(proposalId, msg.sender, commitment);
    }
    modifier extraVotecheck(uint256 proposalId, uint8 support, uint256 salt) {
         if(DAOVotingLibrary.hasMaxFailureStreak(_voterStats[msg.sender], 5)){
            votingWeight[msg.sender] = 0;
        }
        require(committed[msg.sender], "You must commit your vote before casting it");
        require(block.timestamp > votingDelay() && block.timestamp < votingDelay() + votingPeriod(), "Voting period is not active");
        bytes32 commitHash = DAOVotingLibrary.createCommitHash(support, salt);
        require(voteCommits[proposalId][msg.sender] == commitHash, "committed vote does not match");
        require(hasRevealed[proposalId][msg.sender] == false, "Vote already revealed");
        _;
    }

    function castVote(uint256, uint8) public pure virtual override returns (uint256) {
        revert InvalidVoteType();
    }

    function castVoteWithReason(uint256, uint8, string calldata) public pure virtual override returns (uint256) {
        revert InvalidVoteType();
    }

    function castVoteWithReasonAndParams(uint256, uint8, string calldata, bytes memory) public pure virtual override returns (uint256) {
        revert InvalidVoteType();
    }

    function castVoteBySig(
        uint256 proposalId,
        uint8 support,
        address voter,
        bytes memory signature
    ) public override extraVotecheck(proposalId, support, 0) returns(uint256) {
        if (!DAOSignatureLibrary.validateVoteSig(_domainSeparatorV4(), proposalId, support, voter, signature)) {
            revert GovernorInvalidSignature(voter);
        }
        return _castVote(proposalId, voter, support, "");
    }

    function castVoteWithReasonAndParamsBySig (
        uint256 proposalId,
        uint8 support,
        address voter,
        string calldata reason,
        bytes memory params,
        bytes memory signature
    ) public override extraVotecheck(proposalId, support, 0) returns (uint256) {
        if (!DAOSignatureLibrary.validateExtendedVoteSig(_domainSeparatorV4(), proposalId, support, voter, reason, params, signature)) {
            revert GovernorInvalidSignature(voter);
        }
        return _castVote(proposalId, voter, support, reason, params);
    }

    function revealVoteBySig(
        address voter,
        uint256 proposalId,
        uint8 support,
        uint256 salt,
        bytes memory signature
    ) public {
        uint256 _commitDeadline = commitDeadline(proposalId);
        if (block.number > proposalDeadline(proposalId)) revert RevealWindowClosed();
        if (block.number <= _commitDeadline) revert CommitWindowClosed();

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

        _countVote(proposalId, voter, support, 1);
        
        emit VoteRevealedByRelayer(proposalId, voter, support);
    }

    function _countVote(
        uint256 proposalId,
        address,
        uint8 support,
        uint256 weight
    ) internal returns (uint256, uint256, uint256) {
        return DAOVotingLibrary.countVote(_myProposalVotes[proposalId], support, weight);
    }

    function _updateVoterStats(uint256 proposalId, bool proposalSucceeded) private {
        address[] memory voters = votersList[proposalId];
        for (uint i = 0; i < voters.length; i++) {
            address voter = voters[i];
            uint8 support = revealedVoteSupport[proposalId][voter];
            
            DAOVotingLibrary.updateVoterStats(_voterStats, voter, support, proposalSucceeded);
        }
    }

    function getGovernorStats(address governor) public view returns (uint256 successfulVotes, uint256 failedVotes, uint8 streak) {
        require(governor != address(0), "Invalid governor address");
        DAOVotingLibrary.VoterStats storage stats = _voterStats[governor];
        successfulVotes = stats.successfulVotes;
        failedVotes = stats.failedVotes;
        streak = stats.winStreak;
    }

    function maxFailurestreak()
    public
    view
    returns (bool) {
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
   
    function setCommitted(address voter, bool isCommitted) public {
        committed[voter] = isCommitted;
    }
    
    function storeCommitment(uint256 proposalId, address voter, bytes32 commitment) public {
        voteCommits[proposalId][voter] = commitment;
    }
    
    function setHasRevealed(uint256 proposalId, address voter, bool revealed) public {
        hasRevealed[proposalId][voter] = revealed;
    }
    
    function setVoterLossStreak(address voter, uint8 streak) public {
        _voterStats[voter].lossStreak = streak;
    }
    
    function setVotingWeight(address voter, uint8 weight) public {
        votingWeight[voter] = weight;
    }

    bool private _votingActiveForTest;
    
    function setVotingActive(bool active) public {
        _votingActiveForTest = active;
    }
    
    function votingDelay() public view override(Governor, GovernorSettings) returns (uint256) {
        if (_votingActiveForTest) {
            return block.timestamp - 1;
        }
        return super.votingDelay();
    }
    
    function votingPeriod() public view override(Governor, GovernorSettings) returns (uint256) {
        if (_votingActiveForTest) {
            return 1000000;
        }
        return super.votingPeriod();
    }

    function setRevealedVoteSupport(uint256 proposalId, address voter, uint8 support) public {
        revealedVoteSupport[proposalId][voter] = support;
    }
    
    function addVoterToList(uint256 proposalId, address voter) public {
        votersList[proposalId].push(voter);
    }
    
    function updateVoterStatsForTest(uint256 proposalId, bool proposalSucceeded) public {
        _updateVoterStats(proposalId, proposalSucceeded);
    }
    
    function countVoteForTest(uint256 proposalId, address voter, uint8 support, uint256 weight) public returns (uint256, uint256, uint256) {
        return _countVote(proposalId, voter, support, weight);
    }
    
    function getProposalVotes(uint256 proposalId) public view returns (DAOVotingLibrary.VoteCounts memory) {
        return _myProposalVotes[proposalId];
    }
}

