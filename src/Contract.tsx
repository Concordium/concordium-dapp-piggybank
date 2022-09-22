import React, {useEffect, useState} from 'react';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import './App.css';
import {AccountAddress, GtuAmount, JsonRpcClient} from "@concordium/web-sdk";
import {Result, ResultAsync} from "neverthrow";
import Spinner from "react-bootstrap/Spinner";
import {DEFAULT_CONTRACT_INPUT} from "./config";
import {resultFromTruthy} from "./util";

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

async function refresh(rpc: JsonRpcClient, index: bigint) {
    console.debug(`Looking up info for contract {contract}`);
    const info = await rpc.getInstanceInfo({index, subindex: BigInt(0)})
    if (!info) {
        throw new Error(`contract ${index} not found`);
    }

    const {version, name, owner, amount, methods} = info;
    const prefix = "init_";
    if (!name.startsWith(prefix)) {
        throw new Error(`name "${(name)}" doesn't start with "init_"`);
    }
    return {version, index, name: name.substring(prefix.length), amount, owner, methods};
}

const parseContractIndex = Result.fromThrowable(BigInt, () => "invalid contract index");

export function Contract(props: Props) {
    const {children, rpc, setContract} = props;
    const [input, setInput] = useState(DEFAULT_CONTRACT_INPUT);
    const [isLoading, setIsLoading] = useState(false);
    const [validationError, setValidationError] = useState<string>();

    useEffect(
        () => {
            setIsLoading(true);
            resultFromTruthy(input)
                .andThen(parseContractIndex)
                .asyncAndThen(index =>
                    ResultAsync.fromPromise(
                        refresh(rpc, index),
                        e => (e as Error).message
                    )
                ).match<[Info?, string?]>(
                c => [c, undefined],
                e => [undefined, e]
            ).then(([c, e]) => {
                setContract(c);
                setValidationError(e);
                setIsLoading(false);
            });
        }, [input]
    )
    return (
        <>
            <Row>
                <Col>
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
                </Col>
            </Row>
            <Row>
                <Col>
                    {isLoading && <Spinner animation="border"/>}
                    {children}
                </Col>
            </Row>
        </>
    )
}
