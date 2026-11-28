"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { HiOutlineCamera, HiOutlineMapPin, HiOutlineCheckCircle } from "react-icons/hi2";
import BountyFeed from "@/components/BountyFeed";
import BountyModal from "@/components/BountyModal";
import FloatingActionButton from "@/components/FloatingActionButton";

const bountySteps = [
  { icon: HiOutlineMapPin, title: "Post a bounty", detail: "Pin a place and say what you want checked." },
  { icon: HiOutlineCamera, title: "Get local proof", detail: "Someone nearby visits and submits a photo." },
  { icon: HiOutlineCheckCircle, title: "Approve and pay", detail: "Choose the proof that answers your request." },
];

export default function Home() {
  const [open, setOpen] = useState(false);
  const [bgImage, setBgImage] = useState("/light-mode.png");

  // Detect theme and switch wallpaper
  useEffect(() => {
    const updateTheme = () => {
      const isDark = document.documentElement.classList.contains("dark");
      setBgImage(isDark ? "/dark-mode.png" : "/light-mode.png");
    };

    updateTheme();

    // Observe theme changes
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="relative min-h-screen"
      style={{
        backgroundImage: `url(${bgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      {/* Overlay for readability */}
      <div className="absolute inset-0 bg-white/60 dark:bg-backgroundDark/80" />

      {/* Content */}
      <main className="relative mx-auto max-w-2xl px-4 py-6">
        <section className="rounded-2xl border border-primary/15 bg-cardLight/95 px-6 py-10 dark:bg-cardDark/95 sm:px-10 sm:py-14">
          <h1 className="max-w-sm text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
            Get answers from people nearby
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-textMainLight dark:text-textMainDark">
            Post a bounty for a place you want checked. Someone nearby can send photo proof, and you choose which submission earns the reward.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-6 rounded-lg bg-[#5938c9] px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-[#492ba9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#5938c9]"
          >
            Post a bounty
          </button>
        </section>
        <section aria-labelledby="how-pager-works" className="mt-4 rounded-2xl border border-primary/15 bg-cardLight/95 px-6 py-7 dark:bg-cardDark/95 sm:px-8">
          <h2 id="how-pager-works" className="text-xl font-semibold">How Pager works</h2>
          <ol className="mt-4 grid list-none gap-4 sm:grid-cols-3">
            {bountySteps.map(({ icon: Icon, title, detail }) => (
              <li key={title} className="flex gap-3 sm:flex-col">
                <Icon aria-hidden="true" className="size-6 shrink-0 text-[#5938c9] dark:text-[#b8a7ff]" />
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1 text-base leading-snug">{detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <FloatingActionButton onClick={() => setOpen(true)} />
        <BountyModal open={open} onClose={() => setOpen(false)} />

        <div id="bounty-feed" className="scroll-mt-24">
          <BountyFeed />
        </div>
      </main>
      <footer className="relative border-t border-primary/15 bg-cardLight/95 dark:bg-cardDark/95">
        <div className="mx-auto max-w-2xl px-6 pb-24 pt-6 sm:pb-8">
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
            <a href="#bounty-feed" className="hover:underline">Feed</a>
            <Link href="/map" className="hover:underline">Map</Link>
            <Link href="/search" className="hover:underline">Search</Link>
            <Link href="/profile" className="hover:underline">Profile</Link>
          </nav>
          <p className="mt-3 text-sm leading-relaxed">
            Pager runs on Monad Testnet. Bounties use testnet USDC with no monetary value.
          </p>
        </div>
      </footer>
    </div>
  );
}
