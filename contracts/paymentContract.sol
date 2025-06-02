// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract paymentContract {
    address payable public immutable DAOADDRESS;
    mapping(address => mapping(address => uint256)) PaymentsTOContract;

    event paymentSucess(address indexed sender, string message);
    event DAOnotification(address indexed sender, string message);
    constructor(address _DAOADDRESS) {
        require(_DAOADDRESS != address(0), "Invalid DAO address");
        DAOADDRESS = payable(_DAOADDRESS);

    }

    modifier paymentModifier {
        
        assert(balanceOf(msg.sender) >= 0);
        require(msg.value > 0, "Payment must be greater than zero");
        require(balanceOf(msg.sender) > msg.value, "insuffient balance for this transaction" );
        assert(msg.sender != address(0));
       
        _;
    }

    function pay(uint256 _amount, address _sellerAdresss) public payable paymentModifier returns (string memory) {
        payable(address(this)).transfer(_amount);
        PaymentsTOContract[msg.sender][_sellerAdresss] += _amount;
        emit paymentSucess(msg.sender, "Payment registration sucessful");
        return "Payment registration successful";
    }

    function getPayment(address _sellerAdresss) public view returns (uint256) {
        return PaymentsTOContract[msg.sender][_sellerAdresss];
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
     function reportTransaction(address _sellerAdresss, string memory) public {
        require(PaymentsTOContract[msg.sender][_sellerAdresss] > 0, "No payment made to this seller");
        DAOADDRESS.transfer(PaymentsTOContract[msg.sender][_sellerAdresss]);
        emit DAOnotification(msg.sender, " report successful");
     } 

    receive() external payable {
        // This function allows the contract to receive Ether
    }
}