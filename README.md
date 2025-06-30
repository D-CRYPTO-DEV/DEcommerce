# DEcommerce Platform

A decentralized e-commerce platform built on blockchain technology with wallet abstraction, allowing users to login with both wallet and Gmail.

## Features

- **Wallet Abstraction**: Login with crypto wallet or Gmail
- **Escrow Payment System**: Funds are held until buyer confirms receipt
- **Dispute Resolution**: Community governance for resolving disputes
- **Treasury Management**: Platform fees and community governance
- **Marketplace Moderation**: Community voting on delisting sellers

## Project Structure

- `/contracts`: Smart contracts for the platform
- `/frontend`: React frontend application
- `/backend`: Node.js backend server
- `/test`: Smart contract tests

## Setup Instructions

### Prerequisites

- Node.js v16+
- npm or yarn
- Hardhat
- MetaMask or other Web3 wallet

### Smart Contracts

1. Install dependencies:
   ```
   npm install
   ```

2. Create a `.env` file with the following variables:
   ```
   PRIVATE_KEY=your-private-key
   ETHERSCAN_API_KEY=your-etherscan-api-key
   ALCHEMY_API_KEY=your-alchemy-api-key
   ```

3. Compile contracts:
   ```
   npx hardhat compile
   ```

4. Run tests:
   ```
   npx hardhat test
   ```

5. Deploy contracts:
   ```
   npx hardhat run scripts/deploy.js --network base
   ```

### Backend

1. Navigate to the backend directory:
   ```
   cd backend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file with the following variables:
   ```
   PORT=5000
   JWT_SECRET=your-jwt-secret-key
   RPC_URL=https://mainnet.base.org
   PAYMENT_CONTRACT_ADDRESS=0x...
   GOVERNANCE_CONTRACT_ADDRESS=0x...
   VOTING_CONTRACT_ADDRESS=0x...
   INFURA_IPFS_PROJECT_ID=your-infura-ipfs-project-id
   INFURA_IPFS_PROJECT_SECRET=your-infura-ipfs-project-secret
   ```

4. Start the backend server:
   ```
   npm start
   ```

### Frontend

1. Navigate to the frontend directory:
   ```
   cd frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file with the following variables:
   ```
   REACT_APP_API_URL=http://localhost:5000
   REACT_APP_PAYMENT_CONTRACT_ADDRESS=0x...
   REACT_APP_GOVERNANCE_CONTRACT_ADDRESS=0x...
   REACT_APP_VOTING_CONTRACT_ADDRESS=0x...
   REACT_APP_THIRDWEB_CLIENT_ID=your-thirdweb-client-id
   REACT_APP_WALLET_CONNECT_PROJECT_ID=your-wallet-connect-project-id
   ```

4. Start the frontend development server:
   ```
   npm start
   ```

## Usage

1. Open your browser and navigate to `http://localhost:3000`
2. Connect your wallet or login with Gmail
3. Browse the marketplace, create listings, or participate in governance

## Smart Contract Architecture

- **PaymentContract**: Handles escrow payments and dispute resolution
- **DAOGovernanceCore**: Core governance functionality
- **DAOVoting**: Handles voting on proposals
- **DAORewardTreasury**: Manages platform fees and rewards

## License

MIT
