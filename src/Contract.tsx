import React, {useEffect, useState} from 'react';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import './App.css';
import {AccountAddress, GtuAmount, JsonRpcClient} from "@concordium/web-sdk";
import {Result, ResultAsync} from "neverthrow";
import Spinner from "react-bootstrap/Spinner";
import {resultFromTruthy} from "./util";
import {Alert, Button, Modal} from "react-bootstrap";
import {refreshPiggybankState, State} from "./Piggybank";

export interface Info {
    version: number;
    index: bigint;
    name: string;
    amount: GtuAmount;
    owner: AccountAddress;
    methods: string[];
}

interface Props {
    children: React.ReactNode;
    rpc: JsonRpcClient;
    setContract: React.Dispatch<Info | undefined>;
}

export async function refresh(rpc: JsonRpcClient, index: bigint) {
    console.debug(`Looking up info for contract {contract}`);
    const info = await rpc.getInstanceInfo({index, subindex: BigInt(0)})
    if (!info) {
        throw new Error(`contract ${index} not found`);
    }

    const {version, name, owner, amount, methods} = info;
    const prefix = "init_";
    if (!name.startsWith(prefix)) {
        throw new Error(`name "${name}" doesn't start with "init_"`);
    }
    return {version, index, name: name.substring(prefix.length), amount, owner, methods};
}

const parseContractIndex = Result.fromThrowable(BigInt, () => "invalid contract index");

export function Contract(props: Props) {
    const {children, rpc, setContract} = props;
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [validationError, setValidationError] = useState<string>();

    useEffect(
        () => {
            setIsLoading(true);
            resultFromTruthy(input, undefined)
                .andThen(parseContractIndex)
                .asyncAndThen(index =>
                    ResultAsync.fromPromise(
                        refresh(rpc, index),
                        e => (e as Error).message,
                    )
                )
                .match<[Info?, string?]>(
                    c => [c, undefined],
                    e => [undefined, e],
                )
                .then(([c, e]) => {
                    setContract(c);
                    setValidationError(e);
                    setIsLoading(false);
                });
        }, [rpc, input, setContract]
    );

    return (
        <>
            <Row>
                <Col>
                    <Form.Group as={Row} className="mb-3" controlId="contract">
                        <Form.Label column sm={3}>Contract index:</Form.Label>
                        <Col sm={9}>
                            <Form.Control
                                type="text"
                                placeholder="Address (index)"
                                value={input}
                                onChange={e => setInput(e.currentTarget.value)}
                                isInvalid={Boolean(validationError)}
                            />
                            <Form.Control.Feedback type="invalid">
                                {validationError}
                            </Form.Control.Feedback>
                        </Col>
                    </Form.Group>
                </Col>
            </Row>
            <Row>
                <Col>
                    {isLoading && <Spinner animation="border"/>}
                    {children}
                </Col>
            </Row>
        </>
    );
}

interface ModalProps {
    rpc: JsonRpcClient;
    contract: Info | undefined;
    setContract: React.Dispatch<Info | undefined>;
}

export function ContractSelector(props: ModalProps) {
    const {rpc, contract, setContract} = props;

    const [show, setShow] = useState(false);
    const [currentContract, setCurrentContract] = useState<Info>();
    const [currentPiggybankState, setCurrentPiggybankState] = useState<Result<State, string>>();
    useEffect(
        () => {
            if (currentContract) {
                refreshPiggybankState(rpc, currentContract)
                    .then(setCurrentPiggybankState)
                    .catch(console.error);
            }
        },
        [rpc, currentContract],
    );

    const handleClose = () => setShow(false);
    const handleShow = () => setShow(true);
    const handleSave = () => {
        setContract(currentContract);
        handleClose();
    };
    const canSave = Boolean(currentPiggybankState?.isOk());

    return (
        <>
            <Button variant="outline-dark" size="sm" onClick={handleShow}>
                {!contract && "Select contract"}
                {contract && (
                    <span>Using contract <code>{contract.index.toString()}</code></span>
                )}
            </Button>
            <Modal show={show} onHide={handleClose} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>Select contract</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Contract rpc={rpc} setContract={setCurrentContract}>
                        {currentContract && (
                            <>
                                <Alert variant="secondary">
                                    <Row>
                                        <Col sm={2}>Name:</Col>
                                        <Col sm={10}><code>{currentContract.name}</code></Col>
                                    </Row>
                                    <Row>
                                        <Col sm={2}>Owner:</Col>
                                        <Col sm={10}><code>{currentContract.owner.address}</code></Col>
                                    </Row>
                                    <Row>
                                        <Col sm={2}>Balance:</Col>
                                        <Col sm={10}>{currentContract.amount.microGtuAmount.toString()} μCCD</Col>
                                    </Row>
                                    <Row>
                                        <Col sm={2}>Methods:</Col>
                                        <Col sm={10}>{currentContract.methods.join(", ")}</Col>
                                    </Row>
                                    <Row>
                                        <Col sm={2}>Platform:</Col>
                                        <Col sm={10}>v{currentContract.version}</Col>
                                    </Row>
                                </Alert>
                                {!currentPiggybankState && <Spinner animation="border"/>}
                                {currentPiggybankState?.match(
                                    ({isSmashed, amount}) =>
                                        <Alert variant="success">
                                            Piggybank has {amount} CCD in it and
                                            is {isSmashed ? "smashed" : "not smashed"}.
                                        </Alert>,
                                    e => <Alert variant="danger">{e}</Alert>,
                                )}
                            </>
                        )}
                    </Contract>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleClose}>Close</Button>
                    <Button variant="primary" onClick={handleSave} disabled={!canSave}>Save</Button>
                </Modal.Footer>
            </Modal>
        </>
    );
}
