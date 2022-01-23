const { ethers } = require('hardhat');
const { expect } = require('chai');

describe('[Challenge] Side entrance', function () {

    let deployer, attacker;

    const ETHER_IN_POOL = ethers.utils.parseEther('1000');

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [deployer, attacker] = await ethers.getSigners();

        const SideEntranceLenderPoolFactory = await ethers.getContractFactory('SideEntranceLenderPool', deployer);
        const SideAttackFactory = await ethers.getContractFactory('SideAttack',deployer);
        this.pool = await SideEntranceLenderPoolFactory.deploy();
        this.attackerContract = await SideAttackFactory.deploy(this.pool.address,attacker.address);
        
        await this.pool.deposit({ value: ETHER_IN_POOL });

        this.attackerInitialEthBalance = await ethers.provider.getBalance(attacker.address);

        expect(
            await ethers.provider.getBalance(this.pool.address)
        ).to.equal(ETHER_IN_POOL);
    });

    it('Exploit', async function () {
        /** CODE YOUR EXPLOIT HERE */
        /**
         * Exploit:
         * Deposit and withdraw functions can be called during the flash loan. By receiving a flash loan,
         * just deposit the loan and withdraw it. Recall the unstoppable. While we suggested to check the balance directly
         * rather than tracking the amounts using storage variables, in this situation, creates the exploit.
         * 
         * Solution:
         *  Mutexes can be used. 
         *  State-freezing mechanisms like mutexes can guard the depositing from flash loans. 
         *  
         * 
         */

        this.attackerContract.connect(attacker).attack();

    });

    after(async function () {
        /** SUCCESS CONDITIONS */
        expect(
            await ethers.provider.getBalance(this.pool.address)
        ).to.be.equal('0');
        
        // Not checking exactly how much is the final balance of the attacker,
        // because it'll depend on how much gas the attacker spends in the attack
        // If there were no gas costs, it would be balance before attack + ETHER_IN_POOL
        expect(
            await ethers.provider.getBalance(attacker.address)
        ).to.be.gt(this.attackerInitialEthBalance);
    });
});
