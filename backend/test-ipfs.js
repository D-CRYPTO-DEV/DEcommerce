const { create } = require('ipfs-http-client');
require('dotenv').config();

async function testIPFSConnection() {
  try {
    console.log('Connecting to IPFS via Infura...');
    
    // Connect to Infura IPFS gateway
    const ipfs = create({
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
    console.log('✅ Connected to IPFS node:', nodeInfo.id);
    
    // Test uploading a file
    console.log('Testing file upload to IPFS...');
    const testData = {
      name: 'Test Object',
      description: 'This is a test object uploaded to IPFS',
      timestamp: new Date().toISOString()
    };
    
    const result = await ipfs.add(JSON.stringify(testData));
    console.log('✅ File uploaded to IPFS with CID:', result.cid.toString());
    
    // Test retrieving the file
    console.log('Testing file retrieval from IPFS...');
    let content = '';
    const chunks = [];
    
    for await (const chunk of ipfs.cat(result.cid)) {
      chunks.push(chunk);
    }
    
    content = Buffer.concat(chunks).toString();
    const retrievedData = JSON.parse(content);
    
    console.log('✅ Retrieved data from IPFS:', retrievedData);
    console.log('IPFS connection and functionality test successful!');
    
  } catch (error) {
    console.error('❌ Error testing IPFS connection:', error);
  }
}

testIPFSConnection(); 