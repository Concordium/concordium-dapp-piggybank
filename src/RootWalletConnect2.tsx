/* eslint-disable no-console */
import React, { useEffect, useState } from 'react';
import SignClient from '@walletconnect/sign-client';
import QRCodeModal from '@walletconnect/qrcode-modal';

function onSessionConnected(session) {
    console.debug({ session });
}

function onSessionUpdate(updatedSession) {
    console.debug('onSessionUpdate', { updatedSession });
}

function onSessionEvent(event) {
    console.debug('onSessionEvent', { event });
    // Handle session events, such as "chainChanged", "accountsChanged", etc.
}

function onSessionDelete() {
    console.debug('session_delete');
    // Session was deleted -> reset the dapp state, clean up from user session, etc.
}

async function initClient(setClient: (client: SignClient) => void) {
    console.log('Initializing client.');

    const client = await SignClient.init({
        projectId: '76324905a70fe5c388bab46d3e0564dc',
        metadata: {
            name: 'Example Dapp',
            description: 'Example Dapp',
            url: '#',
            icons: ['https://walletconnect.com/walletconnect-logo.png'],
        },
    });

    client.on('session_event', ({ event }) => {
        onSessionEvent(event);
    });

    client.on('session_update', ({ topic, params }) => {
        console.debug('session_update', { topic, params });
        const { namespaces } = params;
        const session = client.session.get(topic);
        // Overwrite the `namespaces` of the existing session with the incoming one.
        const updatedSession = { ...session, namespaces };
        // Integrate the updated session state into your dapp state.
        onSessionUpdate(updatedSession);
    });

    client.on('session_delete', () => {
        onSessionDelete();
    });

    setClient(client);
}

async function connect(client: SignClient) {
    if (!client) {
        return console.error('Cannot connect without a client.');
    }
    console.log('Opening modal for connecting wallet.');
    try {
        const { uri, approval } = await client.connect({
            // Optionally: pass a known prior pairing (e.g. from `client.pairing.values`) to skip the `uri` step.
            //   pairingTopic: client.pairing.values?.topic,
            // Provide the namespaces and chains (e.g. `eip155` for EVM-based chains) we want to use in this session.
            requiredNamespaces: {
                eip155: {
                    methods: [
                        'eth_sendTransaction',
                        'eth_signTransaction',
                        'eth_sign',
                        'personal_sign',
                        'eth_signTypedData',
                    ],
                    chains: ['eip155:1'],
                    events: ['chainChanged', 'accountsChanged'],
                },
            },
        });

        // Open QRCode modal if a URI was returned (i.e. we're not connecting an existing pairing).
        if (uri) {
            QRCodeModal.open(uri, () => {
                console.log('QR Code Modal closed');
            });
        }

        // Await session approval from the wallet.
        const session = await approval();
        // Handle the returned session (e.g. update UI to "connected" state).
        return onSessionConnected(session);
    } finally {
        // Close the QRCode modal in case it was open.
        QRCodeModal.close();
    }
}

/**
 * Connect to wallet, setup application state context, and render children when the wallet API is ready for use.
 */
export default function Root() {
    const [client, setClient] = useState<SignClient>();

    // Initialize Wallet Connect client.
    useEffect(() => {
        // Client cannot have been already initialized here.
        initClient(setClient);
    }, []);

    console.debug('client', client);

    return (
        <div className={`connection-banner ${client ? 'connected' : ''}`}>
            {client && (
                <button type="button" onClick={() => connect(client)}>
                    Connect wallet
                </button>
            )}
            {!client && <div>Client not initialized!</div>}
        </div>
    );
}
