/* eslint-disable no-console */
import React, { useEffect, useRef, useState } from 'react';
import WalletConnect from '@walletconnect/client';
import QRCodeModal from '@walletconnect/qrcode-modal';

import PiggyIcon from './assets/piggy-bank-solid.svg';
import HammerIcon from './assets/hammer-solid.svg';

const CONTRACT_NAME = 'PiggyBank';

// V1 Module reference on testnet: 12362dd6f12fabd95959cafa27e512805161467b3156c7ccb043318cd2478838
const CONTRACT_INDEX = 81n; // V1 instance

/** If you want to test smashing the piggy bank,
 * it will be necessary to instantiate your own piggy bank using an account available in the browser wallet,
 * and change this constant to match the index of the instance.
 */
/** Should match the subindex of the instance targeted. */
const CONTRACT_SUB_INDEX = 0n;

function onConnect(accounts, chainId, setConnection) {
    // accounts: string array
    // chainId: number
    console.debug('onConnect', { accounts, chainId });

    setConnection({account: accounts[0], chainId});
}

function onSessionUpdate(accounts, chainId, setConnection) {
    console.debug('onSessionUpdate', { accounts, chainId });

    setConnection({account: accounts[0], chainId});
}

function onDisconnect(payload) {
    console.debug('onDisconnect', { payload });

    setConnection(undefined);
}

async function initConnector(setConnector: (client: WalletConnect) => void, setConnection: (connection: Connection) => void) {
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

        const { accounts, chainId } = payload.params[0];
        onConnect(accounts, chainId, setConnection);
    });

    connector.on('session_update', (error, payload) => {
        if (error) {
            throw error;
        }

        // Get updated accounts and chainId
        const { accounts, chainId } = payload.params[0];
        onSessionUpdate(accounts, chainId, setConnection);
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

export type Connection = {
    chainId: number;
    account: string;
};

export interface Props {
    connector?: WalletConnect;
    connection?: Connection;
}

export default function Root() {
    const [connector, setConnector] = useState<WalletConnect>();
    const [connection, setConnection] = useState<Connection>();

    // Initialize Wallet Connect connector.
    useEffect(() => {
        // Connector cannot have been already initialized here.
        initConnector(setConnector, setConnection);
    }, []);

    console.debug('connector', connector);

    return (
        <main className="piggybank">
            <div className={`connection-banner ${connector && connection ? 'connected' : ''}`}>
                {!connector && <div>Initializing connector...</div>}
                {connector && !connection && (
                    <button type="button" onClick={() => connector.createSession()}>
                        Create session
                    </button>
                )}
                {connector && connection && (
                    <>
                        <div>Connected to account <code>{connection.account}</code>!</div>
                        <button type="button" onClick={() => connector.killSession()}>Kill session</button>
                    </>
                )}
                <PiggyBankWalletConnect1 connector={connector} connection={connection}/>
            </div>
        </main>
    );
}

export function PiggyBankWalletConnect1(props : Props) {
    const {connector, connection} = props;

    const [owner, setOwner] = useState<string>();
    const [smashed, setSmashed] = useState<boolean>();
    const [amount, setAmount] = useState<bigint>(0n);
    const input = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (connector) {
            // Get piggy bank owner.
            connector.sendCustomRequest
            // detectConcordiumProvider()
            //     .then((provider) =>
            //         provider.getJsonRpcClient().getInstanceInfo({ index: CONTRACT_INDEX, subindex: CONTRACT_SUB_INDEX })
            //     )
            //     .then((info) => {
            //         if (info?.name !== `init_${CONTRACT_NAME}`) {
            //             // Check that we have the expected instance.
            //             throw new Error(`Expected instance of PiggyBank: ${info?.name}`);
            //         }

            //         setOwner(info.owner.address);
            //     });
        }
    }, [connection]);

    // The internal state of the piggy bank, which is either intact or smashed.
    useEffect(() => {
        if (isConnected) {
            updateState(setSmashed, setAmount);
        }
    }, [isConnected]);

    // Disable use if we're not connected or if piggy bank has already been smashed.
    const canUse = isConnected && smashed !== undefined && !smashed;

    return (
        <>
            {owner === undefined ? (
                <div>Loading piggy bank...</div>
            ) : (
                <>
                    <h1 className="stored">{Number(amount) / 1000000} CCD</h1>
                    <div>
                        Owned by
                        <br />
                        {owner}
                    </div>
                    <br />
                    <div>State: {smashed ? 'Smashed' : 'Intact'}</div>
                    <button type="button" onClick={() => updateState(setSmashed, setAmount)}>
                        ↻
                    </button>
                </>
            )}
            <br />
            <label>
                <div className="container">
                    <input className="input" type="number" placeholder="Deposit amount" ref={input} />
                    <button
                        className="deposit"
                        type="button"
                        onClick={() =>
                            account &&
                            deposit(account, CONTRACT_INDEX, CONTRACT_SUB_INDEX, input.current?.valueAsNumber)
                        }
                        disabled={account === undefined || !canUse}
                    >
                        <PiggyIcon height="20" />
                    </button>
                </div>
            </label>
            <br />
            <br />
            <button
                className="smash"
                type="button"
                onClick={() => account && smash(account, CONTRACT_INDEX, CONTRACT_SUB_INDEX)}
                disabled={account === undefined || account !== owner || !canUse} // The smash button is only active for the contract owner.
            >
                <HammerIcon width="40" />
            </button>
        </>
    );
}
