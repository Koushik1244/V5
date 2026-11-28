//src\app\api\bounty\create\route.ts

import { NextRequest, NextResponse } from "next/server";
import { Contract, JsonRpcProvider, isAddress, parseUnits } from "ethers";
import { ESCROW_ABI, ESCROW_ADDRESS } from "@/lib/contracts";
import { connectDB } from "@/lib/mongodb";
import Bounty from "@/models/Bounty";
import User from "@/models/User";

export async function POST(req: NextRequest) {
    let provider: JsonRpcProvider | undefined;

    try {
        const { walletAddress, description, reward, lat, lng, address, mediaUrl, onChainId } =
            (await req.json().catch(() => null)) ?? {};

        if (
            !isAddress(walletAddress) || typeof description !== "string" || !description.trim()
            || typeof reward !== "number" || !Number.isFinite(reward) || reward <= 0
            || !Number.isSafeInteger(onChainId) || onChainId <= 0
        ) {
            return NextResponse.json({ error: "Valid wallet, description, reward, and on-chain ID are required" }, { status: 400 });
        }
        let rewardUnits: bigint;
        try {
            rewardUnits = parseUnits(reward.toString(), 6);
        } catch {
            return NextResponse.json({ error: "Invalid USDC reward" }, { status: 400 });
        }

        await connectDB();

        const user = await User.findOne({ walletAddress });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        provider = new JsonRpcProvider(process.env.MONAD_RPC || "https://testnet-rpc.monad.xyz");
        if ((await provider.getNetwork()).chainId !== 10143n) {
            return NextResponse.json({ error: "Bounty verification requires Monad Testnet" }, { status: 502 });
        }
        const escrow = new Contract(ESCROW_ADDRESS, ESCROW_ABI, provider);
        const escrowBounty = await escrow.bounties(onChainId);
        const deadline = new Date(Number(escrowBounty.deadline) * 1000);
        if (
            !escrowBounty.active || escrowBounty.creator.toLowerCase() !== walletAddress.toLowerCase()
            || escrowBounty.amount !== rewardUnits || escrowBounty.deadline <= 0n || !Number.isFinite(deadline.getTime())
        ) {
            return NextResponse.json({ error: "Bounty does not match an active escrow record" }, { status: 422 });
        }

        const bounty = await Bounty.create({
            creator: user._id,
            username: user.username,
            description,
            reward,
            location: { lat, lng, address },
            mediaUrl,
            onChainId,
            deadline,
        });

        return NextResponse.json({ success: true, bounty });
    } catch (error) {
        console.error("Bounty creation sync failed", error instanceof Error ? error.name : typeof error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    } finally {
        provider?.destroy();
    }
}
