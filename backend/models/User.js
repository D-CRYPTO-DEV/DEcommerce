const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  address: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  isSeller: {
    type: Boolean,
    default: false
  },
  isCourier: {
    type: Boolean,
    default: false
  },
  reputation: {
    type: Number,
    default: 0
  },
  location: {
    type: String,
    default: ''
  },
  sellerCategories: {
    type: [String],
    default: []
  },
  serviceAreas: {
    type: [String],
    default: []
  },
  vehicle: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', userSchema); 