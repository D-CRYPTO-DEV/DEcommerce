// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract paymentContract {
    address payable public immutable DAOADDRESS;
    mapping(address => mapping(address => uint256)) public PaymentsTOContract;
    mapping(address => uint256) public PaymentsToDAO;

    event paymentSucess(address indexed sender, string message);
    event DAOnotification(address indexed sender, string message);
    constructor(address _DAOADDRESS) {
        require(_DAOADDRESS != address(0), "Invalid DAO address");
        DAOADDRESS = payable(_DAOADDRESS);

    }

    modifier paymentModifier {
        
        assert(balanceOf(msg.sender) > 0);
        require(msg.value > 0, "Payment must be greater than zero");
        require(balanceOf(msg.sender) > msg.value, "insuffient balance for this transaction" );
        assert(msg.sender != address(0));
       
        _;
    }

    function pay(address _sellerAdresss) public payable paymentModifier returns (string memory) {
        payable(address(this)).transfer(msg.value);
        PaymentsToDAO[msg.sender] += msg.value;
        PaymentsTOContract[msg.sender][_sellerAdresss] += msg.value;
        emit paymentSucess(msg.sender, "Payment registration sucessful");
        return "Payment registration successful";
       
    }

    function getPaymentToDAO(address _useradd) public view returns (uint256) {
        uint256 result = PaymentsToDAO[_useradd];
        return result;
    }
    function getPayment(address _sellerAdresss) public view returns (uint256) {
       uint256 result = PaymentsTOContract[msg.sender][_sellerAdresss];
        return result;
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
     function reportTransactionPetition(address _sellerAdresss, string memory) public {
        require(PaymentsTOContract[msg.sender][_sellerAdresss] > 0, "No payment made to this seller");
        DAOADDRESS.transfer(PaymentsTOContract[msg.sender][_sellerAdresss]);
        //a message to notify the seller of the transaction petition
        // in a real-world scenario, this would be more complex and involve a DAO voting mechanism
        //when this transaction is sent out a gmail should be sent to the seller or a farcaster notification
        // this notification can be handled on the backend
        emit DAOnotification(msg.sender, " report successful");
     } 

    receive() external payable {
        // This function allows the contract to receive Ether
    }
}