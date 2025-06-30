import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const Home = () => {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch featured products
    const fetchFeaturedProducts = async () => {
      try {
        const response = await axios.get('/api/listings/featured');
        setFeaturedProducts(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching featured products:', error);
        setLoading(false);
      }
    };

    fetchFeaturedProducts();
  }, []);

  return (
    <div className="container mx-auto px-4">
      <section className="hero bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl p-8 mb-12">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-bold mb-4">Decentralized E-Commerce Platform</h1>
          <p className="text-xl mb-6">Buy and sell products with cryptocurrency, secured by blockchain technology</p>
          <div className="flex flex-wrap gap-4">
            <Link to="/marketplace" className="btn btn-primary">Browse Marketplace</Link>
            <Link to="/register" className="btn btn-outline btn-light">Become a Seller</Link>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Featured Products</h2>
          <Link to="/marketplace" className="text-blue-500 hover:underline">View All</Link>
        </div>
        
        {loading ? (
          <div className="flex justify-center">
            <div className="loading loading-spinner loading-lg"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredProducts.map(product => (
              <div key={product.id} className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
                <figure className="px-4 pt-4">
                  <img src={product.imageUrl} alt={product.name} className="rounded-xl h-48 w-full object-cover" />
                </figure>
                <div className="card-body">
                  <h3 className="card-title text-lg">{product.name}</h3>
                  <p className="text-gray-500 truncate">{product.description}</p>
                  <div className="flex justify-between items-center mt-2">
                    <span className="font-bold">{product.price} ETH</span>
                    <Link to={`/product/${product.id}`} className="btn btn-sm btn-primary">View Details</Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h3 className="card-title">Secure Payments</h3>
            <p>All transactions are secured by smart contracts with escrow functionality</p>
          </div>
        </div>
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h3 className="card-title">Decentralized Governance</h3>
            <p>Community-driven platform with voting on important decisions</p>
          </div>
        </div>
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h3 className="card-title">Dispute Resolution</h3>
            <p>Fair dispute resolution through community voting</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home; 