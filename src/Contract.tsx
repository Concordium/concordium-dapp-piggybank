import React, { useEffect, useState } from 'react';
import {
    AccountAddress,
    CcdAmount,
    ConcordiumGRPCClient,
    ContractAddress,
    ContractName,
    InitName,
    ReceiveName,
} from '@concordium/web-sdk';
import { Result, ResultAsync } from 'neverthrow';
import { Alert, Button, Col, Form, Modal, Row, Spinner } from 'react-bootstrap';
import { resultFromTruthy } from './util';
import { refreshPiggybankState, PiggybankState } from './state';
import { errorString } from './error';

export interface Info {
    version: number;
    index: bigint;
    name: ContractName.Type;
    amount: CcdAmount.Type;
    owner: AccountAddress.Type;
    methods: ReceiveName.Type[];
}

interface Props {
    children: React.ReactNode;
    rpc: ConcordiumGRPCClient;
    setContract: React.Dispatch<Info | undefined>;
}

export async function refresh(rpc: ConcordiumGRPCClient, index: bigint) {
    console.debug(`Refreshing info for contract ${index.toString()}`);
    const info = await rpc.getInstanceInfo(ContractAddress.create(index, 0));
    if (!info) {
        throw new Error(`contract ${index} not found`);
    }

    const { version, name, owner, amount, methods } = info;
    const prefix = 'init_';
    if (!InitName.toString(name).startsWith(prefix)) {
        throw new Error(`name "${name}" doesn't start with "init_"`);
    }
    return { version, index, name: ContractName.fromInitName(name), amount, owner, methods };
}

const parseContractIndex = Result.fromThrowable(BigInt, () => 'invalid contract index');

export function ContractSelector(props: Props) {
    const { children, rpc, setContract } = props;
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [validationError, setValidationError] = useState<string>();

    useEffect(() => {
        setIsLoading(true);
        resultFromTruthy(input, undefined)
            .andThen(parseContractIndex)
            .asyncAndThen((index) => ResultAsync.fromPromise(refresh(rpc, index), errorString))
            .match<[Info?, string?]>(
                (c) => [c, undefined],
                (e) => [undefined, e]
            )
            .then(([c, e]) => {
                setContract(c);
                setValidationError(e);
                setIsLoading(false);
            });
    }, [rpc, input, setContract]);

    return (
        <>
            <Row>
                <Col>
                    <Form.Group as={Row} className="mb-3" controlId="contract">
                        <Form.Label column sm={3}>
                            Contract index:
                        </Form.Label>
                        <Col sm={9}>
                            <Form.Control
                                type="text"
                                placeholder="Address (index)"
                                value={input}
                                onChange={(e) => setInput(e.currentTarget.value)}
                                isInvalid={Boolean(validationError)}
                                autoFocus
                            />
                            <Form.Control.Feedback type="invalid">{validationError}</Form.Control.Feedback>
                        </Col>
                    </Form.Group>
                </Col>
            </Row>
            <Row>
                <Col>
                    {isLoading && <Spinner animation="border" />}
                    {children}
                </Col>
            </Row>
        </>
    );
}

interface ModalProps {
    rpc: ConcordiumGRPCClient;
    contract: Info | undefined;
    setContract: React.Dispatch<Info | undefined>;
}

export function ContractManager(props: ModalProps) {
    const { rpc, contract, setContract } = props;

    const [show, setShow] = useState(false);
    const [currentContract, setCurrentContract] = useState<Info>();
    const [currentPiggybankState, setCurrentPiggybankState] = useState<Result<PiggybankState, string>>();
    useEffect(() => {
        resultFromTruthy(currentContract, 'no contract selected')
            .asyncAndThen((c) => ResultAsync.fromPromise(refreshPiggybankState(rpc, c), errorString))
            .then(setCurrentPiggybankState);
    }, [rpc, currentContract]);

    const handleClose = () => setShow(false);
    const handleShow = () => setShow(true);
    const handleSelect = () => {
        setContract(currentContract);
        handleClose();
    };
    const canSelect = Boolean(currentPiggybankState?.isOk());

    return (
        <>
            <Button variant="outline-dark" size="sm" onClick={handleShow}>
                {!contract && 'Select contract'}
                {contract && (
                    <span>
                        Using&nbsp;contract&nbsp;<code>{contract.index.toString()}</code>
                    </span>
                )}
            </Button>
            <Modal show={show} onHide={handleClose} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>Select contract</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <ContractSelector rpc={rpc} setContract={setCurrentContract}>
                        {currentContract && (
                            <>
                                <Alert variant="secondary">
                                    <Row>
                                        <Col sm={2}>Name:</Col>
                                        <Col sm={10}>
                                            <code>{ContractName.toString(currentContract.name)}</code>
                                        </Col>
                                    </Row>
                                    <Row>
                                        <Col sm={2}>Index:</Col>
                                        <Col sm={10}>
                                            <code>{currentContract.index.toString()}</code>
                                        </Col>
                                    </Row>
                                    <Row>
                                        <Col sm={2}>Owner:</Col>
                                        <Col sm={10}>
                                            <code>{currentContract.owner.address}</code>
                                        </Col>
                                    </Row>
                                    <Row>
                                        <Col sm={2}>Balance:</Col>
                                        <Col sm={10}>{currentContract.amount.microCcdAmount.toString()} μCCD</Col>
                                    </Row>
                                    <Row>
                                        <Col sm={2}>Methods:</Col>
                                        <Col sm={10}>
                                            {currentContract.methods.map(ReceiveName.toString).join(', ')}
                                        </Col>
                                    </Row>
                                    <Row>
                                        <Col sm={2}>Platform:</Col>
                                        <Col sm={10}>v{currentContract.version}</Col>
                                    </Row>
                                </Alert>
                                {!currentPiggybankState && <Spinner animation="border" />}
                                {currentPiggybankState?.match(
                                    ({ isSmashed, amount }) => (
                                        <Alert variant="success">
                                            Piggybank has {amount} CCD in it and is{' '}
                                            {isSmashed ? 'smashed' : 'not smashed'}.
                                        </Alert>
                                    ),
                                    (e) => <Alert variant="danger">{e}</Alert>
                                )}
                            </>
                        )}
                    </ContractSelector>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleClose}>
                        Close
                    </Button>
                    <Button variant="primary" onClick={handleSelect} disabled={!canSelect}>
                        Select
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    );
}
