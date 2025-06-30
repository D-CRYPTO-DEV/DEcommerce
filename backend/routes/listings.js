const express = require('express');
const router = express.Router();
const { authenticateToken, uploadToIPFS } = require('../middleware');

// Get all listings
router.get('/', async (req, res) => {
  try {
    // Apply filters if provided
    let filteredListings = [...db.listings];
    
    // Filter by category
    if (req.query.category) {
      filteredListings = filteredListings.filter(
        listing => listing.category === req.query.category
      );
    }
    
    // Filter by location
    if (req.query.location) {
      filteredListings = filteredListings.filter(
        listing => listing.location === req.query.location
      );
    }
    
    // Filter by seller
    if (req.query.seller) {
      filteredListings = filteredListings.filter(
        listing => listing.seller.toLowerCase() === req.query.seller.toLowerCase()
      );
    }
    
    // Filter by price range
    if (req.query.minPrice) {
      filteredListings = filteredListings.filter(
        listing => parseFloat(listing.price) >= parseFloat(req.query.minPrice)
      );
    }
    
    if (req.query.maxPrice) {
      filteredListings = filteredListings.filter(
        listing => parseFloat(listing.price) <= parseFloat(req.query.maxPrice)
      );
    }
    
    // Sort listings
    if (req.query.sort) {
      switch (req.query.sort) {
        case 'price-asc':
          filteredListings.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
          break;
        case 'price-desc':
          filteredListings.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
          break;
        case 'newest':
          filteredListings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          break;
        case 'oldest':
          filteredListings.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          break;
        default:
          // Default sort by newest
          filteredListings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }
    } else {
      // Default sort by newest
      filteredListings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    
    const paginatedListings = filteredListings.slice(startIndex, endIndex);
    
    res.json(paginatedListings);
  } catch (error) {
    console.error('Error getting listings:', error);
    res.status(500).json({ error: 'Failed to get listings' });
  }
});

// Get featured listings
router.get('/featured', async (req, res) => {
  try {
    // Get top 8 listings sorted by some criteria (e.g., newest, most popular)
    const featuredListings = [...db.listings]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 8);
    
    res.json(featuredListings);
  } catch (error) {
    console.error('Error getting featured listings:', error);
    res.status(500).json({ error: 'Failed to get featured listings' });
  }
});

// Get listing by ID
router.get('/:id', async (req, res) => {
  try {
    const listing = db.listings.find(l => l.id === req.params.id);
    
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    
    // Get seller info
    const seller = db.users.find(u => u.walletAddress.toLowerCase() === listing.seller.toLowerCase());
    
    if (seller) {
      listing.sellerInfo = {
        id: seller.id,
        displayName: seller.displayName,
        profileImageUrl: seller.profileImageUrl,
        rating: seller.sellerInfo?.rating || 0,
        totalRatings: seller.sellerInfo?.totalRatings || 0
      };
    }
    
    res.json(listing);
  } catch (error) {
    console.error('Error getting listing:', error);
    res.status(500).json({ error: 'Failed to get listing' });
  }
});

// Create new listing
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description, price, category, location, images, quantity, shippingOptions } = req.body;
    
    // Validate required fields
    if (!name || !description || !price || !category || !location || !images || !quantity || !shippingOptions) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check if user is a seller
    const user = db.users.find(u => u.id === req.user.id);
    
    if (!user || !user.isSeller) {
      return res.status(403).json({ error: 'Only sellers can create listings' });
    }
    
    // Upload images to IPFS
    const imageUrls = [];
    
    for (const image of images) {
      try {
        const cid = await uploadToIPFS({
          name: `listing_${Date.now()}`,
          image
        });
        
        imageUrls.push(`https://ipfs.io/ipfs/${cid}`);
      } catch (error) {
        console.error('Error uploading image to IPFS:', error);
      }
    }
    
    // Create new listing
    const newListing = {
      id: generateId(),
      name,
      description,
      price,
      category,
      location,
      imageUrls: imageUrls.length > 0 ? imageUrls : images, // Fall back to original URLs if IPFS upload fails
      quantity,
      shippingOptions,
      seller: user.walletAddress,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active'
    };
    
    // Add to database
    db.listings.push(newListing);
    saveData();
    
    res.status(201).json(newListing);
  } catch (error) {
    console.error('Error creating listing:', error);
    res.status(500).json({ error: 'Failed to create listing' });
  }
});

// Update listing
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, description, price, category, location, images, quantity, shippingOptions, status } = req.body;
    
    // Find listing
    const listingIndex = db.listings.findIndex(l => l.id === req.params.id);
    
    if (listingIndex === -1) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    
    const listing = db.listings[listingIndex];
    
    // Check if user is the seller
    if (listing.seller.toLowerCase() !== req.user.address.toLowerCase()) {
      return res.status(403).json({ error: 'Only the seller can update this listing' });
    }
    
    // Update fields
    if (name) listing.name = name;
    if (description) listing.description = description;
    if (price) listing.price = price;
    if (category) listing.category = category;
    if (location) listing.location = location;
    if (quantity) listing.quantity = quantity;
    if (shippingOptions) listing.shippingOptions = shippingOptions;
    if (status) listing.status = status;
    
    // Handle image updates if provided
    if (images && images.length > 0) {
      const imageUrls = [];
      
      for (const image of images) {
        // Only upload if it's a new image (not already a URL)
        if (image.startsWith('data:')) {
          try {
            const cid = await uploadToIPFS({
              name: `listing_${listing.id}_${Date.now()}`,
              image
            });
            
            imageUrls.push(`https://ipfs.io/ipfs/${cid}`);
          } catch (error) {
            console.error('Error uploading image to IPFS:', error);
          }
        } else {
          // Keep existing image URL
          imageUrls.push(image);
        }
      }
      
      listing.imageUrls = imageUrls;
    }
    
    listing.updatedAt = new Date().toISOString();
    
    // Save changes
    saveData();
    
    res.json(listing);
  } catch (error) {
    console.error('Error updating listing:', error);
    res.status(500).json({ error: 'Failed to update listing' });
  }
});

// Delete listing
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    // Find listing
    const listingIndex = db.listings.findIndex(l => l.id === req.params.id);
    
    if (listingIndex === -1) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    
    const listing = db.listings[listingIndex];
    
    // Check if user is the seller
    if (listing.seller.toLowerCase() !== req.user.address.toLowerCase()) {
      return res.status(403).json({ error: 'Only the seller can delete this listing' });
    }
    
    // Remove listing
    db.listings.splice(listingIndex, 1);
    saveData();
    
    res.json({ message: 'Listing deleted successfully' });
  } catch (error) {
    console.error('Error deleting listing:', error);
    res.status(500).json({ error: 'Failed to delete listing' });
  }
});

// Helper function to generate unique IDs
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

module.exports = router; 