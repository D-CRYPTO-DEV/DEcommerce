import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { InjectedConnector } from 'wagmi/connectors/injected';
import { useAuth } from '../context/AuthContext';
import { useLocation } from '../context/LocationContext';
import Login from './Login';

const Navbar = () => {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect({
    connector: new InjectedConnector(),
  });
  const { disconnect } = useDisconnect();
  const { user, isAuthenticated, logout } = useAuth();
  const { userLocation, availableLocations, updateLocation } = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const navigate = useNavigate();

  const handleConnect = async () => {
    setShowLoginModal(true);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const truncateAddress = (addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <>
      <nav className="bg-gray-800 text-white">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo and primary navigation */}
            <div className="flex items-center">
              <Link to="/" className="flex-shrink-0 text-xl font-bold">
                DEcommerce
              </Link>
              <div className="hidden md:block ml-10">
                <div className="flex items-baseline space-x-4">
                  <Link to="/" className="px-3 py-2 rounded-md hover:bg-gray-700">
                    Home
                  </Link>
                  <Link to="/marketplace" className="px-3 py-2 rounded-md hover:bg-gray-700">
                    Marketplace
                  </Link>
                  <Link to="/governance" className="px-3 py-2 rounded-md hover:bg-gray-700">
                    Governance
                  </Link>
                  {isAuthenticated && (
                    <>
                      {user?.isSeller && (
                        <Link to="/seller-dashboard" className="px-3 py-2 rounded-md hover:bg-gray-700">
                          Seller Dashboard
                        </Link>
                      )}
                      {user?.isCourier && (
                        <Link to="/courier-dashboard" className="px-3 py-2 rounded-md hover:bg-gray-700">
                          Courier Dashboard
                        </Link>
                      )}
                      <Link to="/buyer-dashboard" className="px-3 py-2 rounded-md hover:bg-gray-700">
                        My Orders
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Location selector */}
            <div className="hidden md:block relative">
              <button 
                className="flex items-center px-3 py-2 border rounded-md border-gray-600 hover:bg-gray-700"
                onClick={() => setIsLocationDropdownOpen(!isLocationDropdownOpen)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                {userLocation || 'Select Location'}
              </button>

              {isLocationDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10">
                  {availableLocations.map((location) => (
                    <button
                      key={location}
                      className="block w-full text-left px-4 py-2 text-gray-800 hover:bg-gray-100"
                      onClick={() => {
                        updateLocation(location);
                        setIsLocationDropdownOpen(false);
                      }}
                    >
                      {location}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* User account section */}
            <div className="hidden md:block">
              <div className="flex items-center">
                {isAuthenticated ? (
                  <div className="flex items-center">
                    <span className="bg-gray-700 rounded-md px-3 py-2 mr-2">
                      {truncateAddress(user?.walletAddress || address)}
                    </span>
                    <Link to="/profile" className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-md mr-2">
                      Profile
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-md"
                    >
                      Logout
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleConnect}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-md"
                  >
                    Login / Sign Up
                  </button>
                )}
              </div>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none"
              >
                <svg
                  className={`${isMenuOpen ? 'hidden' : 'block'} h-6 w-6`}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <svg
                  className={`${isMenuOpen ? 'block' : 'hidden'} h-6 w-6`}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <div className={`${isMenuOpen ? 'block' : 'hidden'} md:hidden`}>
          <div className="px-2 pt-2 pb-3 space-y-1">
            <Link to="/" className="block px-3 py-2 rounded-md hover:bg-gray-700">
              Home
            </Link>
            <Link to="/marketplace" className="block px-3 py-2 rounded-md hover:bg-gray-700">
              Marketplace
            </Link>
            <Link to="/governance" className="block px-3 py-2 rounded-md hover:bg-gray-700">
              Governance
            </Link>
            {isAuthenticated && (
              <>
                {user?.isSeller && (
                  <Link to="/seller-dashboard" className="block px-3 py-2 rounded-md hover:bg-gray-700">
                    Seller Dashboard
                  </Link>
                )}
                {user?.isCourier && (
                  <Link to="/courier-dashboard" className="block px-3 py-2 rounded-md hover:bg-gray-700">
                    Courier Dashboard
                  </Link>
                )}
                <Link to="/buyer-dashboard" className="block px-3 py-2 rounded-md hover:bg-gray-700">
                  My Orders
                </Link>
              </>
            )}
            
            {/* Location dropdown for mobile */}
            <div className="relative">
              <button 
                className="flex items-center w-full px-3 py-2 rounded-md hover:bg-gray-700"
                onClick={() => setIsLocationDropdownOpen(!isLocationDropdownOpen)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                {userLocation || 'Select Location'}
              </button>

              {isLocationDropdownOpen && (
                <div className="mt-2 w-full bg-gray-700 rounded-md py-1 z-10">
                  {availableLocations.map((location) => (
                    <button
                      key={location}
                      className="block w-full text-left px-4 py-2 hover:bg-gray-600"
                      onClick={() => {
                        updateLocation(location);
                        setIsLocationDropdownOpen(false);
                      }}
                    >
                      {location}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 pb-3 border-t border-gray-700">
            <div className="px-2 space-y-1">
              {isAuthenticated ? (
                <>
                  <div className="block px-3 py-2 rounded-md">
                    <span className="font-medium">Account: </span>
                    <span>{truncateAddress(user?.walletAddress || address)}</span>
                  </div>
                  <Link to="/profile" className="block px-3 py-2 rounded-md hover:bg-gray-700">
                    Profile
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-3 py-2 rounded-md hover:bg-gray-700 text-red-400"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <button
                  onClick={handleConnect}
                  className="block w-full text-left px-3 py-2 rounded-md hover:bg-gray-700 text-indigo-400"
                >
                  Login / Sign Up
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="relative">
            <button 
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
              onClick={() => setShowLoginModal(false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <Login onClose={() => setShowLoginModal(false)} />
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar; 