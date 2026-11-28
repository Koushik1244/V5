//src\app\api\submission\approve\route.ts

import { NextRequest, NextResponse } from "next/server";
import { Interface, JsonRpcProvider, isAddress, isHexString } from "ethers";
import { isObjectIdOrHexString } from "mongoose";
import { ESCROW_ADDRESS, ESCROW_ABI } from "@/lib/contracts";
import { connectDB } from "@/lib/mongodb";
import Submission from "@/models/Submission";
import Bounty from "@/models/Bounty";

const ESCROW_INTERFACE = new Interface(ESCROW_ABI);

export async function POST(req: NextRequest) {
    let provider: JsonRpcProvider | undefined;

    try {
        const { submissionId, bountyId, txHash } = (await req.json().catch(() => null)) ?? {};
        if (
            typeof submissionId !== "string" || !isObjectIdOrHexString(submissionId)
            || typeof bountyId !== "string" || !isObjectIdOrHexString(bountyId)
            || !isHexString(txHash, 32)
        ) {
            return NextResponse.json({ error: "Valid submission ID, bounty ID, and transaction hash are required" }, { status: 400 });
        }

        await connectDB();
        const submissionQuery = { _id: submissionId, bountyId };
        const [submission, bounty] = await Promise.all([
            Submission.findOne(submissionQuery).select("hunterWallet"),
            Bounty.findById(bountyId).select("onChainId"),
        ]);
        if (!submission || !bounty) {
            return NextResponse.json({ error: "Submission or bounty not found" }, { status: 404 });
        }
        if (!Number.isSafeInteger(bounty.onChainId) || bounty.onChainId <= 0 || !isAddress(submission.hunterWallet)) {
            return NextResponse.json({ error: "Submission or bounty is missing valid on-chain details" }, { status: 422 });
        }

        provider = new JsonRpcProvider(process.env.MONAD_RPC || "https://testnet-rpc.monad.xyz");
        if ((await provider.getNetwork()).chainId !== 10143n) {
            return NextResponse.json({ error: "Approval verification requires Monad Testnet" }, { status: 502 });
        }
        const receipt = await provider.getTransactionReceipt(txHash);
        if (!receipt) {
            return NextResponse.json({ error: "Approval transaction is not confirmed" }, { status: 409 });
        }

        const approvalTopics = ESCROW_INTERFACE.encodeFilterTopics("BountyApproved", [
            bounty.onChainId,
            submission.hunterWallet,
        ]);
        const matchesApproval = receipt.status === 1 && receipt.logs.some(log =>
            log.address.toLowerCase() === ESCROW_ADDRESS.toLowerCase()
            && approvalTopics.every((topic, index) => topic === log.topics[index]?.toLowerCase())
        );
        if (!matchesApproval) {
            return NextResponse.json({ error: "Transaction did not approve this bounty and hunter" }, { status: 422 });
        }

        await Submission.findOneAndUpdate(submissionQuery, { status: "approved" });
        await Bounty.findByIdAndUpdate(bountyId, {
            status: "completed",
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Approval verification or database sync failed", error instanceof Error ? error.name : typeof error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    } finally {
        provider?.destroy();
    }
}
