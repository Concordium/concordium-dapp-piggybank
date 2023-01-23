import { Alert, Button } from 'react-bootstrap';
import { BrowserWalletConnector, WalletConnection } from '@concordium/react-components';
import { useState } from 'react';

interface Props {
    connector: BrowserWalletConnector;
    connectedAccount: string | undefined;
    setActiveConnection: (c: WalletConnection | undefined) => void;
}

export default function BrowserWallet(props: Props) {
    const { connector, connectedAccount, setActiveConnection } = props;
    const [connectionError, setConnectionError] = useState('');

    return (
        <>
            {connectionError && <Alert variant="danger">{connectionError}</Alert>}
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
            {!connectedAccount && (
                <>
                    <p>No wallet connection</p>
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
                </>
            )}
        </>
    );
}
