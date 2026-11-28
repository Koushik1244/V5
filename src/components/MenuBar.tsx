"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import ConnectWallet from "@/components/ConnectWallet";

const navItems = [
    { href: "/", label: "Home" },
    { href: "/search", label: "Search" },
    { href: "/map", label: "Map" },
    { href: "/profile", label: "Profile" },
];

export default function MenuBar() {
    const pathname = usePathname();
    const router = useRouter();

    const [isDark, setIsDark] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [visible, setVisible] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0); // ✅ NEW

    const isMapPage = pathname === "/map";

    // Theme init
    useEffect(() => {
        const stored = localStorage.getItem("theme");

        if (stored === "dark") {
            document.documentElement.classList.add("dark");
            setIsDark(true);
        } else {
            document.documentElement.classList.remove("dark");
            setIsDark(false);
        }

        setMounted(true);
    }, []);

    // ✅ NEW: Scroll hide/show (all pages)
    useEffect(() => {
        const handleScroll = () => {
            const currentY = window.scrollY;

            // Scroll down → hide
            if (currentY > lastScrollY && currentY > 80) {
                setVisible(false);
            } else {
                // Scroll up → show
                setVisible(true);
            }

            setLastScrollY(currentY);
        };

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, [lastScrollY]);

    // ✅ UPDATED: Map page special behavior
    useEffect(() => {
        if (!isMapPage) return;

        setVisible(false); // hidden by default

        const handleMouseMove = (e: MouseEvent) => {
            if (e.clientY < 80) {
                setVisible(true);
            } else if (window.scrollY === 0) {
                setVisible(false);
            }
        };

        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, [isMapPage]);

    if (!mounted) return null;

    return (
        <header
            className={`
        sticky top-0 z-[1000]  // ✅ CHANGED: sticky NOT fixed
        transition-transform duration-300 ease-out
        ${visible ? "translate-y-0" : "translate-y-0 md:-translate-y-full"}
        bg-white/90 dark:bg-[#1a1530]/95
        backdrop-blur-md
        border-b border-borderLight/50 dark:border-borderDark/50
        px-3 py-2 md:px-6 md:py-4 lg:px-20
      `}
        >
            <div className="max-w-[1200px] max-h-[50px] mx-auto flex items-center justify-between">
                {/* Logo */}
                <button
                    type="button"
                    onClick={() => router.push("/")}
                    className="flex items-center hover:scale-105 transition-transform duration-200"
                >
                    <div className="relative h-12 w-20 md:size-32">
                        <Image
                            src="/pager-logo.svg"
                            alt="Pager logo"
                            fill
                            sizes="40px"
                            className="object-contain"
                            priority
                        />
                    </div>
                </button>

                {/* Nav */}
                <nav aria-label="Main navigation" className="hidden items-center gap-4 md:flex lg:gap-8">
                    {navItems.map((item) => {
                        const isActive =
                            item.href === "/"
                                ? pathname === "/"
                                : pathname.startsWith(item.href);

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`group relative px-1 py-1 text-md font-semibold transition-colors ${isActive
                                        ? "text-primary"
                                        : "text-gray-500 dark:text-gray-400 hover:text-primary"
                                    }`}
                            >
                                {item.label}

                                <span
                                    className={`absolute -bottom-1 left-1/2 -translate-x-1/2 h-0.5 rounded-full transition-all duration-300 ${isActive
                                            ? "w-8 bg-primary shadow-glow"
                                            : "w-0 group-hover:w-6 group-hover:bg-primary/70"
                                        }`}
                                />
                            </Link>
                        );
                    })}
                    <Link href="/?create=1" className="rounded-md bg-[#5938c9] px-3 py-2 text-sm font-semibold text-white">
                        Create
                    </Link>
                </nav>

                {/* Right */}
                <div className="flex items-center gap-3">
                    <ConnectWallet
                        showLoginText={false}
                        showUserName={true}
                        showLogoutButton={false}
                        showAvatarDropdown={true}
                    />
                </div>
            </div>
            <nav aria-label="Mobile navigation" className="mt-2 grid grid-cols-5 gap-1 md:hidden">
                {navItems.map(item => (
                    <Link
                        key={item.href}
                        href={item.href}
                        aria-current={pathname === item.href ? "page" : undefined}
                        className="rounded-md px-1 py-2 text-center text-sm font-medium aria-[current=page]:bg-primary/15"
                    >
                        {item.href === "/" ? "Feed" : item.label}
                    </Link>
                ))}
                <Link href="/?create=1" className="rounded-md bg-[#5938c9] px-1 py-2 text-center text-sm font-semibold text-white">
                    Create
                </Link>
            </nav>
        </header>
    );
}
