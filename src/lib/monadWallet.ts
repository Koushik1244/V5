import { BrowserProvider, type Eip1193Provider } from "ethers";

const MONAD_TESTNET_CHAIN_ID = "0x279f";

export async function connectMonadWallet(ethereum: Eip1193Provider) {
    const switchChain = () => ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: MONAD_TESTNET_CHAIN_ID }],
    });

    if (await ethereum.request({ method: "eth_chainId" }) !== MONAD_TESTNET_CHAIN_ID) {
        try {
            await switchChain();
        } catch (error) {
            if (typeof error !== "object" || error === null || !("code" in error) || error.code !== 4902) {
                throw error;
            }

            await ethereum.request({
                method: "wallet_addEthereumChain",
                params: [{
                    chainId: MONAD_TESTNET_CHAIN_ID,
                    chainName: "Monad Testnet",
                    rpcUrls: ["https://testnet-rpc.monad.xyz"],
                    nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
                    blockExplorerUrls: ["https://explorer.monad.xyz"],
                }],
            });
            if (await ethereum.request({ method: "eth_chainId" }) !== MONAD_TESTNET_CHAIN_ID) {
                await switchChain();
            }
        }
    }

    const provider = new BrowserProvider(ethereum);
    if ((await provider.getNetwork()).chainId !== BigInt(MONAD_TESTNET_CHAIN_ID)) {
        throw new Error("Please switch to Monad Testnet");
    }
    return provider;
}
