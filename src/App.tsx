import React, { useCallback, useEffect, useState } from 'react';

import { Alert, Button, Col, Container, Row, Spinner } from 'react-bootstrap';
import { CcdAmount, HttpProvider, JsonRpcClient } from '@concordium/web-sdk';
import { Result, ResultAsync } from 'neverthrow';
import { ArrowRepeat } from 'react-bootstrap-icons';
import {
    BrowserWalletConnector,
    useConnect,
    useConnection,
    WalletConnectConnector,
    WalletConnectionProps,
} from '@concordium/react-components';
import { ContractManager, Info, refresh } from './Contract';
import { BROWSER_WALLET, DEFAULT_CONTRACT_INDEX, TESTNET, WALLET_CONNECT } from './config';
import WalletConnect2 from './WalletConnect2';
import Piggybank, { refreshPiggybankState, State } from './Piggybank';
import { deposit, resultFromTruthy, smash } from './util';
import BrowserWallet from './BrowserWallet';

const rpc = new JsonRpcClient(new HttpProvider(TESTNET.jsonRpcUrl));

function refreshContract(index: bigint, setContract: React.Dispatch<Info | undefined>) {
    refresh(rpc, index).then(setContract).catch(console.error);
}

export default function App(props: WalletConnectionProps) {
    const {
        activeConnectorType,
        setActiveConnectorType,
        activeConnector,
        activeConnectorError,
        connectedAccounts,
        genesisHashes,
    } = props;
    const { connection, setConnection, account } = useConnection(connectedAccounts, genesisHashes);
    const { connect, isConnecting, connectionError } = useConnect(activeConnector, setConnection);

    useEffect(() => {
        setConnection(undefined);
        if (activeConnector) {
            // When changing connector, select the first of any existing connections.
            const cs = activeConnector.getConnections();
            if (cs.length) {
                setConnection(cs[0]);
            }
        }
    }, [activeConnector]);

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

    // TODO Need an interface ('canSmash', 'handleSubmitDeposit', etc.).
    const canUpdate = Boolean(account);
    const canSmash = canUpdate && account === contract?.owner.address;
    const handleSubmitDeposit = useCallback(
        (amount: bigint) =>
            Result.combine([
                resultFromTruthy(connection, 'no connection initialized'),
                resultFromTruthy(account, 'no account connected'),
                resultFromTruthy(contract, 'no contract'),
            ])
                .asyncAndThen(([client, account, contract]) =>
                    ResultAsync.fromPromise(
                        deposit(client, new CcdAmount(amount), account, contract),
                        (e) => (e as Error).message
                    )
                )
                .map((txHash) => {
                    console.debug(`${TESTNET.ccdScanBaseUrl}/?dcount=1&dentity=transaction&dhash=${txHash}`);
                    return txHash;
                })
                .match(
                    (txHash) => console.log('deposit transaction submitted', { hash: txHash }),
                    (e) => console.error('cannot submit deposit transaction', { error: e })
                ),
        [connection, account, contract]
    );
    const handleSubmitSmash = useCallback(
        () =>
            Result.combine([
                resultFromTruthy(connection, 'no connection initialized'),
                resultFromTruthy(account, 'no account connected'),
                resultFromTruthy(contract, 'no contract'),
            ])
                .asyncAndThen(([client, account, contract]) =>
                    ResultAsync.fromPromise(smash(client, account, contract), (e) => (e as Error).message)
                )
                .map((txHash) => {
                    console.debug(`${TESTNET.ccdScanBaseUrl}/?dcount=1&dentity=transaction&dhash=${txHash}`);
                    return txHash;
                })
                .match(
                    (txHash) => console.log('smash transaction submitted', { hash: txHash }),
                    (e) => console.error('cannot submit smash transaction', { error: e })
                ),
        [connection, account, contract]
    );
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
                        variant={activeConnectorType === BROWSER_WALLET ? 'dark' : 'light'}
                        onClick={() =>
                            setActiveConnectorType(activeConnectorType === BROWSER_WALLET ? undefined : BROWSER_WALLET)
                        }
                    >
                        Use Browser Wallet
                    </Button>
                </Col>
                <Col>
                    <Button
                        className="w-100"
                        variant={activeConnectorType === WALLET_CONNECT ? 'dark' : 'light'}
                        onClick={() =>
                            setActiveConnectorType(activeConnectorType === WALLET_CONNECT ? undefined : WALLET_CONNECT)
                        }
                    >
                        Use WalletConnect v2
                    </Button>
                </Col>
            </Row>
            <Row>
                <Col>
                    <>
                        {activeConnectorError && <Alert variant="danger">{activeConnectorError}</Alert>}
                        {!activeConnectorError && activeConnectorType && !activeConnector && (
                            <Spinner animation="border" />
                        )}
                        {connectionError && <Alert variant="danger">Connection error: {connectionError}</Alert>}
                        {activeConnector && !account && (
                            <Button type="button" onClick={connect} disabled={isConnecting}>
                                {isConnecting && 'Connecting...'}
                                {!isConnecting && activeConnectorType === BROWSER_WALLET && 'Connect Browser Wallet'}
                                {!isConnecting && activeConnectorType === WALLET_CONNECT && 'Connect Mobile Wallet'}
                            </Button>
                        )}
                        {activeConnector instanceof BrowserWalletConnector && <BrowserWallet account={account} />}
                        {activeConnector instanceof WalletConnectConnector && (
                            <WalletConnect2 connection={connection} />
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
