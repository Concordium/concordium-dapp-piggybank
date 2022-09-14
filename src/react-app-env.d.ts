/// <reference types="react-scripts" />

import { WalletApi } from '@concordium/browser-wallet-api-helpers';
import SignClient from "@walletconnect/sign-client";

declare global {
    interface Window {
        concordium: WalletApi | undefined;
        walletConnect: SignClient | undefined;
    }
}
