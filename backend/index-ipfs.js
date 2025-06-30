const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { ethers } = require('ethers');
const jwt = require('jsonwebtoken');
const { create } = require('ipfs-http-client');
const { join } = require('path');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const fs = require('fs');
require('dotenv').config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Initialize IPFS client
let ipfs;

// Initialize LowDB (for local caching)
let db;

// Initialize IPFS and database
const initializeDatabase = async () => {
  try {
    console.log('Connecting to IPFS...');
    
    // Connect to Infura IPFS gateway
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
    
    // Create database directory if it doesn't exist
    const dbDirectory = join(__dirname, 'db');
    if (!fs.existsSync(dbDirectory)) {
      fs.mkdirSync(dbDirectory, { recursive: true });
    }
    
    // Set up the LowDB adapter (for local caching)
    const file = join(dbDirectory, 'data.json');
    const adapter = new JSONFile(file);
    db = new Low(adapter);
    
    // Read data from JSON file
    await db.read();
    
    // Set default data if file is empty
    db.data = db.data || {
      users: [],
      listings: [],
      transactions: [],
      votes: [],
      proposals: [],
      reports: [],
      ipfsRootCid: null // Store the root CID of our database on IPFS
    };
    
    // Try to load the latest data from IPFS if we have a root CID
    if (db.data.ipfsRootCid) {
      try {
        console.log(`Attempting to load latest data from IPFS (CID: ${db.data.ipfsRootCid})...`);
        const ipfsData = await getFromIPFS(db.data.ipfsRootCid);
        
        // Update local cache with IPFS data
        db.data.users = ipfsData.users || [];
        db.data.listings = ipfsData.listings || [];
        db.data.transactions = ipfsData.transactions || [];
        db.data.votes = ipfsData.votes || [];
        db.data.proposals = ipfsData.proposals || [];
        db.data.reports = ipfsData.reports || [];
        
        console.log('Successfully loaded data from IPFS');
      } catch (ipfsError) {
        console.error('Error loading data from IPFS:', ipfsError);
        console.log('Using local cache instead');
      }
    }
    
    // Write data to JSON file
    await db.write();
    console.log('Database initialized successfully');
    
  } catch (error) {
    console.error('Error initializing:', error);
    process.exit(1);
  }
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

// Helper function to save database to IPFS
const saveDatabaseToIPFS = async () => {
  try {
    // Create a copy of the database without the ipfsRootCid field
    const dbCopy = {
      users: db.data.users,
      listings: db.data.listings,
      transactions: db.data.transactions,
      votes: db.data.votes,
      proposals: db.data.proposals,
      reports: db.data.reports,
      lastUpdated: new Date().toISOString()
    };
    
    // Upload to IPFS
    const cid = await uploadToIPFS(dbCopy);
    console.log(`Database saved to IPFS with CID: ${cid}`);
    
    // Update the root CID in our local database
    db.data.ipfsRootCid = cid;
    await db.write();
    
    return cid;
  } catch (error) {
    console.error('Error saving database to IPFS:', error);
    throw error;
  }
};

// Initialize Ethers provider
const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL || 'https://mainnet.base.org');

// Load contract ABIs
const paymentContractABI = require('../artifacts/contracts/paymentContract.sol/PaymentContract.json').abi;
const governanceContractABI = require('../artifacts/contracts/DAOGovernanceCore.sol/DAOGovernanceCore.json').abi;
const votingContractABI = require('../artifacts/contracts/DAOVoting.sol/DAOVoting.json').abi;

// Contract instances
const paymentContract = new ethers.Contract(
  process.env.PAYMENT_CONTRACT_ADDRESS,
  paymentContractABI,
  provider
);

const governanceContract = new ethers.Contract(
  process.env.GOVERNANCE_CONTRACT_ADDRESS,
  governanceContractABI,
  provider
);

const votingContract = new ethers.Contract(
  process.env.VOTING_CONTRACT_ADDRESS,
  votingContractABI,
  provider
);

