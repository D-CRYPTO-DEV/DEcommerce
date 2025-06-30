import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Login from '../components/Login';

const Register = () => {
  const { user, isAuthenticated } = useAuth();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    displayName: '',
    bio: '',
    profileImage: null,
    role: 'buyer' // buyer, seller, or courier
  });
  const navigate = useNavigate();

  // Redirect if already registered
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate('/profile');
    }
  }, [isAuthenticated, user, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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

  const handleRoleSelect = (role) => {
    setFormData(prev => ({ ...prev, role }));
    setStep(3);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // This will be handled in the profile page after login
    navigate('/profile');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center">Join DEcommerce</h1>
        
        {step === 1 && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Step 1: Connect Your Account</h2>
            <p className="mb-6">First, connect your wallet or sign in with Google to get started.</p>
            
            <Login onClose={() => setStep(2)} />
          </div>
        )}
        
        {step === 2 && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Step 2: Choose Your Role</h2>
            <p className="mb-6">How would you like to participate in our marketplace?</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div 
                className="border rounded-lg p-4 text-center cursor-pointer hover:bg-blue-50 transition-colors"
                onClick={() => handleRoleSelect('buyer')}
              >
                <div className="text-blue-500 text-4xl mb-2">🛒</div>
                <h3 className="font-medium">Buyer</h3>
                <p className="text-sm text-gray-500">Purchase products from sellers</p>
              </div>
              
              <div 
                className="border rounded-lg p-4 text-center cursor-pointer hover:bg-blue-50 transition-colors"
                onClick={() => handleRoleSelect('seller')}
              >
                <div className="text-green-500 text-4xl mb-2">🏪</div>
                <h3 className="font-medium">Seller</h3>
                <p className="text-sm text-gray-500">List and sell your products</p>
              </div>
              
              <div 
                className="border rounded-lg p-4 text-center cursor-pointer hover:bg-blue-50 transition-colors"
                onClick={() => handleRoleSelect('courier')}
              >
                <div className="text-purple-500 text-4xl mb-2">🚚</div>
                <h3 className="font-medium">Courier</h3>
                <p className="text-sm text-gray-500">Deliver products to buyers</p>
              </div>
            </div>
          </div>
        )}
        
        {step === 3 && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Step 3: Complete Your Profile</h2>
            
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
                      className="w-24 h-24 object-cover rounded-full mx-auto"
                    />
                  </div>
                )}
              </div>
              
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="btn btn-outline"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Complete Registration
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default Register; 