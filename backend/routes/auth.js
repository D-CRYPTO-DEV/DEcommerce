const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// In-memory nonce store (replace with database in production)
const nonceStore = {};

// Generate a random nonce for authentication
router.get('/nonce', (req, res) => {
  const { address } = req.query;
  
  if (!address) {
    return res.status(400).json({ error: 'Address is required' });
  }
  
  // Generate a random nonce
  const nonce = crypto.randomBytes(32).toString('hex');
  
  // Store the nonce with expiration (15 minutes)
  nonceStore[address.toLowerCase()] = {
    nonce,
    expires: Date.now() + 15 * 60 * 1000 // 15 minutes
  };
  
  res.json({ nonce });
});

// Verify signature and issue JWT token
router.post('/verify-signature', async (req, res) => {
  const { address, signature, nonce, loginType } = req.body;
  
  if (!address || !signature || !nonce || !loginType) {
    return res.status(400).json({ error: 'Address, signature, nonce, and loginType are required' });
  }
  
  // Check if nonce exists and hasn't expired
  const storedNonceData = nonceStore[address.toLowerCase()];
  if (!storedNonceData || storedNonceData.nonce !== nonce || storedNonceData.expires < Date.now()) {
    return res.status(401).json({ error: 'Invalid or expired nonce' });
  }
  
  try {
    let isValid = false;
    const message = `Sign this message to authenticate: ${nonce}`;
    
    if (loginType === 'wallet') {
      // Verify Ethereum signature
      const recoveredAddress = ethers.utils.verifyMessage(message, signature);
      isValid = recoveredAddress.toLowerCase() === address.toLowerCase();
    } else if (loginType === 'google') {
      // For Google login, we trust the signature from the social wallet connector
      // In a real implementation, you'd verify with Google's OAuth service
      isValid = true;
    }
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // Clear the used nonce
    delete nonceStore[address.toLowerCase()];
    
    // Find or create user
    let user = db.users.find(u => u.walletAddress.toLowerCase() === address.toLowerCase());
    
    if (!user) {
      // Create new user
      user = {
        id: generateId(),
        walletAddress: address,
        createdAt: new Date().toISOString(),
        isSeller: false,
        isCourier: false,
        loginType,
        displayName: `User_${address.slice(0, 6)}`,
        profileImageUrl: null
      };
      
      db.users.push(user);
      saveData(); // Save to disk
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, address: user.walletAddress },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      token,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        displayName: user.displayName,
        profileImageUrl: user.profileImageUrl,
        isSeller: user.isSeller,
        isCourier: user.isCourier
      }
    });
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Verify token validity
router.get('/verify', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ valid: false });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ valid: false });
    }
    
    // Find user
    const user = db.users.find(u => u.id === decoded.id);
    
    if (!user) {
      return res.status(401).json({ valid: false });
    }
    
    res.json({
      valid: true,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        displayName: user.displayName,
        profileImageUrl: user.profileImageUrl,
        isSeller: user.isSeller,
        isCourier: user.isCourier
      }
    });
  });
});

// Helper function to generate unique IDs
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

module.exports = router; 