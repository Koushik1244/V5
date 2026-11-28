//src\app\api\submission\create\route.ts

import { NextRequest, NextResponse } from "next/server";
import { connection, isObjectIdOrHexString } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Submission from "@/models/Submission";
import User from "@/models/User";
import Bounty from "@/models/Bounty";

export async function POST(req: NextRequest) {
    try {
        await connectDB();

        const { walletAddress, bountyId, description, mediaUrl } =
            await req.json();

        if (!walletAddress || typeof bountyId !== "string" || !isObjectIdOrHexString(bountyId) || !mediaUrl) {
            return NextResponse.json(
                { error: "Missing fields" },
                { status: 400 }
            );
        }

        const user = await User.findOne({ walletAddress });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const result = await connection.transaction(async session => {
            const openBounty = await Bounty.updateOne(
                { _id: bountyId, status: "open" },
                { $currentDate: { updatedAt: true } },
                { session, timestamps: false }
            );
            if (openBounty.matchedCount === 0) {
                const exists = await Bounty.exists({ _id: bountyId }).session(session);
                return exists
                    ? { error: "Bounty is closed", status: 409 }
                    : { error: "Bounty not found", status: 404 };
            }

            const [submission] = await Submission.create([{
                bountyId,
                hunter: user._id,
                username: user.username,
                description,
                mediaUrl,
                hunterWallet: walletAddress,
            }], { session });
            return { submission };
        });

        if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
        return NextResponse.json({ success: true, submission: result.submission });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
