// Simple script to start the backend with IPFS integration
console.log('Starting backend server with IPFS integration...');

// Check for required environment variables
if (!process.env.INFURA_IPFS_PROJECT_ID || !process.env.INFURA_IPFS_PROJECT_SECRET) {
  console.log('\x1b[33m%s\x1b[0m', 'Warning: INFURA_IPFS_PROJECT_ID and/or INFURA_IPFS_PROJECT_SECRET environment variables are not set.');
  console.log('\x1b[33m%s\x1b[0m', 'IPFS functionality will be limited. Please add these to your .env file.');
  console.log('You can get these credentials from https://infura.io/dashboard');
}

// Import and run the server
require('./index-with-ipfs.js'); 