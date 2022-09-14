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

function onDisconnect(payload, setConnection) {
    console.debug('onDisconnect', { payload });

    setConnection(undefined);
}

async function initConnector(setConnector: (client: WalletConnect) => void, setConnection: (connection: Connection) => void) {
    console.log('Initializing connector.');

    const connector = new WalletConnect({
        bridge: 'https://bridge.walletconnect.org',
        qrcodeModal: QRCodeModal,
    });

    if (connector.connected) {
        setConnection({account: connector.accounts[0], chainId: connector.chainId});
    }

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
        onDisconnect(payload, setConnection);
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

async function updateState(connector: WalletConnect, setSmashed: (x: boolean) => void, setAmount: (x: bigint) => void): Promise<void> {
    console.log('TODO: Update state');
}

export const deposit = (account: string, index: bigint, subindex = 0n, amount = 0) => {
    console.log('TODO: Deposit');
};

export const smash = (account: string, index: bigint, subindex = 0n) => {
    console.log('TODO: Smash');
};

export function PiggyBankWalletConnect1(props : Props) {
    const {connector, connection} = props;

    const [owner, setOwner] = useState<string>();
    const [smashed, setSmashed] = useState<boolean>();
    const [amount, setAmount] = useState<bigint>(0n);
    const input = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (connector && connection) {
            // Get piggy bank owner.
            const customRequest = {
                id: 1337,
                jsonrpc: "2.0",
                method: "eth_signTransaction",
                params: [
                  {
                    from: "0xbc28Ea04101F03aA7a94C1379bc3AB32E65e62d3",
                    to: "0x89D24A7b4cCB1b6fAA2625Fe562bDd9A23260359",
                    data: "0x",
                    gasPrice: "0x02540be400",
                    gasLimit: "0x9c40",
                    value: "0x00",
                    nonce: "0x0114",
                  },
                ],
              };

            connector
                .sendCustomRequest(customRequest)
                .then(result => {
                    // Returns request result
                    console.log('custom request result', result);
                })
                .catch(error => {
                    // Error returned when rejected
                    console.error('custom request error', error);
                });
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

    // // The internal state of the piggy bank, which is either intact or smashed.
    // useEffect(() => {
    //     if (isConnected) {
    //         updateState(setSmashed, setAmount);
    //     }
    // }, [isConnected]);

    // Disable use if we're not connected or if piggy bank has already been smashed.
    const canUse = smashed === false;

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
                    <button type="button" onClick={() => updateState(connector, setSmashed, setAmount)}>
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
                            connection?.account &&
                            deposit(connection.account, CONTRACT_INDEX, CONTRACT_SUB_INDEX, input.current?.valueAsNumber)
                        }
                        disabled={connection?.account === undefined || !canUse}
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
                onClick={() => connection?.account && smash(connection.account, CONTRACT_INDEX, CONTRACT_SUB_INDEX)}
                disabled={connection?.account === undefined || connection.account !== owner || !canUse} // The smash button is only active for the contract owner.
            >
                <HammerIcon width="40" />
            </button>
        </>
    );
}
