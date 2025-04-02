import SignClient from '@walletconnect/sign-client';
import { WalletConnectModal } from '@walletconnect/modal';

// Initialize WalletConnect SignClient
async function initWalletConnect(projectId) {
    const client = await SignClient.init({
        projectId: projectId,
        metadata: {
            name: 'Lazy Legends',
            description: 'A Chill2Earn game on Hedera',
            url: 'https://lazylegendscoin.com',
            icons: ['https://lazylegendscoin.com/icon.png']
        }
    });
    return client;
}

// Export WalletConnectModal and init function to the global scope
window.WalletConnectModal = WalletConnectModal;
window.initWalletConnect = initWalletConnect;
