//src\app\api\submission\approve\route.ts

import { NextRequest, NextResponse } from "next/server";
import { Interface, JsonRpcProvider, isAddress, isHexString } from "ethers";
import { connection, isObjectIdOrHexString } from "mongoose";
import { ESCROW_ADDRESS, ESCROW_ABI } from "@/lib/contracts";
import { connectDB } from "@/lib/mongodb";
import Submission from "@/models/Submission";
import Bounty from "@/models/Bounty";

const ESCROW_INTERFACE = new Interface(ESCROW_ABI);

class ApprovalConflict extends Error {}

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

        await connection.transaction(async session => {
            const updatedBounty = await Bounty.updateOne(
                { _id: bountyId, onChainId: bounty.onChainId, status: { $in: ["open", "completed"] } },
                { $set: { status: "completed" } },
                { session }
            );
            if (updatedBounty.matchedCount === 0) throw new ApprovalConflict("The bounty is closed");

            const existingApproval = await Submission.exists({
                _id: { $ne: submissionId },
                bountyId,
                status: "approved",
            }).session(session);
            if (existingApproval) throw new ApprovalConflict("A different submission is already approved");

            const selected = await Submission.updateOne(
                { ...submissionQuery, hunterWallet: submission.hunterWallet },
                { $set: { status: "approved" } },
                { session }
            );
            if (selected.matchedCount === 0) throw new ApprovalConflict("The submission changed before approval");

            await Submission.updateMany(
                { _id: { $ne: submissionId }, bountyId, status: "pending" },
                { $set: { status: "rejected" } },
                { session }
            );
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof ApprovalConflict) {
            return NextResponse.json({ error: error.message }, { status: 409 });
        }
        console.error("Approval verification or database sync failed", error instanceof Error ? error.name : typeof error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    } finally {
        provider?.destroy();
    }
}
