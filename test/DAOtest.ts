import { expect } from "chai";
import * as fs from "fs";
import { toHex, hexToString, parseEther, formatEther } from "viem";
import { viem } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { bigint } from "hardhat/internal/core/params/argumentTypes";
import path from "path";
import { Address } from "viem";
import hre from "hardhat";

const PROPOSALS = ["Proposal 1", "Proposal 2", "Proposal 3"];
const david = 0;
const dalinton = 1;
const trust = 2;
async function deployContract() {
  const publicClient  = await viem.getPublicClient();
  const [deployer, otherAccount] = await viem.getWalletClients();
  const BallotTokenContract = await viem.deployContract("BallotToken", [
  otherAccount.account.address,
  otherAccount.account.address
  ],
  {
     client: {
    wallet: otherAccount,
  },
  }

  );
  console.log("deployer:", deployer.account.address)
  // const blockNumber = await publicClient.getBlockNumber();
  const ballotContractAdd = BallotTokenContract.address

  // deploying BallotAdmin contract
  const BallotAdminContract = await viem.deployContract("BallotAdmin",[ 
      ballotContractAdd,
      // blockNumber - BigInt(0),
      PROPOSALS,
    ],

  );

  // Return both contracts and deployer for use in tests
  return { BallotTokenContract, BallotAdminContract, deployer, otherAccount };
} 
describe("Ballot", async () => {



  describe("when the contract is deployed", async () => {
  
    
  
     
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

  describe("when an account other than the chairperson interacts with the giveRightToVote function in the contract", async () => {
    // TODO
    it("should revert", async () => {
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

// Removed unused balanceOf stub function

