import React, {useEffect, useState} from 'react';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import './App.css';
import {AccountAddress, GtuAmount, JsonRpcClient} from "@concordium/web-sdk";
import {Result, ResultAsync} from "neverthrow";
import Spinner from "react-bootstrap/Spinner";

export interface State {
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
    setContract: React.Dispatch<State | undefined>;
}

async function refresh(rpc: JsonRpcClient, index: bigint) {
    console.debug(`Looking up contract {contract}`);
    const info = await rpc.getInstanceInfo({index, subindex: BigInt(0)})
    if (!info) {
        throw new Error(`contract ${index} not found`);
    }

    const {version, name, owner, amount, methods} = info;
    const prefix = "init_";
    if (!name.startsWith(prefix)) {
        throw new Error(`name "${(name)}" doesn't start with "init_"`);
    }
    const trimmedName = name.substring(prefix.length);
    return {version, index, name: trimmedName, amount, owner, methods};
}

const parseContractIndex = Result.fromThrowable(BigInt, () => "invalid contract index");

export function Contract(props: Props) {
    const {children, rpc, setContract} = props;
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [validationError, setValidationError] = useState<string>();

    useEffect(
        () => {
            setContract(undefined);
            if (input) {
                setIsLoading(true);
                parseContractIndex(input)
                    .asyncAndThen(index =>
                        ResultAsync.fromPromise(
                            refresh(rpc, index),
                            e => (e as Error).message
                        )
                    )
                    .match(c => {
                        setContract(c);
                        setValidationError(undefined);
                    }, setValidationError)
                    .finally(() => setIsLoading(false));
            } else {
                setValidationError(undefined);
            }
        }, [input]
    )
    return (
        <>
            <Row>
                <Col>
                    <Form noValidate>
                        <Form.Group as={Row} className="mb-3" controlId="contract">
                            <Form.Label column sm={2}>Contract index:</Form.Label>
                            <Col sm={10}>
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
                    </Form>
                </Col>
            </Row>
            <Row>
                <Col>
                    {isLoading && <Spinner animation="border" />}
                    {children}
                </Col>
            </Row>
        </>
    )
}
