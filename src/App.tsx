import React, { useEffect, useState } from 'react';

import { Alert, Button, Col, Container, Row, Spinner } from 'react-bootstrap';
import { Result, ResultAsync } from 'neverthrow';
import { ArrowRepeat } from 'react-bootstrap-icons';
import {
    useConnect,
    useConnection,
    BrowserWalletConnector,
    WalletConnectConnector,
    WalletConnectionProps,
    useGrpcClient,
} from '@concordium/react-components';
import { ConcordiumGRPCClient } from '@concordium/web-sdk';
import { ContractManager, Info, refresh } from './Contract';
import { BROWSER_WALLET, DEFAULT_CONTRACT_INDEX, WALLET_CONNECT } from './config';
import WalletConnect2 from './WalletConnect2';
import Piggybank from './Piggybank';
import { resultFromTruthy } from './util';
import BrowserWallet from './BrowserWallet';
import { usePiggybank } from './usePiggybank';
import { refreshPiggybankState, PiggybankState } from './state';
import { errorString } from './error';
import packageInfo from '../package.json';

function refreshContract(rpc: ConcordiumGRPCClient, index: bigint, setContract: React.Dispatch<Info | undefined>) {
    // TODO Store and display error instead of just logging it.
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
        network,
    } = props;
    const rpc = useGrpcClient(network);
    const { connection, setConnection, account } = useConnection(connectedAccounts, genesisHashes);
    const { connect, isConnecting, connectError } = useConnect(activeConnector, setConnection);

    useEffect(() => {
        if (activeConnector) {
            // When changing connector, select the first of any existing connections.
            const cs = activeConnector.getConnections();
            if (cs.length) {
                setConnection(cs[0]);
            }
        }
        return () => setConnection(undefined);
    }, [activeConnector]);

    const [contract, setContract] = useState<Info>();

    // Piggybank state is duplicated in Contract component. State is redundantly refreshed after selecting a new contract.
    const [piggybankState, setPiggybankState] = useState<Result<PiggybankState, string>>();
    useEffect(() => {
        if (rpc) {
            resultFromTruthy(contract, 'no contract selected')
                .asyncAndThen((c) => ResultAsync.fromPromise(refreshPiggybankState(rpc, c), errorString))
                .then(setPiggybankState);
        }
    }, [contract, rpc]);

    // Select default contract.
    useEffect(() => {
        if (rpc) {
            refreshContract(rpc, DEFAULT_CONTRACT_INDEX, setContract);
        }
    }, [rpc]);

    const { canDeposit, canSmash, deposit, smash } = usePiggybank(connection, account, contract);
    return (
        <Container>
            <Row>
                <Col className="d-flex">
                    <h1>Piggybank dApp</h1>
                    <div className="ms-auto p-2">
                        {rpc && <ContractManager rpc={rpc} contract={contract} setContract={setContract} />}
                        {!rpc && <i>Loading...</i>}
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
                    {activeConnectorError && <Alert variant="danger">Connector error: {activeConnectorError}</Alert>}
                    {!activeConnectorError && activeConnectorType && !activeConnector && <Spinner animation="border" />}
                    {connectError && <Alert variant="danger">Connect error: {connectError}</Alert>}
                    {activeConnector && !account && (
                        <Button type="button" onClick={connect} disabled={isConnecting}>
                            {isConnecting && 'Connecting...'}
                            {!isConnecting && activeConnectorType === BROWSER_WALLET && 'Connect Browser Wallet'}
                            {!isConnecting && activeConnectorType === WALLET_CONNECT && 'Connect Mobile Wallet'}
                        </Button>
                    )}
                    {activeConnector instanceof BrowserWalletConnector && <BrowserWallet account={account} />}
                    {activeConnector instanceof WalletConnectConnector && <WalletConnect2 connection={connection} />}
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
                                    {rpc && (
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            className="p-2"
                                            onClick={() => refreshContract(rpc, state.contract.index, setContract)}
                                        >
                                            <ArrowRepeat />
                                        </Button>
                                    )}
                                </Alert>
                                <h6>Update</h6>
                                <p>Everyone can make deposits to the Piggybank. Only the owner can smash it.</p>
                                <Piggybank
                                    canDeposit={canDeposit}
                                    canSmash={canSmash}
                                    deposit={deposit}
                                    smash={smash}
                                />
                            </>
                        ),
                        (e) => (
                            <Alert variant="danger">{e}</Alert>
                        )
                    )}
                </Col>
            </Row>
            <hr />
            Version: {packageInfo.version} |{' '}
            <a
                href="https://developer.concordium.software/en/mainnet/smart-contracts/tutorials/piggy-bank/index.html"
                target="_blank"
                rel="noreferrer"
            >
                Explore the piggy bank tutorial here.
            </a>
        </Container>
    );
}
