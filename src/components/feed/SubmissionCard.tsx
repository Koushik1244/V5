// src\components\feed\SubmissionCard.tsx

"use client";

import { useRef, useState } from "react";
import MediaViewer from "./MediaViewer";
import SubmissionRejectButton from "./SubmissionRejectButton";
import { useUser } from "@/context/UserContext";
import axios from "axios";
import { ethers } from "ethers";
import { ESCROW_ADDRESS, ESCROW_ABI } from "@/lib/contracts";
import { connectMonadWallet, MonadWalletNetworkError } from "@/lib/monadWallet";
import { FaShare } from "react-icons/fa";
import { HiChatBubbleLeft } from "react-icons/hi2";
import { AiFillLike } from "react-icons/ai";

type Props = {
    submission: any;
    bounty: any;
    onApproved?: () => void;
};

async function recoverApprovalHash(
    escrow: ethers.Contract,
    storageKey: string,
    onChainId: ethers.BigNumberish,
    hunter: string,
) {
    const provider = escrow.runner?.provider;
    if (!provider) return;

    const topics = escrow.interface.encodeFilterTopics("BountyApproved", [onChainId, hunter]);
    const matchesApproval = (log: ethers.Log) =>
        log.address.toLowerCase() === ESCROW_ADDRESS.toLowerCase() &&
        topics.every((topic, index) => topic === log.topics[index]);

    let storedHash: string | null = null;
    try {
        storedHash = localStorage.getItem(storageKey);
    } catch {
        // Event logs can recover the hash when storage is unavailable.
    }

    if (storedHash) {
        try {
            const receipt = await provider.getTransactionReceipt(storedHash);
            if (receipt?.status === 1 && receipt.logs.some(matchesApproval)) return storedHash;
        } catch {
            // Fall back to the event query if the receipt cannot be read.
        }
    }

    try {
        const latestBlock = await provider.getBlockNumber();
        const filter = escrow.filters.BountyApproved(onChainId);
        for (const range of [90_000, 10_000, 1_000]) {
            try {
                const logs = await escrow.queryFilter(filter, Math.max(0, latestBlock - range));
                return logs.filter(matchesApproval).sort(
                    (a, b) => b.blockNumber - a.blockNumber || b.index - a.index
                )[0]?.transactionHash;
            } catch {
                // Some RPCs only accept shorter log queries.
            }
        }
    } catch {
        // The caller reports when no matching approval can be recovered.
    }
}

export default function SubmissionCard({ submission, bounty, onApproved }: Props) {
    const { user, walletProvider: ethereum } = useUser();

    const [confirmOpen, setConfirmOpen] = useState(false);
    const [stage, setStage] = useState<"idle" | "wallet" | "confirming" | "saving" | "retry" | "saved">("idle");
    const [error, setError] = useState("");
    const confirmedHash = useRef<string | null>(null);

    const isCreator = user?.username === bounty.username;
    const isPending = submission.status === "pending";
    const busy = stage === "wallet" || stage === "confirming" || stage === "saving";
    const storageKey = `pager:approval:${submission._id}`;

    async function saveApproval(txHash: string) {
        confirmedHash.current = txHash;
        setStage("saving");
        try {
            await axios.post("/api/submission/approve", {
                submissionId: submission._id,
                bountyId: bounty._id,
                txHash,
            });
        } catch {
            setStage("retry");
            return;
        }
        try {
            localStorage.removeItem(storageKey);
        } catch {
            // The database already has the confirmed approval.
        }
        setStage("saved");
    }

    async function approve() {
        setError("");
        if (confirmedHash.current) {
            await saveApproval(confirmedHash.current);
            return;
        }
        if (!user || !ethereum) {
            setError("Reconnect your wallet to continue.");
            return;
        }

        setStage("wallet");
        try {
            const provider = await connectMonadWallet(ethereum);
            const signer = await provider.getSigner(user.walletAddress);
            const escrow = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);
            const onChainBounty = await escrow.bounties(bounty.onChainId);
            if (!onChainBounty.active) {
                const hash = await recoverApprovalHash(escrow, storageKey, bounty.onChainId, submission.hunterWallet);
                if (!hash) {
                    setStage("idle");
                    setError("This bounty is closed on-chain. No matching payment to this hunter could be verified.");
                    return;
                }
                await saveApproval(hash);
                return;
            }

            const tx = await escrow.approveBounty(bounty.onChainId, submission.hunterWallet);
            setStage("confirming");
            try {
                localStorage.setItem(storageKey, tx.hash);
            } catch {
                // The on-chain event can recover the hash after confirmation.
            }

            const receipt = await tx.wait();
            if (receipt?.status !== 1) throw new Error("Approval did not confirm");
            await saveApproval(receipt.hash);
        } catch (err) {
            setStage("idle");
            setError(err instanceof MonadWalletNetworkError ? err.message : "Could not confirm payment. Check your wallet and try again.");
        }
    }

    function closeConfirmation() {
        setConfirmOpen(false);
        setError("");
        if (stage === "saved") onApproved?.();
    }

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

            {confirmOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
                    <div role="dialog" aria-modal="true" aria-labelledby="approval-title" className="glass-modal w-full max-w-sm space-y-4 p-6 text-center">
                        <h3 id="approval-title" className="text-lg font-semibold">
                            {stage === "saved" ? "Payment approved" : "Release funds to hunter?"}
                        </h3>

                        {stage === "saved" ? (
                            <p role="status" className="text-sm">Funds were released and the approval was saved.</p>
                        ) : (
                            <p className="text-sm">{bounty.reward} USDC, including a 2% platform fee.</p>
                        )}

                        {stage === "wallet" && <p role="status" className="text-sm">Check your wallet to confirm.</p>}
                        {stage === "confirming" && <p role="status" className="text-sm">Waiting for Monad to confirm payment…</p>}
                        {stage === "saving" && <p role="status" className="text-sm">Payment confirmed. Saving the approval…</p>}
                        {stage === "retry" && <p role="alert" className="text-sm text-red-700 dark:text-red-300">Payment confirmed, but saving failed. Retry saving to update the bounty.</p>}
                        {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}

                        <div className="flex gap-3">
                            {stage !== "saved" && (
                                <button
                                    type="button"
                                    onClick={closeConfirmation}
                                    disabled={busy}
                                    className="flex-1 rounded-lg border border-borderLight py-2 disabled:opacity-50 dark:border-borderDark"
                                >
                                    {stage === "retry" ? "Close" : "Cancel"}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={stage === "saved" ? closeConfirmation : approve}
                                disabled={busy}
                                className="flex-1 rounded-lg bg-[#5938c9] py-2 font-semibold text-white disabled:opacity-50"
                            >
                                {stage === "saved" ? "Done" : stage === "retry" ? "Retry saving" : busy ? "Processing…" : "Confirm"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
