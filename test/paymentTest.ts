import { expect } from "chai";
import * as fs from "fs";
import { toHex, hexToString, parseEther, formatEther } from "viem";
import { viem } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { bigint } from "hardhat/internal/core/params/argumentTypes";
import path from "path";
import { Address } from "viem";
import hre from "hardhat";



async function deployContract() {
  const publicClient  = await viem.getPublicClient();
  const [deployer, buyer, sellerwallet, otherAccount] = await viem.getWalletClients();
  const paymentContract = await viem.deployContract("paymentContract", [
    deployer.account.address,
  ],
  {
     client: {
    wallet: otherAccount,
  },
  }

  );
  return{
    publicClient,
    paymentContract,
    deployer,
    sellerwallet,
    buyer,
    otherAccount,
  }
  

 
 
} 
describe("paymentTest", async () => {



  describe("when the contract is deployed", async () => {
   it("the payment amount is zero", async () => {
      const { paymentContract, deployer, sellerwallet, otherAccount } = await loadFixture(deployContract);
      // make paymentContract available for further tests
      expect(await paymentContract.read.getPayment([sellerwallet.account.address])).to.equal(0n);
      // Add your test logic here, for example:
      // expect(await paymentContract.getVotesForAllProposals()).to.deep.equal([0, 0, 0]);
    });
    
    it("set paymentamount to the amount to be paid ", async () => {
      const { publicClient, paymentContract, deployer,buyer, sellerwallet, otherAccount } = await loadFixture(deployContract);
      const price = parseEther("2");
      const price2 = await paymentContract.write.pay([ 
        sellerwallet.account.address,
      ], {
        value: price,
      });
      const price3 = await paymentContract.write.pay([ 
        sellerwallet.account.address,
      ], {
        value: price,
      });
       const price4 = await paymentContract.write.pay([ 
        sellerwallet.account.address,
      ], {
        value: price,
      });
     
      const ContractADD = paymentContract.address
      console.log(price2)
      console.log( await publicClient.getBalance({
        address: ContractADD,
      }));
      const DAOpay = await paymentContract.read.getPayment( [sellerwallet.account.address, otherAccount.account.address]);
      console.log(DAOpay);
      expect(DAOpay).to.equal(price * 3n);
      

    });
    it("check to see if you can send tokens to ", async () => {
     
    });
     
  });

  describe("when the contractadmin interacts with the giveRightToVote function in the contract", async () => {
    it("gives right to vote for another address", async () => {
    
    });
    it("can not vote with more than your voting power", async () => {
    
    });
   
  });

  describe("when the voter interacts with the vote function in the contract", async () => {
    // TODO
    it("should register the vote", async () => {
     
      
     
     
    });
  });

  describe("when the voter interacts with the delegate function in the contract", async () => {
    // TODO
    it("should transfer voting power", async () => {
      throw Error("Not implemented");
    });
  });

 

  describe("when an account without right to vote interacts with the vote function in the contract", async () => {
    // TODO
    it("should revert", async () => {
      throw Error("Not implemented");
    });
  });

  describe("when an account without right to vote interacts with the delegate function in the contract", async () => {
    // TODO
    it("should revert", async () => {
      throw Error("Not implemented");
    });
  });

  describe("when someone interacts with the winningProposal function before any votes are cast", async () => {
    // TODO
    it("should return 0", async () => {
      throw Error("Not implemented");
    });
  });

  describe("when someone interacts with the winningProposal function after one vote is cast for the first proposal", async () => {
    // TODO
    it("should return 0", async () => {
      throw Error("Not implemented");
    });
  });

  describe("when someone interacts with the winnerName function before any votes are cast", async () => {
    // TODO
    it("should return name of proposal 0", async () => {
      throw Error("Not implemented");
    });
  });

  describe("when someone interacts with the winnerName function after one vote is cast for the first proposal", async () => {
    // TODO
    it("should return name of proposal 0", async () => {
      throw Error("Not implemented");
    });
  });

  describe("when someone interacts with the winningProposal function and winnerName after 5 random votes are cast for the proposals", async () => {
    // TODO
    it("should return the name of the winner proposal", async () => {
      throw Error("Not implemented");
    });
  });
});