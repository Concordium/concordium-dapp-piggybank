import { Alert, Button } from 'react-bootstrap';
import { WalletConnectConnection, WalletConnectConnector, WalletConnection } from '@concordium/react-components';
import { useEffect, useState } from 'react';
import { PING_INTERVAL_MS } from './config';

interface Props {
    connector: WalletConnectConnector;
    connection: WalletConnection | undefined;
    connectedAccount: string | undefined;
    setActiveConnection: (c: WalletConnection | undefined) => void;
}

export default function WalletConnect2(props: Props) {
    const { connector, connection, connectedAccount, setActiveConnection } = props;
    const [connectionError, setConnectionError] = useState('');
    const [pingError, setPingError] = useState('');

    const connectedSession = connection instanceof WalletConnectConnection && connection.session;

    // Ping Wallet Connect periodically.
    useEffect(() => {
        if (connector && connectedSession) {
            console.log('setting up ping loop');
            const interval = setInterval(() => {
                // console.debug("attempting to ping");
                connector.client
                    .ping({ topic: connectedSession.topic })
                    .then(() => console.debug('ping successful'))
                    .catch((e) => setPingError((e as Error).message));
            }, PING_INTERVAL_MS);
            return () => {
                console.debug('tearing down ping loop');
                clearInterval(interval);
            };
        }
        return undefined;
    }, [connector, connectedSession]);

    return (
        <>
            {connectionError && <Alert variant="danger">Connection error: {connectionError}</Alert>}
            {pingError && <Alert variant="danger">Ping error: {pingError}</Alert>}
            {connectedAccount && (
                <Alert variant="success">
                    <p>
                        Connected to account <code>{connectedAccount}</code>.
                    </p>
                    <p>
                        The wallet currently only exposes the &quot;most recently selected&quot; connected account, even
                        if more than one is actually connected. Select and disconnect accounts through the wallet.
                    </p>
                </Alert>
            )}
            {!connectedSession && (
                <Button
                    onClick={() =>
                        connector
                            .connect()
                            .then(setActiveConnection)
                            .catch((e) => setConnectionError((e as Error).message))
                    }
                >
                    Connect
                </Button>
            )}
            {connectedSession && (
                <>
                    <Alert variant="success">
                        Connected:
                        <ul>
                            <li>Topic: {connectedSession.topic}</li>
                            <li>Relay protocol: {connectedSession.relay.protocol}</li>
                            <li>Relay data: {connectedSession.relay.data}</li>
                            <li>Expiry: {connectedSession.expiry}</li>
                            <li>Acknowledged: {connectedSession.acknowledged}</li>
                            <li>Controller: {connectedSession.controller}</li>
                            <li>
                                Namespaces:
                                <ul>
                                    {connectedSession.namespaces &&
                                        Object.entries(connectedSession.namespaces).map(([key, ns]) => (
                                            <li key={key}>
                                                Key: {key}
                                                Accounts: {ns.accounts.join(', ')}
                                                Methods: {ns.methods.join(', ')}
                                                Events: {ns.events.join(', ')}
                                                Extension: {JSON.stringify(ns.extension)}
                                            </li>
                                        ))}
                                </ul>
                            </li>
                            <li>
                                Required namespaces:
                                <ul>
                                    {connectedSession.requiredNamespaces &&
                                        Object.entries(connectedSession.requiredNamespaces).map(([key, ns]) => (
                                            <li key={key}>
                                                Key: {key}
                                                Chains: {ns.chains.join(', ')}
                                                Methods: {ns.methods.join(', ')}
                                                Events: {ns.events.join(', ')}
                                                Extension: {JSON.stringify(ns.extension)}
                                            </li>
                                        ))}
                                </ul>
                            </li>
                            <li>Self public key: {connectedSession.self.publicKey}</li>
                            <li>Self metadata name: {connectedSession.self.metadata.name}</li>
                            <li>Self metadata url: {connectedSession.self.metadata.url}</li>
                            <li>Self metadata icons: {connectedSession.self.metadata.icons.join(', ')}</li>
                            <li>Self metadata description: {connectedSession.self.metadata.description}</li>
                            <li>Peer public key: {connectedSession.peer.publicKey}</li>
                            <li>Peer metadata name: {connectedSession.peer.metadata.name}</li>
                            <li>Peer metadata url: {connectedSession.peer.metadata.url}</li>
                            <li>Peer metadata icons: {connectedSession.peer.metadata.icons.join(', ')}</li>
                            <li>Peer metadata description: {connectedSession.peer.metadata.description}</li>
                        </ul>
                    </Alert>
                    <Button onClick={() => connection?.disconnect().catch(setConnectionError)}>Disconnect</Button>
                </>
            )}
        </>
    );
}
