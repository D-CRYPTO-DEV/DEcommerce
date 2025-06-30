import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import SellerProofForm from '../components/SellerProofForm';

const SellerDashboard = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  const [listings, setListings] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('transactions');

  // Redirect if not authenticated or not a seller
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }
    
    if (user && !user.isSeller) {
      navigate('/profile');
    }
  }, [isAuthenticated, user, navigate]);

  // Fetch seller data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        
        // Fetch seller's listings
        const listingsResponse = await axios.get('/api/listings', {
          params: { seller: user.walletAddress },
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Fetch seller's transactions
        const transactionsResponse = await axios.get('/api/transactions/user', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Filter transactions where user is the seller
        const sellerTransactions = transactionsResponse.data.filter(
          tx => tx.seller.toLowerCase() === user.walletAddress.toLowerCase()
        );
        
        setListings(listingsResponse.data);
        setTransactions(sellerTransactions);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching seller data:', error);
        setError('Failed to load seller data');
        setLoading(false);
      }
    };
    
    if (isAuthenticated && user && user.isSeller) {
      fetchData();
    }
  }, [isAuthenticated, user]);

  const handleProofSubmission = (transaction) => {
    setSelectedTransaction(transaction);
  };

  const handleProofSuccess = () => {
    // Refresh transactions after successful proof submission
    const fetchTransactions = async () => {
      try {
        const token = localStorage.getItem('token');
        
        const response = await axios.get('/api/transactions/user', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Filter transactions where user is the seller
        const sellerTransactions = response.data.filter(
          tx => tx.seller.toLowerCase() === user.walletAddress.toLowerCase()
        );
        
        setTransactions(sellerTransactions);
        setSelectedTransaction(null);
      } catch (error) {
        console.error('Error refreshing transactions:', error);
      }
    };
    
    fetchTransactions();
  };

  if (!isAuthenticated || (user && !user.isSeller)) {
    return null; // Redirect will handle this
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center">
          <div className="loading loading-spinner loading-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Seller Dashboard</h1>
      
      {error && (
        <div className="alert alert-error mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}
      
      {/* Tabs */}
      <div className="tabs mb-6">
        <button 
          className={`tab tab-bordered ${activeTab === 'transactions' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('transactions')}
        >
          Transactions
        </button>
        <button 
          className={`tab tab-bordered ${activeTab === 'listings' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('listings')}
        >
          My Listings
        </button>
        <button 
          className={`tab tab-bordered ${activeTab === 'create' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          Create Listing
        </button>
      </div>
      
      {/* Selected transaction for proof submission */}
      {selectedTransaction && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Submit Shipping Proof</h2>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => setSelectedTransaction(null)}
            >
              Cancel
            </button>
          </div>
          
          <div className="bg-base-200 p-4 rounded-lg mb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold">Transaction Details</h3>
                <p className="text-sm">ID: {selectedTransaction.id}</p>
                <p className="text-sm">Product: {selectedTransaction.listingName}</p>
                <p className="text-sm">Quantity: {selectedTransaction.quantity}</p>
                <p className="text-sm">Total: {selectedTransaction.totalAmount} ETH</p>
              </div>
              <div>
                <h3 className="font-semibold">Buyer</h3>
                <p className="text-sm font-mono">{selectedTransaction.buyer}</p>
                <h3 className="font-semibold mt-2">Delivery Address</h3>
                <p className="text-sm">{selectedTransaction.deliveryAddress}</p>
              </div>
            </div>
          </div>
          
          <SellerProofForm 
            transactionId={selectedTransaction.id}
            onSuccess={handleProofSuccess}
          />
        </div>
      )}
      
      {/* Transactions Tab */}
      {activeTab === 'transactions' && !selectedTransaction && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Your Transactions</h2>
          
          {transactions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">You don't have any transactions yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Buyer</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(transaction => (
                    <tr key={transaction.id}>
                      <td>
                        <div className="flex items-center space-x-3">
                          {transaction.listingImageUrl && (
                            <div className="avatar">
                              <div className="mask mask-squircle w-12 h-12">
                                <img src={transaction.listingImageUrl} alt={transaction.listingName} />
                              </div>
                            </div>
                          )}
                          <div>
                            <div className="font-bold">{transaction.listingName}</div>
                            <div className="text-sm opacity-50">Qty: {transaction.quantity}</div>
                          </div>
                        </div>
                      </td>
                      <td className="font-mono text-xs">
                        {transaction.buyer.substring(0, 6)}...{transaction.buyer.substring(transaction.buyer.length - 4)}
                      </td>
                      <td>{transaction.totalAmount} ETH</td>
                      <td>
                        <span className={`badge ${
                          transaction.status === 'pending' ? 'badge-warning' :
                          transaction.status === 'shipped' ? 'badge-info' :
                          transaction.status === 'delivered' ? 'badge-success' :
                          transaction.status === 'disputed' ? 'badge-error' :
                          'badge-ghost'
                        }`}>
                          {transaction.status}
                        </span>
                      </td>
                      <td>{new Date(transaction.createdAt).toLocaleDateString()}</td>
                      <td>
                        {transaction.status === 'pending' && (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleProofSubmission(transaction)}
                          >
                            Submit Proof
                          </button>
                        )}
                        {transaction.status === 'shipped' && (
                          <span className="text-sm text-gray-500">Awaiting delivery</span>
                        )}
                        {transaction.status === 'delivered' && (
                          <span className="text-sm text-green-500">Completed</span>
                        )}
                        {transaction.status === 'disputed' && (
                          <span className="text-sm text-red-500">Under dispute</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      
      {/* Listings Tab */}
      {activeTab === 'listings' && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Your Listings</h2>
          
          {listings.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">You don't have any listings yet.</p>
              <button
                className="btn btn-primary mt-4"
                onClick={() => setActiveTab('create')}
              >
                Create Your First Listing
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {listings.map(listing => (
                <div key={listing.id} className="card bg-base-100 shadow-xl">
                  <figure>
                    {listing.imageUrls && listing.imageUrls[0] && (
                      <img
                        src={listing.imageUrls[0]}
                        alt={listing.name}
                        className="h-48 w-full object-cover"
                      />
                    )}
                  </figure>
                  <div className="card-body">
                    <h2 className="card-title">{listing.name}</h2>
                    <p className="text-gray-500 line-clamp-2">{listing.description}</p>
                    <div className="flex justify-between items-center mt-2">
                      <span className="font-bold">{listing.price} ETH</span>
                      <span className="text-sm">Qty: {listing.quantity}</span>
                    </div>
                    <div className="card-actions justify-end mt-4">
                      <button className="btn btn-sm btn-outline">Edit</button>
                      <button className="btn btn-sm btn-error">Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Create Listing Tab */}
      {activeTab === 'create' && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Create New Listing</h2>
          
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-center text-gray-500 py-8">
              Listing creation form would go here.
              <br />
              This would include fields for product name, description, price, quantity, images, etc.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellerDashboard; 