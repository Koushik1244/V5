"use client";

import { useState, useEffect } from "react";
import BountyFeed from "@/components/BountyFeed";
import BountyModal from "@/components/BountyModal";
import FloatingActionButton from "@/components/FloatingActionButton";

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
    <main
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
      <div className="relative mx-auto max-w-2xl px-4 py-6">
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
        <FloatingActionButton onClick={() => setOpen(true)} />
        <BountyModal open={open} onClose={() => setOpen(false)} />

        <BountyFeed />
      </div>
    </main>
  );
}
