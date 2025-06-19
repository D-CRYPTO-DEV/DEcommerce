import { expect } from "chai";
import * as fs from "fs";
import { toHex, hexToString, parseEther, formatEther, parseEventLogs } from "viem";
import { viem } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { bigint } from "hardhat/internal/core/params/argumentTypes";
import path from "path";
import { Address } from "viem";
import hre from "hardhat";
import { decodeEventLog, parseAbi } from 'viem';
import { abi } from './../artifacts/contracts/paymentContract.sol/paymentContract.json'
import { parseAbiItem } from 'viem'



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
      expect(await paymentContract.read.getPayment([sellerwallet.account.address, otherAccount.account.address])).to.equal(0n);
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
    it("check to see if you can send tokens to yourself as the seller ", async () => {
       const { publicClient, paymentContract, deployer,buyer, sellerwallet, otherAccount } = await loadFixture(deployContract);
      const price = parseEther("2");
      const price2 = await paymentContract.write.pay([sellerwallet.account.address,], {
        value: price,
      }
    );
     
  });

  describe("trying out the cancel function", async () => {
    it(" cancel function test", async () => {

   
    const { publicClient, paymentContract, deployer,buyer, sellerwallet, otherAccount } = await loadFixture(deployContract);
    const price = parseEther("2");
    const paidTxHash = await paymentContract.write.pay([ 
      sellerwallet.account.address,
    ], {
      value: price,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: paidTxHash });

   

// You will find your arguments in args section of the objects 
// stored in result.logs array 


// console log the logs. It's an array with one, or more objects called EventLog.
// One of the properties of EventLog is args which contain all the 
// arguments in an array. Here, I am tapping into the event that I 
// am interested in and it is at index 0. 

const logs = await publicClient.getLogs({
  address: paymentContract.address,
  event: parseAbiItem('event paymentSucess(address indexed sender, uint256 indexed transactionId, string message)'),
  strict: true
})
 
const transactionId = logs[0].args.transactionId;

    console.log("Transaction ID:", transactionId);
    
    const cancelTxHash = await paymentContract.write.cancelOrder([transactionId], {
      account: otherAccount.account.address,
    });
    
    const cancelReceipt = await publicClient.waitForTransactionReceipt({ hash: cancelTxHash });
    let stateOfFunction: number;
    if (cancelReceipt.status === "success") {
      stateOfFunction = 1;
    } else {
      stateOfFunction = 0;
    }
    expect(stateOfFunction).to.equal(1); // Check if the transaction was successful
    console.log("Cancellation successful");


  
   
  });
});

  describe("cannot cancel a transaction after the time limit is exceeded", async () => {
    
    it("try canceling a transaction after the 1 min time limit", async () => {
      const { publicClient, paymentContract, deployer,buyer, sellerwallet, otherAccount } = await loadFixture(deployContract);
    const price = parseEther("2");
    const paidTxHash = await paymentContract.write.pay([ 
      sellerwallet.account.address,
    ], {
      value: price,
      account: buyer.account.address,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: paidTxHash });

   

  // You will find your arguments in args section of the objects 
  // stored in result.logs array 


  // console log the logs. It's an array with one, or more objects called EventLog.
  // One of the properties of EventLog is args which contain all the 
  // arguments in an array. Here, I am tapping into the event that I 
  // am interested in and it is at index 0. 

  const logs = await publicClient.getLogs({
    address: paymentContract.address,
    event: parseAbiItem('event paymentSucess(address indexed sender, uint256 indexed transactionId, string message)'),
    strict: true
  })
  
  const transactionId = logs[0].args.transactionId;

  console.log("Transaction ID:", transactionId);

    // Simulate waiting for more than 1 minute 
    await new Promise(resolve => setTimeout(resolve, 61000)); // Wait for 61 seconds
    try {
      const cancelAfterLimitTxHash = await paymentContract.write.cancelOrder([transactionId], {
        account: buyer.account.address,
      });
      const cancelAfterLimitReceipt = await publicClient.waitForTransactionReceipt({ hash: cancelAfterLimitTxHash });
      expect(cancelAfterLimitReceipt.status).to.equal("reverted");
    } catch (error) {
      console.error("Cancellation after time limit exceeded:", error);
      expect(error).to.exist; // Ensure that an error is thrown
    }
     
     
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
  });







  /**
 * Writes a contract and gets event logs.
 * @returns {Promise<Array>} An array containing the logs and decoded event logs.
 * @answer https://github.com/wagmi-dev/viem/discussions/916
 */
// export const writeContractAndGetEventLogs = async () => {
//   const walletClient = await getWalletClient(avalancheFuji);
//   const account = walletClient.account;
//   if (account) {
//     const hash = await walletClient.writeContract({
//       account,
//       ...FUJI_NFT_CONFIG,
//       functionName: "safeMint",
//       args: ["0x3261C3819dAc9e2e4D39721A0552a0547Bd92906", 5n],
//     });
//     const { logs } = await getPublicClient(
//       avalancheFuji
//     ).waitForTransactionReceipt({ hash });
//     return [
//       logs,
//       logs.map((log) => decodeEventLog({ ...log, abi: FUJI_NFT_CONFIG.abi })),
//     ];
//   }
// };