// Middleware for JWT authentication
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access denied' });
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// Helper function to verify Ethereum signatures
const verifySignature = (message, signature, address) => {
  try {
    const signerAddress = ethers.utils.verifyMessage(message, signature);
    return signerAddress.toLowerCase() === address.toLowerCase();
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
};

// Helper function to generate unique IDs
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Auth routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { address, signature, message } = req.body;
    
    // Verify the signature
    const isValid = verifySignature(message, signature, address);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // Find or create user
    const normalizedAddress = address.toLowerCase();
    let user = db.data.users.find(u => u.address === normalizedAddress);
    
    if (!user) {
      // Create new user
      user = {
        _id: generateId(),
        address: normalizedAddress,
        isSeller: false,
        isCourier: false,
        reputation: 0,
        createdAt: Date.now()
      };
      
      // Upload user data to IPFS
      try {
        const ipfsCid = await uploadToIPFS(user);
        user.ipfsCid = ipfsCid;
        console.log(`User data stored on IPFS with CID: ${ipfsCid}`);
      } catch (ipfsError) {
        console.error('Failed to upload user data to IPFS:', ipfsError);
        // Continue without IPFS backup
      }
      
      db.data.users.push(user);
      await db.write();
      
      // Save database to IPFS
      await saveDatabaseToIPFS();
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, address: user.address },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      token,
      user: {
        address: user.address,
        isSeller: user.isSeller,
        isCourier: user.isCourier,
        reputation: user.reputation,
        location: user.location
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/auth/validate', authenticateToken, async (req, res) => {
  try {
    const user = db.data.users.find(u => u._id === req.user.id);
    if (!user) {
      return res.status(404).json({ valid: false });
    }
    
    res.json({
      valid: true,
      address: user.address,
      user: {
        address: user.address,
        isSeller: user.isSeller,
        isCourier: user.isCourier,
        reputation: user.reputation,
        location: user.location
      }
    });
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// User routes
app.put('/api/users/profile', authenticateToken, async (req, res) => {
  try {
    const { location } = req.body;
    
    const userIndex = db.data.users.findIndex(u => u._id === req.user.id);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    db.data.users[userIndex].location = location;
    
    // Update user data on IPFS
    try {
      const ipfsCid = await uploadToIPFS(db.data.users[userIndex]);
      db.data.users[userIndex].ipfsCid = ipfsCid;
      console.log(`Updated user data stored on IPFS with CID: ${ipfsCid}`);
    } catch (ipfsError) {
      console.error('Failed to update user data on IPFS:', ipfsError);
      // Continue without IPFS backup
    }
    
    await db.write();
    
    // Save database to IPFS
    await saveDatabaseToIPFS();
    
    res.json(db.data.users[userIndex]);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/users/register-seller', authenticateToken, async (req, res) => {
  try {
    const { location, categories, transactionHash } = req.body;
    
    // Verify transaction on blockchain
    const receipt = await provider.getTransactionReceipt(transactionHash);
    if (!receipt || !receipt.status) {
      return res.status(400).json({ error: 'Invalid transaction' });
    }
    
    const userIndex = db.data.users.findIndex(u => u._id === req.user.id);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    db.data.users[userIndex].isSeller = true;
    db.data.users[userIndex].location = location;
    db.data.users[userIndex].sellerCategories = categories;
    
    // Update user data on IPFS
    try {
      const ipfsCid = await uploadToIPFS(db.data.users[userIndex]);
      db.data.users[userIndex].ipfsCid = ipfsCid;
      console.log(`Seller data stored on IPFS with CID: ${ipfsCid}`);
    } catch (ipfsError) {
      console.error('Failed to upload seller data to IPFS:', ipfsError);
      // Continue without IPFS backup
    }
    
    await db.write();
    
    // Save database to IPFS
    await saveDatabaseToIPFS();
    
    res.json(db.data.users[userIndex]);
  } catch (error) {
    console.error('Register seller error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/users/register-courier', authenticateToken, async (req, res) => {
  try {
    const { location, serviceAreas, vehicle, transactionHash } = req.body;
    
    // Verify transaction on blockchain
    const receipt = await provider.getTransactionReceipt(transactionHash);
    if (!receipt || !receipt.status) {
      return res.status(400).json({ error: 'Invalid transaction' });
    }
    
    const userIndex = db.data.users.findIndex(u => u._id === req.user.id);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    db.data.users[userIndex].isCourier = true;
    db.data.users[userIndex].location = location;
    db.data.users[userIndex].serviceAreas = serviceAreas;
    db.data.users[userIndex].vehicle = vehicle;
    
    // Update user data on IPFS
    try {
      const ipfsCid = await uploadToIPFS(db.data.users[userIndex]);
      db.data.users[userIndex].ipfsCid = ipfsCid;
      console.log(`Courier data stored on IPFS with CID: ${ipfsCid}`);
    } catch (ipfsError) {
      console.error('Failed to upload courier data to IPFS:', ipfsError);
      // Continue without IPFS backup
    }
    
    await db.write();
    
    // Save database to IPFS
    await saveDatabaseToIPFS();
    
    res.json(db.data.users[userIndex]);
  } catch (error) {
    console.error('Register courier error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Marketplace routes
app.post('/api/listings', authenticateToken, async (req, res) => {
  try {
    const { title, description, price, category, location, images } = req.body;
    
    const user = db.data.users.find(u => u._id === req.user.id);
    if (!user || !user.isSeller) {
      return res.status(403).json({ error: 'Only sellers can create listings' });
    }
    
    const listing = {
      _id: generateId(),
      seller: user._id,
      title,
      description,
      price,
      category,
      location,
      images,
      status: 'active',
      createdAt: Date.now()
    };
    
    // Upload listing data to IPFS
    try {
      const ipfsCid = await uploadToIPFS(listing);
      listing.ipfsCid = ipfsCid;
      console.log(`Listing data stored on IPFS with CID: ${ipfsCid}`);
    } catch (ipfsError) {
      console.error('Failed to upload listing data to IPFS:', ipfsError);
      // Continue without IPFS backup
    }
    
    db.data.listings.push(listing);
    await db.write();
    
    // Save database to IPFS
    await saveDatabaseToIPFS();
    
    res.status(201).json(listing);
  } catch (error) {
    console.error('Create listing error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/listings', async (req, res) => {
  try {
    const { location, category, minPrice, maxPrice, sort } = req.query;
    
    // Filter listings
    let listings = db.data.listings.filter(listing => listing.status === 'active');
    
    if (location) {
      listings = listings.filter(listing => listing.location === location);
    }
    
    if (category) {
      listings = listings.filter(listing => listing.category === category);
    }
    
    if (minPrice) {
      const min = parseFloat(minPrice);
      listings = listings.filter(listing => parseFloat(listing.price) >= min);
    }
    
    if (maxPrice) {
      const max = parseFloat(maxPrice);
      listings = listings.filter(listing => parseFloat(listing.price) <= max);
    }
    
    // Apply sorting
    if (sort === 'price_asc') {
      listings.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    } else if (sort === 'price_desc') {
      listings.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
    } else if (sort === 'newest') {
      listings.sort((a, b) => b.createdAt - a.createdAt);
    }
    
    // Add seller information
    const listingsWithSeller = listings.map(listing => {
      const seller = db.data.users.find(u => u._id === listing.seller);
      return {
        ...listing,
        seller: {
          _id: seller._id,
          address: seller.address,
          reputation: seller.reputation
        }
      };
    });
    
    res.json(listingsWithSeller);
  } catch (error) {
    console.error('Get listings error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Transaction routes
app.post('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const { listingId, transactionHash, courierAddress } = req.body;
    
    // Verify transaction on blockchain
    const receipt = await provider.getTransactionReceipt(transactionHash);
    if (!receipt || !receipt.status) {
      return res.status(400).json({ error: 'Invalid transaction' });
    }
    
    const listing = db.data.listings.find(l => l._id === listingId);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    
    let courier = null;
    if (courierAddress) {
      courier = db.data.users.find(u => u.address.toLowerCase() === courierAddress.toLowerCase());
      if (!courier || !courier.isCourier) {
        return res.status(404).json({ error: 'Courier not found' });
      }
    }
    
    const transaction = {
      _id: generateId(),
      buyer: req.user.id,
      seller: listing.seller,
      listing: listing._id,
      amount: listing.price,
      transactionHash,
      courier: courier ? courier._id : null,
      status: courier ? 'awaiting_pickup' : 'awaiting_shipment',
      createdAt: Date.now()
    };
    
    // Upload transaction data to IPFS
    try {
      const ipfsCid = await uploadToIPFS(transaction);
      transaction.ipfsCid = ipfsCid;
      console.log(`Transaction data stored on IPFS with CID: ${ipfsCid}`);
    } catch (ipfsError) {
      console.error('Failed to upload transaction data to IPFS:', ipfsError);
      // Continue without IPFS backup
    }
    
    db.data.transactions.push(transaction);
    
    // Update listing status
    const listingIndex = db.data.listings.findIndex(l => l._id === listingId);
    db.data.listings[listingIndex].status = 'sold';
    
    // Update listing data on IPFS
    try {
      const listingIpfsCid = await uploadToIPFS(db.data.listings[listingIndex]);
      db.data.listings[listingIndex].ipfsCid = listingIpfsCid;
      console.log(`Updated listing data stored on IPFS with CID: ${listingIpfsCid}`);
    } catch (ipfsError) {
      console.error('Failed to update listing data on IPFS:', ipfsError);
      // Continue without IPFS backup
    }
    
    await db.write();
    
    // Save database to IPFS
    await saveDatabaseToIPFS();
    
    res.status(201).json(transaction);
  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/transactions/buyer', authenticateToken, async (req, res) => {
  try {
    const transactions = db.data.transactions.filter(t => t.buyer === req.user.id);
    
    // Populate related data
    const populatedTransactions = transactions.map(transaction => {
      const listing = db.data.listings.find(l => l._id === transaction.listing);
      const seller = db.data.users.find(u => u._id === transaction.seller);
      const courier = transaction.courier ? db.data.users.find(u => u._id === transaction.courier) : null;
      
      return {
        ...transaction,
        listing,
        seller: {
          _id: seller._id,
          address: seller.address,
          reputation: seller.reputation
        },
        courier: courier ? {
          _id: courier._id,
          address: courier.address,
          reputation: courier.reputation
        } : null
      };
    });
    
    res.json(populatedTransactions);
  } catch (error) {
    console.error('Get buyer transactions error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/transactions/seller', authenticateToken, async (req, res) => {
  try {
    const transactions = db.data.transactions.filter(t => t.seller === req.user.id);
    
    // Populate related data
    const populatedTransactions = transactions.map(transaction => {
      const listing = db.data.listings.find(l => l._id === transaction.listing);
      const buyer = db.data.users.find(u => u._id === transaction.buyer);
      const courier = transaction.courier ? db.data.users.find(u => u._id === transaction.courier) : null;
      
      return {
        ...transaction,
        listing,
        buyer: {
          _id: buyer._id,
          address: buyer.address,
          reputation: buyer.reputation
        },
        courier: courier ? {
          _id: courier._id,
          address: courier.address,
          reputation: courier.reputation
        } : null
      };
    });
    
    res.json(populatedTransactions);
  } catch (error) {
    console.error('Get seller transactions error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/transactions/courier', authenticateToken, async (req, res) => {
  try {
    const user = db.data.users.find(u => u._id === req.user.id);
    if (!user || !user.isCourier) {
      return res.status(403).json({ error: 'Not a courier' });
    }
    
    const transactions = db.data.transactions.filter(t => t.courier === req.user.id);
    
    // Populate related data
    const populatedTransactions = transactions.map(transaction => {
      const listing = db.data.listings.find(l => l._id === transaction.listing);
      const buyer = db.data.users.find(u => u._id === transaction.buyer);
      const seller = db.data.users.find(u => u._id === transaction.seller);
      
      return {
        ...transaction,
        listing,
        buyer: {
          _id: buyer._id,
          address: buyer.address,
          reputation: buyer.reputation
        },
        seller: {
          _id: seller._id,
          address: seller.address,
          reputation: seller.reputation
        }
      };
    });
    
    res.json(populatedTransactions);
  } catch (error) {
    console.error('Get courier transactions error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/transactions/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, transactionHash } = req.body;
    
    const transactionIndex = db.data.transactions.findIndex(t => t._id === id);
    if (transactionIndex === -1) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    const transaction = db.data.transactions[transactionIndex];
    
    // Check permissions based on status update
    let isAuthorized = false;
    
    if (status === 'shipped' && transaction.seller === req.user.id) {
      isAuthorized = true;
    } else if (status === 'picked_up' && transaction.courier && transaction.courier === req.user.id) {
      isAuthorized = true;
    } else if (status === 'delivered' && transaction.courier && transaction.courier === req.user.id) {
      isAuthorized = true;
    } else if (status === 'completed' && transaction.buyer === req.user.id) {
      // Verify transaction on blockchain if completing the transaction
      if (transactionHash) {
        const receipt = await provider.getTransactionReceipt(transactionHash);
        if (!receipt || !receipt.status) {
          return res.status(400).json({ error: 'Invalid transaction' });
        }
        isAuthorized = true;
      }
    } else if (status === 'disputed' && transaction.buyer === req.user.id) {
      isAuthorized = true;
    }
    
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Not authorized to update this transaction' });
    }
    
    db.data.transactions[transactionIndex].status = status;
    if (transactionHash) {
      db.data.transactions[transactionIndex].completionTxHash = transactionHash;
    }
    
    // Update transaction data on IPFS
    try {
      const ipfsCid = await uploadToIPFS(db.data.transactions[transactionIndex]);
      db.data.transactions[transactionIndex].ipfsCid = ipfsCid;
      console.log(`Updated transaction data stored on IPFS with CID: ${ipfsCid}`);
    } catch (ipfsError) {
      console.error('Failed to update transaction data on IPFS:', ipfsError);
      // Continue without IPFS backup
    }
    
    await db.write();
    
    // Save database to IPFS
    await saveDatabaseToIPFS();
    
    res.json(db.data.transactions[transactionIndex]);
  } catch (error) {
    console.error('Update transaction status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// IPFS status endpoint
app.get('/api/ipfs/status', async (req, res) => {
  try {
    const nodeInfo = await ipfs.id();
    const dbCid = db.data.ipfsRootCid || 'Not yet saved to IPFS';
    
    res.json({
      status: 'connected',
      nodeId: nodeInfo.id,
      protocolVersion: nodeInfo.protocolVersion,
      agentVersion: nodeInfo.agentVersion,
      databaseCid: dbCid,
      lastUpdated: db.data.lastUpdated || 'Never'
    });
  } catch (error) {
    console.error('IPFS status check error:', error);
    res.status(500).json({ 
      status: 'error',
      error: error.message
    });
  }
});

// Manually trigger database backup to IPFS
app.post('/api/ipfs/backup', async (req, res) => {
  try {
    const cid = await saveDatabaseToIPFS();
    
    res.json({
      success: true,
      message: 'Database successfully backed up to IPFS',
      cid: cid
    });
  } catch (error) {
    console.error('IPFS backup error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message
    });
  }
});

// Start server and initialize database
const startServer = async () => {
  try {
    await initializeDatabase();
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer(); 