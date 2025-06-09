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

contract MyGovernor is Governor, GovernorSettings, GovernorCountingSimple, GovernorStorage, GovernorVotes, GovernorVotesQuorumFraction, GovernorTimelockControl {
    interface IgovernanceToken {
        function mint(address to, uint256 amount) external;
        function burnfrom(address _useradd) external;
        
    }

    interface IpaymentContract {
        function getPaymentToDAO(address _useradd) external view returns (uint256);
       
    }

    mapping (uint8 => mapping(address => bytes32)) voteCommits;
    mapping (uint8 => mapping(address => bool)) voteReveals;
    mapping( uint256 => address[]) votersListMap;
    mapping(address => uint256) governorsSuccessfulvotes;
    mapping(address => uint256) governorsFailedvotes;
    mapping(address => uint8) governorsStreak;


    IgovernanceToken public governanceToken;
    IpaymentContract public paymentContract;
    
    uint256 public standardtransactionPower;
    event JoinedDAO(address DAOApplicant,address _DAOAddress);
    constructor(IVotes _token, TimelockController _timelock, address _governanceToken, address _paymentContract, _standardtransactionPower)
        Governor("MyGovernor")
        GovernorSettings(4 hours, 1 weeks, 0)
        GovernorVotes(_token)
        GovernorVotesQuorumFraction(4)
        GovernorTimelockControl(_timelock)
    { 
        require(_governanceToken != address(0), "Invalid governance token address");
        require(_paymentContract != address(0), "Invalid payment contract address");
        
        governanceToken = IgovernanceToken(_governanceToken);
        paymentContract = IpaymentContract(_paymentContract);
        standardtransactionPower = _standardtransactionPower;
    }

    // The following functions are overrides required by Solidity.

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

    function standardtransactionPower(uint256 _standardtransactionPower)
        internal   
    {
        standardtransactionPower = _standardtransactionPower;
    }

    function joinDAO(address _DAOAddress) external {
        require(_DAOAddress != address(0), "Invalid DAO address");
        require(governanceToken.balanceOf(msg.sender) > 0, "You must hold governance tokens to join the DAO");
        require(paymentContract.getPaymentToDAO(msg.sender) > standardtransactionPower , "You must have made a payment to the DAO to join");
        governanceToken.mint(msg.sender, 1000); // Minting 1000 governance tokens to the user as as voting power
        // Logic to join the DAO, such as transferring tokens or registering
        // This is a placeholder for actual DAO joining logic   
        emit JoinedDAO(msg.sender, _DAOAddress);
    }

    function _removeMemberFromDAO(address _memberAddress) internal {
        require(_memberAddress != address(0), "Invalid member address");
        require(governanceToken.balanceOf(_memberAddress) > 0, "Member does not hold governance tokens");
        // Logic to remove the member from the DAO
        // This is a placeholder for actual DAO removal logic
        governanceToken.burnfrom(_memberAddress); // Burn the governance tokens of the member
    }   
 // voting hashing function

 // Function to commit a vote
    function commitVote(uint256 proposalId,bool support, uint256 salt) public {
        require(block.timestamp < proposalEndTimes[proposalId], "Voting period has ended");
        bytes32 commitHash = keccak256(abi.encodePacked(support, salt));
        voteCommits[proposalId][msg.sender] = commitHash;

        emit VoteCommitted(proposalId, msg.sender, commitHash);
    }

    // Function to reveal a vote
    function revealVote(uint256 proposalId, bool support, uint256 salt) public {
        address[] votersList;
        votersList.push(msg.sender)
        votersListMap[proposalId] = votersList;
        require(block.timestamp >= proposalEndTimes[proposalId], "Voting period has not ended");
        bytes32 commitHash = keccak256(abi.encodePacked(support, salt));
        require(voteCommits[proposalId][msg.sender] == commitHash, "Invalid vote reveal");
        voteReveals[proposalId][msg.sender] = support;

        emit VoteRevealed(proposalId, msg.sender, support);
    }

    // Function to get the vote count
    function getVoteCount(uint256 proposalId) public view returns (uint256 forVotes, uint256 againstVotes) {
        require(block.timestamp >= proposalEndTimes[proposalId], "Votes have not been revealed yet");
        forVotes = 0;
        againstVotes = 0;
        for (uint256 i = 0; i < voteReveals[proposalId].length; i++) {
            if (voteReveals[proposalId][i]) {
                forVotes++;
            } else {
                againstVotes++;
            }
        }

        if (forVotes > againstVotes) {
            for(uint256 i= 0; i < votersListMap[proposalId].length; i++){
                if(voteReveals[proposalId][votersListMap[proposalId][i]] = forVotes ){
                    governorsSuccessfulvotes[votersListMap[proposalId][i]] += 1;
                    governorsStreak[votersListMap[proposalId][i]] += 1;
                }
                else{
                    governorsfailedvotes[votersListMap[proposalId][i]] += 1;
                    governorsStreak[votersListMap[proposalId][i]] = 0;
                }
           }
        } else {
            for(uint256 i= 0; i < votersListMap[proposalId].length; i++){
                if(voteReveals[proposalId][votersListMap[proposalId][i]] = forVotes ){
                    governorsfailedvotes[votersListMap[proposalId][i]] += 1;
                    governorsStreak[votersListMap[proposalId][i]] = 0;
                }
                else{
                    governorssuccesfulvotes[votersListMap[proposalId][i]] += 1;
                    governorsStreak[votersListMap[proposalId][i]] += 1;
                }
           }
        }

        return (forVotes, againstVotes);
    }


    function getGovernorStats(address governor) public view returns (uint256 successfulVotes, uint256 failedVotes, uint8 streak) {
        require(governor != address(0), "Invalid governor address");
        successfulVotes = governorsSuccessfulvotes[governor];
        failedVotes = governorsFailedvotes[governor];
        streak = governorsStreak[governor];
    }

    function castVote(uint256 proposalId, uint8 support) public override returns (uint256) {
        return false;
    }
     function castVoteWithReason(
        uint256 proposalId,
        uint8 support,
        string calldata reason
    ) public override returns (uint256) {
        return false;
    }

   
    function castVoteWithReasonAndParams(
        uint256 proposalId,
        uint8 support,
        string calldata reason,
        bytes memory params
    ) public virtual returns (uint256) {
        
        return false;
    }

   
    function castVoteBySig(
        uint256 proposalId,
        uint8 support,
        address voter,
        bytes memory signature
    ) public virtual returns (uint256) {
      
        return false;
    }

    
    function castVoteWithReasonAndParamsBySig(
        uint256 proposalId,
        uint8 support,
        address voter,
        string calldata reason,
        bytes memory params,
        bytes memory signature
    ) public virtual returns (uint256) {
        return false;
    }
    

   
}

