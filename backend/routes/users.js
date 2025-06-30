const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');
const { authenticateToken, uploadToIPFS } = require('../middleware');

// Get user profile
router.get('/:address', authenticateToken, (req, res) => {
  const { address } = req.params;
  
  // Check if the address belongs to the authenticated user
  if (req.user.address.toLowerCase() !== address.toLowerCase()) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  
  const user = db.users.find(u => u.walletAddress.toLowerCase() === address.toLowerCase());
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json({
    id: user.id,
    walletAddress: user.walletAddress,
    displayName: user.displayName,
    profileImageUrl: user.profileImageUrl,
    bio: user.bio,
    isSeller: user.isSeller,
    isCourier: user.isCourier,
    sellerInfo: user.sellerInfo,
    courierInfo: user.courierInfo,
    createdAt: user.createdAt
  });
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  const { displayName, bio, profileImage } = req.body;
  
  const userIndex = db.users.findIndex(u => u.id === req.user.id);
  
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Update profile fields
  if (displayName) {
    db.users[userIndex].displayName = displayName;
  }
  
  if (bio) {
    db.users[userIndex].bio = bio;
  }
  
  // Handle profile image upload to IPFS if provided
  if (profileImage) {
    try {
      const cid = await uploadToIPFS({
        name: `profile_${req.user.id}`,
        image: profileImage
      });
      
      db.users[userIndex].profileImageUrl = `https://ipfs.io/ipfs/${cid}`;
    } catch (error) {
      console.error('Error uploading profile image:', error);
      return res.status(500).json({ error: 'Failed to upload profile image' });
    }
  }
  
  // Save changes
  saveData();
  
  res.json({
    id: db.users[userIndex].id,
    walletAddress: db.users[userIndex].walletAddress,
    displayName: db.users[userIndex].displayName,
    profileImageUrl: db.users[userIndex].profileImageUrl,
    bio: db.users[userIndex].bio,
    isSeller: db.users[userIndex].isSeller,
    isCourier: db.users[userIndex].isCourier
  });
});

// Register as seller
router.post('/register-seller', authenticateToken, async (req, res) => {
  const { location, categories, transactionHash } = req.body;
  
  if (!location || !categories || !transactionHash) {
    return res.status(400).json({ error: 'Location, categories, and transaction hash are required' });
  }
  
  const userIndex = db.users.findIndex(u => u.id === req.user.id);
  
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Verify transaction on blockchain
  try {
    const tx = await provider.getTransactionReceipt(transactionHash);
    
    if (!tx || !tx.status) {
      return res.status(400).json({ error: 'Invalid transaction or transaction failed' });
    }
    
    // Update user to seller
    db.users[userIndex].isSeller = true;
    db.users[userIndex].sellerInfo = {
      location,
      categories,
      rating: 0,
      totalRatings: 0,
      registeredAt: new Date().toISOString(),
      transactionHash
    };
    
    // Save changes
    saveData();
    
    res.json({
      id: db.users[userIndex].id,
      walletAddress: db.users[userIndex].walletAddress,
      displayName: db.users[userIndex].displayName,
      isSeller: true,
      sellerInfo: db.users[userIndex].sellerInfo
    });
  } catch (error) {
    console.error('Error verifying seller registration transaction:', error);
    res.status(500).json({ error: 'Failed to verify transaction' });
  }
});

// Register as courier
router.post('/register-courier', authenticateToken, async (req, res) => {
  const { location, serviceAreas, vehicle, transactionHash } = req.body;
  
  if (!location || !serviceAreas || !vehicle || !transactionHash) {
    return res.status(400).json({ error: 'Location, service areas, vehicle, and transaction hash are required' });
  }
  
  const userIndex = db.users.findIndex(u => u.id === req.user.id);
  
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Verify transaction on blockchain
  try {
    const tx = await provider.getTransactionReceipt(transactionHash);
    
    if (!tx || !tx.status) {
      return res.status(400).json({ error: 'Invalid transaction or transaction failed' });
    }
    
    // Update user to courier
    db.users[userIndex].isCourier = true;
    db.users[userIndex].courierInfo = {
      location,
      serviceAreas,
      vehicle,
      rating: 0,
      totalRatings: 0,
      registeredAt: new Date().toISOString(),
      transactionHash
    };
    
    // Save changes
    saveData();
    
    res.json({
      id: db.users[userIndex].id,
      walletAddress: db.users[userIndex].walletAddress,
      displayName: db.users[userIndex].displayName,
      isCourier: true,
      courierInfo: db.users[userIndex].courierInfo
    });
  } catch (error) {
    console.error('Error verifying courier registration transaction:', error);
    res.status(500).json({ error: 'Failed to verify transaction' });
  }
});

module.exports = router; 