import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Alert, Button, Col, Container, Row, Spinner } from 'react-bootstrap';
import { GtuAmount, HttpProvider, JsonRpcClient } from '@concordium/web-sdk';
import { Result, ResultAsync } from 'neverthrow';
import { detectConcordiumProvider, WalletApi } from '@concordium/browser-wallet-api-helpers';
import SignClient from '@walletconnect/sign-client';
import { SessionTypes } from '@walletconnect/types';
import { ArrowRepeat } from 'react-bootstrap-icons';
import { ContractManager, Info, refresh } from './Contract';
import {
    CHAIN_ID,
    DEFAULT_CONTRACT_INDEX,
    JSON_RPC_URL,
    PING_INTERVAL_MS,
    WALLET_CONNECT_PROJECT_ID,
    ZERO_AMOUNT,
} from './config';
import WalletConnect2, { resolveAccount, signAndSendTransaction, trySend } from './WalletConnect2';
import BrowserWallet, { deposit, smash, trySendTransaction, wrapPromise } from './BrowserWallet';
import Piggybank, { refreshPiggybankState, State } from './Piggybank';
import { resultFromTruthy } from './util';

const rpc = new JsonRpcClient(new HttpProvider(JSON_RPC_URL));

type Wallet = 'browserwallet' | 'walletconnect2';

function refreshContract(index: bigint, setContract: React.Dispatch<Info | undefined>) {
    refresh(rpc, index).then(setContract).catch(console.error);
}

