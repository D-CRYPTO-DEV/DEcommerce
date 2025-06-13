// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

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
        
    }
    mapping(uint256 => transactions) public transactionRecords;
    address payable public immutable DAOADDRESS;
    mapping(address => mapping(address => uint256)) public PaymentsTOContract;
    mapping(address => uint256) public PaymentsToDAO;
    mapping(string => address) public CouriersAddress;
    

    event paymentSucess(address indexed sender, string message);
    event DAOnotification(address indexed sender, string message);
    constructor(address _DAOADDRESS) {
        require(_DAOADDRESS != address(0), "Invalid DAO address");
        DAOADDRESS = payable(_DAOADDRESS);

    }

    modifier paymentModifier {
        
        assert((msg.sender).balance > 0);
        require(msg.value > 0, "Payment must be greater than zero");
        require((msg.sender).balance > msg.value, "insuffient balance for this transaction" );
        assert(msg.sender != address(0));
       
        _;
    }

    function pay(address _sellerAdresss) public payable paymentModifier returns (string memory) {
        uint256 transactionId = uint256(keccak256(abi.encodePacked(msg.sender, _sellerAdresss, block.timestamp)));
        transactionRecords[transactionId] = transactions({
            transactionId: transactionId,
            timestamp: block.timestamp,
            buyer: msg.sender,
            seller: _sellerAdresss,
            amount: msg.value,
            message: "Payment made successfully",
            isCompleted: false,
            cancelOrderTimeLimited: block.timestamp + 4 hours // 24 hours to cancel the order
        });
        require(_sellerAdresss != address(0), "Invalid seller address");
        require(msg.sender != _sellerAdresss, "Buyer cannot be the seller");
        payable(address(this)).transfer(msg.value);
        PaymentsToDAO[msg.sender] += msg.value;
        PaymentsTOContract[msg.sender][_sellerAdresss] += msg.value;
        emit paymentSucess(msg.sender, "Payment registration sucessful");
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

    function cancelOrder(uint256 _transactionID) public {
        address sellerAdresss = transactionRecords[_transactionID].seller;
        address buyer = transactionRecords[_transactionID].buyer;
        require(block.timestamp < transactionRecords[_transactionID].cancelOrderTimeLimited, "Order cancellation time limit exceeded");
        require(msg.sender == sellerAdresss || msg.sender == buyer, "Only the buyer can cancel the order");
        require(PaymentsTOContract[msg.sender][sellerAdresss] > 0, "No payment made to this seller");
        uint256 amount = PaymentsTOContract[buyer][sellerAdresss];
        PaymentsTOContract[buyer][sellerAdresss] = 0;
        payable(buyer).transfer(amount);
        emit paymentSucess(msg.sender, "Order cancelled and funds returned to buyer");
    }

  

    function acknowledgeGoodsReceiption(address _sellerAdresss) public {
        address payable seller = payable(_sellerAdresss);
        require(PaymentsTOContract[msg.sender][_sellerAdresss] > 0, "No payment made to this seller");
        seller.transfer(PaymentsTOContract[msg.sender][_sellerAdresss]);
        PaymentsTOContract[msg.sender][_sellerAdresss] = 0;
        emit paymentSucess(msg.sender, "goods receiption  acknowledged and funds transferred to seller");
    }

    function balanceOf(address _user) public view returns (uint256) {
        return _user.balance;

    }
     function reportTransactionPetition(address _sellerAdresss, string memory message) public {
        require(PaymentsTOContract[msg.sender][_sellerAdresss] > 0, "No payment made to this seller");
        DAOADDRESS.transfer(PaymentsTOContract[msg.sender][_sellerAdresss]);
        //a message to notify the seller of the transaction petition
        // in a real-world scenario, this would be more complex and involve a DAO voting mechanism
        //when this transaction is sent out a gmail should be sent to the seller or a farcaster notification
        // this notification can be handled on the backend
        emit DAOnotification(msg.sender, message);
     } 

    receive() external payable {
        // This function allows the contract to receive Ether
    }
}