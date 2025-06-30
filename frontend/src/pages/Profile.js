import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useAccount, useContract, useSigner } from 'wagmi';

const Profile = () => {
  const { user, isAuthenticated } = useAuth();
  const { address } = useAccount();
  const { data: signer } = useSigner();
  const navigate = useNavigate();
  
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [formData, setFormData] = useState({
    displayName: '',
    bio: '',
    profileImage: null
  });
  
  // Seller registration form
  const [sellerForm, setSellerForm] = useState({
    location: '',
    categories: []
  });
  
  // Courier registration form
  const [courierForm, setCourierForm] = useState({
    location: '',
    serviceAreas: [],
    vehicle: 'car'
  });
  
  // Payment contract
  const paymentContract = useContract({
    address: process.env.REACT_APP_PAYMENT_CONTRACT_ADDRESS,
    abi: [
      "function registerAsSeller(string memory location, string[] memory categories) external",
      "function registerAsCourier(string memory location, string[] memory serviceAreas) external"
    ],
    signerOrProvider: signer
  });
  
  // Load user data
  useEffect(() => {
    if (isAuthenticated && user) {
      setFormData({
        displayName: user.displayName || '',
        bio: user.bio || '',
        profileImage: user.profileImageUrl || null
      });
    }
  }, [isAuthenticated, user]);
  
  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSellerChange = (e) => {
    const { name, value } = e.target;
    setSellerForm(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSellerCategoryChange = (e) => {
    const { value, checked } = e.target;
    
    setSellerForm(prev => {
      if (checked) {
        return { ...prev, categories: [...prev.categories, value] };
      } else {
        return { ...prev, categories: prev.categories.filter(cat => cat !== value) };
      }
    });
  };
  
  const handleCourierChange = (e) => {
    const { name, value } = e.target;
    setCourierForm(prev => ({ ...prev, [name]: value }));
  };
  
  const handleCourierAreaChange = (e) => {
    const { value, checked } = e.target;
    
    setCourierForm(prev => {
      if (checked) {
        return { ...prev, serviceAreas: [...prev.serviceAreas, value] };
      } else {
        return { ...prev, serviceAreas: prev.serviceAreas.filter(area => area !== value) };
      }
    });
  };
  
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, profileImage: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const token = localStorage.getItem('token');
      
      const response = await axios.put('/api/users/profile', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSuccess('Profile updated successfully');
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      setError('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };
  
  const handleRegisterAsSeller = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      if (!sellerForm.location || sellerForm.categories.length === 0) {
        throw new Error('Please fill all required fields');
      }
      
      // Register on blockchain
      const tx = await paymentContract.registerAsSeller(
        sellerForm.location,
        sellerForm.categories
      );
      
      // Wait for transaction to be mined
      await tx.wait();
      
      // Register on backend
      const token = localStorage.getItem('token');
      const response = await axios.post(
        '/api/users/register-seller',
        {
          location: sellerForm.location,
          categories: sellerForm.categories,
          transactionHash: tx.hash
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSuccess('Successfully registered as a seller');
      
      // Reload page after short delay
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Error registering as seller:', error);
      setError('Failed to register as seller: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };
  
  const handleRegisterAsCourier = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      if (!courierForm.location || courierForm.serviceAreas.length === 0 || !courierForm.vehicle) {
        throw new Error('Please fill all required fields');
      }
      
      // Register on blockchain
      const tx = await paymentContract.registerAsCourier(
        courierForm.location,
        courierForm.serviceAreas
      );
      
      // Wait for transaction to be mined
      await tx.wait();
      
      // Register on backend
      const token = localStorage.getItem('token');
      const response = await axios.post(
        '/api/users/register-courier',
        {
          location: courierForm.location,
          serviceAreas: courierForm.serviceAreas,
          vehicle: courierForm.vehicle,
          transactionHash: tx.hash
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSuccess('Successfully registered as a courier');
      
      // Reload page after short delay
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Error registering as courier:', error);
      setError('Failed to register as courier: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };
  
  if (!isAuthenticated || !user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">My Profile</h1>
      
      {error && (
        <div className="alert alert-error mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}
      
      {success && (
        <div className="alert alert-success mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{success}</span>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Information */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Profile Information</h2>
              <button
                className="btn btn-sm btn-outline"
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? 'Cancel' : 'Edit Profile'}
              </button>
            </div>
            
            {isEditing ? (
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="displayName">
                    Display Name
                  </label>
                  <input
                    type="text"
                    id="displayName"
                    name="displayName"
                    value={formData.displayName}
                    onChange={handleChange}
                    className="input input-bordered w-full"
                    required
                  />
                </div>
                
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="bio">
                    Bio
                  </label>
                  <textarea
                    id="bio"
                    name="bio"
                    value={formData.bio}
                    onChange={handleChange}
                    className="textarea textarea-bordered w-full"
                    rows="3"
                  ></textarea>
                </div>
                
                <div className="mb-6">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="profileImage">
                    Profile Image
                  </label>
                  <input
                    type="file"
                    id="profileImage"
                    name="profileImage"
                    onChange={handleImageChange}
                    className="file-input file-input-bordered w-full"
                    accept="image/*"
                  />
                  {formData.profileImage && (
                    <div className="mt-2">
                      <img 
                        src={formData.profileImage} 
                        alt="Profile preview" 
                        className="w-24 h-24 object-cover rounded-full"
                      />
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? <span className="loading loading-spinner"></span> : 'Save Changes'}
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <div className="flex items-center mb-4">
                  {formData.profileImage ? (
                    <img 
                      src={formData.profileImage} 
                      alt={formData.displayName} 
                      className="w-24 h-24 object-cover rounded-full mr-4"
                    />
                  ) : (
                    <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mr-4">
                      <span className="text-3xl text-gray-500">
                        {formData.displayName ? formData.displayName[0].toUpperCase() : '?'}
                      </span>
                    </div>
                  )}
                  
                  <div>
                    <h3 className="text-lg font-semibold">{formData.displayName || 'No display name'}</h3>
                    <p className="text-gray-500 text-sm break-all">{address}</p>
                  </div>
                </div>
                
                <div className="mb-4">
                  <h4 className="font-semibold mb-1">Bio</h4>
                  <p className="text-gray-700">{formData.bio || 'No bio provided'}</p>
                </div>
                
                <div className="mb-4">
                  <h4 className="font-semibold mb-1">Roles</h4>
                  <div className="flex flex-wrap gap-2">
                    <span className="badge badge-primary">Buyer</span>
                    {user.isSeller && <span className="badge badge-success">Seller</span>}
                    {user.isCourier && <span className="badge badge-secondary">Courier</span>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Sidebar */}
        <div>
          {/* Become a Seller */}
          {!user.isSeller && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Become a Seller</h2>
              <p className="text-gray-700 mb-4">List your products and start selling on our marketplace.</p>
              
              <form onSubmit={handleRegisterAsSeller}>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="sellerLocation">
                    Location
                  </label>
                  <input
                    type="text"
                    id="sellerLocation"
                    name="location"
                    value={sellerForm.location}
                    onChange={handleSellerChange}
                    className="input input-bordered w-full"
                    required
                  />
                </div>
                
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Categories
                  </label>
                  
                  <div className="space-y-2">
                    <div className="form-control">
                      <label className="label cursor-pointer justify-start gap-2">
                        <input 
                          type="checkbox" 
                          value="electronics" 
                          onChange={handleSellerCategoryChange}
                          className="checkbox checkbox-primary" 
                        />
                        <span className="label-text">Electronics</span>
                      </label>
                    </div>
                    
                    <div className="form-control">
                      <label className="label cursor-pointer justify-start gap-2">
                        <input 
                          type="checkbox" 
                          value="clothing" 
                          onChange={handleSellerCategoryChange}
                          className="checkbox checkbox-primary" 
                        />
                        <span className="label-text">Clothing & Fashion</span>
                      </label>
                    </div>
                    
                    <div className="form-control">
                      <label className="label cursor-pointer justify-start gap-2">
                        <input 
                          type="checkbox" 
                          value="home" 
                          onChange={handleSellerCategoryChange}
                          className="checkbox checkbox-primary" 
                        />
                        <span className="label-text">Home & Garden</span>
                      </label>
                    </div>
                    
                    <div className="form-control">
                      <label className="label cursor-pointer justify-start gap-2">
                        <input 
                          type="checkbox" 
                          value="other" 
                          onChange={handleSellerCategoryChange}
                          className="checkbox checkbox-primary" 
                        />
                        <span className="label-text">Other</span>
                      </label>
                    </div>
                  </div>
                </div>
                
                <button
                  type="submit"
                  className="btn btn-success w-full"
                  disabled={loading}
                >
                  {loading ? <span className="loading loading-spinner"></span> : 'Register as Seller'}
                </button>
              </form>
            </div>
          )}
          
          {/* Become a Courier */}
          {!user.isCourier && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Become a Courier</h2>
              <p className="text-gray-700 mb-4">Deliver products and earn rewards.</p>
              
              <form onSubmit={handleRegisterAsCourier}>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="courierLocation">
                    Location
                  </label>
                  <input
                    type="text"
                    id="courierLocation"
                    name="location"
                    value={courierForm.location}
                    onChange={handleCourierChange}
                    className="input input-bordered w-full"
                    required
                  />
                </div>
                
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Service Areas
                  </label>
                  
                  <div className="space-y-2">
                    <div className="form-control">
                      <label className="label cursor-pointer justify-start gap-2">
                        <input 
                          type="checkbox" 
                          value="north" 
                          onChange={handleCourierAreaChange}
                          className="checkbox checkbox-secondary" 
                        />
                        <span className="label-text">North</span>
                      </label>
                    </div>
                    
                    <div className="form-control">
                      <label className="label cursor-pointer justify-start gap-2">
                        <input 
                          type="checkbox" 
                          value="south" 
                          onChange={handleCourierAreaChange}
                          className="checkbox checkbox-secondary" 
                        />
                        <span className="label-text">South</span>
                      </label>
                    </div>
                    
                    <div className="form-control">
                      <label className="label cursor-pointer justify-start gap-2">
                        <input 
                          type="checkbox" 
                          value="east" 
                          onChange={handleCourierAreaChange}
                          className="checkbox checkbox-secondary" 
                        />
                        <span className="label-text">East</span>
                      </label>
                    </div>
                    
                    <div className="form-control">
                      <label className="label cursor-pointer justify-start gap-2">
                        <input 
                          type="checkbox" 
                          value="west" 
                          onChange={handleCourierAreaChange}
                          className="checkbox checkbox-secondary" 
                        />
                        <span className="label-text">West</span>
                      </label>
                    </div>
                  </div>
                </div>
                
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="vehicle">
                    Vehicle Type
                  </label>
                  <select
                    id="vehicle"
                    name="vehicle"
                    value={courierForm.vehicle}
                    onChange={handleCourierChange}
                    className="select select-bordered w-full"
                    required
                  >
                    <option value="car">Car</option>
                    <option value="motorcycle">Motorcycle</option>
                    <option value="bicycle">Bicycle</option>
                    <option value="van">Van</option>
                    <option value="truck">Truck</option>
                  </select>
                </div>
                
                <button
                  type="submit"
                  className="btn btn-secondary w-full"
                  disabled={loading}
                >
                  {loading ? <span className="loading loading-spinner"></span> : 'Register as Courier'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile; 