const { readFileSync } = require("node:fs");
const path = require("node:path");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const solc = require("solc");

const REWARD = 5_000_000n;
const HOUR = 3600;
const DAY = 24 * HOUR;

const mockUsdcSource = `
pragma solidity ^0.8.20;

contract MockUSDC {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(uint256 initialBalance) {
        balanceOf[msg.sender] = initialBalance;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}
`;

function compileContracts() {
    const escrowSource = readFileSync(path.join(__dirname, "../contracts/PagerEscrow.sol"), "utf8");
    const result = JSON.parse(solc.compile(JSON.stringify({
        language: "Solidity",
        sources: {
            "PagerEscrow.sol": { content: escrowSource },
            "MockUSDC.sol": { content: mockUsdcSource },
        },
        settings: {
            evmVersion: "paris",
            outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
        },
    })));
    const errors = (result.errors ?? []).filter(error => error.severity === "error");
    if (errors.length) throw new Error(errors.map(error => error.formattedMessage).join("\n"));
    return result.contracts;
}

describe("PagerEscrow", function () {
    let compiled;

    before(function () {
        compiled = compileContracts();
    });

    async function deployEscrow() {
        const [creator, hunter, platform, anotherHunter] = await ethers.getSigners();
        async function deploy(name, ...args) {
            const contract = compiled[`${name}.sol`][name];
            const factory = new ethers.ContractFactory(contract.abi, contract.evm.bytecode.object, creator);
            const deployed = await factory.deploy(...args);
            await deployed.waitForDeployment();
            return deployed;
        }
        const usdc = await deploy("MockUSDC", REWARD);
        const escrow = await deploy("PagerEscrow", await usdc.getAddress(), platform.address);
        await (await usdc.approve(await escrow.getAddress(), REWARD)).wait();
        return { escrow, usdc, creator, hunter, platform, anotherHunter };
    }

    async function openBounty() {
        const fixture = await deployEscrow();
        const deadline = (await time.latest()) + DAY;
        await (await fixture.escrow.createBounty(REWARD, deadline)).wait();
        return { ...fixture, deadline };
    }

    it("locks the reward and records the creator and deadline", async function () {
        const { escrow, usdc, creator } = await loadFixture(deployEscrow);
        const deadline = (await time.latest()) + DAY;

        await expect(escrow.createBounty(REWARD, deadline))
            .to.emit(escrow, "BountyCreated").withArgs(1, creator.address, REWARD, deadline);
        const bounty = await escrow.bounties(1);
        expect(bounty.creator).to.equal(creator.address);
        expect(bounty.amount).to.equal(REWARD);
        expect(bounty.active).to.equal(true);
        expect(bounty.deadline).to.equal(deadline);
        expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(REWARD);
    });

    it("rejects deadlines outside the allowed range", async function () {
        const { escrow } = await loadFixture(deployEscrow);
        const now = await time.latest();
        await expect(escrow.createBounty(REWARD, now + HOUR - 1)).to.be.revertedWith("Deadline too soon");
        await expect(escrow.createBounty(REWARD, now + 8 * DAY)).to.be.revertedWith("Deadline too far");
        expect(await escrow.bountyCount()).to.equal(0);
    });

    it("pays the hunter and the 2 percent fee exactly once", async function () {
        const { escrow, usdc, hunter, platform, anotherHunter } = await loadFixture(openBounty);
        const fee = REWARD * 2n / 100n;
        await expect(escrow.approveBounty(1, hunter.address))
            .to.emit(escrow, "BountyApproved").withArgs(1, hunter.address, REWARD);
        expect(await usdc.balanceOf(hunter.address)).to.equal(REWARD - fee);
        expect(await usdc.balanceOf(platform.address)).to.equal(fee);
        expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(0);
        await expect(escrow.approveBounty(1, anotherHunter.address)).to.be.revertedWith("Inactive");
    });

    it("leaves the bounty open and funded after rejecting proof", async function () {
        const { escrow, usdc, hunter, anotherHunter } = await loadFixture(openBounty);
        await expect(escrow.reject(1, hunter.address))
            .to.emit(escrow, "SubmissionRejected").withArgs(1, hunter.address);
        expect((await escrow.bounties(1)).active).to.equal(true);
        expect(await usdc.balanceOf(hunter.address)).to.equal(0);
        expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(REWARD);
        await expect(escrow.approveBounty(1, anotherHunter.address)).to.emit(escrow, "BountyApproved");
    });

    it("refunds the full reward only after expiry", async function () {
        const { escrow, usdc, creator, deadline } = await loadFixture(openBounty);
        await time.setNextBlockTimestamp(deadline);
        await expect(escrow.refundExpired(1)).to.be.revertedWith("Not expired");
        await time.setNextBlockTimestamp(deadline + 1);
        await expect(escrow.refundExpired(1))
            .to.emit(escrow, "BountyRefunded").withArgs(1, creator.address, REWARD);
        expect(await usdc.balanceOf(creator.address)).to.equal(REWARD);
        expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(0);
        expect((await escrow.bounties(1)).active).to.equal(false);
        await expect(escrow.refundExpired(1)).to.be.revertedWith("Inactive");
    });

    it("requires the creator for approval, rejection, and refund", async function () {
        const { escrow, hunter, deadline } = await loadFixture(openBounty);
        const asHunter = escrow.connect(hunter);
        await expect(asHunter.approveBounty(1, hunter.address)).to.be.revertedWith("Not creator");
        await expect(asHunter.reject(1, hunter.address)).to.be.revertedWith("Not creator");
        await time.setNextBlockTimestamp(deadline + 1);
        await expect(asHunter.refundExpired(1)).to.be.revertedWith("Not creator");
    });
});
