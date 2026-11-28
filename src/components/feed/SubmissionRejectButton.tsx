"use client";

import { useRef, useState } from "react";
import axios from "axios";
import { BrowserProvider, Contract } from "ethers";
import { useUser } from "@/context/UserContext";
import { ESCROW_ABI, ESCROW_ADDRESS } from "@/lib/contracts";

type Props = {
    submissionId: string;
    onChainId: number;
    hunterWallet: string;
    onRejected?: () => void;
};

export default function SubmissionRejectButton({ submissionId, onChainId, hunterWallet, onRejected }: Props) {
    const { user, walletProvider } = useUser();
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const confirmedHash = useRef<string | null>(null);
    const storageKey = `pager:reject:${ESCROW_ADDRESS}:${submissionId}`;

    async function reject() {
        setLoading(true);
        setMessage("");

        try {
            let hash = confirmedHash.current;
            try {
                hash ||= localStorage.getItem(storageKey);
            } catch {
                // In-memory recovery is still available on this page.
            }
            if (!hash) {
                if (!user || !walletProvider) {
                    setMessage("Reconnect your wallet to continue.");
                    return;
                }
                if (await walletProvider.request({ method: "eth_chainId" }) !== "0x279f") {
                    await walletProvider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x279f" }] });
                }
                const provider = new BrowserProvider(walletProvider);
                if ((await provider.getNetwork()).chainId !== 10143n) {
                    setMessage("Switch your wallet to Monad Testnet.");
                    return;
                }

                const signer = await provider.getSigner(user.walletAddress);
                const escrow = new Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);
                const tx = await escrow.reject(onChainId, hunterWallet);
                const receipt = await tx.wait();
                if (receipt?.status !== 1) throw new Error("Rejection did not confirm");
                hash = receipt.hash;
                confirmedHash.current = hash;
                try {
                    localStorage.setItem(storageKey, receipt.hash);
                } catch {
                    // In-memory recovery is still available on this page.
                }
            }

            try {
                await axios.post("/api/submission/reject", { submissionId, txHash: hash });
            } catch {
                setMessage("Rejection confirmed on-chain. Select Reject again to retry saving it.");
                return;
            }
            try {
                localStorage.removeItem(storageKey);
            } catch {
                // The database already has the rejected status.
            }
            setMessage("Submission rejected.");
            onRejected?.();
        } catch {
            setMessage("Could not reject this submission. Check your wallet and try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="text-right">
            <button
                type="button"
                onClick={reject}
                disabled={loading}
                className="min-h-10 rounded-md px-3 text-xs font-bold text-red-600 hover:bg-red-500/10 disabled:opacity-50 dark:text-red-300"
            >
                {loading ? "Rejecting…" : "Reject"}
            </button>
            {message && <p role="status" className="text-xs">{message}</p>}
        </div>
    );
}
