// src\components\CreateBounty.tsx

"use client";

import { useState } from "react";
import axios from "axios";
import { useUser } from "@/context/UserContext";
import { parseUnits, type Eip1193Provider } from "ethers";
import { BOUNTY_DURATIONS, DEFAULT_BOUNTY_DURATION, lockBountyFunds } from "@/lib/bountyCreation";

export default function CreateBounty() {
    const { user } = useUser();
    const [description, setDescription] = useState("");
    const [reward, setReward] = useState("");
    const [duration, setDuration] = useState(DEFAULT_BOUNTY_DURATION);
    const [lat, setLat] = useState("");
    const [lng, setLng] = useState("");
    const [address, setAddress] = useState("");
    const [loading, setLoading] = useState(false);

    const createBounty = async () => {
        if (!user) {
            alert("Connect wallet first");
            return;
        }

        if (!description.trim()) {
            alert("Enter a bounty description");
            return;
        }

        const amount = Number(reward);
        if (!amount || amount <= 0) {
            alert("Enter a valid reward amount");
            return;
        }

        try {
            setLoading(true);

            const ethereum = (window as Window & { ethereum?: Eip1193Provider }).ethereum;
            if (!ethereum) {
                alert("MetaMask not found");
                return;
            }

            const onChainId = await lockBountyFunds(ethereum, parseUnits(amount.toString(), 6), duration);
            if (onChainId === null) {
                alert("Funds were locked, but the bounty ID could not be read. The bounty was not saved.");
                return;
            }

            await axios.post("/api/bounty/create", {
                walletAddress: user.walletAddress,
                description,
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
            console.error(err);
            alert("Transaction failed");
        } finally {
            setLoading(false);
        }
    };

    return (

        <div className="max-w-xl mx-auto mt-8 bg-white shadow-md rounded-2xl p-6 border">
            <h2 className="text-xl font-semibold mb-4">Create a Bounty</h2>

            <textarea
                placeholder="Ask what's happening at a location..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border rounded-lg p-3 mb-3 focus:outline-none focus:ring-2 focus:ring-black"
                rows={3}
            />

            <div className="grid grid-cols-2 gap-3 mb-3">
                <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    placeholder="Reward (USDC)"
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
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    className="border rounded-lg p-2"
                />

                <input
                    placeholder="Longitude"
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    className="border rounded-lg p-2"
                />
            </div>

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
