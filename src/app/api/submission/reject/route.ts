import { NextRequest, NextResponse } from "next/server";
import { Interface, JsonRpcProvider, isAddress, isHexString } from "ethers";
import { isObjectIdOrHexString } from "mongoose";
import { ESCROW_ABI, ESCROW_ADDRESS } from "@/lib/contracts";
import { connectDB } from "@/lib/mongodb";
import Bounty from "@/models/Bounty";
import Submission from "@/models/Submission";

const escrowInterface = new Interface(ESCROW_ABI);

export async function POST(req: NextRequest) {
    let provider: JsonRpcProvider | undefined;

    try {
        const { submissionId, txHash } = (await req.json().catch(() => null)) ?? {};
        if (typeof submissionId !== "string" || !isObjectIdOrHexString(submissionId) || !isHexString(txHash, 32)) {
            return NextResponse.json({ error: "Valid submission ID and transaction hash are required" }, { status: 400 });
        }

        await connectDB();
        const submission = await Submission.findById(submissionId).select("bountyId hunterWallet");
        if (!submission) return NextResponse.json({ error: "Submission not found" }, { status: 404 });
        const bounty = await Bounty.findById(submission.bountyId).select("onChainId");
        if (!bounty || !Number.isSafeInteger(bounty.onChainId) || bounty.onChainId <= 0 || !isAddress(submission.hunterWallet)) {
            return NextResponse.json({ error: "Submission is missing valid on-chain details" }, { status: 422 });
        }

        provider = new JsonRpcProvider(process.env.MONAD_RPC || "https://testnet-rpc.monad.xyz");
        if ((await provider.getNetwork()).chainId !== 10143n) {
            return NextResponse.json({ error: "Rejection verification requires Monad Testnet" }, { status: 502 });
        }
        const receipt = await provider.getTransactionReceipt(txHash);
        if (!receipt) return NextResponse.json({ error: "Rejection transaction is not confirmed" }, { status: 409 });

        const topics = escrowInterface.encodeFilterTopics("SubmissionRejected", [bounty.onChainId, submission.hunterWallet]);
        const matchesRejection = receipt.status === 1 && receipt.logs.some(log =>
            log.address.toLowerCase() === ESCROW_ADDRESS.toLowerCase()
            && topics.every((topic, index) => topic === log.topics[index]?.toLowerCase())
        );
        if (!matchesRejection) {
            return NextResponse.json({ error: "Transaction did not reject this bounty and hunter" }, { status: 422 });
        }

        const rejectionTxHash = txHash.toLowerCase();
        await Submission.init();
        const updated = await Submission.updateOne({
            _id: submissionId,
            bountyId: submission.bountyId,
            hunterWallet: submission.hunterWallet,
            $or: [{ status: "pending" }, { status: "rejected", rejectionTxHash }],
        }, { $set: { status: "rejected", rejectionTxHash } });
        if (updated.matchedCount === 0) {
            return NextResponse.json({ error: "Submission is no longer pending" }, { status: 409 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
            return NextResponse.json({ error: "Rejection transaction was already used for another submission" }, { status: 409 });
        }
        console.error("Submission rejection sync failed", error instanceof Error ? error.name : typeof error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    } finally {
        provider?.destroy();
    }
}
