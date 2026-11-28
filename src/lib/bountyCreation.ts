import { Contract, type Eip1193Provider } from "ethers";
import { ESCROW_ADDRESS, USDC_ADDRESS, ESCROW_ABI, ERC20_ABI } from "./contracts";
import { connectMonadWallet } from "./monadWallet";

const HOUR = 60 * 60;

export const DEFAULT_BOUNTY_DURATION = 24 * HOUR;

export const BOUNTY_DURATIONS = [
    { label: "2 hours", seconds: 2 * HOUR },
    { label: "24 hours", seconds: DEFAULT_BOUNTY_DURATION },
    { label: "3 days", seconds: 3 * 24 * HOUR },
    { label: "6 days", seconds: 6 * 24 * HOUR },
];

export async function lockBountyFunds(
    ethereum: Eip1193Provider,
    amount: bigint,
    duration: number,
    walletAddress: string,
) {
    const provider = await connectMonadWallet(ethereum);
    const signer = await provider.getSigner(walletAddress);

    const usdc = new Contract(USDC_ADDRESS, ERC20_ABI, signer);
    const allowance = await usdc.approve(ESCROW_ADDRESS, amount);
    const approvalReceipt = await allowance.wait();
    if (approvalReceipt?.status !== 1) throw new Error("USDC approval did not confirm");

    const block = await provider.getBlock("latest");
    if (!block) throw new Error("Could not read the latest Monad Testnet block");
    const deadline = block.timestamp + duration;

    const escrow = new Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);
    const transaction = await escrow.createBounty(amount, deadline);
    const receipt = await transaction.wait();
    if (receipt?.status !== 1) throw new Error("Bounty creation did not confirm");

    for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== ESCROW_ADDRESS.toLowerCase()) continue;
        const event = escrow.interface.parseLog(log);
        if (event?.name === "BountyCreated") return Number(event.args.bountyId);
    }

    return null;
}
