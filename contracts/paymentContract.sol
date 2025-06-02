// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

contract paymentContract {
    address public immutable DAOADDRESS;
    mapping (address => mapping( address) => uint256) PaymentsTOContract;

    event paymentSucess(address index sender, string message);
    event DAOnotification(address index sender, string message)
    constructor(address _DAOADDRESS) {
        require(_DAOADDRESS != address(0), "Invalid DAO address");
        DAOADDRESS = _DAOADDRESS;

    }

    modifier paymentModifier {
        
        assert(balanceOf(msg.sender) >= 0, "Invalid sender balance")
        require(msg.value > 0, "Payment must be greater than zero"):
        require(balanceOf(msg.sender) > msg.value, "insuffient balance for this transaction" );
        assert(msg.sender != address(0), "Invalid reciever address");
       
        _;
    }

    function pay(uint256 _amount, address _sellerAdresss) public payable paymentModifier returns (string memory) {
        address(this).transfer(_amount);
        PaymentsTOContract[msg.sender][_sellerAdresss] += _amount;
        emit paymentSucess(msg.sender, "Payment registration sucessful");
    }

    function getPayment(address _sellerAdresss) public view returns (uint256) {
        return PaymentsTOContract[msg.sender][_sellerAdresss];
    }

    function acknowledgeGoodsReceiption(address _sellerAdresss) public {
        require(PaymentsTOContract[msg.sender][_sellerAdresss] > 0, "No payment made to this seller");
        _sellerAdresss.transfer(PaymentsTOContract[msg.sender][_sellerAdresss]);
        PaymentsTOContract[msg.sender][_sellerAdresss] = 0;
        emit paymentSucess(msg.sender, "goods receiption  acknowledged and funds transferred to seller")
    }

    function balanceOf(address _user) public view returns (uint256) {
        return _user.balance

    }
     function reportTransaction(address _sellerAdresss, string storage) public view returns (uint256){
        require(PaymentsTOContract[msg.sender][_sellerAdresss] > 0, "No payment made to this seller");
        DAOADDRESS.transfer(PaymentsTOContract[msg.sender][_sellerAdresss]);
        emit DAOnotification(msg.sender, " report successful");
        return "report was successful";

     } 
}