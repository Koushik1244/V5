import { Contract, parseUnits, type Eip1193Provider } from "ethers";
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

export type BountyFieldErrors = { description?: string; reward?: string; location?: string };

export function validateBountyFields(description: string, reward: string, lat: number | null, lng: number | null) {
    const errors: BountyFieldErrors = {};
    if (!description.trim()) errors.description = "Enter what you want checked.";
    if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng)
        || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        errors.location = "Choose a valid location.";
    }

    const amount = Number(reward);
    let units: bigint | null = null;
    if (!Number.isFinite(amount) || amount <= 0) {
        errors.reward = "Enter a reward greater than zero.";
    } else {
        try {
            const parsedReward = parseUnits(reward.trim(), 6);
            if (parsedReward === parseUnits(amount.toString(), 6)) units = parsedReward;
            else errors.reward = "Enter a smaller USDC amount.";
        } catch {
            errors.reward = "Enter a USDC amount with up to 6 decimal places.";
        }
    }
    return { errors, amount, units };
}

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
