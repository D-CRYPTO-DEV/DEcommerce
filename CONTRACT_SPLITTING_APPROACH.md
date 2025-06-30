# Contract Splitting Approach

To optimize our DAO governance system for Ethereum deployment, we've split the functionality across multiple contracts to stay under the 24KB contract size limit.

## Contract Structure

### Core Contracts

1. **DAOGovernanceCore**
   - Handles proposal creation, execution, and queuing
   - Manages DAO membership (tokenless approach)
   - Calculates quorum based on member count
   - Interfaces with TimelockController

2. **DAOVoting**
   - Manages commit-reveal voting mechanism
   - Tracks voter statistics
   - Handles vote counting
   - Equal voting weight for all members (1 person = 1 vote)

3. **DAORewardTreasury**
   - Manages the DAO treasury
   - Handles reward distribution based on voting performance

### Libraries

1. **DAOVotingLibrary**
   - Vote counting functions
   - Voter statistics calculations

2. **DAOSignatureLibrary**
   - Signature validation for voting
   - Secure vote verification

## Tokenless Voting System

Our DAO implements a tokenless voting system with the following characteristics:

1. **Membership Requirements**
   - Users must make a payment to the DAO above a threshold value
   - Each address can only join once

2. **Democratic Voting**
   - Each member has equal voting power (1 vote)
   - No token ownership required for participation

3. **Quorum Calculation**
   - Quorum is calculated as a percentage of total members
   - Configurable quorum numerator (e.g., 51% of members)

4. **Decision Making**
   - Proposals pass if they receive more FOR votes than AGAINST votes
   - Proposals must meet quorum requirements

## Benefits of Tokenless Approach

1. **Increased Accessibility**
   - No need to acquire governance tokens
   - More inclusive governance model

2. **Simplified Implementation**
   - Removed dependencies on ERC20 token contracts
   - Reduced contract complexity

3. **Equal Representation**
   - Prevents wealth concentration from affecting governance
   - One member, one vote principle

## Contract Interactions

The contracts interact as follows:

1. DAOGovernanceCore tracks DAO membership and forwards voting operations to DAOVoting
2. DAOVoting handles the vote counting and statistics tracking
3. DAORewardTreasury distributes rewards based on voting statistics

## Size Optimization

By splitting the contracts, we've achieved significant size reductions:
- DAOGovernanceCore: ~20KB (under the 24KB limit)
- DAOVoting: ~7KB
- Libraries: ~3KB each

This approach allows for deployment on Ethereum mainnet while maintaining all required functionality. 