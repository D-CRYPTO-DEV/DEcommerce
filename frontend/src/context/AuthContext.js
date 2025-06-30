import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { useAccount, useConnect, useDisconnect, useSignMessage } from 'wagmi';
import { InjectedConnector } from 'wagmi/connectors/injected';
import { SocialWalletConnector } from '@thirdweb-dev/wallets';
import { GoogleSocialLogin } from '@thirdweb-dev/react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  
  const { address, isConnected } = useAccount();
  const { connect } = useConnect({
    connector: new InjectedConnector(),
  });
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  // Initialize social wallet connector
  const socialWalletConnector = new SocialWalletConnector({
    chains: [1, 8453], // Ethereum and Base chains
    options: {
      projectId: process.env.REACT_APP_WALLET_CONNECT_PROJECT_ID,
      thirdwebClientId: process.env.REACT_APP_THIRDWEB_CLIENT_ID,
    },
  });

  // Check if user is authenticated on load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        
        if (token) {
          // Verify token with backend
          const response = await axios.get('/api/auth/verify', {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (response.data.valid) {
            setUser(response.data.user);
          } else {
            // Token invalid, remove it
            localStorage.removeItem('token');
            setUser(null);
          }
        }
      } catch (error) {
        console.error('Auth verification error:', error);
        localStorage.removeItem('token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  // Connect wallet
  const connectWallet = async () => {
    try {
      setAuthError(null);
      await connect();
    } catch (error) {
      console.error('Wallet connection error:', error);
      setAuthError('Failed to connect wallet');
    }
  };

  // Connect with social login (Google)
  const connectWithGoogle = async () => {
    try {
      setAuthError(null);
      await socialWalletConnector.connect({
        strategy: 'google',
      });
      
      // After successful connection, the address should be available
      const socialWalletAddress = await socialWalletConnector.getAddress();
      
      // Authenticate with backend
      await authenticateWithBackend(socialWalletAddress, 'google');
    } catch (error) {
      console.error('Google login error:', error);
      setAuthError('Failed to connect with Google');
    }
  };

  // Sign message and authenticate
  const login = async () => {
    if (!isConnected || !address) {
      setAuthError('Please connect your wallet first');
      return;
    }
    
    try {
      setAuthError(null);
      await authenticateWithBackend(address, 'wallet');
    } catch (error) {
      console.error('Login error:', error);
      setAuthError('Authentication failed');
    }
  };

  // Helper function to authenticate with backend
  const authenticateWithBackend = async (walletAddress, loginType) => {
    try {
      // Get nonce from server
      const nonceResponse = await axios.get(`/api/auth/nonce?address=${walletAddress}`);
      const nonce = nonceResponse.data.nonce;
      
      // Sign the nonce
      let signature;
      if (loginType === 'wallet') {
        signature = await signMessageAsync({ message: `Sign this message to authenticate: ${nonce}` });
      } else if (loginType === 'google') {
        signature = await socialWalletConnector.signMessage(`Sign this message to authenticate: ${nonce}`);
      }
      
      // Verify signature with backend
      const authResponse = await axios.post('/api/auth/verify-signature', {
        address: walletAddress,
        signature,
        nonce,
        loginType
      });
      
      // Save token and user data
      localStorage.setItem('token', authResponse.data.token);
      setUser(authResponse.data.user);
    } catch (error) {
      console.error('Authentication error:', error);
      throw error;
    }
  };

  // Logout
  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    disconnect();
  };

  const value = {
    user,
    loading,
    authError,
    isAuthenticated: !!user,
    connectWallet,
    connectWithGoogle,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext; 