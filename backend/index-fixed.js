const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { ethers } = require('ethers');
const jwt = require('jsonwebtoken');
const { create } = require('ipfs-http-client');
const { join } = require('path');
const fs = require('fs');
require('dotenv').config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Initialize IPFS client
let ipfs;

// Database-like storage (in-memory for simplicity)
// In a production app, you'd use a proper database
const db = {
  users: [],
  listings: [],
  transactions: [],
  votes: [],
  proposals: [],
  reports: [],
  sellerProofs: []
};

// Initialize IPFS and database
const initializeDatabase = async () => {
  try {
    console.log('Connecting to IPFS...');
    
    // Connect to Infura IPFS gateway
    // You can also use other public gateways or run your own IPFS node
    ipfs = create({
      host: 'ipfs.infura.io',
      port: 5001,
      protocol: 'https',
      headers: {
        authorization: `Basic ${Buffer.from(
          process.env.INFURA_IPFS_PROJECT_ID + ':' + process.env.INFURA_IPFS_PROJECT_SECRET
        ).toString('base64')}`
      }
    });
    
    // Test connection by getting IPFS node info
    const nodeInfo = await ipfs.id();
    console.log('Connected to IPFS node:', nodeInfo.id);
    
    // Create data directory if it doesn't exist
    const dataDir = join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Load data from disk if exists
    try {
      const usersFile = join(dataDir, 'users.json');
      if (fs.existsSync(usersFile)) {
        db.users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
      }
      
      const listingsFile = join(dataDir, 'listings.json');
      if (fs.existsSync(listingsFile)) {
        db.listings = JSON.parse(fs.readFileSync(listingsFile, 'utf8'));
      }
      
      const transactionsFile = join(dataDir, 'transactions.json');
      if (fs.existsSync(transactionsFile)) {
        db.transactions = JSON.parse(fs.readFileSync(transactionsFile, 'utf8'));
      }
      
      const votesFile = join(dataDir, 'votes.json');
      if (fs.existsSync(votesFile)) {
        db.votes = JSON.parse(fs.readFileSync(votesFile, 'utf8'));
      }
      
      const proposalsFile = join(dataDir, 'proposals.json');
      if (fs.existsSync(proposalsFile)) {
        db.proposals = JSON.parse(fs.readFileSync(proposalsFile, 'utf8'));
      }
      
      const reportsFile = join(dataDir, 'reports.json');
      if (fs.existsSync(reportsFile)) {
        db.reports = JSON.parse(fs.readFileSync(reportsFile, 'utf8'));
      }
      
      const sellerProofsFile = join(dataDir, 'sellerProofs.json');
      if (fs.existsSync(sellerProofsFile)) {
        db.sellerProofs = JSON.parse(fs.readFileSync(sellerProofsFile, 'utf8'));
      }
      
      console.log('Data loaded from disk');
    } catch (error) {
      console.error('Error loading data from disk:', error);
      console.log('Starting with empty database');
    }
  } catch (error) {
    console.error('Error initializing IPFS:', error);
    console.log('Starting without IPFS connection');
  }
};

// Helper function to save data to disk
const saveData = async () => {
  const dataDir = join(__dirname, 'data');
  
  fs.writeFileSync(join(dataDir, 'users.json'), JSON.stringify(db.users, null, 2));
  fs.writeFileSync(join(dataDir, 'listings.json'), JSON.stringify(db.listings, null, 2));
  fs.writeFileSync(join(dataDir, 'transactions.json'), JSON.stringify(db.transactions, null, 2));
  fs.writeFileSync(join(dataDir, 'votes.json'), JSON.stringify(db.votes, null, 2));
  fs.writeFileSync(join(dataDir, 'proposals.json'), JSON.stringify(db.proposals, null, 2));
  fs.writeFileSync(join(dataDir, 'reports.json'), JSON.stringify(db.reports, null, 2));
  fs.writeFileSync(join(dataDir, 'sellerProofs.json'), JSON.stringify(db.sellerProofs, null, 2));
};

// Helper function to upload to IPFS
const uploadToIPFS = async (content) => {
  try {
    const result = await ipfs.add(JSON.stringify(content));
    return result.cid.toString();
  } catch (error) {
    console.error('Error uploading to IPFS:', error);
    throw error;
  }
};

// Helper function to get from IPFS
const getFromIPFS = async (cid) => {
  try {
    let content = '';
    const chunks = [];
    
    for await (const chunk of ipfs.cat(cid)) {
      chunks.push(chunk);
    }
    
    content = Buffer.concat(chunks).toString();
    return JSON.parse(content);
  } catch (error) {
    console.error('Error getting from IPFS:', error);
    throw error;
  }
};

// Initialize Ethers provider
const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL || 'https://mainnet.base.org');

// Load contract ABIs
let paymentContractABI, governanceContractABI, votingContractABI;
try {
  paymentContractABI = require('../artifacts/contracts/paymentContract.sol/PaymentContract.json').abi;
  governanceContractABI = require('../artifacts/contracts/DAOGovernanceCore.sol/DAOGovernanceCore.json').abi;
  votingContractABI = require('../artifacts/contracts/DAOVoting.sol/DAOVoting.json').abi;
} catch (error) {
  console.error('Error loading contract ABIs:', error);
  console.log('Using placeholder ABIs');
  
  // Placeholder ABIs
  paymentContractABI = [];
  governanceContractABI = [];
  votingContractABI = [];
}

// Contract instances
let paymentContract, governanceContract, votingContract;
try {
  paymentContract = new ethers.Contract(
    process.env.PAYMENT_CONTRACT_ADDRESS,
    paymentContractABI,
    provider
  );

  governanceContract = new ethers.Contract(
    process.env.GOVERNANCE_CONTRACT_ADDRESS,
    governanceContractABI,
    provider
  );

  votingContract = new ethers.Contract(
    process.env.VOTING_CONTRACT_ADDRESS,
    votingContractABI,
    provider
  );
} catch (error) {
  console.error('Error initializing contract instances:', error);
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

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const listingRoutes = require('./routes/listings');
const transactionRoutes = require('./routes/transactions');
const governanceRoutes = require('./routes/governance');
const categoryRoutes = require('./routes/categories');

// Make db and helpers available globally
global.db = db;
global.saveData = saveData;
global.uploadToIPFS = uploadToIPFS;
global.getFromIPFS = getFromIPFS;
global.paymentContract = paymentContract;
global.governanceContract = governanceContract;
global.votingContract = votingContract;
global.authenticateToken = authenticateToken;

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
    
    // Upload proof images to IPFS
    const proofImageUrls = [];
    
    for (const image of proofImages) {
      try {
        const cid = await uploadToIPFS({
          name: `proof_${transactionId}_${Date.now()}`,
          image
        });
        
        proofImageUrls.push(`https://ipfs.io/ipfs/${cid}`);
      } catch (error) {
        console.error('Error uploading proof image to IPFS:', error);
      }
    }
    
    // Create proof record
    const proof = {
      id: generateId(),
      transactionId,
      sellerAddress: req.user.address,
      description,
      imageUrls: proofImageUrls.length > 0 ? proofImageUrls : proofImages,
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

// Helper function to generate unique IDs
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Start server and initialize database
const startServer = async () => {
  await initializeDatabase();
  
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer(); 