const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// In-memory database
const db = {
  users: [],
  listings: [],
  transactions: [],
  proposals: []
};

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'DEcommerce API is running' });
});

// User routes
app.get('/api/users/:address', (req, res) => {
  const { address } = req.params;
  const user = db.users.find(u => u.walletAddress.toLowerCase() === address.toLowerCase());
  
  if (user) {
    res.json(user);
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

// Listings routes
app.get('/api/listings', (req, res) => {
  res.json(db.listings);
});

app.get('/api/listings/featured', (req, res) => {
  // Return top 8 listings
  const featured = db.listings.slice(0, 8);
  res.json(featured);
});

// Categories
const categories = [
  { id: 'electronics', name: 'Electronics' },
  { id: 'clothing', name: 'Clothing & Fashion' },
  { id: 'home', name: 'Home & Garden' },
  { id: 'collectibles', name: 'Collectibles & Art' },
  { id: 'sports', name: 'Sports & Outdoors' },
  { id: 'toys', name: 'Toys & Hobbies' },
  { id: 'beauty', name: 'Beauty & Health' },
  { id: 'automotive', name: 'Automotive' },
  { id: 'books', name: 'Books & Media' },
  { id: 'other', name: 'Other' }
];

app.get('/api/categories', (req, res) => {
  res.json(categories);
});

// Authentication routes
app.post('/api/auth/login', (req, res) => {
  const { address, signature, message } = req.body;
  
  // In a real app, verify the signature
  // For this simplified version, just create a token
  
  // Find or create user
  let user = db.users.find(u => u.walletAddress.toLowerCase() === address.toLowerCase());
  
  if (!user) {
    user = {
      id: Date.now().toString(),
      walletAddress: address,
      displayName: `User_${address.slice(0, 6)}`,
      createdAt: new Date().toISOString(),
      isSeller: false,
      isCourier: false
    };
    
    db.users.push(user);
  }
  
  // Create a token (in a real app, use JWT)
  const token = `fake-token-${Date.now()}`;
  
  res.json({
    token,
    user
  });
});

// Add some sample data
const addSampleData = () => {
  // Sample users
  if (db.users.length === 0) {
    db.users.push({
      id: '1',
      walletAddress: '0x1234567890123456789012345678901234567890',
      displayName: 'Sample Seller',
      profileImageUrl: 'https://i.pravatar.cc/300?img=1',
      bio: 'I sell high-quality products',
      createdAt: new Date().toISOString(),
      isSeller: true,
      isCourier: false,
      sellerInfo: {
        rating: 4.8,
        totalRatings: 24
      }
    });
    
    db.users.push({
      id: '2',
      walletAddress: '0x0987654321098765432109876543210987654321',
      displayName: 'Sample Courier',
      profileImageUrl: 'https://i.pravatar.cc/300?img=2',
      bio: 'Fast delivery guaranteed',
      createdAt: new Date().toISOString(),
      isSeller: false,
      isCourier: true,
      courierInfo: {
        rating: 4.9,
        totalRatings: 36
      }
    });
  }
  
  // Sample listings
  if (db.listings.length === 0) {
    // Generate 20 sample products
    for (let i = 1; i <= 20; i++) {
      db.listings.push({
        id: i.toString(),
        name: `Product ${i}`,
        description: `This is a description for product ${i}. It's a high-quality item that you'll love.`,
        price: (Math.random() * 2 + 0.1).toFixed(3),
        category: categories[Math.floor(Math.random() * categories.length)].id,
        location: ['New York', 'Los Angeles', 'Chicago', 'Houston'][Math.floor(Math.random() * 4)],
        imageUrls: [`https://picsum.photos/seed/${i}/400/300`],
        quantity: Math.floor(Math.random() * 10) + 1,
        seller: '0x1234567890123456789012345678901234567890',
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active'
      });
    }
  }
};

// Add sample data
addSampleData();

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 