// src\components\CreateBounty.tsx

"use client";

import { useState } from "react";
import axios from "axios";
import { useUser } from "@/context/UserContext";
import { BOUNTY_DURATIONS, DEFAULT_BOUNTY_DURATION, lockBountyFunds, validateBountyFields, type BountyFieldErrors } from "@/lib/bountyCreation";
import { MonadWalletNetworkError } from "@/lib/monadWallet";

export default function CreateBounty() {
    const { user, walletProvider } = useUser();
    const [description, setDescription] = useState("");
    const [reward, setReward] = useState("");
    const [duration, setDuration] = useState(DEFAULT_BOUNTY_DURATION);
    const [lat, setLat] = useState("");
    const [lng, setLng] = useState("");
    const [address, setAddress] = useState("");
    const [loading, setLoading] = useState(false);
    const [formError, setFormError] = useState("");
    const [fieldErrors, setFieldErrors] = useState<BountyFieldErrors>({});

    const createBounty = async () => {
        setFormError("");
        const { amount, errors, units } = validateBountyFields(description, reward, lat.trim() ? Number(lat) : null, lng.trim() ? Number(lng) : null);
        setFieldErrors(errors);
        if (Object.keys(errors).length > 0 || units === null) return;
        if (!user || !walletProvider) {
            setFormError("Connect your wallet before posting.");
            return;
        }

        let locked = false;
        try {
            setLoading(true);

            const onChainId = await lockBountyFunds(walletProvider, units, duration, user.walletAddress);
            locked = true;
            if (onChainId === null) {
                setFormError("Funds were locked, but the bounty ID could not be read.");
                return;
            }

            await axios.post("/api/bounty/create", {
                walletAddress: user.walletAddress,
                description: description.trim(),
                reward: amount,
                lat: Number(lat),
                lng: Number(lng),
                address,
                mediaUrl: "",
                onChainId,
            });

            alert("Bounty created & funds locked!");

            setDescription("");
            setReward("");
            setDuration(DEFAULT_BOUNTY_DURATION);
            setLat("");
            setLng("");
            setAddress("");

        } catch (err) {
            if (err instanceof MonadWalletNetworkError) {
                setFormError(err.message);
                return;
            }
            console.error(err);
            setFormError(locked ? "Funds were locked, but the bounty could not be saved." : "Could not post the bounty. Check your wallet and try again.");
        } finally {
            setLoading(false);
        }
    };

    return (

        <div className="max-w-xl mx-auto mt-8 bg-white shadow-md rounded-2xl p-6 border">
            <h2 className="text-xl font-semibold mb-4">Create a Bounty</h2>

            <textarea
                placeholder="Ask what's happening at a location..."
                aria-label="Bounty description"
                aria-invalid={Boolean(fieldErrors.description)}
                aria-describedby={fieldErrors.description ? "create-bounty-description-error" : undefined}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border rounded-lg p-3 mb-3 focus:outline-none focus:ring-2 focus:ring-black"
                rows={3}
            />
            {fieldErrors.description && <p id="create-bounty-description-error" role="alert" className="mb-3 text-sm text-red-700">{fieldErrors.description}</p>}

            <div className="grid grid-cols-2 gap-3 mb-3">
                <input
                    type="number"
                    min="0.000001"
                    step="0.000001"
                    placeholder="Reward (USDC)"
                    aria-label="Reward in USDC"
                    aria-invalid={Boolean(fieldErrors.reward)}
                    aria-describedby={fieldErrors.reward ? "create-bounty-reward-error" : undefined}
                    value={reward}
                    onChange={(e) => setReward(e.target.value)}
                    className="border rounded-lg p-2"
                />

                <input
                    placeholder="Address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="border rounded-lg p-2"
                />
            </div>
            {fieldErrors.reward && <p id="create-bounty-reward-error" role="alert" className="mb-3 text-sm text-red-700">{fieldErrors.reward}</p>}

            <label className="block mb-3 text-sm font-medium">
                <span>Expires after</span>
                <select
                    value={duration}
                    onChange={(event) => setDuration(Number(event.target.value))}
                    disabled={loading}
                    className="mt-1 w-full border rounded-lg p-2"
                >
                    {BOUNTY_DURATIONS.map(({ label, seconds }) => (
                        <option key={seconds} value={seconds}>{label}</option>
                    ))}
                </select>
            </label>

            <div className="grid grid-cols-2 gap-3 mb-4">
                <input
                    placeholder="Latitude"
                    aria-label="Latitude"
                    aria-invalid={Boolean(fieldErrors.location)}
                    aria-describedby={fieldErrors.location ? "create-bounty-location-error" : undefined}
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    className="border rounded-lg p-2"
                />

                <input
                    placeholder="Longitude"
                    aria-label="Longitude"
                    aria-invalid={Boolean(fieldErrors.location)}
                    aria-describedby={fieldErrors.location ? "create-bounty-location-error" : undefined}
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    className="border rounded-lg p-2"
                />
            </div>
            {fieldErrors.location && <p id="create-bounty-location-error" role="alert" className="mb-3 text-sm text-red-700">{fieldErrors.location}</p>}

            {formError && <p role="alert" className="mb-2 text-sm text-red-700 dark:text-red-300">{formError}</p>}
            <button
                onClick={createBounty}
                disabled={loading}
                className="w-full bg-black text-white py-2 rounded-lg hover:opacity-90 transition"
            >
                {loading ? "Posting..." : "Post Bounty"}
            </button>
        </div>
    );
}
