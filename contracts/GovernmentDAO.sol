// /// SPDX-License-Identifier: MIT
// pragma solidity ^0.8.27;

// // OpenZeppelin Imports
// import {Governor} from "@openzeppelin/contracts/governance/Governor.sol";
// import {GovernorSettings} from "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
// import {GovernorTimelockControl} from "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
// import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
// import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
// import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

// /**
//  * @title MyGovernor
//  * @author Your Name
//  * @notice A comprehensive governance contract implementing a commit-reveal scheme
//  * with gasless reveals powered by a backend relayer and EIP-712 signatures.
//  * It features a 1-person-1-vote system and tracks voter statistics.
//  * @dev This contract is designed to work with an off-chain relayer that calls
//  * `revealVoteBySig` on behalf of users.
//  */
// abstract  contract MyGovernor is EIP712, Governor, GovernorSettings, GovernorTimelockControl {
//     // --- Custom Errors for Gas Efficiency ---
//     error AlreadyCommitted(address voter);
//     error NotCommitted(address voter);
//     error AlreadyRevealed(address voter);
//     error InvalidSignature();
//     error CommitmentMismatch();
//     error RevealWindowClosed();
//     error CommitWindowClosed();
//     error InvalidVoteType();

//     // --- State Variables ---
//      struct VoteCounts {
//         uint256 againstVotes;
//         uint256 forVotes;
//         uint256 abstainVotes;
//     }
//     mapping(uint256 => VoteCounts) private _myProposalVotes;
    
//     // Voter Statistics
//     mapping(address => uint256) public voterSuccessfulVotes;
//     mapping(address => uint256) public voterFailedVotes;
//     mapping(address => uint8) public voterWinStreak;
//     mapping(address => uint8) public voterLossStreak;

//     // Commit-Reveal Data
//     mapping(uint256 => mapping(address => bytes32)) public voteCommits;
//     mapping(uint256 => mapping(address => bool)) public hasRevealed;
//     mapping(uint256 => mapping(address => uint8)) public revealedVoteSupport;
//     mapping(uint256 => address[]) public votersList;

//     // --- EIP-712 ---
//     bytes32 public constant REVEALVOTE_TYPEHASH = keccak256(
//         "RevealVote(uint256 proposalId,uint8 support,uint256 salt)"
//     );

//     // --- Events ---
//     event VoteCommitted(uint256 indexed proposalId, address indexed voter, bytes32 commit);
//     event VoteRevealedByRelayer(uint256 indexed proposalId, address indexed voter, uint8 support);
    
//     // --- Constructor ---
//     constructor(TimelockController _timelock)
//         Governor("MyGovernor")
//         // Voting period is split: 50% for commit, 50% for reveal.
//         // Example: 4 days total = 2 day commit window, 2 day reveal window.
//         GovernorSettings(1 days, 4 days, 0)
//         GovernorTimelockControl(_timelock)
//         // Initialize the EIP712 domain separator for signature security
//     {}

//     // --- Timing Logic for Relayer ---
    
//     /**
//      * @notice The block number when the voting period for a proposal ends.
//      */
//     function proposalDeadline(uint256 proposalId) public view override returns (uint256) {
//         uint256 deadlineBlock = proposalDeadline(proposalId);
//         return  deadlineBlock;
//     }

//     /**
//      * @notice The block number when the commit period ends. This marks the start of the reveal window.
//      * @dev This is set to be halfway through the total voting period.
//      */
//     function commitDeadline(uint256 proposalId) public view returns (uint256) {
//          // Use the public getter functions provided by the parent Governor contract
//     uint256 snapshotBlock = proposalSnapshot(proposalId);
//     uint256 deadlineBlock = proposalDeadline(proposalId);

//     // If snapshot is 0, the proposal doesn't exist or hasn't started.
//     if (snapshotBlock == 0) return 0;

//     uint256 votingPeriodDuration = deadlineBlock - snapshotBlock;
//     return snapshotBlock + (votingPeriodDuration / 2);
//     }
    
//     // --- Governance Workflow ---

//     /**
//      * @notice Step 1 (User): Commits a vote by submitting a hash. Must be called before the commit deadline.
//      * @param proposalId The ID of the proposal.
//      * @param commitment The keccak256 hash of (voter address, support, salt). Generated off-chain.
//      */
//     function commitVote(uint256 proposalId, bytes32 commitment) public {
//         if (block.number > commitDeadline(proposalId)) revert CommitWindowClosed();
//         if (voteCommits[proposalId][msg.sender] != bytes32(0)) revert AlreadyCommitted(msg.sender);
        
//         voteCommits[proposalId][msg.sender] = commitment;
//         emit VoteCommitted(proposalId, msg.sender, commitment);
//     }
    
//     /**
//      * @notice Step 2 (Relayer): Reveals a vote using a signature. Called by the authorized relayer.
//      * @dev Must be called after the commit deadline but before the proposal deadline.
//      */
//     function revealVoteBySig(
//         address voter,
//         uint256 proposalId,
//         uint8 support,
//         uint256 salt,
//         bytes memory signature
//     ) public {
//         // Time-based checks
//         uint256 _commitDeadline = commitDeadline(proposalId);
//         if (block.number > proposalDeadline(proposalId)) revert RevealWindowClosed();
//         if (block.number <= _commitDeadline) revert CommitWindowClosed(); // Reveal can only happen after commit window

