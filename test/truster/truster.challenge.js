const { ethers } = require('hardhat');
const { expect } = require('chai');

describe('[Challenge] Truster', function () {
    let deployer, attacker;

    const TOKENS_IN_POOL = ethers.utils.parseEther('1000000');

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [deployer, attacker] = await ethers.getSigners();

        const DamnValuableToken = await ethers.getContractFactory('DamnValuableToken', deployer);
        const TrusterLenderPool = await ethers.getContractFactory('TrusterLenderPool', deployer);
        const AttackTruster = await ethers.getContractFactory('AttackTruster',deployer);

        this.token = await DamnValuableToken.deploy();
        this.pool = await TrusterLenderPool.deploy(this.token.address);
        this.attackContract = await AttackTruster.deploy(this.pool.address,this.token.address,attacker.address);

        await this.token.transfer(this.pool.address, TOKENS_IN_POOL);

        expect(
            await this.token.balanceOf(this.pool.address)
        ).to.equal(TOKENS_IN_POOL);

        expect(
            await this.token.balanceOf(attacker.address)
        ).to.equal('0');
    });

    it('Exploit', async function () {
        /** CODE YOUR EXPLOIT HERE  */
        /**
         * Exploit:
         * The flash loan contract allows any call to any external contract. This gives a greater
         * surface for exploitation.
         * 
         * Solution:
         * Check the subject contracts, force contracts to comply with an interface that is designed
         * to be safer for the pool. Reduce the attack surface as much as you can. 
         */
        await this.attackContract.connect(attacker).attack();
    });

    after(async function () {
        /** SUCCESS CONDITIONS */

        // Attacker has taken all tokens from the pool
        expect(
            await this.token.balanceOf(attacker.address)
        ).to.equal(TOKENS_IN_POOL);
        expect(
            await this.token.balanceOf(this.pool.address)
        ).to.equal('0');
    });
});

