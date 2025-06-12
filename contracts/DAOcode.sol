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

    interface IgovernanceToken {
        function mint(address to, uint256 amount) external;
        function burnfrom(address _useradd) external;
        function balanceOf(address account) external view  returns (uint256);
        
    }
    interface IpaymentContract {
        function getPaymentToDAO(address _useradd) external view returns (uint256);
       
    }

contract MyGovernor is Governor, GovernorSettings, GovernorCountingSimple, GovernorStorage, GovernorVotes, GovernorVotesQuorumFraction, GovernorTimelockControl {
   
   
    mapping (uint256 => mapping(address => bytes32)) voteCommits;
    mapping (uint256 => mapping(address => uint8)) voteReveals;
    mapping( uint256 => address[]) votersListMap;
    mapping(address => uint256) governorSuccessfulvotes;
    mapping(address => uint256) governorFailedvotes;
    mapping(address => uint8) governorStreakWin;
    mapping(address => uint8) governorStreakLoss;
    mapping(address => bool) committed;
   
    mapping(address => uint256) governorsSuccessfulvotes;

   


    IgovernanceToken public governanceToken;
    IpaymentContract public paymentContract;
    
    uint256 public standardtransactionPower;
    uint256 proposalStartTimes;
    uint256 proposalEndTimes;
      address[] votersList;
     uint256 public totalVoteTime = votingDelay() + votingPeriod();
    event JoinedDAO(address DAOApplicant,address _DAOAddress);
    event VoteCommitted(uint256, address, bytes32);
    event VoteRevealed(uint256, address, uint8);
    constructor(IVotes _token, TimelockController _timelock, address _governanceToken, address _paymentContract, uint256 _standardtransactionPower)
        Governor("MyGovernor")
        GovernorSettings( 4 hours, 2 hours, 0)
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
     function votingDelayed() public pure  returns (uint256) {
        return 4 hours;
    }

    function votingPeriods() public pure  returns (uint256) {
        return 2 hours;
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

    function setStandardTransactionPower(uint256 _standardtransactionPower)
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
    
    // Function to reveal a vote
    function revealVote(uint256 proposalId, uint8 support, uint256 salt) public {
      
        votersList.push(msg.sender);
        votersListMap[proposalId] = votersList;
        require(block.timestamp >= votingDelay() + votingPeriods(), "Voting period has not ended");
        bytes32 commitHash = keccak256(abi.encodePacked(support, salt));
        require(voteCommits[proposalId][msg.sender] == commitHash, "Invalid vote reveal");
        voteReveals[proposalId][msg.sender] = support;
        getVoteCountn(proposalId);

        emit VoteRevealed(proposalId, msg.sender, support);
    }


  
      
   
    // Function to get the vote count
    function getVoteCountn(uint256 proposalId) public  returns (uint256 forVotes, uint256 againstVotes) {
        require(block.timestamp >= votingDelayed() + votingPeriod(), "Votes have not been revealed yet");
        // where forVotes represents true and againstVotes represents false
        forVotes = 0;
        againstVotes = 0;
        for (uint256 i = 0; i < votersListMap[proposalId].length; i++) {
            if (voteReveals[proposalId][votersListMap[proposalId][i]] == 1) {
                forVotes++;
            } else {
                againstVotes++;
            }
        }

        if (forVotes > againstVotes) {
            for(uint256 i= 0; i < votersListMap[proposalId].length; i++){
                if(voteReveals[proposalId][votersListMap[proposalId][i]] == 1 ){
                    governorSuccessfulvotes[votersListMap[proposalId][i]] += 1;
                    governorsSuccessfulvotes[address(this)] += 1;
                    governorStreakWin[votersListMap[proposalId][i]] += 1;
                    governorStreakLoss[votersListMap[proposalId][i]] = 0;
                }
                else{
                    governorFailedvotes[votersListMap[proposalId][i]] += 1;
                    governorStreakWin[votersListMap[proposalId][i]] = 0;
                    governorStreakLoss[votersListMap[proposalId][i]] += 1;
                }
           }
        } else {
            for(uint256 i= 0; i < votersListMap[proposalId].length; i++){
                if(voteReveals[proposalId][votersListMap[proposalId][i]] == 1 ){
                    governorFailedvotes[votersListMap[proposalId][i]] += 1;
                    governorStreakLoss[votersListMap[proposalId][i]] += 1;
                    governorStreakWin[votersListMap[proposalId][i]] = 0;
                }
                else{
                    governorSuccessfulvotes[votersListMap[proposalId][i]] += 1;
                    governorsSuccessfulvotes[address(this)] += 1;
                    governorStreakWin[votersListMap[proposalId][i]] += 1;
                    governorStreakLoss[votersListMap[proposalId][i]] = 0;
                }
           }
        }

        return (forVotes, againstVotes);
    }


    function getGovernorStats(address governor) public view returns (uint256 successfulVotes, uint256 failedVotes, uint8 streak) {
        require(governor != address(0), "Invalid governor address");
        successfulVotes = governorSuccessfulvotes[governor];
        failedVotes = governorFailedvotes[governor];
        streak = governorStreakWin[governor];
    }

    function maxFailurestreak()
    public
    view
    returns (bool) {
        if (governorStreakLoss[msg.sender] >= 5) {
            return true;
        } else {
            return false;
        }
    }

   

    function commitVote(uint256 proposalId,bool support, uint256 salt) public returns(bytes32) {
          if(maxFailurestreak()){
            governanceToken.burnfrom(msg.sender);
           
        }
        require(!committed[msg.sender], "You have already committed a vote");
        require(block.timestamp < votingDelay() , "Voting period has ended");
        bytes32 commitHash = keccak256(abi.encodePacked(support, salt));
        voteCommits[proposalId][msg.sender] = commitHash;
        committed[msg.sender] = true;
        emit VoteCommitted(proposalId, msg.sender, commitHash);

        return commitHash;
    }
    function extraVotecheck(uint256 proposalId, uint8 support, uint256 salt) public  returns (bool) {
         if(maxFailurestreak()){
            governanceToken.burnfrom(msg.sender);
           
        }
        require(committed[msg.sender], "You must commit your vote before casting it");
        require(block.timestamp > votingDelay() && block.timestamp < votingDelay() + votingPeriod(), "Voting period is not active");
        bytes32 commitHash = keccak256(abi.encodePacked(support, salt));
        require(voteCommits[proposalId][msg.sender] == commitHash, "committed vote does not match");
        require(voteReveals[proposalId][msg.sender] == 0, "Vote already revealed");
    }

    function castVote(uint256 proposalId, uint8 support,uint256 salt) public returns (uint256) {
        extraVotecheck(proposalId, support, salt);
        // Cast the vote using the Governor contract's castVote function

        Governor.castVote(proposalId, support);
        committed[msg.sender] = false; // Reset the commit status after casting the vote
        emit VoteCast(msg.sender, proposalId, support, 1 , "Vote cast successfully");
    }

   
    function castVoteWithReason(
        uint256 proposalId,
        uint8 support,
        string calldata reason,
        uint256 salt
    ) public returns (uint256) {
        extraVotecheck(proposalId, support, salt);
        // Cast the vote using the Governor contract's castVoteWithReason function
        emit VoteCast(msg.sender, proposalId, support, 1, reason);
        committed[msg.sender] = false; // Reset the commit status after casting the vote
        return Governor.castVoteWithReason(proposalId, support, reason);
        
    }

   
    function castVoteWithReasonAndParams(
        uint256 proposalId,
        uint8 support,
        uint256 salt,
        string calldata reason,
        bytes memory params
    ) public returns (uint256) {
        extraVotecheck(proposalId, support, salt);
        Governor.castVoteWithReasonAndParams(proposalId, support, reason, params);
        committed[msg.sender] = false; // Reset the commit status after casting the vote
        emit VoteCast(msg.sender, proposalId, support, 1, reason);
    }
                                                                                                                                   
  
    function castVoteBySig(
        uint256 proposalId,              
        uint8 support,
        uint256 salt,
        address voter,
        bytes memory signature
    ) public returns (uint256) {
        extraVotecheck(proposalId, support, salt);
        Governor.castVoteBySig(proposalId, support, voter, signature);
        committed[msg.sender] = false; // Reset the commit status after casting the vote
        emit VoteCast(voter, proposalId, support, 1, "Vote cast by signature");
    }

    
    function castVoteWithReasonAndParamsBySig(
        uint256 proposalId,
        uint8 support,
        uint256 salt,
        address voter,
        string calldata reason,
        bytes memory params,
        bytes memory signature
    ) public returns (uint256) {
        extraVotecheck(proposalId, support, salt);
        Governor.castVoteWithReasonAndParamsBySig(proposalId, support, voter, reason, params, signature);
        committed[msg.sender] = false; // Reset the commit status after casting the vote
        emit VoteCast(voter, proposalId, support, 1, reason);
    }

     function governorSuccesfulvotes(address governor) external view returns (uint256) {
        return governorsSuccessfulvotes[governor];
    }

    function governorfailedvotes(address governor) external view returns (uint256) {
        return governorFailedvotes[governor];
    }

    function governorStreak(address governor) external view returns (uint8) {
        return governorStreakWin[governor];
    }
    function governorsSuccesfulvotes() external view returns (uint256) {
        return governorsSuccessfulvotes[address(this)];
    }

    
  

   

   
}

