/* eslint-disable no-console */
import React, { useEffect, useState } from 'react';
import WalletConnect from '@walletconnect/client';
import QRCodeModal from '@walletconnect/qrcode-modal';

function onConnect(accounts, chainId) {
    console.debug('onConnect', { accounts, chainId });
}

function onSessionUpdate(accounts, chainId) {
    console.debug('onSessionUpdate', { accounts, chainId });
}

function onDisconnect(payload) {
    console.debug('onDisconnect', { payload });
}

async function initConnector(setConnector: (client: WalletConnect) => void) {
    console.log('Initializing connector.');

    const connector = new WalletConnect({
        bridge: 'https://bridge.walletconnect.org', // Required
        qrcodeModal: QRCodeModal,
    });

    // Subscribe to connection events
    connector.on('connect', (error, payload) => {
        if (error) {
            throw error;
        }

        // Get provided accounts and chainId
        const { accounts, chainId } = payload.params[0];
        onConnect(accounts, chainId);
    });

    connector.on('session_update', (error, payload) => {
        if (error) {
            throw error;
        }

        // Get updated accounts and chainId
        const { accounts, chainId } = payload.params[0];
        onSessionUpdate(accounts, chainId);
    });

    connector.on('disconnect', (error, payload) => {
        if (error) {
            throw error;
        }

        // Delete connector
        onDisconnect(payload);
    });

    setConnector(connector);
}

/**
 * Connect to wallet, setup application state context, and render children when the wallet API is ready for use.
 */
export default function Root() {
    const [connector, setConnector] = useState<WalletConnect>();

    // Initialize Wallet Connect client.
    useEffect(() => {
        // Client cannot have been already initialized here.
        initConnector(setConnector);
    }, []);

    console.debug('connector', connector);

    return (
        <div className={`connection-banner ${connector && connector.connected ? 'connected' : ''}`}>
            {!connector && <div>Initializing connector...</div>}
            {connector && !connector.connected && (
                <button type="button" onClick={() => connector.createSession()}>
                    Create session
                </button>
            )}
            {connector && connector.connected && <div>Connector initialized and connected!</div>}
        </div>
    );
}
