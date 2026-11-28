// src\context\UserContext.tsx

"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { Eip1193Provider } from "ethers";

type WalletProvider = Eip1193Provider & {
    on?: (event: "accountsChanged", listener: (accounts: string[]) => void) => void;
    removeListener?: (event: "accountsChanged", listener: (accounts: string[]) => void) => void;
};

export type InjectedWallet = {
    info: { uuid: string; name: string; rdns: string };
    provider: WalletProvider;
};

type UserType = {
    walletAddress: string;
    username: string;
    _id: string;
    walletKey?: string;
} | null;

type UserContextType = {
    user: UserType;
    setUser: (user: UserType) => void;
    wallets: InjectedWallet[];
    walletProvider: WalletProvider | null;
    setWalletProvider: (provider: WalletProvider) => void;
};

const UserContext = createContext<UserContextType>({
    user: null,
    setUser: () => { },
    wallets: [],
    walletProvider: null,
    setWalletProvider: () => { },
});

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<UserType>(null);
    const [wallets, setWallets] = useState<InjectedWallet[]>([]);
    const [walletProvider, setWalletProvider] = useState<WalletProvider | null>(null);

    useEffect(() => {
        const storedUser = localStorage.getItem("pagerUser");
        if (storedUser) setUser(JSON.parse(storedUser));

        function announce(event: Event) {
            const detail = (event as CustomEvent<InjectedWallet>).detail;
            if (!detail?.info?.uuid || typeof detail.provider?.request !== "function") return;
            setWallets(previous => [
                ...previous.filter(wallet => wallet.info.uuid !== detail.info.uuid && wallet.info.uuid !== "legacy"),
                detail,
            ]);
        }

        const ethereum = (window as Window & { ethereum?: WalletProvider }).ethereum;
        if (typeof ethereum?.request === "function") {
            setWallets([{ info: { uuid: "legacy", name: "Browser wallet", rdns: "legacy" }, provider: ethereum }]);
        }
        window.addEventListener("eip6963:announceProvider", announce);
        window.dispatchEvent(new Event("eip6963:requestProvider"));
        return () => window.removeEventListener("eip6963:announceProvider", announce);
    }, []);

    const clearUser = useCallback(() => {
        localStorage.removeItem("pagerUser");
        setUser(null);
        setWalletProvider(null);
    }, []);

    useEffect(() => {
        if (user) localStorage.setItem("pagerUser", JSON.stringify(user));
    }, [user]);

    useEffect(() => {
        if (!user || walletProvider || wallets.length === 0) return;
        let cancelled = false;
        const candidates = wallets.filter(wallet =>
            !user.walletKey || user.walletKey === "legacy" || wallet.info.rdns === user.walletKey
        );
        void Promise.all(candidates.map(async wallet => {
            try {
                const accounts = await wallet.provider.request({ method: "eth_accounts" }) as string[];
                return accounts[0]?.toLowerCase() === user.walletAddress.toLowerCase() ? wallet.provider : null;
            } catch {
                return null;
            }
        })).then(providers => {
            if (cancelled) return;
            const matching = providers.filter(provider => provider !== null);
            if (matching.length === 1) setWalletProvider(matching[0]);
            else clearUser();
        });
        return () => { cancelled = true; };
    }, [user, wallets, walletProvider, clearUser]);

    useEffect(() => {
        if (!user || !walletProvider) return;
        let active = true;

        function accountsChanged(accounts: string[]) {
            if (active && accounts[0]?.toLowerCase() !== user?.walletAddress.toLowerCase()) clearUser();
        }
        walletProvider.on?.("accountsChanged", accountsChanged);
        void walletProvider.request({ method: "eth_accounts" })
            .then(accounts => accountsChanged(accounts as string[]), () => accountsChanged([]));
        return () => {
            active = false;
            walletProvider.removeListener?.("accountsChanged", accountsChanged);
        };
    }, [user, walletProvider, clearUser]);

    function setSessionUser(nextUser: UserType) {
        if (nextUser) setUser(nextUser);
        else clearUser();
    }

    return (
        <UserContext.Provider value={{ user, setUser: setSessionUser, wallets, walletProvider, setWalletProvider }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => useContext(UserContext);
