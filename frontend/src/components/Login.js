import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = ({ onClose }) => {
  const { connectWallet, connectWithGoogle, login, authError } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [loginStep, setLoginStep] = useState('options'); // options, wallet-connected
  const navigate = useNavigate();

  const handleWalletLogin = async () => {
    try {
      setIsLoading(true);
      await connectWallet();
      setLoginStep('wallet-connected');
      setIsLoading(false);
    } catch (error) {
      console.error('Wallet connection error:', error);
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      await connectWithGoogle();
      setIsLoading(false);
      
      // If successful, the auth context will update and onClose will be called
      if (onClose) onClose();
    } catch (error) {
      console.error('Google login error:', error);
      setIsLoading(false);
    }
  };

  const handleSignMessage = async () => {
    try {
      setIsLoading(true);
      await login();
      setIsLoading(false);
      
      // If successful, the auth context will update and onClose will be called
      if (onClose) onClose();
    } catch (error) {
      console.error('Sign message error:', error);
      setIsLoading(false);
    }
  };

  const handleRegister = () => {
    if (onClose) onClose();
    navigate('/register');
  };

  return (
    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-auto shadow-xl">
      <h2 className="text-2xl font-bold mb-6 text-center">Login to DEcommerce</h2>
      
      {authError && (
        <div className="alert alert-error mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{authError}</span>
        </div>
      )}
      
      {loginStep === 'options' && (
        <div className="space-y-4">
          <button 
            className="btn btn-primary w-full"
            onClick={handleWalletLogin}
            disabled={isLoading}
          >
            {isLoading ? <span className="loading loading-spinner"></span> : 'Connect Wallet'}
          </button>
          
          <div className="divider">OR</div>
          
          <button 
            className="btn btn-outline w-full flex items-center justify-center gap-2"
            onClick={handleGoogleLogin}
            disabled={isLoading}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M15.545 6.558a9.42 9.42 0 0 1 .139 1.626c0 2.434-.87 4.492-2.384 5.885h.002C11.978 15.292 10.158 16 8 16A8 8 0 1 1 8 0a7.689 7.689 0 0 1 5.352 2.082l-2.284 2.284A4.347 4.347 0 0 0 8 3.166c-2.087 0-3.86 1.408-4.492 3.304a4.792 4.792 0 0 0 0 3.063h.003c.635 1.893 2.405 3.301 4.492 3.301 1.078 0 2.004-.276 2.722-.764h-.003a3.702 3.702 0 0 0 1.599-2.431H8v-3.08h7.545z"/>
            </svg>
            Continue with Google
          </button>
          
          <div className="text-center mt-4">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <button 
                className="text-primary hover:underline"
                onClick={handleRegister}
              >
                Register
              </button>
            </p>
          </div>
        </div>
      )}
      
      {loginStep === 'wallet-connected' && (
        <div className="space-y-4">
          <div className="alert alert-info">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <span>Wallet connected! Please sign the authentication message.</span>
          </div>
          
          <button 
            className="btn btn-primary w-full"
            onClick={handleSignMessage}
            disabled={isLoading}
          >
            {isLoading ? <span className="loading loading-spinner"></span> : 'Sign Message to Login'}
          </button>
          
          <button 
            className="btn btn-ghost w-full"
            onClick={() => setLoginStep('options')}
            disabled={isLoading}
          >
            Back
          </button>
        </div>
      )}
    </div>
  );
};

export default Login; 