const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');
const { authenticateToken } = require('../middleware');

// Get user's transactions
router.get('/user', authenticateToken, async (req, res) => {
  try {
    // Get transactions where user is either buyer or seller
    const userTransactions = db.transactions.filter(
      tx => tx.buyer.toLowerCase() === req.user.address.toLowerCase() || 
            tx.seller.toLowerCase() === req.user.address.toLowerCase()
    );
    
    res.json(userTransactions);
  } catch (error) {
    console.error('Error getting user transactions:', error);
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

// Get transaction by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const transaction = db.transactions.find(tx => tx.id === req.params.id);
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    // Check if user is involved in the transaction
    if (transaction.buyer.toLowerCase() !== req.user.address.toLowerCase() && 
        transaction.seller.toLowerCase() !== req.user.address.toLowerCase()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    res.json(transaction);
  } catch (error) {
    console.error('Error getting transaction:', error);
    res.status(500).json({ error: 'Failed to get transaction' });
  }
});

// Create new transaction
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { listingId, quantity, shippingOption, deliveryAddress, transactionHash } = req.body;
    
    // Validate required fields
    if (!listingId || !quantity || !shippingOption || !deliveryAddress || !transactionHash) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Find listing
    const listing = db.listings.find(l => l.id === listingId);
    
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    
    // Verify transaction on blockchain
    try {
      const tx = await provider.getTransactionReceipt(transactionHash);
      
      if (!tx || !tx.status) {
        return res.status(400).json({ error: 'Invalid transaction or transaction failed' });
      }
      
      // Create new transaction
      const newTransaction = {
        id: generateId(),
        listingId,
        listingName: listing.name,
        listingImageUrl: listing.imageUrls[0],
        quantity,
        price: listing.price,
        totalAmount: (parseFloat(listing.price) * quantity).toString(),
        shippingOption,
        deliveryAddress,
        buyer: req.user.address,
        seller: listing.seller,
        status: 'pending',
        paymentStatus: 'paid',
        transactionHash,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        events: [
          {
            type: 'payment',
            status: 'completed',
            timestamp: new Date().toISOString(),
            data: { transactionHash }
          }
        ]
      };
      
      // Add to database
      db.transactions.push(newTransaction);
      
      // Update listing quantity
      const listingIndex = db.listings.findIndex(l => l.id === listingId);
      if (listingIndex !== -1) {
        db.listings[listingIndex].quantity = Math.max(0, db.listings[listingIndex].quantity - quantity);
        
        // Mark as sold out if quantity reaches 0
        if (db.listings[listingIndex].quantity === 0) {
          db.listings[listingIndex].status = 'sold_out';
        }
      }
      
      saveData();
      
      res.status(201).json(newTransaction);
    } catch (error) {
      console.error('Error verifying transaction:', error);
      res.status(500).json({ error: 'Failed to verify transaction' });
    }
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

// Update transaction status
router.put('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status, transactionHash } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }
    
    // Find transaction
    const transactionIndex = db.transactions.findIndex(tx => tx.id === req.params.id);
    
    if (transactionIndex === -1) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    const transaction = db.transactions[transactionIndex];
    
    // Check permissions based on the status update
    if (status === 'shipped' && transaction.seller.toLowerCase() !== req.user.address.toLowerCase()) {
      return res.status(403).json({ error: 'Only the seller can mark as shipped' });
    }
    
    if (status === 'delivered' && transaction.buyer.toLowerCase() !== req.user.address.toLowerCase()) {
      return res.status(403).json({ error: 'Only the buyer can confirm delivery' });
    }
    
    if (status === 'disputed' && transaction.buyer.toLowerCase() !== req.user.address.toLowerCase()) {
      return res.status(403).json({ error: 'Only the buyer can open a dispute' });
    }
    
    // Update status
    transaction.status = status;
    transaction.updatedAt = new Date().toISOString();
    
    // Add event
    transaction.events.push({
      type: 'status_update',
      status,
      timestamp: new Date().toISOString(),
      data: { transactionHash }
    });
    
    // If status is "delivered", update payment status to "released"
    if (status === 'delivered') {
      transaction.paymentStatus = 'released';
    }
    
    // If status is "disputed", update payment status to "in_dispute"
    if (status === 'disputed') {
      transaction.paymentStatus = 'in_dispute';
    }
    
    saveData();
    
    res.json(transaction);
  } catch (error) {
    console.error('Error updating transaction status:', error);
    res.status(500).json({ error: 'Failed to update transaction status' });
  }
});

// Submit transaction review
router.post('/:id/review', authenticateToken, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Valid rating (1-5) is required' });
    }
    
    // Find transaction
    const transactionIndex = db.transactions.findIndex(tx => tx.id === req.params.id);
    
    if (transactionIndex === -1) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    const transaction = db.transactions[transactionIndex];
    
    // Check if user is the buyer
    if (transaction.buyer.toLowerCase() !== req.user.address.toLowerCase()) {
      return res.status(403).json({ error: 'Only the buyer can leave a review' });
    }
    
    // Check if transaction is completed
    if (transaction.status !== 'delivered') {
      return res.status(400).json({ error: 'Can only review completed transactions' });
    }
    
    // Check if already reviewed
    if (transaction.review) {
      return res.status(400).json({ error: 'Transaction already reviewed' });
    }
    
    // Add review
    transaction.review = {
      rating,
      comment,
      timestamp: new Date().toISOString()
    };
    
    // Update seller rating
    const sellerIndex = db.users.findIndex(u => u.walletAddress.toLowerCase() === transaction.seller.toLowerCase());
    
    if (sellerIndex !== -1 && db.users[sellerIndex].sellerInfo) {
      const currentRating = db.users[sellerIndex].sellerInfo.rating || 0;
      const totalRatings = db.users[sellerIndex].sellerInfo.totalRatings || 0;
      
      // Calculate new average rating
      const newTotalRatings = totalRatings + 1;
      const newRating = ((currentRating * totalRatings) + rating) / newTotalRatings;
      
      db.users[sellerIndex].sellerInfo.rating = newRating;
      db.users[sellerIndex].sellerInfo.totalRatings = newTotalRatings;
    }
    
    saveData();
    
    res.json(transaction);
  } catch (error) {
    console.error('Error submitting review:', error);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// Helper function to generate unique IDs
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

module.exports = router; 