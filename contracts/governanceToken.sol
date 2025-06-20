// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.27;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";


contract governanceToken is ERC20, ERC20Burnable, Ownable, ERC20Permit, ERC20Votes {
    address immutable public  ownerAccount;
    
    
    constructor(address initialOwner)
        ERC20("GovernToken", "GT")
        Ownable(initialOwner)
        ERC20Permit("MyToken")
        
    {
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        return false;
    }

    // Override the transferFrom function to restrict transfers
    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        return false;
    }

    // Override the approve function to restrict approvals
    function approve(address spender, uint256 amount) public override returns (bool) {
        return false;
    }
    

    // function balanceOf(address account)
    //     public
    function burnfrom(address _useradd) public onlyOwner {
        super.burnFrom(_useradd, balanceOf(_useradd));
    }
    // {
    //     return super.balanceOf(account);
    // }

    

    function clock() public view override returns (uint48) {
        return uint48(block.timestamp);
    }

    // solhint-disable-next-line func-name-mixedcase
    function CLOCK_MODE() public pure override returns (string memory) {
        return "mode=timestamp";
    }

    // The following functions are overrides required by Solidity.

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Votes)
    {
        super._update(from, to, value);
    }

    function nonces(address owner)
        public
        view
        override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(owner);
    }
}
