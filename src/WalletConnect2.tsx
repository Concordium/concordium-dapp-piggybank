import { Alert, Button } from 'react-bootstrap';
import { WalletConnectConnection, WalletConnection } from '@concordium/react-components';
import { useEffect, useState } from 'react';
import { Result, ResultAsync } from 'neverthrow';
import { PING_INTERVAL_MS } from './config';
import { errorString } from './error';

interface Props {
    connection: WalletConnection | undefined;
}

export default function WalletConnect2({ connection }: Props) {
    // Ping active connection periodically.
    const [pingDurationMs, setPingDurationMs] = useState<Result<number, string>>();
    useEffect(() => {
        if (connection) {
            // Set up ping loop.
            const interval = setInterval(() => {
                const start = Date.now();
                ResultAsync.fromPromise(connection.ping(), errorString)
                    .map(() => Date.now() - start)
                    .then(setPingDurationMs);
            }, PING_INTERVAL_MS);
            return () => {
                // Tear down ping loop.
                setPingDurationMs(undefined);
                clearInterval(interval);
            };
        }
        return undefined;
    }, [connection]);
    const [disconnectError, setDisconnectError] = useState('');
    useEffect(() => {
        setDisconnectError('');
    }, [connection]);
    const connectedSession = connection instanceof WalletConnectConnection && connection.session;
    if (!connection || !connectedSession) {
        return null;
    }
    return (
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
            {pingDurationMs?.match(
                (d) => <div>Ping time: {d} ms</div>,
                (e) => <Alert variant="danger">Ping error: {e}</Alert>
            )}
            {disconnectError && <Alert variant="danger">Disconnect error: {disconnectError}</Alert>}
            <Button
                onClick={() =>
                    connection.disconnect().catch((e) => {
                        console.log('ping error', { e });
                        setDisconnectError((e as Error).message);
                    })
                }
            >
                Disconnect
            </Button>
        </>
    );
}
