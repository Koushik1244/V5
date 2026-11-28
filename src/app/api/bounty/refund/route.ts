import { NextRequest, NextResponse } from "next/server";
import { Interface, JsonRpcProvider, isAddress, isHexString } from "ethers";
import { isObjectIdOrHexString } from "mongoose";
import { ESCROW_ABI, ESCROW_ADDRESS } from "@/lib/contracts";
import { connectDB } from "@/lib/mongodb";
import Bounty from "@/models/Bounty";
import User from "@/models/User";

const escrowInterface = new Interface(ESCROW_ABI);

export async function POST(req: NextRequest) {
    let provider: JsonRpcProvider | undefined;

    try {
        const { bountyId, txHash } = (await req.json().catch(() => null)) ?? {};
        if (typeof bountyId !== "string" || !isObjectIdOrHexString(bountyId) || !isHexString(txHash, 32)) {
            return NextResponse.json({ error: "Valid bounty ID and transaction hash are required" }, { status: 400 });
        }

        await connectDB();
        const bounty = await Bounty.findById(bountyId).select("creator onChainId");
        if (!bounty) return NextResponse.json({ error: "Bounty not found" }, { status: 404 });

        const creator = await User.findById(bounty.creator).select("walletAddress");
        if (!Number.isSafeInteger(bounty.onChainId) || bounty.onChainId <= 0 || !isAddress(creator?.walletAddress)) {
            return NextResponse.json({ error: "Bounty is missing valid on-chain details" }, { status: 422 });
        }

        provider = new JsonRpcProvider(process.env.MONAD_RPC || "https://testnet-rpc.monad.xyz");
        if ((await provider.getNetwork()).chainId !== 10143n) {
            return NextResponse.json({ error: "Refund verification requires Monad Testnet" }, { status: 502 });
        }
        const receipt = await provider.getTransactionReceipt(txHash);
        if (!receipt) return NextResponse.json({ error: "Refund transaction is not confirmed" }, { status: 409 });

        const topics = escrowInterface.encodeFilterTopics("BountyRefunded", [bounty.onChainId, creator.walletAddress]);
        const matchesRefund = receipt.status === 1 && receipt.logs.some(log =>
            log.address.toLowerCase() === ESCROW_ADDRESS.toLowerCase()
            && topics.every((topic, index) => topic === log.topics[index]?.toLowerCase())
        );
        if (!matchesRefund) {
            return NextResponse.json({ error: "Transaction did not refund this bounty" }, { status: 422 });
        }

        const result = await Bounty.updateOne(
            { _id: bountyId, onChainId: bounty.onChainId, status: { $in: ["open", "expired", "refunded"] } },
            { $set: { status: "refunded" } }
        );
        if (result.matchedCount === 0) {
            return NextResponse.json({ error: "The bounty status changed before the refund could be saved" }, { status: 409 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Bounty refund sync failed", error instanceof Error ? error.name : typeof error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    } finally {
        provider?.destroy();
    }
}
