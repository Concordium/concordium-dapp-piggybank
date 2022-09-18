import React, {useEffect, useMemo, useState} from 'react';
import Alert from 'react-bootstrap/Alert';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';

import './App.css';
import {Button, Container} from "react-bootstrap";
import {Contract, Info as ContractState} from "./Contract"
import {HttpProvider, JsonRpcClient, toBuffer} from "@concordium/web-sdk";
import {JSON_RPC_URL, WALLET_CONNECT_PROJECT_ID} from "./config";
import {err, ok, Result, ResultAsync} from "neverthrow";
import {detectConcordiumProvider, WalletApi} from "@concordium/browser-wallet-api-helpers";
import SignClient from "@walletconnect/sign-client";
import WalletConnect2 from "./WalletConnect2";
import {SessionTypes} from "@walletconnect/types";
import BrowserWallet from "./BrowserWallet";

const rpc = new JsonRpcClient(new HttpProvider(JSON_RPC_URL));

type Wallet = "browserwallet" | "walletconnect2";

// TODO Convert to class component?
export default function App() {
    // TODO Wrap 'setWallet' in function that disconnects the untoggled wallet.
    const [wallet, setWallet] = useState<Wallet>();
    const [contract, setContract] = useState<ContractState>();

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
                        client.on('accountChanged', setBrowserwalletConnectedAccount);
                        client.on('accountDisconnected', () =>
                            client.getMostRecentlySelectedAccount()
                                .then(setBrowserwalletConnectedAccount)
                        );
                        client.on('chainChanged', (chain) => console.log(chain));
                        // Check if you are already connected
                        client.getMostRecentlySelectedAccount().then(setBrowserwalletConnectedAccount);
                        return client;
                    }),
                () => "browser wallet did not initialize in time" // promise rejects without message
            )
                .then(setBrowserwalletClient);
        }, [])
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
                        console.info('Wallet Connect event: session_update', {updatedSession});
                    });
                    client.on("session_delete", () => {
                        // Session was deleted -> reset the dapp state, clean up from user session, etc.
                        console.info('Wallet Connect event: session_delete');
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
    )
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
                                        <Alert variant="danger">Browser Wallet is not available: {e} (is the extension
                                            installed?)</Alert>
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
                                    <Col><PiggybankState rpc={rpc} contract={contract}/></Col>
                                </Row>
                            </Alert>
                        )}
                    </Contract>
                </Col>
            </Row>
            <Row>
                <Col>
                    {"<Piggybank...>"}
                </Col>
            </Row>
        </Container>
    );
}

async function refreshPiggybankState(rpc: JsonRpcClient, contractState: ContractState, setPiggybankState: React.Dispatch<Result<string, string>>) {
    const {version, name, index, methods} = contractState;

    const expectedMethods = ["insert", "smash", "view"].map(m => `${name}.${m}`);
    if (!expectedMethods.every(methods.includes.bind(methods))) {
        return setPiggybankState(err(`contract "${name}" is not a piggy bank as it lacks at least one of the expected methods (${expectedMethods.join(", ")})`))
    }

    const method = `${name}.view`;
    const result = await rpc.invokeContract({contract: {index, subindex: BigInt(0)}, method})
    if (!result) {
        return setPiggybankState(err(`invocation of method "${method}" on contract "${index}" returned no result`));
    }
    switch (result.tag) {
        case "failure":
            return setPiggybankState(err(`invocation of method "${method}" on v${version} contract "${index}" returned error: ${JSON.stringify(result.reason)}`))
        case "success":
            return setPiggybankState(ok(result.returnValue || ""))
    }
}

function PiggybankState(props: { rpc: JsonRpcClient, contract: ContractState }) {
    const {rpc, contract} = props;
    const [piggybankState, setPiggybankState] = useState<Result<string, string>>();

    const parsedState = useMemo(() =>
            piggybankState?.map(rawState => {
                const smashed = !!Number(rawState.substring(0, 2));
                const amount = toBuffer(rawState.substring(2), 'hex').readBigUInt64LE(0) as bigint;
                return {smashed, amount};
            })
        , [piggybankState]);

    useEffect(() => {
        refreshPiggybankState(rpc, contract, setPiggybankState).catch(console.error);
    }, [contract]);

    return parsedState?.match(
        ({smashed}) => <strong>Piggybank is {smashed ? "smashed" : "not smashed"}.</strong>,
        e => <i>{e}</i>
    ) || <Spinner animation="border"/>;
}
