/* eslint-disable no-console */
import React, { useEffect, useState } from 'react';
import SignClient from '@walletconnect/sign-client';

async function initClient(setClient: (client: SignClient) => void, onSessionUpdate) {
    const client = await SignClient.init({
        projectId: '76324905a70fe5c388bab46d3e0564dc',
        metadata: {
            name: 'Example Dapp',
            description: 'Example Dapp',
            url: '#',
            icons: ['https://walletconnect.com/walletconnect-logo.png'],
        },
    });
    setClient(client);

    client.on('session_event', ({ event }) => {
        console.debug('session_event', { event });
        // Handle session events, such as "chainChanged", "accountsChanged", etc.
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
        console.debug('session_delete');
        // Session was deleted -> reset the dapp state, clean up from user session, etc.
    });
}

/**
 * Connect to wallet, setup application state context, and render children when the wallet API is ready for use.
 */
export default function Root() {
    const [client, setClient] = useState<SignClient>();
    // const [isConnected, setIsConnected] = useState<boolean>(false);
    // const [isVersion0, setIsVersion0] = useState<boolean>(false);

    // const handleGetAccount = useCallback((accountAddress: string | undefined) => {
    //     setAccount(accountAddress);
    //     setIsConnected(Boolean(accountAddress));
    // }, []);

    // const handleOnClick = useCallback(
    //     () =>
    //         detectConcordiumProvider()
    //             .then((provider) => provider.connect())
    //             .then(handleGetAccount),
    //     []
    // );

    // Initialize Wallet Connect client.
    useEffect(() => {
        initClient(setClient, (a, b, c) => {
            console.debug({ a, b, c });
        });
    }, []);

    // const stateValue: State = useMemo(() => ({ isConnected, account }), [isConnected, account]);

    return (
        <>
            {client && <div>Client initialized!</div>}
            {!client && <div>Client not initialized!</div>}
        </>
        // // Setup a globally accessible state with data from the wallet.
        // <state.Provider value={stateValue}>
        //     <button type="button" onClick={() => setIsVersion0((v) => !v)}>
        //         Switch to {isVersion0 ? 'V1' : 'V0'}
        //     </button>
        //     <main className="piggybank">
        //         <div className={`connection-banner ${isConnected ? 'connected' : ''}`}>
        //             {isConnected && `Connected: ${account}`}
        //             {!isConnected && (
        //                 <>
        //                     <p>No wallet connection</p>
        //                     <button type="button" onClick={handleOnClick}>
        //                         Connect
        //                     </button>
        //                 </>
        //             )}
        //         </div>
        //         <br />
        //         {isVersion0 && <PiggyBankV0 />}
        //         {!isVersion0 && <PiggyBankV1 />}
        //     </main>
        // </state.Provider>
    );
}
