// src\components\feed\SubmissionCard.tsx

"use client";

import { useState } from "react";
import MediaViewer from "./MediaViewer";
import SubmissionRejectButton from "./SubmissionRejectButton";
import { useUser } from "@/context/UserContext";
import axios from "axios";
import { ethers } from "ethers";
import { ESCROW_ADDRESS, ESCROW_ABI } from "@/lib/contracts";
import { formatTimeAgo } from "@/lib/utils";
import { FaShare } from "react-icons/fa";
import { HiChatBubbleLeft } from "react-icons/hi2";
import { AiFillLike } from "react-icons/ai";

type Props = {
    submission: any;
    bounty: any;
    onApproved?: () => void;
};

export default function SubmissionCard({ submission, bounty, onApproved }: Props) {
    const { user, walletProvider } = useUser();

    const [confirmOpen, setConfirmOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const isCreator = user?.username === bounty.username;
    const isPending = submission.status === "pending";

    // 🔐 On-chain approval + DB update
    const approve = async () => {
        try {
            setLoading(true);

            if (!user || !walletProvider) {
                alert("Reconnect your wallet to continue.");
                return;
            }

            const provider = new ethers.BrowserProvider(walletProvider);
            const signer = await provider.getSigner(user.walletAddress);

            const escrow = new ethers.Contract(
                ESCROW_ADDRESS,
                ESCROW_ABI,
                signer
            );

            // 1️⃣ Release funds on-chain
            const tx = await escrow.approveBounty(
                bounty.onChainId,
                submission.hunterWallet
            );

            await tx.wait();

            // 2️⃣ Update DB
            await axios.post("/api/submission/approve", {
                submissionId: submission._id,
                bountyId: bounty._id,
                txHash: tx.hash,
            });

            setConfirmOpen(false);
            onApproved?.();

            alert("Funds released successfully!");

        } catch (err) {
            console.error(err);
            alert("Approval failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div
                className="
mt-3 ml-10 left-32 relative
before:absolute before:left-[-14px] before:top-4
before:w-2 before:h-2 before:rounded-full
before:bg-primary/40

bg-primary/5
dark:bg-[linear-gradient(135deg,rgba(134,107,255,0.18),rgba(255,120,180,0.10))]

border border-primary/20
dark:border-primary/30
rounded-2xl
shadow-md
"           >
                {/* Header */}
                <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <img
                            src={`https://i.pravatar.cc/40?u=${submission.username}`}
                            className="w-8 h-8 rounded-full border border-primary/20"
                        />

                        <div>
                            <p className="text-xs font-semibold">
                                {submission.username}
                            </p>

                            <p className="text-[10px] text-textMutedDark">
                                {new Date(submission.createdAt).toLocaleString()}
                                {/* {formatTimeAgo(submission.createdAt)} */}
                            </p>
                        </div>
                    </div>

                    {submission.status === "approved" && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-500">
                            Approved
                        </span>
                    )}
                    {submission.status === "rejected" && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-textMainLight dark:text-textMainDark">
                            Not selected
                        </span>
                    )}
                </div>

                {/* Description */}
                {submission.description && (
                    <div className="px-3 pb-2">
                        <p className="text-xs">{submission.description}</p>
                    </div>
                )}

                {/* Media */}
                <div className="px-3 pb-3">
                    <MediaViewer
                        mediaUrl={submission.mediaUrl}
                        lat={bounty.location.lat}
                        lng={bounty.location.lng}
                    />
                </div>

                {/* Actions */}
                <div className="px-3 py-2 border-t border-primary/10 flex items-center justify-between">
                    <div className="flex items-center gap-5 text-textMutedDark">
                        <button className="flex items-center gap-1 hover:text-red-400 active:scale-90 transition">
                            <span className="text-[20px]">
                                <AiFillLike size={24} />
                            </span>
                            <span className="text-xs font-semibold">0</span>
                        </button>

                        <button className="flex items-center gap-1 hover:text-primary transition">
                            <span className="text-[20px]">
                                <HiChatBubbleLeft size={24} />
                            </span>
                            <span className="text-xs font-semibold">0</span>
                        </button>

                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(
                                    `${window.location.origin}/bounty/${bounty._id}`
                                );
                                alert("Link copied");
                            }}
                            className="flex items-center gap-1 hover:text-green-400 transition"
                        >
                            <span className="text-[20px]">
                                <FaShare size={24} />
                            </span>
                        </button>
                    </div>

                    {isCreator && isPending && bounty.status === "open" && (
                        <div className="flex items-center gap-2">
                            <SubmissionRejectButton
                                submissionId={submission._id}
                                onChainId={bounty.onChainId}
                                hunterWallet={submission.hunterWallet}
                                onRejected={onApproved}
                            />
                            <button
                                type="button"
                                onClick={() => setConfirmOpen(true)}
                                className="rounded-md bg-primary px-3 py-1 text-[10px] font-bold text-white transition hover:bg-primary/80"
                            >
                                Approve
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Confirmation Modal */}
            {confirmOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="glass-modal p-6 w-[320px] space-y-4 text-center">
                        <h3 className="font-semibold text-textMainLight dark:text-textMainDark">
                            Release funds to hunter?
                        </h3>

                        <p className="text-xs text-textMutedDark">
                            {bounty.reward} USDC will be released.
                            Platform fee: 2%
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmOpen(false)}
                                className="flex-1 py-2 rounded-lg border border-borderLight dark:border-borderDark"
                            >
                                Cancel
                            </button>

                            <button
                                onClick={approve}
                                disabled={loading}
                                className="flex-1 py-2 rounded-lg bg-primary text-white shadow-glow"
                            >
                                {loading ? "Processing..." : "Confirm"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
