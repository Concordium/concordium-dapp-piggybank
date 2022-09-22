import React, {useEffect, useState} from 'react';
import Alert from 'react-bootstrap/Alert';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';

import './App.css';
import {Button, Container} from "react-bootstrap";
import {Contract, Info} from "./Contract"
import {HttpProvider, JsonRpcClient} from "@concordium/web-sdk";
import {JSON_RPC_URL, WALLET_CONNECT_PROJECT_ID} from "./config";
import {Result, ResultAsync} from "neverthrow";
import {detectConcordiumProvider, WalletApi} from "@concordium/browser-wallet-api-helpers";
import SignClient from "@walletconnect/sign-client";
import WalletConnect2 from "./WalletConnect2";
import {SessionTypes} from "@walletconnect/types";
import BrowserWallet from "./BrowserWallet";
import Piggybank, {refreshPiggybankState, State} from "./Piggybank";

const rpc = new JsonRpcClient(new HttpProvider(JSON_RPC_URL));

type Wallet = "browserwallet" | "walletconnect2";

// TODO Convert to class component?
export default function App() {
    const [wallet, setWallet] = useState<Wallet>();
    const [contract, setContract] = useState<Info>();

    const [piggybankState, setPiggybankState] = useState<Result<State, string>>();

    useEffect(
        () => {
            if (contract) {
                refreshPiggybankState(rpc, contract)
                    .then(setPiggybankState)
                    .catch(console.error);
            }
        }, [rpc, contract],
    );

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
                    // Register event handlers.
                    // TODO Make events actually update some state.
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
    return (
        <Container>
            <Row>
                <Col><h1>Piggybank dApp</h1></Col>
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
                                    c => <BrowserWallet
                                        client={c}
                                        connectedAccount={browserwalletConnectedAccount}
                                        setConnectedAccount={setBrowserwalletConnectedAccount}
                                    />,
                                    e => (
                                        <Alert variant="danger">
                                            Browser Wallet is not available: {e} (is the extension installed?).
                                        </Alert>
                                    )
                                )}
                            </>
                        )}
                        {wallet === "walletconnect2" && (
                            <>
                                {!walletconnect2Client && (
                                    <Spinner animation="border"/>
                                )}
                                {walletconnect2Client?.match(
                                    c => <WalletConnect2
                                        client={c}
                                        connectedSession={walletconnect2ConnectedSession}
                                        setConnectedSession={setWalletconnect2ConnectedSession}
                                    />,
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
                    <Contract rpc={rpc} setContract={setContract}>
                        {contract && (
                            <Alert variant="secondary">
                                <Row>
                                    <Col><h5>Generic state</h5></Col>
                                </Row>
                                <Row>
                                    <Col sm={2}>Name:</Col>
                                    <Col sm={10}><code>{contract.name}</code></Col>
                                </Row>
                                <Row>
                                    <Col sm={2}>Owner:</Col>
                                    <Col sm={10}><code>{contract.owner.address}</code></Col>
                                </Row>
                                <Row>
                                    <Col sm={2}>Balance:</Col>
                                    <Col sm={10}>{contract.amount.microGtuAmount.toString()} μCCD</Col>
                                </Row>
                                <Row>
                                    <Col sm={2}>Methods:</Col>
                                    <Col sm={10}>{contract.methods.join(", ")}</Col>
                                </Row>
                                <Row>
                                    <Col sm={2}>Platform:</Col>
                                    <Col sm={10}>v{contract.version}</Col>
                                </Row>
                                <hr/>
                                <Row>
                                    <Col><h5>Piggybank state</h5></Col>
                                </Row>
                                <Row>
                                    <Col>
                                        {!piggybankState && <Spinner animation="border"/>}
                                        {piggybankState?.match(
                                            ({smashed, amount}) =>
                                                <strong>
                                                    Piggybank has {amount} CCD in it and
                                                    is {smashed ? "smashed" : "not smashed"}.
                                                </strong>,
                                            e => <i>{e}</i>
                                        )}
                                    </Col>
                                </Row>
                            </Alert>
                        )}
                    </Contract>
                </Col>
            </Row>
            <Row>
                <Col>
                    <Piggybank/>
                </Col>
            </Row>
        </Container>
    );
}
