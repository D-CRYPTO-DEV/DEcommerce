import React, { useState, useEffect } from 'react';
import axios from 'axios';

const SellerProofList = () => {
  const [proofs, setProofs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedProof, setSelectedProof] = useState(null);

  useEffect(() => {
    const fetchProofs = async () => {
      try {
        const token = localStorage.getItem('token');
        
        const response = await axios.get('/api/seller/proofs', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        setProofs(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching seller proofs:', error);
        setError('Failed to load seller proofs');
        setLoading(false);
      }
    };
    
    fetchProofs();
  }, []);

  const handleViewProof = (proof) => {
    setSelectedProof(proof);
  };

  const handleCloseModal = () => {
    setSelectedProof(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{error}</span>
      </div>
    );
  }

  if (proofs.length === 0) {
    return (
      <div className="text-center py-8">
        <h3 className="text-lg font-semibold mb-2">No Seller Proofs Available</h3>
        <p className="text-gray-500">No shipping proofs have been submitted yet.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Seller Shipping Proofs</h2>
      
      <div className="overflow-x-auto">
        <table className="table w-full">
          <thead>
            <tr>
              <th>Transaction ID</th>
              <th>Seller</th>
              <th>Submitted</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {proofs.map(proof => (
              <tr key={proof.id}>
                <td className="font-mono text-xs">{proof.transactionId}</td>
                <td className="font-mono text-xs">{proof.sellerAddress.substring(0, 6)}...{proof.sellerAddress.substring(proof.sellerAddress.length - 4)}</td>
                <td>{new Date(proof.submittedAt).toLocaleString()}</td>
                <td>
                  <span className={`badge ${proof.status === 'pending' ? 'badge-warning' : proof.status === 'approved' ? 'badge-success' : 'badge-error'}`}>
                    {proof.status}
                  </span>
                </td>
                <td>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => handleViewProof(proof)}
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Modal for viewing proof details */}
      {selectedProof && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Shipping Proof Details</h3>
                <button
                  className="text-gray-500 hover:text-gray-700"
                  onClick={handleCloseModal}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="mb-4">
                    <h4 className="font-semibold mb-1">Transaction ID</h4>
                    <p className="font-mono text-sm break-all">{selectedProof.transactionId}</p>
                  </div>
                  
                  <div className="mb-4">
                    <h4 className="font-semibold mb-1">Seller Address</h4>
                    <p className="font-mono text-sm break-all">{selectedProof.sellerAddress}</p>
                  </div>
                  
                  <div className="mb-4">
                    <h4 className="font-semibold mb-1">Submitted At</h4>
                    <p>{new Date(selectedProof.submittedAt).toLocaleString()}</p>
                  </div>
                  
                  <div className="mb-4">
                    <h4 className="font-semibold mb-1">Status</h4>
                    <span className={`badge ${selectedProof.status === 'pending' ? 'badge-warning' : selectedProof.status === 'approved' ? 'badge-success' : 'badge-error'}`}>
                      {selectedProof.status}
                    </span>
                  </div>
                  
                  <div className="mb-4">
                    <h4 className="font-semibold mb-1">Description</h4>
                    <p className="text-gray-700">{selectedProof.description}</p>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">Proof Images</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedProof.imageUrls.map((url, index) => (
                      <a
                        key={index}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <img
                          src={url}
                          alt={`Proof ${index + 1}`}
                          className="w-full h-40 object-cover rounded-lg hover:opacity-80 transition-opacity"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-2">
                <button
                  className="btn btn-outline"
                  onClick={handleCloseModal}
                >
                  Close
                </button>
                
                {selectedProof.status === 'pending' && (
                  <>
                    <button
                      className="btn btn-error"
                      onClick={() => {
                        // In a real app, implement rejection logic here
                        alert('Proof rejection would be implemented here');
                        handleCloseModal();
                      }}
                    >
                      Reject
                    </button>
                    <button
                      className="btn btn-success"
                      onClick={() => {
                        // In a real app, implement approval logic here
                        alert('Proof approval would be implemented here');
                        handleCloseModal();
                      }}
                    >
                      Approve
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellerProofList; 