// src\components\BountyFeed.tsx

"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useUser } from "@/context/UserContext";
import BountyCard from "./feed/BountyCard";
import SubmissionCard from "./feed/SubmissionCard";
import HunterSubmissionModal from "./modals/HunterSubmissionModal";

export default function BountyFeed() {
    const { user } = useUser();

    const [bounties, setBounties] = useState<any[]>([]);
    const [submissionsMap, setSubmissionsMap] = useState<Record<string, any[]>>(
        {}
    );
    const [loading, setLoading] = useState(true);

    // Hunter modal
    const [submitBountyId, setSubmitBountyId] = useState<string | null>(null);

    useEffect(() => {
        fetchBounties();
    }, []);

    const fetchSubmissions = async (bountyId: string) => {
        const res = await axios.get(`/api/submission/by-bounty/${bountyId}`);
        return res.data.submissions;
    };

    // Optimized feed loading
    const fetchBounties = async () => {
        setLoading(true);

        try {
            const res = await axios.get("/api/bounty/all");
            const bountiesData = res.data.bounties;

            setBounties(bountiesData);

            // Fetch all submissions in parallel
            const results = await Promise.all(
                bountiesData.map(async (bounty: any) => {
                    const subs = await fetchSubmissions(bounty._id);
                    return { id: bounty._id, subs };
                })
            );

            const map: Record<string, any[]> = {};
            results.forEach((r) => {
                map[r.id] = r.subs;
            });

            setSubmissionsMap(map);
        } catch (err) {
            console.error("Feed load failed:", err);
        }

        setLoading(false);
    };

    if (loading) {
        return (
            <p className="text-center mt-6 text-textMainLight dark:text-textMainDark">
                Loading feed...
            </p>
        );
    }

    if (bounties.length === 0) {
        return (
            <p className="text-center mt-6 text-textMainLight dark:text-textMainDark">
                No bounties yet
            </p>
        );
    }

    const previews = bounties.filter(bounty => bounty.status === "open").slice(0, 3);

    return (
        <div className="max-w-xl mx-auto mt-6 space-y-6">
            {previews.length > 0 && (
                <section aria-labelledby="open-bounty-previews">
                    <h2 id="open-bounty-previews" className="mb-3 text-xl font-semibold">Open bounties</h2>
                    <ul className="grid list-none gap-3 sm:grid-cols-3">
                        {previews.map(bounty => (
                            <li key={bounty._id}>
                                <a
                                    href={`#bounty-${bounty._id}`}
                                    className="block h-full rounded-xl border border-primary/20 bg-cardLight p-4 hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary dark:bg-cardDark"
                                >
                                    <p className="line-clamp-2 font-medium">{bounty.description}</p>
                                    <p className="mt-2 text-sm font-semibold text-[#5938c9] dark:text-[#b8a7ff]">
                                        {bounty.reward} USDC
                                    </p>
                                </a>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
            {bounties.map((bounty) => (
                <div key={bounty._id} id={`bounty-${bounty._id}`} className="scroll-mt-24 space-y-3">
                    {/* Bounty */}
                    <BountyCard
                        bounty={bounty}
                        onRefunded={fetchBounties}
                        onAccept={(id: string) => {
                            if (!user) {
                                alert("Connect wallet first");
                                return;
                            }
                            setSubmitBountyId(id);
                        }}
                    />

                    {/* Submissions */}
                    {submissionsMap[bounty._id]?.map((sub: any) => (
                        <SubmissionCard
                            key={sub._id}
                            submission={sub}
                            bounty={bounty}
                            onApproved={fetchBounties}
                        />
                    ))}
                </div>
            ))}

            {/* Hunter Submission Modal */}
            <HunterSubmissionModal
                open={!!submitBountyId}
                bountyId={submitBountyId}
                onClose={() => setSubmitBountyId(null)}
                onSubmitted={fetchBounties}
            />
        </div>
    );
}
