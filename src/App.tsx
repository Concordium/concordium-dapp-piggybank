import React, {useCallback, useEffect, useMemo, useState} from 'react';
import Alert from 'react-bootstrap/Alert';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';

import './App.css';
import {Button, Container} from "react-bootstrap";
import {ContractSelector, Info, refresh} from "./Contract"
import {GtuAmount, HttpProvider, JsonRpcClient} from "@concordium/web-sdk";
import {CHAIN_ID, DEFAULT_CONTRACT_INDEX, JSON_RPC_URL, WALLET_CONNECT_PROJECT_ID, ZERO_AMOUNT} from "./config";
import {Result, ResultAsync} from "neverthrow";
import {detectConcordiumProvider, WalletApi} from "@concordium/browser-wallet-api-helpers";
import SignClient from "@walletconnect/sign-client";
import WalletConnect2, {resolveAccount, signAndSendTransaction, trySignSend} from "./WalletConnect2";
import {SessionTypes} from "@walletconnect/types";
import BrowserWallet, {deposit, trySendTransaction, smash, wrapPromise} from "./BrowserWallet";
import Piggybank, {refreshPiggybankState, State} from "./Piggybank";

const rpc = new JsonRpcClient(new HttpProvider(JSON_RPC_URL));

type Wallet = "browserwallet" | "walletconnect2";

