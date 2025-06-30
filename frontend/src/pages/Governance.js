import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAccount } from 'wagmi';
import { useAuth } from '../context/AuthContext';
import SellerProofList from '../components/SellerProofList';

const Governance = () => {
  const { address } = useAccount();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  const [proposals, setProposals] = useState([]);
  const [isGovernor, setIsGovernor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('proposals');

  // Check if user is a governor
  useEffect(() => {
    const checkGovernorStatus = async () => {
      if (!isAuthenticated || !address) {
        setIsGovernor(false);
        return;
      }
      
      try {
        // In a real app, you would check against the blockchain
        // For now, we'll assume all authenticated users can view governance
        setIsGovernor(true);
      } catch (error) {
        console.error('Error checking governor status:', error);
        setIsGovernor(false);
      }
    };
    
    checkGovernorStatus();
  }, [isAuthenticated, address]);

  // Fetch proposals
  useEffect(() => {
    const fetchProposals = async () => {
      try {
        const token = localStorage.getItem('token');
        
        const response = await axios.get('/api/governance/proposals', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        setProposals(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching proposals:', error);
        setError('Failed to load proposals');
        setLoading(false);
      }
    };
    
    fetchProposals();
  }, []);

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
      <h1 className="text-3xl font-bold mb-6">Governance</h1>
      
      {error && (
        <div className="alert alert-error mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}
      
      {!isAuthenticated ? (
        <div className="alert alert-warning mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h3 className="font-bold">Authentication Required</h3>
            <p className="text-sm">Please connect your wallet to participate in governance.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="tabs mb-6">
            <button 
              className={`tab tab-bordered ${activeTab === 'proposals' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('proposals')}
            >
              Proposals
            </button>
            <button 
              className={`tab tab-bordered ${activeTab === 'seller-proofs' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('seller-proofs')}
            >
              Seller Proofs
            </button>
            <button 
              className={`tab tab-bordered ${activeTab === 'treasury' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('treasury')}
            >
              Treasury
            </button>
            <button 
              className={`tab tab-bordered ${activeTab === 'create' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('create')}
            >
              Create Proposal
            </button>
          </div>
          
          {/* Proposals Tab */}
          {activeTab === 'proposals' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Active Proposals</h2>
                <button
                  className="btn btn-primary"
                  onClick={() => setActiveTab('create')}
                >
                  Create Proposal
                </button>
              </div>
              
              {proposals.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No active proposals at the moment.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {proposals.map(proposal => (
                    <div key={proposal.id} className="card bg-base-100 shadow-xl">
                      <div className="card-body">
                        <div className="flex justify-between">
                          <h2 className="card-title">{proposal.title}</h2>
                          <span className={`badge ${
                            proposal.status === 'Active' ? 'badge-primary' :
                            proposal.status === 'Passed' ? 'badge-success' :
                            proposal.status === 'Rejected' ? 'badge-error' :
                            proposal.status === 'Executed' ? 'badge-info' :
                            'badge-ghost'
                          }`}>
                            {proposal.status}
                          </span>
                        </div>
                        
                        <p className="text-gray-600 line-clamp-2">{proposal.description}</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                          <div>
                            <p className="text-sm text-gray-500">Proposer</p>
                            <p className="font-mono text-xs">{proposal.proposer.substring(0, 6)}...{proposal.proposer.substring(proposal.proposer.length - 4)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Voting Period</p>
                            <p className="text-sm">{new Date(proposal.startTime).toLocaleDateString()} - {new Date(proposal.endTime).toLocaleDateString()}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Votes</p>
                            <div className="flex items-center gap-2">
                              <span className="text-green-500">{proposal.votesFor} For</span>
                              <span className="text-red-500">{proposal.votesAgainst} Against</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="card-actions justify-end mt-4">
                          <button
                            className="btn btn-primary"
                            onClick={() => navigate(`/proposal/${proposal.id}`)}
                          >
                            View Details
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Seller Proofs Tab */}
          {activeTab === 'seller-proofs' && (
            <SellerProofList />
          )}
          
          {/* Treasury Tab */}
          {activeTab === 'treasury' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Treasury</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                <div className="stat bg-base-100 shadow">
                  <div className="stat-title">Total Balance</div>
                  <div className="stat-value">10.5 ETH</div>
                  <div className="stat-desc">Updated 1 hour ago</div>
                </div>
                <div className="stat bg-base-100 shadow">
                  <div className="stat-title">Platform Fees Collected</div>
                  <div className="stat-value">0.8 ETH</div>
                  <div className="stat-desc">Last 7 days</div>
                </div>
                <div className="stat bg-base-100 shadow">
                  <div className="stat-title">Pending Allocations</div>
                  <div className="stat-value">2.3 ETH</div>
                  <div className="stat-desc">From active proposals</div>
                </div>
              </div>
              
              <div className="bg-base-100 shadow-xl rounded-lg p-6">
                <h3 className="font-semibold mb-4">Recent Treasury Transactions</h3>
                
                <div className="overflow-x-auto">
                  <table className="table w-full">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Description</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><span className="badge badge-success">Income</span></td>
                        <td>0.12 ETH</td>
                        <td>Platform fees</td>
                        <td>{new Date().toLocaleDateString()}</td>
                      </tr>
                      <tr>
                        <td><span className="badge badge-error">Expense</span></td>
                        <td>0.5 ETH</td>
                        <td>Development grant</td>
                        <td>{new Date(Date.now() - 86400000).toLocaleDateString()}</td>
                      </tr>
                      <tr>
                        <td><span className="badge badge-success">Income</span></td>
                        <td>0.08 ETH</td>
                        <td>Platform fees</td>
                        <td>{new Date(Date.now() - 172800000).toLocaleDateString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          
          {/* Create Proposal Tab */}
          {activeTab === 'create' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Create New Proposal</h2>
              
              <div className="bg-white rounded-lg shadow-md p-6">
                <form>
                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="title">
                      Title
                    </label>
                    <input
                      type="text"
                      id="title"
                      className="input input-bordered w-full"
                      placeholder="Enter proposal title"
                    />
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="description">
                      Description
                    </label>
                    <textarea
                      id="description"
                      className="textarea textarea-bordered w-full"
                      rows="5"
                      placeholder="Describe your proposal in detail"
                    ></textarea>
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="proposalType">
                      Proposal Type
                    </label>
                    <select
                      id="proposalType"
                      className="select select-bordered w-full"
                    >
                      <option value="">Select proposal type</option>
                      <option value="treasury">Treasury Allocation</option>
                      <option value="parameter">Parameter Change</option>
                      <option value="moderation">Seller Moderation</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="votingPeriod">
                      Voting Period (days)
                    </label>
                    <input
                      type="number"
                      id="votingPeriod"
                      className="input input-bordered w-full"
                      min="1"
                      max="14"
                      defaultValue="7"
                    />
                  </div>
                  
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="btn btn-primary"
                    >
                      Create Proposal
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Governance; 