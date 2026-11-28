"use client";

import { useState } from "react";
import axios from "axios";
import GlassModal from "@/components/ui/GlassModal";
import ImageUploader from "@/components/ui/ImageUploader";
import { useUser } from "@/context/UserContext";

type Props = {
    open: boolean;
    bountyId: string | null;
    onClose: () => void;
    onSubmitted?: () => void;
};

export default function HunterSubmissionModal({
    open,
    bountyId,
    onClose,
    onSubmitted,
}: Props) {
    const { user } = useUser();

    const [description, setDescription] = useState("");
    const [imageUrl, setImageUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");

    function dismiss() {
        setDescription("");
        setImageUrl("");
        setError("");
        onClose();
    }

    const submit = async () => {
        setError("");
        if (!user) {
            setError("Connect your wallet to submit proof.");
            return;
        }

        if (!bountyId || !imageUrl || uploading) {
            return;
        }

        try {
            setLoading(true);

            await axios.post("/api/submission/create", {
                walletAddress: user.walletAddress,
                bountyId,
                description: description.trim(),
                mediaUrl: imageUrl,
            });

            onSubmitted?.();
            dismiss();

        } catch {
            setError("Could not send your proof. Try submitting it again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <GlassModal open={open} onClose={loading || uploading ? undefined : dismiss} maxWidth="max-w-md">
            <div role="dialog" aria-modal="true" aria-labelledby="submit-proof-title" className="glass-modal max-h-[90dvh] space-y-4 overflow-y-auto p-6">

                <h2 id="submit-proof-title" className="text-lg font-bold">
                    Submit Proof
                </h2>
                <div>
                    <p className="mb-2 text-sm font-semibold">Add a photo of what you verified</p>
                    <ImageUploader onUpload={setImageUrl} onUploadingChange={setUploading} disabled={loading} />
                </div>

                <label className="block">
                    <span className="mb-2 block text-sm font-semibold">Add a note (optional)</span>
                    <textarea
                        placeholder="Describe what you verified…"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full p-3 rounded-xl bg-white dark:bg-neutralDark border border-borderLight dark:border-borderDark"
                    />
                </label>

                {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
                <button
                    type="button"
                    onClick={submit}
                    disabled={loading || uploading || !imageUrl}
                    className="w-full rounded-xl bg-[#5938c9] py-3 font-semibold text-white transition hover:bg-[#492ba9] disabled:opacity-50"
                >
                    {loading ? "Submitting…" : "Submit proof"}
                </button>
                <button type="button" onClick={dismiss} disabled={loading || uploading} className="w-full text-sm font-semibold disabled:opacity-50">
                    Cancel
                </button>
            </div>
        </GlassModal>
    );
}
