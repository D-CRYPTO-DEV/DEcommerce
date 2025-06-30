const jwt = require('jsonwebtoken');

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

module.exports = {
  authenticateToken,
  uploadToIPFS
}; 