// This script will run the fixed backend
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { ethers } = require('ethers');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Database-like storage (in-memory for simplicity)
const db = {
  users: [],
  listings: [],
  transactions: [],
  votes: [],
  proposals: [],
  reports: [],
  sellerProofs: []
};

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Helper function to save data to disk
const saveData = async () => {
  try {
    fs.writeFileSync(path.join(dataDir, 'users.json'), JSON.stringify(db.users, null, 2));
    fs.writeFileSync(path.join(dataDir, 'listings.json'), JSON.stringify(db.listings, null, 2));
    fs.writeFileSync(path.join(dataDir, 'transactions.json'), JSON.stringify(db.transactions, null, 2));
    fs.writeFileSync(path.join(dataDir, 'votes.json'), JSON.stringify(db.votes, null, 2));
    fs.writeFileSync(path.join(dataDir, 'proposals.json'), JSON.stringify(db.proposals, null, 2));
    fs.writeFileSync(path.join(dataDir, 'reports.json'), JSON.stringify(db.reports, null, 2));
    fs.writeFileSync(path.join(dataDir, 'sellerProofs.json'), JSON.stringify(db.sellerProofs, null, 2));
    console.log('Data saved to disk');
  } catch (error) {
    console.error('Error saving data to disk:', error);
  }
};

// Load data from disk if exists
try {
  if (fs.existsSync(path.join(dataDir, 'users.json'))) {
    db.users = JSON.parse(fs.readFileSync(path.join(dataDir, 'users.json'), 'utf8'));
  }
  
  if (fs.existsSync(path.join(dataDir, 'listings.json'))) {
    db.listings = JSON.parse(fs.readFileSync(path.join(dataDir, 'listings.json'), 'utf8'));
  }
  
  if (fs.existsSync(path.join(dataDir, 'transactions.json'))) {
    db.transactions = JSON.parse(fs.readFileSync(path.join(dataDir, 'transactions.json'), 'utf8'));
  }
  
  if (fs.existsSync(path.join(dataDir, 'votes.json'))) {
    db.votes = JSON.parse(fs.readFileSync(path.join(dataDir, 'votes.json'), 'utf8'));
  }
  
  if (fs.existsSync(path.join(dataDir, 'proposals.json'))) {
    db.proposals = JSON.parse(fs.readFileSync(path.join(dataDir, 'proposals.json'), 'utf8'));
  }
  
  if (fs.existsSync(path.join(dataDir, 'reports.json'))) {
    db.reports = JSON.parse(fs.readFileSync(path.join(dataDir, 'reports.json'), 'utf8'));
  }
  
  if (fs.existsSync(path.join(dataDir, 'sellerProofs.json'))) {
    db.sellerProofs = JSON.parse(fs.readFileSync(path.join(dataDir, 'sellerProofs.json'), 'utf8'));
  }
  
  console.log('Data loaded from disk');
} catch (error) {
  console.error('Error loading data from disk:', error);
  console.log('Starting with empty database');
}

// Helper function to generate unique IDs
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Initialize Ethers provider
let provider;
try {
  provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL || 'https://mainnet.base.org');
} catch (error) {
  console.error('Error initializing Ethers provider:', error);
  console.log('Continuing without blockchain integration');
}

// Middleware for JWT authentication
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access denied' });
  
  jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret-key', (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// Make db and helpers available globally
global.db = db;
global.saveData = saveData;
global.generateId = generateId;
global.provider = provider;
global.authenticateToken = authenticateToken;

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const listingRoutes = require('./routes/listings');
const transactionRoutes = require('./routes/transactions');
const governanceRoutes = require('./routes/governance');
const categoryRoutes = require('./routes/categories');

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/governance', governanceRoutes);
app.use('/api/categories', categoryRoutes);

// Add seller proof submission route
app.post('/api/seller/proof', authenticateToken, async (req, res) => {
  try {
    const { transactionId, proofImages, description } = req.body;
    
    if (!transactionId || !proofImages || !description) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Find transaction
    const transaction = db.transactions.find(tx => tx.id === transactionId);
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    // Check if seller matches authenticated user
    if (transaction.seller.toLowerCase() !== req.user.address.toLowerCase()) {
      return res.status(403).json({ error: 'Only the seller can submit proof' });
    }
    
    // Create proof record (in a real app, we'd upload to IPFS)
    const proof = {
      id: generateId(),
      transactionId,
      sellerAddress: req.user.address,
      description,
      imageUrls: proofImages,
      submittedAt: new Date().toISOString(),
      status: 'pending'
    };
    
    // Add to database
    db.sellerProofs.push(proof);
    
    // Update transaction
    const transactionIndex = db.transactions.findIndex(tx => tx.id === transactionId);
    if (transactionIndex !== -1) {
      db.transactions[transactionIndex].status = 'shipped';
      db.transactions[transactionIndex].updatedAt = new Date().toISOString();
      db.transactions[transactionIndex].events = db.transactions[transactionIndex].events || [];
      db.transactions[transactionIndex].events.push({
        type: 'shipping_proof',
        status: 'submitted',
        timestamp: new Date().toISOString(),
        data: { proofId: proof.id }
      });
    }
    
    saveData();
    
    res.status(201).json(proof);
  } catch (error) {
    console.error('Error submitting seller proof:', error);
    res.status(500).json({ error: 'Failed to submit proof' });
  }
});

// Get seller proofs for a transaction
app.get('/api/seller/proof/:transactionId', authenticateToken, async (req, res) => {
  try {
    const { transactionId } = req.params;
    
    // Find proofs for this transaction
    const proofs = db.sellerProofs.filter(proof => proof.transactionId === transactionId);
    
    res.json(proofs);
  } catch (error) {
    console.error('Error getting seller proofs:', error);
    res.status(500).json({ error: 'Failed to get proofs' });
  }
});

// Get all seller proofs (for governance/DAO members)
app.get('/api/seller/proofs', authenticateToken, async (req, res) => {
  try {
    // In a real app, check if user is a DAO member
    // For now, just return all proofs
    res.json(db.sellerProofs);
  } catch (error) {
    console.error('Error getting all seller proofs:', error);
    res.status(500).json({ error: 'Failed to get proofs' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Fixed backend running on port ${PORT}`);
}); 