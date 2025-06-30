const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware');

// Default categories
const defaultCategories = [
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

// Initialize categories if not exists
if (!db.categories || db.categories.length === 0) {
  db.categories = defaultCategories;
  saveData();
}

// Get all categories
router.get('/', async (req, res) => {
  try {
    res.json(db.categories);
  } catch (error) {
    console.error('Error getting categories:', error);
    res.status(500).json({ error: 'Failed to get categories' });
  }
});

// Add new category (admin only)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { id, name } = req.body;
    
    if (!id || !name) {
      return res.status(400).json({ error: 'ID and name are required' });
    }
    
    // Check if user is admin (in a real app, you'd check against admin list)
    const user = db.users.find(u => u.id === req.user.id);
    const isAdmin = user && user.role === 'admin';
    
    if (!isAdmin) {
      return res.status(403).json({ error: 'Only admins can add categories' });
    }
    
    // Check if category ID already exists
    if (db.categories.some(c => c.id === id)) {
      return res.status(400).json({ error: 'Category ID already exists' });
    }
    
    // Add new category
    const newCategory = { id, name };
    db.categories.push(newCategory);
    saveData();
    
    res.status(201).json(newCategory);
  } catch (error) {
    console.error('Error adding category:', error);
    res.status(500).json({ error: 'Failed to add category' });
  }
});

module.exports = router; 