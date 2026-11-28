"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { useUser, type InjectedWallet } from "@/context/UserContext";

import CreateUsernameModal from "@/components/modals/CreateUsernameModal";
import NotificationModal from "@/components/modals/NotificationModal";

type ConnectWalletProps = {
    showLoginText?: boolean;
    showUserName?: boolean;
    showLogoutButton?: boolean;
    showAvatarDropdown?: boolean;
};

export default function ConnectWallet({
    showLoginText = true,
    showUserName = true,
    showLogoutButton = true,
    showAvatarDropdown = false,
}: ConnectWalletProps) {
    const { user, setUser, wallets, setWalletProvider } = useUser();

    const [username, setUsername] = useState("");
    const [loading, setLoading] = useState(false);
    const [showWallets, setShowWallets] = useState(false);
    const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
    const [isDark, setIsDark] = useState(false);

    // Modal controls
    const [showUsernameModal, setShowUsernameModal] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);

    // Theme init
    useEffect(() => {
        if (typeof window === "undefined") return;
        setIsDark(document.documentElement.classList.contains("dark"));
    }, []);

    // Lock body scroll when any modal open
    useEffect(() => {
        if (showUsernameModal || showNotifications) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "auto";
        }
    }, [showUsernameModal, showNotifications]);

    // ---------------------------
    // Wallet Connection
    // ---------------------------
    const connectWallet = async (wallet: InjectedWallet) => {
        try {
            setLoading(true);

            const accounts = await wallet.provider.request({ method: "eth_requestAccounts" }) as string[];
            const address = accounts[0];
            if (!address) return;

            const res = await axios.post("/api/user/connect", {
                walletAddress: address,
            });

            const userData = res.data.user;
            setWalletProvider(wallet.provider);
            setUser({ ...userData, walletKey: wallet.info.rdns });
            setShowWallets(false);

            setUsername("");
            setShowUsernameModal(!userData.username);
        } catch (err) {
            console.error(err);
            alert("Wallet connection failed");
        } finally {
            setLoading(false);
        }
    };

    function openWalletConnection() {
        if (wallets.length === 0) {
            alert("Install a browser wallet to connect.");
        } else if (wallets.length === 1) {
            void connectWallet(wallets[0]);
        } else {
            setShowWallets(previous => !previous);
        }
    }

    // ---------------------------
    // Username Save
    // ---------------------------
    const saveUsername = async () => {
        if (!user || !username.trim()) return;

        try {
            const res = await axios.post("/api/user/set-username", {
                walletAddress: user.walletAddress,
                username,
            });

            setUser({ ...res.data.user, walletKey: user.walletKey });
            setShowUsernameModal(false);
            setUsername("");
        } catch (err) {
            console.error(err);
            alert("Failed to save username");
        }
    };

    // ---------------------------
    // Logout
    // ---------------------------
    const logout = () => {
        setUser(null);
        setIsAvatarMenuOpen(false);
    };

    // ---------------------------
    // Theme Toggle
    // ---------------------------
    const toggleTheme = () => {
        const html = document.documentElement;

        if (isDark) {
            html.classList.remove("dark");
            localStorage.setItem("theme", "light");
            setIsDark(false);
        } else {
            html.classList.add("dark");
            localStorage.setItem("theme", "dark");
            setIsDark(true);
        }
    };

    const openNotifications = () => {
        setShowNotifications(true);
        setIsAvatarMenuOpen(false);
    };

    // ---------------------------
    // UI Helpers
    // ---------------------------
    const displayName =
        user?.username ||
        (user?.walletAddress
            ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`
            : "");

    const hasInlineContent =
        showLoginText || showUserName || showLogoutButton;

    // ===========================
    // RENDER
    // ===========================
    return (
        <>
            {/* ----------------- Modals ----------------- */}

            <CreateUsernameModal
                open={Boolean(user && showUsernameModal)}
                username={username}
                setUsername={setUsername}
                onSave={saveUsername}
            />

            <NotificationModal
                open={showNotifications}
                onClose={() => setShowNotifications(false)}
            />

            {/* ----------------- Main ----------------- */}
            <div className="p-4 flex mt-1">
                {/* Connect Button */}
                {!user && (
                    <button
                        onClick={openWalletConnection}
                        disabled={loading}
                        className="bg-black dark:bg-neutralDark text-white px-4 py-2 rounded-full text-sm font-semibold hover:scale-105 transition-all duration-200"
                    >
                        {loading ? "Connecting..." : "Connect Wallet"}
                    </button>
                )}
                {!user && showWallets && (
                    <ul className="ml-2 rounded-lg border border-primary/30 bg-cardLight p-1 dark:bg-cardDark">
                        {wallets.map(wallet => (
                            <li key={wallet.info.uuid}>
                                <button
                                    type="button"
                                    onClick={() => void connectWallet(wallet)}
                                    disabled={loading}
                                    className="w-full rounded px-3 py-2 text-left text-sm hover:bg-primary/10"
                                >
                                    {wallet.info.name}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}

                {/* Logged user info */}
                {user && hasInlineContent && (
                    <div className="flex items-center justify-between mb-4 gap-3">
                        <div className="flex items-center gap-1">
                            {showLoginText && (
                                <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">
                                    Logged in as:
                                </span>
                            )}

                            {showUserName && (
                                <span className="text-md font-semibold mt-2 mr-3 text-textMainLight dark:text-textMainDark">
                                    {displayName}
                                </span>
                            )}
                        </div>

                        {showLogoutButton && (
                            <button
                                onClick={logout}
                                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-sm active:scale-95 transition-all duration-150"
                            >
                                Logout
                            </button>
                        )}
                    </div>
                )}

                {/* Avatar Dropdown */}
                {user && showAvatarDropdown && (
                    <div className="relative inline-block">
                        <button
                            type="button"
                            onClick={() =>
                                setIsAvatarMenuOpen((prev) => !prev)
                            }
                            className="group"
                        >
                            <div className="size-10 rounded-full border-2 border-primary/40 shadow-sm group-hover:scale-105 transition-all duration-300" ><img
                                src={`https://i.pravatar.cc/150?u=${user.username}`}
                                className="w-96 rounded-full border-2 border-primary shadow-glow object-cover" /></div>
                        </button>

                        {isAvatarMenuOpen && (
                            <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-white dark:bg-cardDark border border-borderLight/60 dark:border-borderDark/70 shadow-2xl py-3 z-50">
                                <div className="px-3 pb-3 border-b border-borderLight/60 dark:border-borderDark/70">
                                    <p className="text-[10px] uppercase tracking-wide text-gray-400">
                                        Logged in as
                                    </p>
                                    <p className="text-sm font-semibold text-textMainLight dark:text-textMainDark truncate">
                                        {displayName}
                                    </p>
                                </div>

                                <button
                                    onClick={toggleTheme}
                                    className="flex items-center justify-between w-full px-3 py-2 hover:bg-primary/10 dark:hover:bg-primary/20 text-sm font-semibold"
                                >
                                    <span>Theme</span>
                                    <div className="relative inline-flex items-center h-5 w-10 rounded-full bg-gray-200 dark:bg-gray-700">
                                        <span
                                            className={`inline-block w-4 h-4 bg-white rounded-full transform transition-transform duration-300 ${isDark
                                                ? "translate-x-5"
                                                : "translate-x-1"
                                                }`}
                                        />
                                    </div>
                                </button>

                                <button
                                    onClick={openNotifications}
                                    className="w-full text-left px-3 py-2 hover:bg-primary/10 dark:hover:bg-primary/20 text-sm font-semibold"
                                >
                                    Notifications
                                </button>

                                <button
                                    onClick={logout}
                                    className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 font-semibold"
                                >
                                    Logout
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}
