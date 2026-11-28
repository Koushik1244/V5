"use client";

import { useRef, useState } from "react";
import axios from "axios";
import { BrowserProvider, Contract, type Eip1193Provider } from "ethers";
import { ESCROW_ABI, ESCROW_ADDRESS } from "@/lib/contracts";

type Props = {
    bountyId: string;
    onChainId: number;
    onRefunded?: () => void;
};

export default function BountyRefundButton({ bountyId, onChainId, onRefunded }: Props) {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const confirmedHash = useRef<string | null>(null);
    const storageKey = `pager:refund:${ESCROW_ADDRESS}:${bountyId}`;

    async function refund() {
        setLoading(true);
        setMessage("");

        try {
            let hash = confirmedHash.current;
            try {
                hash ||= localStorage.getItem(storageKey);
            } catch {
                // The current page can still retry with the in-memory hash.
            }

            if (!hash) {
                const ethereum = (window as Window & { ethereum?: Eip1193Provider }).ethereum;
                if (!ethereum) {
                    setMessage("Connect your wallet to request a refund.");
                    return;
                }
                if (await ethereum.request({ method: "eth_chainId" }) !== "0x279f") {
                    await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x279f" }] });
                }
                const provider = new BrowserProvider(ethereum);
                if ((await provider.getNetwork()).chainId !== 10143n) {
                    setMessage("Switch your wallet to Monad Testnet.");
                    return;
                }

                const signer = await provider.getSigner();
                const escrow = new Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);
                const [bounty, block] = await Promise.all([escrow.bounties(onChainId), provider.getBlock("latest")]);
                if (bounty.creator.toLowerCase() !== (await signer.getAddress()).toLowerCase()) {
                    setMessage("Select the wallet that created this bounty.");
                    return;
                }
                if (!bounty.active || !block || BigInt(block.timestamp) <= bounty.deadline) {
                    setMessage(bounty.active && block ? "This bounty has not expired yet." : "A refund is unavailable for this bounty.");
                    return;
                }

                const transaction = await escrow.refundExpired(onChainId);
                const receipt = await transaction.wait();
                if (receipt?.status !== 1) throw new Error("Refund did not confirm");
                hash = receipt.hash;
                confirmedHash.current = hash;
                try {
                    localStorage.setItem(storageKey, receipt.hash);
                } catch {
                    // The current page can still retry with the in-memory hash.
                }
            }

            try {
                await axios.post("/api/bounty/refund", { bountyId, txHash: hash });
            } catch {
                setMessage("Refund confirmed on-chain. Select Refund expired bounty again to retry saving it.");
                return;
            }
            try {
                localStorage.removeItem(storageKey);
            } catch {
                // The database already has the refunded status.
            }
            setMessage("Bounty refunded.");
            onRefunded?.();
        } catch {
            setMessage("Could not complete the refund. Check your wallet and try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="text-right">
            <button
                type="button"
                onClick={refund}
                disabled={loading}
                className="rounded-lg px-3 py-2 text-xs font-semibold text-primary disabled:opacity-50"
            >
                {loading ? "Processing refund…" : "Refund expired bounty"}
            </button>
            {message && <p role="status" className="text-xs text-textMainLight dark:text-textMainDark">{message}</p>}
        </div>
    );
}