export default function App() {
    const [wallet, setWallet] = useState<Wallet>();
    const [contract, setContract] = useState<Info>();

    // Piggybank state is duplicated in Contract component. State is redundantly refreshed after selecting a new contract.
    const [piggybankState, setPiggybankState] = useState<Result<State, string>>();
    useEffect(() => {
        resultFromTruthy(contract, 'no contract selected')
            .asyncAndThen((c) => ResultAsync.fromPromise(refreshPiggybankState(rpc, c), (e) => (e as Error).message))
            .then(setPiggybankState);
    }, [contract]);

    // Select default contract.
    useEffect(() => refreshContract(DEFAULT_CONTRACT_INDEX, setContract), []);

    // Wallet clients: React only manages their existence, not their internal state.
    const [browserwalletClient, setBrowserwalletClient] = useState<Result<WalletApi, string>>();
    const [walletconnect2Client, setWalletconnect2Client] = useState<Result<SignClient, string>>();

    // Wallet state.
    const [browserwalletConnectedAccount, setBrowserwalletConnectedAccount] = useState<string>();
    const [walletconnect2ConnectedSession, setWalletconnect2ConnectedSession] = useState<SessionTypes.Struct>();
    const [walletconnect2ConnectionError, setWalletconnect2ConnectionError] = useState<string>();

    // Attempt to initialize Browser Wallet Client.
    useEffect(() => {
        ResultAsync.fromPromise(
            detectConcordiumProvider().then((client) => {
                // Listen for relevant events from the wallet.
                client.on('accountChanged', (account) => {
                    // eslint-disable-next-line no-console
                    console.debug('browserwallet event: accountChange', { account });
                    setBrowserwalletConnectedAccount(account);
                });
                client.on('accountDisconnected', () => {
                    // eslint-disable-next-line no-console
                    console.debug('browserwallet event: accountDisconnected');
                    client.getMostRecentlySelectedAccount().then(setBrowserwalletConnectedAccount);
                });
                client.on('chainChanged', (chain) => {
                    // eslint-disable-next-line no-console
                    console.debug('browserwallet event: chainChanged', { chain });
                });
                // Check if you are already connected
                client.getMostRecentlySelectedAccount().then(setBrowserwalletConnectedAccount);
                return client;
            }),
            () => 'browser wallet did not initialize in time' // promise rejects without message
        ).then(setBrowserwalletClient);
    }, []);
    // Attempt to initialize Wallet Connect Client.
    useEffect(() => {
        ResultAsync.fromPromise(
            SignClient.init({
                projectId: WALLET_CONNECT_PROJECT_ID,
                metadata: {
                    name: 'Piggybank',
                    description: 'Example dApp',
                    url: '#',
                    icons: ['https://walletconnect.com/walletconnect-logo.png'],
                },
            }).then((client) => {
                // Register event handlers (from official docs).
                client.on('session_event', (event) => {
                    // Handle session events, such as "chainChanged", "accountsChanged", etc.
                    console.debug('Wallet Connect event: session_event', { event });
                });
                client.on('session_update', ({ topic, params }) => {
                    const { namespaces } = params;
                    const session = client.session.get(topic);
                    // Overwrite the `namespaces` of the existing session with the incoming one.
                    const updatedSession = { ...session, namespaces };
                    // Integrate the updated session state into your dapp state.
                    console.debug('Wallet Connect event: session_update', { updatedSession });
                });
                client.on('session_delete', () => {
                    // Session was deleted -> reset the dapp state, clean up from user session, etc.
                    console.debug('Wallet Connect event: session_delete');
                });
                return client;
            }),
            (e) => {
                console.debug('Wallet Connect: init error', e);
                return (e as Error).message;
            }
        ).then(setWalletconnect2Client);
    }, []);

    // Ping Wallet Connect periodically.
    // TODO Move to WC component.
    useEffect(() => {
        if (walletconnect2Client && walletconnect2ConnectedSession) {
            console.log('setting up ping loop');
            const interval = setInterval(() => {
                // console.debug("attempting to ping");
                walletconnect2Client
                    .asyncAndThen((c) => {
                        return ResultAsync.fromPromise(
                            c.ping({ topic: walletconnect2ConnectedSession.topic }),
                            (e) => `${e} (${typeof e})`
                        );
                    })
                    .then((r) =>
                        r.match(
                            () => {
                                // console.debug("ping successful");
                            },
                            (e) => {
                                // eslint-disable-next-line no-console
                                console.error(`ping failed: ${e}`);
                                setWalletconnect2ConnectionError(e);
                            }
                        )
                    );
            }, PING_INTERVAL_MS);
            return () => {
                // eslint-disable-next-line no-console
                console.debug('tearing down ping loop');
                clearInterval(interval);
            };
        }
        return undefined;
    }, [walletconnect2Client, walletconnect2ConnectedSession]);

    const canUpdate = useMemo(
        // TODO Give reason?
        () => {
            if (wallet === 'browserwallet') {
                return Boolean(browserwalletConnectedAccount);
            }
            if (wallet === 'walletconnect2') {
                return Boolean(walletconnect2ConnectedSession);
            }
            return false;
        },
        [wallet, browserwalletConnectedAccount, walletconnect2ConnectedSession]
    );
    // TODO Need an interface ('canSmash', 'handleSubmitDeposit', etc.) and a function for mapping from wallet to implementation.
    const canSmash = useMemo(() => {
        if (wallet === 'browserwallet' && contract) {
            return browserwalletConnectedAccount === contract.owner.address;
        }
        if (wallet === 'walletconnect2' && walletconnect2ConnectedSession && contract) {
            return resolveAccount(walletconnect2ConnectedSession) === contract.owner.address;
        }
        return false;
    }, [wallet, browserwalletConnectedAccount, walletconnect2ConnectedSession, contract]);
    const handleSubmitDeposit = useCallback(
        (amount: bigint) => {
            if (wallet === 'browserwallet') {
                trySendTransaction(
                    browserwalletClient,
                    browserwalletConnectedAccount,
                    contract,
                    wrapPromise((client, account, contract) =>
                        deposit(client, new GtuAmount(amount), account, contract)
                    )
                );
            } else if (wallet === 'walletconnect2' && rpc) {
                trySend(
                    walletconnect2Client,
                    walletconnect2ConnectedSession,
                    contract,
                    wrapPromise((client, session, contractInfo) =>
                        signAndSendTransaction(
                            client,
                            session,
                            rpc,
                            CHAIN_ID,
                            new GtuAmount(amount),
                            resolveAccount(session),
                            contractInfo,
                            'insert'
                        )
                    )
                ).then((r) =>
                    r.match(
                        // eslint-disable-next-line no-console
                        (txHash) => console.log('transaction submitted', { hash: txHash }),
                        // eslint-disable-next-line no-console
                        (e) => console.error('cannot submit transaction', { error: e })
                    )
                );
            }
        },
        [
            wallet,
            browserwalletClient,
            walletconnect2Client,
            browserwalletConnectedAccount,
            walletconnect2ConnectedSession,
            contract,
        ]
    );
    const handleSubmitSmash = useCallback(() => {
        if (wallet === 'browserwallet') {
            trySendTransaction(browserwalletClient, browserwalletConnectedAccount, contract, wrapPromise(smash));
        } else if (wallet === 'walletconnect2' && rpc) {
            trySend(
                walletconnect2Client,
                walletconnect2ConnectedSession,
                contract,
                wrapPromise((client, session, contractInfo) =>
                    signAndSendTransaction(
                        client,
                        session,
                        rpc,
                        CHAIN_ID,
                        ZERO_AMOUNT,
                        resolveAccount(session),
                        contractInfo,
                        'smash'
                    )
                )
            ).then((r) =>
                r.match(
                    (txHash) => console.log(`transaction ${txHash} submitted`),
                    (e) => console.error(`cannot sign or submit transaction: ${e}`)
                )
            );
        }
    }, [
        wallet,
        browserwalletClient,
        browserwalletConnectedAccount,
        walletconnect2Client,
        walletconnect2ConnectedSession,
        contract,
    ]);
    return (
        <Container>
            <Row>
                <Col className="d-flex">
                    <h1>Piggybank dApp</h1>
                    <div className="ms-auto p-2">
                        <ContractManager rpc={rpc} contract={contract} setContract={setContract} />
                    </div>
                </Col>
            </Row>
            <hr />
            <Row className="mb-3">
                <Col>
                    <Button
                        className="w-100"
                        variant={wallet === 'browserwallet' ? 'dark' : 'light'}
                        onClick={() => (wallet === 'browserwallet' ? setWallet(undefined) : setWallet('browserwallet'))}
                    >
                        Use Browser Wallet
                    </Button>
                </Col>
                <Col>
                    <Button
                        className="w-100"
                        variant={wallet === 'walletconnect2' ? 'dark' : 'light'}
                        onClick={() =>
                            wallet === 'walletconnect2' ? setWallet(undefined) : setWallet('walletconnect2')
                        }
                    >
                        Use WalletConnect v2
                    </Button>
                </Col>
            </Row>
            <Row>
                <Col>
                    <>
                        {wallet === 'browserwallet' && (
                            <>
                                {!browserwalletClient && <Spinner animation="border" />}
                                {browserwalletClient?.match(
                                    (c) => (
                                        <BrowserWallet
                                            client={c}
                                            connectedAccount={browserwalletConnectedAccount}
                                            setConnectedAccount={setBrowserwalletConnectedAccount}
                                        />
                                    ),
                                    (e) => (
                                        <Alert variant="danger">
                                            Browser Wallet is not available: {e} (is the extension installed?).
                                        </Alert>
                                    )
                                )}
                            </>
                        )}
                        {wallet === 'walletconnect2' && (
                            <>
                                {!walletconnect2Client && <Spinner animation="border" />}
                                {walletconnect2Client?.match(
                                    (c) => (
                                        <WalletConnect2
                                            client={c}
                                            connectedSession={walletconnect2ConnectedSession}
                                            setConnectedSession={setWalletconnect2ConnectedSession}
                                            connectionError={walletconnect2ConnectionError}
                                        />
                                    ),
                                    (e) => (
                                        <Alert variant="danger">Wallet Connect is not available: {e}.</Alert>
                                    )
                                )}
                            </>
                        )}
                    </>
                </Col>
            </Row>
            <hr />
            <Row>
                <Col>
                    {!piggybankState && <Spinner animation="border" />}
                    {piggybankState?.match(
                        (state) => (
                            <>
                                <h2>
                                    Piggybank instance <code>{state.contract.index.toString()}</code>
                                </h2>
                                <Alert variant="light" className="d-flex">
                                    <div className="me-auto p-2">
                                        Owned by{' '}
                                        <code>
                                            {state.ownerAddress.slice(0, 4)}...{state.ownerAddress.slice(-4)}
                                        </code>
                                        . As of {state.queryTime.toLocaleTimeString()} it contains{' '}
                                        <strong>{state.amount}</strong> CCD and is{' '}
                                        <em>{state.isSmashed ? 'smashed' : 'not smashed'}</em>
                                    </div>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="p-2"
                                        onClick={() => refreshContract(state.contract.index, setContract)}
                                    >
                                        <ArrowRepeat />
                                    </Button>
                                </Alert>
                                <h6>Update</h6>
                                <p>Everyone can make deposits to the Piggybank. Only the owner can smash it.</p>
                                <Piggybank
                                    submitDeposit={handleSubmitDeposit}
                                    submitSmash={handleSubmitSmash}
                                    canUpdate={canUpdate}
                                    canSmash={canSmash}
                                />
                            </>
                        ),
                        (e) => (
                            <Alert variant="danger">{e}</Alert>
                        )
                    )}
                </Col>
            </Row>
        </Container>
    );
}
