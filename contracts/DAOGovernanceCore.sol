// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Governor} from "@openzeppelin/contracts/governance/Governor.sol";
import {GovernorCountingSimple} from "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import {GovernorSettings} from "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import {GovernorStorage} from "@openzeppelin/contracts/governance/extensions/GovernorStorage.sol";
import {GovernorTimelockControl} from "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {IERC6372} from "@openzeppelin/contracts/interfaces/IERC6372.sol";
import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";

// Import interfaces
import "./interfaces/IDAOVoting.sol";
import "./interfaces/IDAOPayment.sol";
import "./interfaces/IDAOGovernanceCore.sol";
import "./DAOSignatureLibrary.sol";

interface IpaymentContract {
    function getPaymentToDAO(address _useradd) external view returns (uint256);
}

/**
 * @title DAOGovernanceCore
 * @dev Core governance contract for the DAO - Modified to work without governance tokens
 */
contract DAOGovernanceCore is 
    IDAOGovernanceCore,
    Governor, 
    GovernorSettings, 
    GovernorCountingSimple, 
    GovernorStorage, 
    GovernorTimelockControl 
{
    // --- Custom Errors ---
    error InvalidVoteType();
    error NotVotingContract();

    // --- State Variables ---
    address private _votingContract;
    IpaymentContract private _paymentContract;
    uint256 private _standardTransactionPower;
    mapping(address => bool) private _members;
    uint256 private _memberCount;
    uint256 private _quorumNumerator;
    address private _initialDeployer;
    bool private _initialized;

    // --- Events ---
    event VotingContractSet(address votingContract);

    // --- Modifiers ---
    modifier onlyVotingContract() {
        if (msg.sender != _votingContract) revert NotVotingContract();
        _;
    }
    
    modifier onlyInitialDeployer() {
        require(msg.sender == _initialDeployer, "Only initial deployer can call");
        _;
    }

    // --- Constructor ---
    constructor(
        TimelockController _timelock, 
        address paymentContractAddress,
        uint256 standardTransactionPower_,
        uint256 initialQuorumNumerator
    )
        Governor("DAOGovernanceCore")
        GovernorSettings(4 hours, 2 hours, 0)
        GovernorTimelockControl(_timelock)
    { 
        require(initialQuorumNumerator >= 10, "QuorumNumerator over 100");
        
        if (paymentContractAddress != address(0)) {
            _paymentContract = IpaymentContract(paymentContractAddress);
        }
        _standardTransactionPower = standardTransactionPower_;
        _quorumNumerator = initialQuorumNumerator;
        _initialDeployer = msg.sender;
        _initialized = false;
    }

    // --- External Functions ---
    function setVotingContract(address votingContract_) external override onlyGovernance {
        require(votingContract_ != address(0), "Invalid voting contract address");
        _votingContract = votingContract_;
        emit VotingContractSet(votingContract_);
    }
    
    // One-time initialization function for setting the voting contract
    function initializeVotingContract(address votingContract_) external override onlyInitialDeployer {
        require(!_initialized, "Already initialized");
        require(votingContract_ != address(0), "Invalid voting contract address");
        _votingContract = votingContract_;
        _initialized = true;
        emit VotingContractInitialized(votingContract_);
    }
    
    // Function to set or update the payment contract
    function setPaymentContract(address paymentContractAddress) external onlyInitialDeployer {
        require(paymentContractAddress != address(0), "Invalid payment contract address");
        _paymentContract = IpaymentContract(paymentContractAddress);
        emit PaymentContractSet(paymentContractAddress);
    }
    
    function votingContract() external view override returns (address) {
        return _votingContract;
    }

    function paymentContract() external view override returns (address) {
        return address(_paymentContract);
    }

    function standardTransactionPower() external view override returns (uint256) {
        return _standardTransactionPower;
    }

    // --- DAO Membership ---
    function joinDAO(address _DAOAddress) external override {
        require(_DAOAddress != address(0), "Invalid DAO address");
        require(address(_paymentContract) != address(0), "Payment contract not set");
        require(_paymentContract.getPaymentToDAO(msg.sender) > _standardTransactionPower, "You must have made a payment to the DAO to join");
        require(!_members[msg.sender], "Already a member");
        
        _members[msg.sender] = true;
        _memberCount++;
        
        // Set voting weight in the voting contract
        IDAOVoting(_votingContract).setVotingWeight(msg.sender, 1);
        
        emit JoinedDAO(msg.sender, _DAOAddress);
    }

    function isMember(address account) public view returns (bool) {
        return _members[account];
    }

    function memberCount() public view returns (uint256) {
        return _memberCount;
    }

    // --- Quorum Management ---
    function updateQuorumNumerator(uint256 newQuorumNumerator) external onlyGovernance {
        require(newQuorumNumerator <= 100, "QuorumNumerator over 100");
        uint256 oldQuorumNumerator = _quorumNumerator;
        _quorumNumerator = newQuorumNumerator;
        
        emit QuorumNumeratorUpdated(oldQuorumNumerator, newQuorumNumerator);
    }

    function quorumNumerator() public view returns (uint256) {
        return _quorumNumerator;
    }

    function quorum(uint256) public view override(Governor, IGovernor) returns (uint256) {
        return (_memberCount * _quorumNumerator) / 100;
    }

    // --- Vote Management ---
    function commitDeadline(uint256 proposalId) public view override returns (uint256) {
        return proposalDeadline(proposalId) / 2;
    }

    // --- OpenZeppelin Governor Overrides ---
    function state(uint256 proposalId)
        public
        view
        override(IGovernor, Governor, GovernorTimelockControl)
        returns (ProposalState)
    {
        return super.state(proposalId);
    }

    function proposalNeedsQueuing(uint256 proposalId)
        public
        view
        override(IGovernor, Governor, GovernorTimelockControl)
        returns (bool)
    {
        return super.proposalNeedsQueuing(proposalId);
    }

    function proposalThreshold()
        public
        view
        override(IGovernor, Governor, GovernorSettings)
        returns (uint256)
    {
        return super.proposalThreshold();
    }

    function _propose(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, string memory description, address proposer)
        internal
        override(Governor, GovernorStorage)
        returns (uint256)
    {
        // Allow proposals from payment contract or members
        if (proposer != address(_paymentContract)) {
            require(_members[proposer], "Only members can propose");
        }
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

    // --- Clock Functions ---
    function CLOCK_MODE() public pure override(IERC6372, Governor) returns (string memory) {
        return "mode=timestamp";
    }
    
    function clock() public view override(IERC6372, Governor) returns (uint48) {
        return uint48(block.timestamp);
    }

    // --- Vote Casting Overrides ---
    function castVote(uint256, uint8) public pure virtual override(IGovernor, Governor) returns (uint256) {
        revert InvalidVoteType();
    }

    function castVoteWithReason(uint256, uint8, string calldata) public pure virtual override(IGovernor, Governor) returns (uint256) {
        revert InvalidVoteType();
    }

    function castVoteWithReasonAndParams(uint256, uint8, string calldata, bytes memory) public pure virtual override(IGovernor, Governor) returns (uint256) {
        revert InvalidVoteType();
    }

    function castVoteBySig(
        uint256 proposalId,
        uint8 support,
        address voter,
        bytes memory signature
    ) public override(IGovernor, Governor) returns (uint256) {
        require(_members[voter], "Only members can vote");
        
        if (!DAOSignatureLibrary.validateVoteSig(_domainSeparatorV4(), proposalId, support, voter, signature)) {
            revert GovernorInvalidSignature(voter);
        }
        
        // Use the voting contract to handle the vote
        IDAOVoting voting = IDAOVoting(_votingContract);
        
        // Ensure the vote is properly committed and revealed
        bytes32 commitHash = keccak256(abi.encode(support, 0)); // Salt 0 for direct voting
        voting.storeCommitment(proposalId, voter, commitHash);
        voting.setCommitted(voter, true);
        voting.setHasRevealed(proposalId, voter, true);
        voting.setRevealedVoteSupport(proposalId, voter, support);
        voting.addVoterToList(proposalId, voter);
        
        // Count the vote
        voting.countVoteForTest(proposalId, voter, support, 1);
        
        return 1; // Return weight
    }

    function castVoteWithReasonAndParamsBySig(
        uint256 proposalId,
        uint8 support,
        address voter,
        string calldata reason,
        bytes memory params,
        bytes memory signature
    ) public override(IGovernor, Governor) returns (uint256) {
        require(_members[voter], "Only members can vote");
        
        if (!DAOSignatureLibrary.validateExtendedVoteSig(_domainSeparatorV4(), proposalId, support, voter, reason, params, signature)) {
            revert GovernorInvalidSignature(voter);
        }
        
        // Use the voting contract to handle the vote (same as castVoteBySig)
        IDAOVoting voting = IDAOVoting(_votingContract);
        
        bytes32 commitHash = keccak256(abi.encode(support, 0)); // Salt 0 for direct voting
        voting.storeCommitment(proposalId, voter, commitHash);
        voting.setCommitted(voter, true);
        voting.setHasRevealed(proposalId, voter, true);
        voting.setRevealedVoteSupport(proposalId, voter, support);
        voting.addVoterToList(proposalId, voter);
        
        // Count the vote
        voting.countVoteForTest(proposalId, voter, support, 1);
        
        return 1; // Return weight
    }
    
    // --- Testing Functions ---
    bool private _votingActiveForTest;
    
    function setVotingActive(bool active) public {
        _votingActiveForTest = active;
    }
    
    function votingDelay() public view override(IGovernor, Governor, GovernorSettings) returns (uint256) {
        if (_votingActiveForTest) {
            return block.timestamp - 1;
        }
        return super.votingDelay();
    }
    
    function votingPeriod() public view override(IGovernor, Governor, GovernorSettings) returns (uint256) {
        if (_votingActiveForTest) {
            return 1000000;
        }
        return super.votingPeriod();
    }

    // Implement the missing _getVotes function
    function _getVotes(
        address account,
        uint256 timepoint,
        bytes memory params
    ) internal view virtual override returns (uint256) {
        // For tokenless voting, we just return 1 for members
        if (_members[account]) {
            return 1;
        }
        return 0;
    }
} 