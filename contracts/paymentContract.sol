// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IDAOGovernanceCore.sol";
import "@openzeppelin/contracts/governance/IGovernor.sol";

contract paymentContract {

    struct transactions {
        uint256 transactionId;
        uint256 timestamp;
        address buyer;
        address seller;
        uint256 amount;
        string message;
        bool isCompleted;
        uint256 cancelOrderTimeLimited; // time limit for canceling the order
        bool isDisputed;
        uint256 proposalId;
        address courier;
        bool isDelivered;
        string deliveryStatus;
        string location;
    }
    
    // Seller reputation and status tracking
    struct SellerProfile {
        bool isRegistered;
        bool isDelisted;
        uint256 delistProposalId;
        uint256 totalSales;
        uint256 totalDisputes;
        uint256 successfulDisputes; // disputes won by buyer
        string location;
        string[] categories;
    }
    
    // Courier profile
    struct CourierProfile {
        bool isRegistered;
        bool isActive;
        uint256 totalDeliveries;
        uint256 rating;
        uint256 ratingCount;
        string location;
        string[] serviceAreas;
    }
    
    // Marketplace fees and treasury
    uint256 public marketplaceFeePercentage = 2; // 2% fee
    uint256 public courierFeePercentage = 3; // 3% fee for courier
    uint256 public totalFeesCollected;
    uint256 public totalEscrowHeld;
    
    // Mappings
    mapping(uint256 => transactions) public transactionRecords;
    address payable public immutable DAOADDRESS;
    mapping(address => mapping(address => uint256)) public PaymentsTOContract;
    mapping(address => uint256) public PaymentsToDAO;
    mapping(string => address) public CouriersAddress;
    mapping(uint256 => uint256) public proposalToTransaction; // Maps proposal IDs to transaction IDs
    mapping(address => SellerProfile) public sellerProfiles;
    mapping(uint256 => address) public delistProposalToSeller; // Maps delist proposal IDs to seller addresses
    mapping(address => CourierProfile) public courierProfiles;
    mapping(string => address[]) public sellersInLocation; // Maps location to sellers
    mapping(string => address[]) public couriersInLocation; // Maps location to couriers
    
    // New mapping to store the latest transaction ID for each buyer-seller pair
    mapping(address => mapping(address => uint256)) public buyerSellerToTransactionId;
    
    // Events
    event paymentSucess(address indexed sender, uint256 indexed transactionId, string message);
    event DAOnotification(address indexed sender, string message);
    event calcelationSuccess(address indexed sender, string message);
    event paymentCompleted(address indexed sender, string message);
    event DisputeCreated(address indexed buyer, address indexed seller, uint256 transactionId, uint256 proposalId);
    event DisputeResolved(uint256 transactionId, bool refundToBuyer);
    event SellerRegistered(address indexed seller, string location, string[] categories);
    event SellerDelisted(address indexed seller, uint256 proposalId, string reason);
    event SellerReinstated(address indexed seller);
    event CourierRegistered(address indexed courier, string location, string[] serviceAreas);
    event CourierStatusChanged(address indexed courier, bool isActive);
    event DeliveryAssigned(uint256 transactionId, address indexed courier);
    event DeliveryStatusUpdated(uint256 transactionId, string status);
    event DeliveryCompleted(uint256 transactionId, address indexed courier);
    event TreasuryWithdrawal(address indexed recipient, uint256 amount);
    event MarketplaceFeeUpdated(uint256 newFeePercentage);
    event CourierFeeUpdated(uint256 newFeePercentage);
    event IllicitGoodsReported(address indexed seller, address indexed reporter, string evidence);
    
    IDAOGovernanceCore public governanceCore;
    
    constructor(address _DAOADDRESS) {
        require(_DAOADDRESS != address(0), "Invalid DAO address");
        DAOADDRESS = payable(_DAOADDRESS);
        governanceCore = IDAOGovernanceCore(_DAOADDRESS);
    }

    modifier paymentModifier {
        assert((msg.sender).balance > 0);
        require(msg.value > 0, "Payment must be greater than zero");
        require((msg.sender).balance > msg.value, "insuffient balance for this transaction" );
        assert(msg.sender != address(0));
        _;
    }
    
    modifier onlyDAO {
        require(msg.sender == address(governanceCore) || msg.sender == DAOADDRESS, "Only DAO can call this function");
        _;
    }
    
    modifier notDelisted(address seller) {
        require(!sellerProfiles[seller].isDelisted, "Seller has been delisted from the marketplace");
        _;
    }
    
    modifier onlyCourier(uint256 transactionId) {
        require(courierProfiles[msg.sender].isRegistered, "Not a registered courier");
        require(courierProfiles[msg.sender].isActive, "Courier is not active");
        require(transactionRecords[transactionId].courier == msg.sender, "Not assigned to this delivery");
        _;
    }

    // Register as a seller on the marketplace
    function registerAsSeller(string memory location, string[] memory categories) public {
        require(!sellerProfiles[msg.sender].isRegistered, "Already registered as seller");
        
        sellerProfiles[msg.sender] = SellerProfile({
            isRegistered: true,
            isDelisted: false,
            delistProposalId: 0,
            totalSales: 0,
            totalDisputes: 0,
            successfulDisputes: 0,
            location: location,
            categories: categories
        });
        
        // Add seller to location mapping
        sellersInLocation[location].push(msg.sender);
        
        emit SellerRegistered(msg.sender, location, categories);
    }
    
    // Register as a courier
    function registerAsCourier(string memory location, string[] memory serviceAreas) public {
        require(!courierProfiles[msg.sender].isRegistered, "Already registered as courier");
        
        courierProfiles[msg.sender] = CourierProfile({
            isRegistered: true,
            isActive: true,
            totalDeliveries: 0,
            rating: 0,
            ratingCount: 0,
            location: location,
            serviceAreas: serviceAreas
        });
        
        // Add courier to location mappings for each service area
        for (uint i = 0; i < serviceAreas.length; i++) {
            couriersInLocation[serviceAreas[i]].push(msg.sender);
        }
        
        emit CourierRegistered(msg.sender, location, serviceAreas);
    }
    
    // Update courier status
    function updateCourierStatus(bool isActive) public {
        require(courierProfiles[msg.sender].isRegistered, "Not a registered courier");
        courierProfiles[msg.sender].isActive = isActive;
        emit CourierStatusChanged(msg.sender, isActive);
    }

    function pay(address _sellerAdresss, string memory buyerLocation) public payable paymentModifier notDelisted(_sellerAdresss) returns (string memory) {
        require(sellerProfiles[_sellerAdresss].isRegistered, "Seller is not registered on the marketplace");
        
        uint256 transactionId = uint256(keccak256(abi.encodePacked(msg.sender, _sellerAdresss, block.timestamp)));
        
        // Calculate marketplace fee
        uint256 fee = (msg.value * marketplaceFeePercentage) / 100;
        uint256 escrowAmount = msg.value - fee;
        
        // Update fee tracking
        totalFeesCollected += fee;
        totalEscrowHeld += escrowAmount;
        
        transactionRecords[transactionId] = transactions({
            transactionId: transactionId,
            timestamp: block.timestamp,
            buyer: msg.sender,
            seller: _sellerAdresss,
            amount: msg.value,
            message: "Payment made successfully",
            isCompleted: false,
            cancelOrderTimeLimited: block.timestamp + 60 seconds, // 24 hours to cancel the order
            isDisputed: false,
            proposalId: 0,
            courier: address(0),
            isDelivered: false,
            deliveryStatus: "Pending",
            location: buyerLocation
        });
        
        require(_sellerAdresss != address(0), "Invalid seller address");
        require(msg.sender != _sellerAdresss, "Buyer cannot be the seller");
        
        // Transfer funds to contract
        PaymentsToDAO[msg.sender] += msg.value;
        PaymentsTOContract[msg.sender][_sellerAdresss] += escrowAmount; // Only escrow amount, fee is kept separate
        
        // Store the transaction ID for this buyer-seller pair
        buyerSellerToTransactionId[msg.sender][_sellerAdresss] = transactionId;
        
        emit paymentSucess(msg.sender, transactionId, "Payment registration sucessful");
        return "Payment registration successful";
    }

    function getPaymentToDAO(address _buyer) public view returns (uint256) {
        uint256 result = PaymentsToDAO[_buyer];
        return result;
    }

    function getPayment(address _sellerAdresss, address _buyer) public view returns (uint256) {
        uint256 result = PaymentsTOContract[_buyer][_sellerAdresss];
        return result;
    }
    
    function getTransactionId(address buyer, address seller) public view returns (uint256) {
        uint256 transactionId = buyerSellerToTransactionId[buyer][seller];
        require(transactionId != 0, "No transaction found for this buyer-seller pair");
        return transactionId;
    }

    function cancelOrder(uint256 _transactionID) public {
        address sellerAdresss = transactionRecords[_transactionID].seller;
        address buyer = transactionRecords[_transactionID].buyer;
        require(block.timestamp < transactionRecords[_transactionID].cancelOrderTimeLimited, "Order cancellation time limit exceeded");
        require(msg.sender == sellerAdresss || msg.sender == buyer, "Only the buyer or seller can cancel the order");
        require(PaymentsTOContract[buyer][sellerAdresss] > 0, "No payment made to this seller");
        
        uint256 escrowAmount = PaymentsTOContract[buyer][sellerAdresss];
        uint256 totalAmount = transactionRecords[_transactionID].amount;
        
        // Update tracking
        totalEscrowHeld -= escrowAmount;
        
        // Reset payment records
        PaymentsToDAO[buyer] -= totalAmount;
        PaymentsTOContract[buyer][sellerAdresss] = 0;
        
        // Return full amount including fee to buyer
        payable(buyer).transfer(totalAmount);
        
        emit calcelationSuccess(msg.sender, "Order cancelled and funds returned to buyer");
    }

    function acknowledgeGoodsReceiption(address _sellerAdresss) public {
        address payable seller = payable(_sellerAdresss);
        require(PaymentsTOContract[msg.sender][_sellerAdresss] > 0, "No payment made to this seller");
        
        uint256 escrowAmount = PaymentsTOContract[msg.sender][_sellerAdresss];
        
        // Update tracking
        totalEscrowHeld -= escrowAmount;
        sellerProfiles[_sellerAdresss].totalSales += 1;
        
        // Reset payment record
        PaymentsTOContract[msg.sender][_sellerAdresss] = 0;
        
        // Get transaction ID for this buyer-seller pair
        uint256 transactionId = buyerSellerToTransactionId[msg.sender][_sellerAdresss];
        require(transactionId != 0, "No transaction found for this buyer-seller pair");
        
        // If there's a courier, pay them their fee
        if (transactionRecords[transactionId].courier != address(0) && transactionRecords[transactionId].isDelivered) {
            address payable courier = payable(transactionRecords[transactionId].courier);
            uint256 courierFee = (transactionRecords[transactionId].amount * courierFeePercentage) / 100;
            
            // Pay the courier
            if (courierFee > 0) {
                courier.transfer(courierFee);
                escrowAmount -= courierFee;
                
                // Update courier stats
                courierProfiles[transactionRecords[transactionId].courier].totalDeliveries += 1;
            }
        }
        
        // Transfer remaining escrow amount to seller
        seller.transfer(escrowAmount);
        
        // Mark transaction as completed
        transactionRecords[transactionId].isCompleted = true;
        
        emit paymentCompleted(msg.sender, "goods receiption acknowledged and funds transferred to seller");
    }

    function balanceOf(address _user) public view returns (uint256) {
        return _user.balance;
    }
    
    // Helper function to convert uint to string
    function uint256ToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
    
    // Helper function to convert address to string
    function addressToString(address _addr) internal pure returns (string memory) {
        bytes32 value = bytes32(uint256(uint160(_addr)));
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(42);
        str[0] = '0';
        str[1] = 'x';
        for (uint256 i = 0; i < 20; i++) {
            str[2+i*2] = alphabet[uint8(value[i + 12] >> 4)];
            str[3+i*2] = alphabet[uint8(value[i + 12] & 0x0f)];
        }
        return string(str);
    }
    
    // Dispute resolution functions
    function resolveDispute(uint256 transactionId, bool refundToBuyer) public {
        // Only the governance contract can call this function
        require(msg.sender == address(governanceCore) || msg.sender == address(this), "Only governance can resolve disputes");
        
        transactions storage txn = transactionRecords[transactionId];
        require(txn.isDisputed, "Transaction is not disputed");
        
        uint256 amount = PaymentsTOContract[txn.buyer][txn.seller];
        
        // Update seller profile stats
        sellerProfiles[txn.seller].totalDisputes += 1;
        if (refundToBuyer) {
            sellerProfiles[txn.seller].successfulDisputes += 1;
        }
        
        // Update escrow tracking
        totalEscrowHeld -= amount;
        
        // If the proposal failed (was rejected), send funds to the seller
        if (!refundToBuyer) {
            payable(txn.seller).transfer(amount);
        } else {
            // If the proposal succeeded, refund the buyer
            payable(txn.buyer).transfer(amount);
        }
        
        // Mark the transaction as completed
        txn.isCompleted = true;
        txn.isDisputed = false;
        PaymentsTOContract[txn.buyer][txn.seller] = 0;
        
        emit DisputeResolved(transactionId, refundToBuyer);
    }
    
    function checkDisputeResolution(uint256 proposalId) public {
        uint256 transactionId = proposalToTransaction[proposalId];
        require(transactionId > 0, "No transaction found for this proposal");
        
        IGovernor.ProposalState state = governanceCore.state(proposalId);
        
        // If the proposal was defeated or expired, send funds to seller
        if (state == IGovernor.ProposalState.Defeated || 
            state == IGovernor.ProposalState.Expired) {
            resolveDispute(transactionId, false); // false = don't refund to buyer (send to seller)
        } 
        // If the proposal succeeded, funds will be refunded to buyer through the execute function
        else if (state == IGovernor.ProposalState.Succeeded) {
            // The governance execute function will call resolveDispute with refundToBuyer=true
            resolveDispute(transactionId, true);
        }
    }
    
    function reportTransactionPetition(address _sellerAdresss, string memory message) public {
        require(PaymentsTOContract[msg.sender][_sellerAdresss] > 0, "No payment made to this seller");
        
        // Get the transaction ID for this buyer-seller pair
        uint256 transactionId = buyerSellerToTransactionId[msg.sender][_sellerAdresss];
        require(transactionId != 0, "No transaction found for this buyer-seller pair");
        
        // Verify transaction state
        require(!transactionRecords[transactionId].isCompleted, "Transaction already completed");
        require(!transactionRecords[transactionId].isDisputed, "Transaction already disputed");
        
        // Mark the transaction as disputed
        transactionRecords[transactionId].isDisputed = true;
        
        // Create a governance proposal
        address[] memory targets = new address[](1);
        targets[0] = address(this);
        
        uint256[] memory values = new uint256[](1);
        values[0] = 0;
        
        bytes[] memory calldatas = new bytes[](1);
        // Call resolveDispute with parameters: transactionId, true (refund to buyer)
        calldatas[0] = abi.encodeWithSignature("resolveDispute(uint256,bool)", transactionId, true);
        
        string memory description = string(abi.encodePacked(
            "Dispute for transaction ", 
            uint256ToString(transactionId), 
            " between buyer ", 
            addressToString(msg.sender), 
            " and seller ", 
            addressToString(_sellerAdresss), 
            ": ", 
            message
        ));
        
        // Submit the proposal to the governance contract
        // Note: The sender must be a member of the DAO to create a proposal
        uint256 proposalId = governanceCore.propose(targets, values, calldatas, description);
        
        // Store the proposal ID in the transaction record
        transactionRecords[transactionId].proposalId = proposalId;
        proposalToTransaction[proposalId] = transactionId;
        
        emit DisputeCreated(msg.sender, _sellerAdresss, transactionId, proposalId);
        emit DAOnotification(msg.sender, message);
    }
    
    // Courier functions
    function assignCourier(uint256 transactionId, address courier) public {
        require(msg.sender == transactionRecords[transactionId].seller, "Only seller can assign courier");
        require(!transactionRecords[transactionId].isCompleted, "Transaction already completed");
        require(!transactionRecords[transactionId].isDisputed, "Transaction is disputed");
        require(courierProfiles[courier].isRegistered, "Not a registered courier");
        require(courierProfiles[courier].isActive, "Courier is not active");
        
        transactionRecords[transactionId].courier = courier;
        transactionRecords[transactionId].deliveryStatus = "Assigned to courier";
        
        emit DeliveryAssigned(transactionId, courier);
    }
    
    function updateDeliveryStatus(uint256 transactionId, string memory status) public onlyCourier(transactionId) {
        require(!transactionRecords[transactionId].isCompleted, "Transaction already completed");
        require(!transactionRecords[transactionId].isDisputed, "Transaction is disputed");
        
        transactionRecords[transactionId].deliveryStatus = status;
        
        emit DeliveryStatusUpdated(transactionId, status);
    }
    
    function confirmDelivery(uint256 transactionId) public onlyCourier(transactionId) {
        require(!transactionRecords[transactionId].isCompleted, "Transaction already completed");
        require(!transactionRecords[transactionId].isDisputed, "Transaction is disputed");
        
        transactionRecords[transactionId].isDelivered = true;
        transactionRecords[transactionId].deliveryStatus = "Delivered";
        
        emit DeliveryCompleted(transactionId, msg.sender);
    }
    
    function rateCourier(uint256 transactionId, uint256 rating) public {
        require(msg.sender == transactionRecords[transactionId].buyer, "Only buyer can rate courier");
        require(transactionRecords[transactionId].isDelivered, "Delivery not confirmed yet");
        require(rating >= 1 && rating <= 5, "Rating must be between 1 and 5");
        
        address courier = transactionRecords[transactionId].courier;
        require(courier != address(0), "No courier assigned to this transaction");
        
        // Update courier rating
        CourierProfile storage profile = courierProfiles[courier];
        uint256 totalRating = profile.rating * profile.ratingCount;
        profile.ratingCount += 1;
        profile.rating = (totalRating + rating) / profile.ratingCount;
    }
    
    // Function to get sellers in a specific location
    function getSellersInLocation(string memory location) public view returns (address[] memory) {
        return sellersInLocation[location];
    }
    
    // Function to get couriers in a specific location
    function getCouriersInLocation(string memory location) public view returns (address[] memory) {
        return couriersInLocation[location];
    }
    
    // Function to report a seller for illicit goods
    function reportIllicitGoods(address seller, string memory evidence) public {
        require(sellerProfiles[seller].isRegistered, "Seller is not registered");
        require(!sellerProfiles[seller].isDelisted, "Seller is already delisted");
        
        // Create a governance proposal to delist the seller
        address[] memory targets = new address[](1);
        targets[0] = address(this);
        
        uint256[] memory values = new uint256[](1);
        values[0] = 0;
        
        bytes[] memory calldatas = new bytes[](1);
        // Call delistSeller with seller address
        calldatas[0] = abi.encodeWithSignature("delistSeller(address,string)", seller, evidence);
        
        string memory description = string(abi.encodePacked(
            "Proposal to delist seller ", 
            addressToString(seller), 
            " for illicit goods. Evidence: ", 
            evidence
        ));
        
        // Submit the proposal to the governance contract
        uint256 proposalId = governanceCore.propose(targets, values, calldatas, description);
        
        // Store the proposal ID
        sellerProfiles[seller].delistProposalId = proposalId;
        delistProposalToSeller[proposalId] = seller;
        
        emit IllicitGoodsReported(seller, msg.sender, evidence);
    }
    
    // Function to delist a seller (only callable by governance)
    function delistSeller(address seller, string memory reason) public onlyDAO {
        require(sellerProfiles[seller].isRegistered, "Seller is not registered");
        require(!sellerProfiles[seller].isDelisted, "Seller is already delisted");
        
        sellerProfiles[seller].isDelisted = true;
        
        emit SellerDelisted(seller, sellerProfiles[seller].delistProposalId, reason);
    }
    
    // Function to reinstate a seller (only callable by governance)
    function reinstateSeller(address seller) public onlyDAO {
        require(sellerProfiles[seller].isRegistered, "Seller is not registered");
        require(sellerProfiles[seller].isDelisted, "Seller is not delisted");
        
        sellerProfiles[seller].isDelisted = false;
        
        emit SellerReinstated(seller);
    }
    
    // Treasury management functions
    function withdrawFees(address payable recipient, uint256 amount) public onlyDAO {
        require(amount <= totalFeesCollected, "Amount exceeds available fees");
        
        totalFeesCollected -= amount;
        recipient.transfer(amount);
        
        emit TreasuryWithdrawal(recipient, amount);
    }
    
    // Update marketplace fee percentage (only callable by governance)
    function updateMarketplaceFee(uint256 newFeePercentage) public onlyDAO {
        require(newFeePercentage <= 10, "Fee percentage cannot exceed 10%");
        
        marketplaceFeePercentage = newFeePercentage;
        
        emit MarketplaceFeeUpdated(newFeePercentage);
    }
    
    // Update courier fee percentage (only callable by governance)
    function updateCourierFee(uint256 newFeePercentage) public onlyDAO {
        require(newFeePercentage <= 10, "Fee percentage cannot exceed 10%");
        
        courierFeePercentage = newFeePercentage;
        
        emit CourierFeeUpdated(newFeePercentage);
    }
    
    // Get marketplace statistics
    function getMarketplaceStats() public view returns (
        uint256 totalFees,
        uint256 escrowHeld,
        uint256 marketplaceFee,
        uint256 courierFee
    ) {
        return (
            totalFeesCollected,
            totalEscrowHeld,
            marketplaceFeePercentage,
            courierFeePercentage
        );
    }
}