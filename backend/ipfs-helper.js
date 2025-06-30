const { create } = require('ipfs-http-client');
require('dotenv').config();

/**
 * Creates and returns an IPFS client connected to Infura
 * @returns {Object} IPFS client
 */
function createIPFSClient() {
  try {
    // Check if environment variables are set
    if (!process.env.INFURA_IPFS_PROJECT_ID || !process.env.INFURA_IPFS_PROJECT_SECRET) {
      throw new Error('Missing Infura IPFS credentials in .env file');
    }
    
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
    
    return ipfs;
  } catch (error) {
    console.error('Error creating IPFS client:', error);
    throw error;
  }
}

/**
 * Uploads content to IPFS
 * @param {Object} ipfs - IPFS client
 * @param {Object|String} content - Content to upload
 * @returns {String} CID of uploaded content
 */
async function uploadToIPFS(ipfs, content) {
  try {
    // Convert object to string if needed
    const contentString = typeof content === 'object' ? JSON.stringify(content) : content;
    
    const result = await ipfs.add(contentString);
    return result.cid.toString();
  } catch (error) {
    console.error('Error uploading to IPFS:', error);
    throw error;
  }
}

/**
 * Retrieves content from IPFS by CID
 * @param {Object} ipfs - IPFS client
 * @param {String} cid - Content identifier
 * @param {Boolean} parseJSON - Whether to parse the content as JSON
 * @returns {Object|String} Retrieved content
 */
async function getFromIPFS(ipfs, cid, parseJSON = true) {
  try {
    let content = '';
    const chunks = [];
    
    for await (const chunk of ipfs.cat(cid)) {
      chunks.push(chunk);
    }
    
    content = Buffer.concat(chunks).toString();
    
    return parseJSON ? JSON.parse(content) : content;
  } catch (error) {
    console.error('Error getting from IPFS:', error);
    throw error;
  }
}

/**
 * Pins content to IPFS to ensure it remains available
 * @param {Object} ipfs - IPFS client
 * @param {String} cid - Content identifier to pin
 * @returns {Boolean} Success status
 */
async function pinToIPFS(ipfs, cid) {
  try {
    await ipfs.pin.add(cid);
    return true;
  } catch (error) {
    console.error('Error pinning to IPFS:', error);
    throw error;
  }
}

/**
 * Creates a directory in IPFS and adds files to it
 * @param {Object} ipfs - IPFS client
 * @param {Object} files - Object with filenames as keys and content as values
 * @returns {String} CID of the directory
 */
async function createIPFSDirectory(ipfs, files) {
  try {
    const fileArray = [];
    
    // Convert files object to array format required by ipfs.addAll
    for (const [filename, content] of Object.entries(files)) {
      const contentString = typeof content === 'object' ? JSON.stringify(content) : content;
      fileArray.push({
        path: filename,
        content: Buffer.from(contentString)
      });
    }
    
    // Add all files to IPFS
    const results = ipfs.addAll(fileArray);
    let dirCID = null;
    
    // Find the CID of the directory (last result)
    for await (const result of results) {
      dirCID = result.cid.toString();
    }
    
    return dirCID;
  } catch (error) {
    console.error('Error creating IPFS directory:', error);
    throw error;
  }
}

module.exports = {
  createIPFSClient,
  uploadToIPFS,
  getFromIPFS,
  pinToIPFS,
  createIPFSDirectory
}; 