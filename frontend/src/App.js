import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThirdwebProvider } from '@thirdweb-dev/react';
import { WagmiConfig, createConfig } from 'wagmi';
import { base, baseGoerli } from 'wagmi/chains';
import { createPublicClient, http } from 'viem';

import { AuthProvider } from './context/AuthContext';
import { LocationProvider } from './context/LocationContext';

// Components
import Navbar from './components/Navbar';
import Footer from './components/Footer';

// Pages
import Home from './pages/Home';
import Login from './components/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Marketplace from './pages/Marketplace';
import SellerDashboard from './pages/SellerDashboard';
import Governance from './pages/Governance';

// Wagmi config
const config = createConfig({
  autoConnect: true,
  publicClient: createPublicClient({
    chain: process.env.REACT_APP_NETWORK === 'mainnet' ? base : baseGoerli,
    transport: http()
  }),
});

function App() {
  return (
    <ThirdwebProvider
      activeChain={process.env.REACT_APP_NETWORK === 'mainnet' ? 'base' : 'base-goerli'}
      clientId={process.env.REACT_APP_THIRDWEB_CLIENT_ID}
    >
      <WagmiConfig config={config}>
        <AuthProvider>
          <LocationProvider>
            <Router>
              <div className="flex flex-col min-h-screen">
                <Navbar />
                <main className="flex-grow">
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/marketplace" element={<Marketplace />} />
                    <Route path="/seller-dashboard" element={<SellerDashboard />} />
                    <Route path="/governance" element={<Governance />} />
                  </Routes>
                </main>
                <Footer />
              </div>
            </Router>
          </LocationProvider>
        </AuthProvider>
      </WagmiConfig>
    </ThirdwebProvider>
  );
}

export default App; 