//         // State-based checks
//         if (voteCommits[proposalId][voter] == bytes32(0)) revert NotCommitted(voter);
//         if (hasRevealed[proposalId][voter]) revert AlreadyRevealed(voter);

//         // 1. Verify EIP-712 Signature
//         bytes32 structHash = keccak256(abi.encode(REVEALVOTE_TYPEHASH, proposalId, support, salt));
//         bytes32 digest = _hashTypedDataV4(structHash);
//         address signer = ECDSA.recover(digest, signature);
//         if (signer != voter) revert InvalidSignature();

//         // 2. Verify Commitment Hash
//         bytes32 expectedCommitment = keccak256(abi.encodePacked(voter, support, salt));
//         if (voteCommits[proposalId][voter] != expectedCommitment) revert CommitmentMismatch();
        
//         // 3. Reveal and Cast Vote
//         hasRevealed[proposalId][voter] = true;
//         revealedVoteSupport[proposalId][voter] = support;
//         votersList[proposalId].push(voter);

//         // This triggers the _countVote override. Weight is 1 for 1-person-1-vote.
//         _castVote(proposalId, voter, support, 1, "");
//         _castVote(proposalId, voter, support, "");
//         emit VoteRevealedByRelayer(proposalId, voter, support);
//     }
    
//     // --- Core Governor Overrides ---

//     /**
//      * @notice Overrides the default vote counting mechanism to implement 1-person-1-vote.
//      * @dev Ignores token balance (weight) from the ERC20Votes token.
//      */
  
//     function _countVote(
//         uint256 proposalId,
//         address, // 'account' parameter is unused as we use 'voter' from revealVoteBySig
//         uint8 support,
//         uint256 weight // 'weight' is used as 1 for each valid reveal
//     ) internal{
//         VoteCounts storage counts = _myProposalVotes[proposalId];
//         if (support == uint8(Governor.VoteType.Against)) {
//             counts.againstVotes += weight;
//         } else if (support == uint8(Governor.VoteType.For)) {
//             counts.forVotes += weight;
//         } else if (support == uint8(Governor.VoteType.Abstain)) {
//             counts.abstainVotes += weight;
//         } else {
//             revert InvalidVoteType();
//         }
//     }
//     /**
//      * @notice Hook called upon successful execution of a proposal to update voter stats.
//      */
      
//     function _execute(
//         uint256 proposalId,
//         address[] memory targets,
//         uint256[] memory values,
//         bytes[] memory calldatas,
//         bytes32 descriptionHash
//     ) internal virtual override(Governor, GovernorTimelockControl) {
//         super._execute(proposalId, targets, values, calldatas, descriptionHash);
//         _updateVoterStats(proposalId, true);
//     }
//     // FIX #2: The function signature now correctly includes the parameter names.
//     function _cancel(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash) internal override(Governor, GovernorTimelockControl) returns (uint256 proposalId) {
//         proposalId = super._cancel(targets, values, calldatas, descriptionHash);
//         _updateVoterStats(proposalId, false);
//     }

//     /**
//      * @dev Internal function to update voter statistics based on proposal outcome.
//      * @param proposalId The ID of the finalized proposal.
//      * @param proposalSucceeded True if the proposal passed, false otherwise.
//      */
//     function _updateVoterStats(uint256 proposalId, bool proposalSucceeded) private {
//         address[] memory voters = votersList[proposalId];
//         for (uint i = 0; i < voters.length; i++) {
//             address voter = voters[i];
//             uint8 support = revealedVoteSupport[proposalId][voter];
            
//             // A "win" for the voter is voting FOR a successful proposal, or AGAINST a failed one.
//             bool voterWon = (support == uint8(Governor.VoteType.For) && proposalSucceeded) || (support == uint8(Governor.VoteType.Against) && !proposalSucceeded);

//             if (voterWon) {
//                 voterSuccessfulVotes[voter]++;
//                 voterWinStreak[voter]++;
//                 voterLossStreak[voter] = 0;
//             } else { // Voting FOR a failed proposal or AGAINST a successful one is a loss.
//                 voterFailedVotes[voter]++;
//                 voterLossStreak[voter]++;

//             }
//         }
//     }
//     // --- Required Overrides for Solidity Compilation ---
//     function state(uint256 proposalId) public view override(Governor, GovernorTimelockControl) returns (ProposalState) { return super.state(proposalId); }
//     function proposalThreshold() public view override(Governor, GovernorSettings) returns (uint256) { return super.proposalThreshold(); }
//     function _queueOperations(uint256 pId, address[] memory t, uint256[] memory v, bytes[] memory c, bytes32 dH) internal override(Governor, GovernorTimelockControl) returns (uint48) { return super._queueOperations(pId, t, v, c, dH); }
//     function _executeOperations(uint256 pId, address[] memory t, uint256[] memory v, bytes[] memory c, bytes32 dH) internal override(Governor, GovernorTimelockControl) { super._executeOperations(pId, t, v, c, dH); }
//     function _executor() internal view override(Governor, GovernorTimelockControl) returns (address) { return super._executor(); }
//     function proposalNeedsQueuing(uint256 proposalId) public view override(Governor, GovernorTimelockControl) returns (bool) {
//         return super.proposalNeedsQueuing(proposalId);
//     }
// }   