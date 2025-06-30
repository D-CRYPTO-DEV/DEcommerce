const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');
const { authenticateToken } = require('../middleware');

// Get all proposals
router.get('/proposals', async (req, res) => {
  try {
    // Get proposals from blockchain
    const governanceContract = new ethers.Contract(
      process.env.GOVERNANCE_CONTRACT_ADDRESS,
      governanceContractABI,
      provider
    );
    
    // Get proposal count
    const proposalCount = await governanceContract.getProposalCount();
    
    // Fetch all proposals
    const proposals = [];
    
    for (let i = 1; i <= proposalCount; i++) {
      try {
        const proposalData = await governanceContract.getProposal(i);
        
        // Format proposal data
        const proposal = {
          id: i.toString(),
          title: proposalData.title,
          description: proposalData.description,
          proposer: proposalData.proposer,
          startTime: new Date(proposalData.startTime.toNumber() * 1000).toISOString(),
          endTime: new Date(proposalData.endTime.toNumber() * 1000).toISOString(),
          executed: proposalData.executed,
          proposalType: proposalData.proposalType,
          status: getProposalStatus(proposalData),
          votesFor: ethers.utils.formatEther(proposalData.votesFor),
          votesAgainst: ethers.utils.formatEther(proposalData.votesAgainst),
          createdAt: new Date(proposalData.createdAt.toNumber() * 1000).toISOString()
        };
        
        // Add additional data from local database if available
        const localProposal = db.proposals.find(p => p.id === i.toString());
        if (localProposal) {
          proposal.additionalData = localProposal.additionalData;
        }
        
        proposals.push(proposal);
      } catch (error) {
        console.error(`Error fetching proposal ${i}:`, error);
      }
    }
    
    res.json(proposals);
  } catch (error) {
    console.error('Error getting proposals:', error);
    res.status(500).json({ error: 'Failed to get proposals' });
  }
});

// Get proposal by ID
router.get('/proposals/:id', async (req, res) => {
  try {
    const proposalId = req.params.id;
    
    // Get proposal from blockchain
    const governanceContract = new ethers.Contract(
      process.env.GOVERNANCE_CONTRACT_ADDRESS,
      governanceContractABI,
      provider
    );
    
    const proposalData = await governanceContract.getProposal(proposalId);
    
    // Format proposal data
    const proposal = {
      id: proposalId,
      title: proposalData.title,
      description: proposalData.description,
      proposer: proposalData.proposer,
      startTime: new Date(proposalData.startTime.toNumber() * 1000).toISOString(),
      endTime: new Date(proposalData.endTime.toNumber() * 1000).toISOString(),
      executed: proposalData.executed,
      proposalType: proposalData.proposalType,
      status: getProposalStatus(proposalData),
      votesFor: ethers.utils.formatEther(proposalData.votesFor),
      votesAgainst: ethers.utils.formatEther(proposalData.votesAgainst),
      createdAt: new Date(proposalData.createdAt.toNumber() * 1000).toISOString()
    };
    
    // Add additional data from local database if available
    const localProposal = db.proposals.find(p => p.id === proposalId);
    if (localProposal) {
      proposal.additionalData = localProposal.additionalData;
    }
    
    // Get votes for this proposal
    const votingContract = new ethers.Contract(
      process.env.VOTING_CONTRACT_ADDRESS,
      votingContractABI,
      provider
    );
    
    // Get vote events
    const voteFilter = votingContract.filters.VoteRevealed(null, proposalId);
    const voteEvents = await votingContract.queryFilter(voteFilter);
    
    // Format vote data
    const votes = voteEvents.map(event => {
      const { voter, proposalId, vote, weight } = event.args;
      return {
        voter,
        proposalId: proposalId.toString(),
        vote: vote ? 'For' : 'Against',
        weight: ethers.utils.formatEther(weight)
      };
    });
    
    proposal.votes = votes;
    
    res.json(proposal);
  } catch (error) {
    console.error('Error getting proposal:', error);
    res.status(500).json({ error: 'Failed to get proposal' });
  }
});

