import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const Marketplace = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const productsPerPage = 12;

  useEffect(() => {
    // Fetch all products and categories
    const fetchData = async () => {
      try {
        const [productsResponse, categoriesResponse] = await Promise.all([
          axios.get('/api/listings'),
          axios.get('/api/categories')
        ]);
        
        setProducts(productsResponse.data);
        setCategories(categoriesResponse.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching marketplace data:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter and sort products
  const filteredProducts = products
    .filter(product => 
      (selectedCategory === 'all' || product.category === selectedCategory) &&
      (product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
       product.description.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return parseFloat(a.price) - parseFloat(b.price);
        case 'price-high':
          return parseFloat(b.price) - parseFloat(a.price);
        case 'oldest':
          return new Date(a.createdAt) - new Date(b.createdAt);
        case 'newest':
        default:
          return new Date(b.createdAt) - new Date(a.createdAt);
      }
    });

  // Pagination
  const indexOfLastProduct = currentPage * productsPerPage;
  const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
  const currentProducts = filteredProducts.slice(indexOfFirstProduct, indexOfLastProduct);
  const totalPages = Math.ceil(filteredProducts.length / productsPerPage);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo(0, 0);
  };

  return (
    <div className="container mx-auto px-4">
      <h1 className="text-3xl font-bold mb-6">Marketplace</h1>
      
      <div className="flex flex-col md:flex-row gap-6 mb-8">
        {/* Search and filters */}
        <div className="w-full md:w-1/4">
          <div className="bg-base-100 shadow-md rounded-lg p-4 mb-4">
            <h3 className="font-bold mb-2">Search</h3>
            <input
              type="text"
              placeholder="Search products..."
              className="input input-bordered w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="bg-base-100 shadow-md rounded-lg p-4 mb-4">
            <h3 className="font-bold mb-2">Categories</h3>
            <div className="space-y-2">
              <div className="form-control">
                <label className="label cursor-pointer justify-start gap-2">
                  <input 
                    type="radio" 
                    name="category" 
                    className="radio radio-primary" 
                    checked={selectedCategory === 'all'}
                    onChange={() => setSelectedCategory('all')}
                  />
                  <span className="label-text">All Categories</span>
                </label>
              </div>
              
              {categories.map(category => (
                <div key={category.id} className="form-control">
                  <label className="label cursor-pointer justify-start gap-2">
                    <input 
                      type="radio" 
                      name="category" 
                      className="radio radio-primary"
                      checked={selectedCategory === category.id}
                      onChange={() => setSelectedCategory(category.id)}
                    />
                    <span className="label-text">{category.name}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-base-100 shadow-md rounded-lg p-4">
            <h3 className="font-bold mb-2">Sort By</h3>
            <select 
              className="select select-bordered w-full"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
            </select>
          </div>
        </div>
        
        {/* Product grid */}
        <div className="w-full md:w-3/4">
          {loading ? (
            <div className="flex justify-center">
              <div className="loading loading-spinner loading-lg"></div>
            </div>
          ) : currentProducts.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {currentProducts.map(product => (
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
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center mt-8">
                  <div className="join">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        className={`join-item btn ${currentPage === page ? 'btn-active' : ''}`}
                        onClick={() => handlePageChange(page)}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <h3 className="text-xl font-semibold mb-2">No products found</h3>
              <p className="text-gray-500">Try changing your search or filter criteria</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Marketplace; 