export default function App() {
    const [wallet, setWallet] = useState<Wallet>();
    const [contract, setContract] = useState<Info>();

    // Piggybank state is duplicated in Contract component. State is redundantly refreshed after selecting a new contract.
    const [piggybankState, setPiggybankState] = useState<Result<State, string>>();
    useEffect(
        () => {
            if (contract) {
                refreshPiggybankState(rpc, contract)
                    .then(setPiggybankState)
                    .catch(console.error);
            }
        },
        [contract],
    );

    useEffect(
        () => {
            if (contract) {
                refreshPiggybankState(rpc, contract)
                    .then(setPiggybankState)
                    .catch(console.error);
            }
        },
        [contract],
    );

    // Select default contract.
    useEffect(
        () => {
            refresh(rpc, DEFAULT_CONTRACT_INDEX)
                .then(setContract)
                .catch(console.error)
        },
        [],
    )

    // Wallet clients: React only manages their existence, not their internal state.
    const [browserwalletClient, setBrowserwalletClient] = useState<Result<WalletApi, string>>();
    const [walletconnect2Client, setWalletconnect2Client] = useState<Result<SignClient, string>>();

    // Wallet state.
    const [browserwalletConnectedAccount, setBrowserwalletConnectedAccount] = useState<string>();
    const [walletconnect2ConnectedSession, setWalletconnect2ConnectedSession] = useState<SessionTypes.Struct>();

    // Attempt to initialize Browser Wallet Client.
    useEffect(
        () => {
            ResultAsync.fromPromise(
                detectConcordiumProvider()
                    .then(client => {
                        // Listen for relevant events from the wallet.
                        client.on('accountChanged', account => {
                            console.debug('browserwallet event: accountChange', {account});
                            setBrowserwalletConnectedAccount(account);
                        });
                        client.on('accountDisconnected', () => {
                            console.debug('browserwallet event: accountDisconnected');
                            client.getMostRecentlySelectedAccount().then(setBrowserwalletConnectedAccount);
                        });
                        client.on('chainChanged', (chain) => {
                            console.debug('browserwallet event: chainChanged', {chain});
                        });
                        // Check if you are already connected
                        client.getMostRecentlySelectedAccount().then(setBrowserwalletConnectedAccount);
                        return client;
                    }),
                () => "browser wallet did not initialize in time" // promise rejects without message
            )
                .then(setBrowserwalletClient);
        }, []);
    // Attempt to initialize Wallet Connect Client.
    useEffect(
        () => {
            ResultAsync.fromPromise(
                SignClient.init({
                    projectId: WALLET_CONNECT_PROJECT_ID,
                    metadata: {
                        name: "Piggybank",
                        description: "Example dApp",
                        url: "#",
                        icons: ["https://walletconnect.com/walletconnect-logo.png"],
                    },
                }).then(client => {
                    // Register event handlers (from official docs).
                    client.on("session_event", (event) => {
                        // Handle session events, such as "chainChanged", "accountsChanged", etc.
                        console.debug('Wallet Connect event: session_event', {event});
                    });
                    client.on("session_update", ({topic, params}) => {
                        const {namespaces} = params;
                        const _session = client.session.get(topic);
                        // Overwrite the `namespaces` of the existing session with the incoming one.
                        const updatedSession = {..._session, namespaces};
                        // Integrate the updated session state into your dapp state.
                        console.debug('Wallet Connect event: session_update', {updatedSession});
                    });
                    client.on("session_delete", () => {
                        // Session was deleted -> reset the dapp state, clean up from user session, etc.
                        console.debug('Wallet Connect event: session_delete');
                    });
                    return client;
                }),
                e => {
                    console.debug('Wallet Connect: init error', e)
                    return (e as Error).message;
                },
            ).then(setWalletconnect2Client);
        },
        []
    );
    const canUpdate = useMemo(
        // TODO Give reason?
        () => {
            if (wallet === "browserwallet") {
                return Boolean(browserwalletConnectedAccount);
            }
            if (wallet === "walletconnect2") {
                return Boolean(walletconnect2ConnectedSession);
            }
            return false;
        },
        [wallet, browserwalletConnectedAccount, walletconnect2ConnectedSession],
    );
    // TODO Need an interface ('canSmash', 'handleSubmitDeposit', etc.) and a function for mapping from wallet to implementation.
    const canSmash = useMemo(
        () => {
            if (wallet === "browserwallet" && contract) {
                return browserwalletConnectedAccount === contract.owner.address;
            }
            if (wallet === "walletconnect2" && walletconnect2ConnectedSession && contract) {
                return resolveAccount(walletconnect2ConnectedSession) === contract.owner.address;
            }
            return false;
        },
        [wallet, browserwalletConnectedAccount, walletconnect2ConnectedSession, contract],
    );
    const handleSubmitDeposit = useCallback(
        (amount: bigint) => {
            if (wallet === "browserwallet") {
                trySendTransaction(
                    browserwalletClient,
                    browserwalletConnectedAccount,
                    contract,
                    wrapPromise(
                        (client, account, contract) =>
                            deposit(client, new GtuAmount(amount), account, contract),
                    ),
                )
            } else if (wallet === "walletconnect2" && rpc) {
                trySignSend(
                    walletconnect2Client,
                    walletconnect2ConnectedSession,
                    contract,
                    wrapPromise(
                        (client, session, contract) =>
                            signAndSendTransaction(
                                client,
                                session,
                                rpc,
                                CHAIN_ID,
                                ZERO_AMOUNT,
                                resolveAccount(session),
                                contract,
                                "deposit",
                            )
                    ),
                )
            }
        },
        [wallet, browserwalletClient, walletconnect2Client, browserwalletConnectedAccount, walletconnect2ConnectedSession, contract],
    );
    const handleSubmitSmash = useCallback(
        () => {
            if (wallet === "browserwallet") {
                trySendTransaction(
                    browserwalletClient,
                    browserwalletConnectedAccount,
                    contract,
                    wrapPromise(smash),
                )
            } else if (wallet === "walletconnect2" && rpc) {
                trySignSend(
                    walletconnect2Client,
                    walletconnect2ConnectedSession,
                    contract,
                    wrapPromise(
                        (client, session, contract) =>
                            signAndSendTransaction(
                                client,
                                session,
                                rpc,
                                CHAIN_ID,
                                ZERO_AMOUNT,
                                resolveAccount(session),
                                contract,
                                "smash",
                            )
                    ),
                )
            }
        },
        [wallet, browserwalletClient, browserwalletConnectedAccount, walletconnect2Client, walletconnect2ConnectedSession, contract],
    );
    return (
        <Container>
            <Row>
                <Col className="d-flex">
                    <h1>Piggybank dApp</h1>
                    <div className="ms-auto p-2">
                        <ContractSelector rpc={rpc} contract={contract} setContract={setContract}/>
                    </div>
                </Col>
            </Row>
            <hr/>
            <Row className="mb-3">
                <Col>
                    <Button
                        className="w-100"
                        variant={wallet === "browserwallet" ? "dark" : "light"}
                        onClick={() => wallet === "browserwallet" ? setWallet(undefined) : setWallet("browserwallet")}
                    >Use Browser Wallet</Button>
                </Col>
                <Col>
                    <Button
                        className="w-100"
                        variant={wallet === "walletconnect2" ? "dark" : "light"}
                        onClick={() => wallet === "walletconnect2" ? setWallet(undefined) : setWallet("walletconnect2")}
                    >Use WalletConnect v2</Button>
                </Col>
            </Row>
            <Row>
                <Col>
                    <>
                        {wallet === "browserwallet" && (
                            <>
                                {!browserwalletClient && (
                                    <Spinner animation="border"/>
                                )}
                                {browserwalletClient?.match(
                                    c => (
                                        <BrowserWallet
                                            client={c}
                                            connectedAccount={browserwalletConnectedAccount}
                                            setConnectedAccount={setBrowserwalletConnectedAccount}
                                        />
                                    ),
                                    e => (
                                        <Alert variant="danger">
                                            Browser Wallet is not available: {e} (is the extension installed?).
                                        </Alert>
                                    ),
                                )}
                            </>
                        )}
                        {wallet === "walletconnect2" && (
                            <>
                                {!walletconnect2Client && (
                                    <Spinner animation="border"/>
                                )}
                                {walletconnect2Client?.match(
                                    c => (
                                        <WalletConnect2
                                            client={c}
                                            connectedSession={walletconnect2ConnectedSession}
                                            setConnectedSession={setWalletconnect2ConnectedSession}
                                        />
                                    ),
                                    e => (
                                        <Alert variant="danger">Wallet Connect is not available: {e}.</Alert>
                                    )
                                )}
                            </>
                        )}
                    </>
                </Col>
            </Row>
            <hr/>
            <Row>
                <Col>
                    {!piggybankState && <Spinner animation="border"/>}
                    {piggybankState?.match(
                        state => (
                            <>
                                <h2>Piggybank instance <code>{state.contract.index.toString()}</code></h2>
                                <Alert variant="light">
                                    Owned by <code>{state.ownerAddress}</code>, has <strong>{state.amount}</strong> CCD
                                    in it, and is <em>{state.isSmashed ? "smashed" : "not smashed"}</em>.
                                </Alert>
                                <p>
                                    Everyone can make deposits to the Piggybank. Only the owner can smash it.
                                </p>
                                <Piggybank
                                    submitDeposit={handleSubmitDeposit}
                                    submitSmash={handleSubmitSmash}
                                    canUpdate={canUpdate}
                                    canSmash={canSmash}
                                />
                            </>
                        ),
                        e => <Alert variant="danger">{e}</Alert>,
                    )}
                </Col>
            </Row>
        </Container>
    );
}
