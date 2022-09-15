import React, {useEffect, useState} from 'react';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import './App.css';
import Alert from 'react-bootstrap/Alert';
import {AccountAddress, GtuAmount, JsonRpcClient} from "@concordium/web-sdk";
import {ok, Result, ResultAsync} from "neverthrow";
import Spinner from "react-bootstrap/Spinner";

export interface State {
    version: number;
    index: bigint;
    name: string;
    amount: GtuAmount;
    owner: AccountAddress;
    methods: string[];
}

export type ContractResult = Result<State | undefined, string>;

interface Props {
    rpc: JsonRpcClient,
    contract: ContractResult | undefined;
    setContract: React.Dispatch<ContractResult | undefined>;
    renderState: (c: State) => React.ReactNode;
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
    const {rpc, contract, setContract, renderState} = props;
    const [input, setInput] = useState("");

    useEffect(
        () => {
            if (input) {
                setContract(ok(undefined)); // trigger "loading" message
                parseContractIndex(input)
                    .asyncAndThen(index =>
                        ResultAsync.fromPromise(
                            refresh(rpc, index),
                            error => (error as Error).message
                        )
                    )
                    .then(setContract);
            } else {
                setContract(undefined);
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
                                    isInvalid={contract?.isErr()}
                                />
                                <Form.Control.Feedback type="invalid">
                                    {contract?.match(_ => "", error => error)}
                                </Form.Control.Feedback>
                            </Col>
                        </Form.Group>
                    </Form>
                </Col>
            </Row>
            <Row>
                <Col>
                    {contract?.map(c => !c ? <Spinner animation="border" /> : (
                        <Alert variant="secondary">
                            {renderState(c)}
                        </Alert>
                    )).unwrapOr(undefined)}
                </Col>
            </Row>
        </>
    )
}
