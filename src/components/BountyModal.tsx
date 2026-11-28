// src\components\BountyModal.tsx

"use client";

import { useEffect, useState } from "react";
import MapPicker from "./ui/MapPicker";
import ImageUploader from "./ui/ImageUploader";
import axios from "axios";
import { useUser } from "@/context/UserContext";
import { BOUNTY_DURATIONS, DEFAULT_BOUNTY_DURATION, lockBountyFunds, validateBountyFields, type BountyFieldErrors } from "@/lib/bountyCreation";
import { MonadWalletNetworkError } from "@/lib/monadWallet";
import { IoImageSharp } from "react-icons/io5";

type Props = {
    open: boolean;
    onClose: () => void;
};

export default function BountyModal({ open, onClose }: Props) {
    const [isVisible, setIsVisible] = useState(false);
    const [lat, setLat] = useState<number | null>(null);
    const [lng, setLng] = useState<number | null>(null);
    const [imageUrl, setImageUrl] = useState("");
    const { user, walletProvider } = useUser();
    const [description, setDescription] = useState("");
    const [reward, setReward] = useState("");
    const [duration, setDuration] = useState(DEFAULT_BOUNTY_DURATION);
    const [loading, setLoading] = useState(false);
    const [formError, setFormError] = useState("");
    const [fieldErrors, setFieldErrors] = useState<BountyFieldErrors>({});


    // Handle mount + scroll lock
    useEffect(() => {
        if (open) {
            setIsVisible(true);
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "auto";
            const timer = setTimeout(() => setIsVisible(false), 250);
            return () => clearTimeout(timer);
        }
    }, [open]);

    if (!isVisible) return null;

    const handleLocation = (lat: number, lng: number) => {
        setLat(lat);
        setLng(lng);
    };

    const createBounty = async () => {
        setFormError("");
        const { amount, errors, units } = validateBountyFields(description, reward, lat, lng);
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

            // Save in Mongo
            await axios.post("/api/bounty/create", {
                walletAddress: user.walletAddress,
                description: description.trim(),
                reward: amount,
                lat,
                lng,
                mediaUrl: imageUrl,
                onChainId,
            });

            alert("Bounty created!");

            // Reset
            setDescription("");
            setReward("");
            setDuration(DEFAULT_BOUNTY_DURATION);
            setImageUrl("");
            setLat(null);
            setLng(null);

            onClose();
            window.location.reload(); // refresh feed

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
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Overlay */}
            <div
                onClick={onClose}
                className={`
          absolute inset-0
          bg-black/30 dark:bg-black/60
          backdrop-blur-md
          transition-opacity duration-300
          ${open ? "opacity-100" : "opacity-0"}
        `}
            />

            {/* Modal */}
            <div
                className={`
          relative w-[92%] max-w-lg max-h-[90dvh] overflow-y-auto
          rounded-2xl p-6

          /* Glass surface */
          bg-white/90
          dark:bg-cardDark/80
          backdrop-blur-md

          /* Borders */
          border border-primary/20
          dark:border-primary/30

          /* Depth */
          shadow-xl
          dark:shadow-[0_30px_90px_rgba(0,0,0,0.7)]

          /* Purple ambient glow */
          before:absolute before:inset-0 before:rounded-2xl
          before:bg-gradient-to-br before:from-primary/10 before:to-transparent
          before:pointer-events-none

          /* Animation */
          transform transition-all duration-300 ease-out
          ${open ? "scale-100 opacity-100" : "scale-95 opacity-0"}
        `}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-textMainLight dark:text-textMainDark">
                        Create Bounty
                    </h2>

                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-primary transition"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Content */}
                <div className="space-y-4">
                    {/* Description */}
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="What’s happening at this location?"
                        aria-label="Bounty description"
                        aria-invalid={Boolean(fieldErrors.description)}
                        aria-describedby={fieldErrors.description ? "bounty-modal-description-error" : undefined}
                        rows={3}
                        className="
              w-full p-3 rounded-lg
              bg-white dark:bg-neutralDark
              border border-borderLight dark:border-borderDark
              outline-none
              focus:ring-2 focus:ring-primary/40
              transition
            "
                    />
                    {fieldErrors.description && <p id="bounty-modal-description-error" role="alert" className="text-sm text-red-700 dark:text-red-300">{fieldErrors.description}</p>}

                    {/* Reward */}
                    <input
                        type="number"
                        placeholder="Reward (USDC)"
                        min="0.000001"
                        step="0.000001"
                        aria-label="Reward in USDC"
                        aria-invalid={Boolean(fieldErrors.reward)}
                        aria-describedby={fieldErrors.reward ? "bounty-modal-reward-error" : undefined}
                        value={reward}
                        onChange={(e) => setReward(e.target.value)}
                        className="
              w-full p-3 rounded-lg
              bg-white dark:bg-neutralDark
              border border-borderLight dark:border-borderDark
              outline-none
              focus:ring-2 focus:ring-primary/40
            "
                    />
                    {fieldErrors.reward && <p id="bounty-modal-reward-error" role="alert" className="text-sm text-red-700 dark:text-red-300">{fieldErrors.reward}</p>}

                    <label className="block space-y-1 text-sm font-medium">
                        <span>Expires after</span>
                        <select
                            value={duration}
                            onChange={(event) => setDuration(Number(event.target.value))}
                            disabled={loading}
                            className="w-full p-3 rounded-lg bg-white dark:bg-neutralDark border border-borderLight dark:border-borderDark"
                        >
                            {BOUNTY_DURATIONS.map(({ label, seconds }) => (
                                <option key={seconds} value={seconds}>{label}</option>
                            ))}
                        </select>
                    </label>

                    {/* Map Location Picker */}
                    {/* <div className="text-sm text-primary/70 space-y-2"> */}
                    <div className="mb-4" role="group" aria-label="Location" aria-describedby={fieldErrors.location ? "bounty-modal-location-error" : undefined}>
                        <p className="text-sm font-medium text-primary mb-2 flex items-center gap-2">
                            <img src="/pager-icon.png" width={20} />
                            Select Location
                        </p>

                        <MapPicker onLocationSelect={handleLocation} />
                        {fieldErrors.location && <p id="bounty-modal-location-error" role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">{fieldErrors.location}</p>}

                        {lat !== null && lng !== null && (
                            <p className="text-xs text-primary/70 mt-2">
                                Selected: {lat.toFixed(4)}, {lng.toFixed(4)}
                            </p>
                        )}
                    </div>


                    <div>
                        <p className="text-sm font-medium text-primary mb-2 flex items-center gap-2">
                            <IoImageSharp size={16} />
                            Choose Image (optional)
                        </p>

                        <ImageUploader onUpload={(url) => setImageUrl(url)} />
                    </div>

                    {/* </div> */}

                    {/* Submit */}
                    {formError && <p role="alert" className="mb-2 text-sm text-red-700 dark:text-red-300">{formError}</p>}
                    <button
                        onClick={createBounty}
                        disabled={loading}
                        className="
    w-full py-3 rounded-xl
    bg-primary text-white font-semibold
    shadow-glow
    hover:scale-[1.01]
    active:scale-95
    transition-all duration-200
  "
                    >
                        {loading ? "Processing..." : "Lock Funds & Post"}
                    </button>

                </div>
            </div>
        </div>
    );
}