// Create new proposal (off-chain record)
router.post('/proposals', authenticateToken, async (req, res) => {
  try {
    const { proposalId, additionalData } = req.body;
    
    if (!proposalId || !additionalData) {
      return res.status(400).json({ error: 'Proposal ID and additional data are required' });
    }
    
    // Check if proposal already exists in local database
    const existingProposal = db.proposals.find(p => p.id === proposalId);
    
    if (existingProposal) {
      return res.status(400).json({ error: 'Proposal already exists' });
    }
    
    // Create new proposal record
    const newProposal = {
      id: proposalId,
      additionalData,
      createdBy: req.user.address,
      createdAt: new Date().toISOString()
    };
    
    // Add to database
    db.proposals.push(newProposal);
    saveData();
    
    res.status(201).json(newProposal);
  } catch (error) {
    console.error('Error creating proposal record:', error);
    res.status(500).json({ error: 'Failed to create proposal record' });
  }
});

// Submit dispute
router.post('/disputes', authenticateToken, async (req, res) => {
  try {
    const { transactionId, reason, evidence, transactionHash } = req.body;
    
    if (!transactionId || !reason) {
      return res.status(400).json({ error: 'Transaction ID and reason are required' });
    }
    
    // Find transaction
    const transaction = db.transactions.find(tx => tx.id === transactionId);
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    // Check if user is the buyer
    if (transaction.buyer.toLowerCase() !== req.user.address.toLowerCase()) {
      return res.status(403).json({ error: 'Only the buyer can open a dispute' });
    }
    
    // Check if transaction is in a valid state for dispute
    if (transaction.status === 'delivered' || transaction.status === 'disputed' || transaction.status === 'refunded') {
      return res.status(400).json({ error: 'Cannot dispute this transaction in its current state' });
    }
    
    // Create new dispute
    const newDispute = {
      id: generateId(),
      transactionId,
      reason,
      evidence,
      buyer: transaction.buyer,
      seller: transaction.seller,
      amount: transaction.totalAmount,
      status: 'pending',
      proposalId: null, // Will be set when governance proposal is created
      transactionHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      events: [
        {
          type: 'dispute_opened',
          timestamp: new Date().toISOString(),
          data: { reason }
        }
      ]
    };
    
    // Add to database
    db.reports.push(newDispute);
    
    // Update transaction status
    const transactionIndex = db.transactions.findIndex(tx => tx.id === transactionId);
    if (transactionIndex !== -1) {
      db.transactions[transactionIndex].status = 'disputed';
      db.transactions[transactionIndex].paymentStatus = 'in_dispute';
      db.transactions[transactionIndex].updatedAt = new Date().toISOString();
      db.transactions[transactionIndex].events.push({
        type: 'dispute',
        status: 'opened',
        timestamp: new Date().toISOString(),
        data: { disputeId: newDispute.id }
      });
    }
    
    saveData();
    
    res.status(201).json(newDispute);
  } catch (error) {
    console.error('Error submitting dispute:', error);
    res.status(500).json({ error: 'Failed to submit dispute' });
  }
});

// Helper function to determine proposal status
function getProposalStatus(proposalData) {
  const now = Math.floor(Date.now() / 1000);
  const startTime = proposalData.startTime.toNumber();
  const endTime = proposalData.endTime.toNumber();
  
  if (proposalData.executed) {
    return 'Executed';
  } else if (now < startTime) {
    return 'Pending';
  } else if (now >= startTime && now < endTime) {
    return 'Active';
  } else {
    // Check if proposal passed based on votes
    const votesFor = parseFloat(ethers.utils.formatEther(proposalData.votesFor));
    const votesAgainst = parseFloat(ethers.utils.formatEther(proposalData.votesAgainst));
    
    if (votesFor > votesAgainst) {
      return 'Passed';
    } else {
      return 'Rejected';
    }
  }
}

// Helper function to generate unique IDs
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

module.exports = router; 