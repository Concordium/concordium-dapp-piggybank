import React, {useEffect, useState} from 'react';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import './App.css';
import Alert from 'react-bootstrap/Alert';
import {AccountAddress, GtuAmount, JsonRpcClient} from "@concordium/web-sdk";
import {err, ok, Result} from "neverthrow";

export interface State {
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

async function refresh(rpc: JsonRpcClient, index: bigint, setContract: React.Dispatch<ContractResult | undefined>) {
    console.debug(`Looking up contract {contract}`);
    const info = await rpc.getInstanceInfo({index, subindex: BigInt(0)})
    if (!info) {
        return setContract(err(`contract ${index} not found`));
    }

    const {name, owner, amount, methods} = info;
    const prefix = "init_";
    if (!name.startsWith(prefix)) {
        return setContract(err(`name "${(name)}" doesn't start with "init_"`));
    }
    const trimmedName = name.substring(prefix.length);
    return setContract(ok({index, name: trimmedName, amount, owner, methods}));
}

export function Contract(props: Props) {
    const {rpc, contract, setContract, renderState} = props;
    const [contractInput, setContractInput] = useState("");

    useEffect(
        () => {
            if (contractInput) {
                setContract(ok(undefined));
                refresh(rpc, BigInt(contractInput), setContract).catch(console.error);
            } else {
                setContract(undefined);
            }
        }, [contractInput]
    )
    return (
        <>
            <Row>
                <Col>
                    <Form>
                        <Form.Group as={Row} className="mb-3" controlId="contract">
                            <Form.Label column sm={2}>Contract</Form.Label>
                            <Col sm={10}>
                                <Form.Control
                                    type="text"
                                    placeholder="Address (index)"
                                    value={contractInput}
                                    onChange={e => setContractInput(e.currentTarget.value)}
                                />
                            </Col>
                        </Form.Group>
                    </Form>
                </Col>
            </Row>
            <Row>
                <Col sm={2}/>
                <Col sm={10}>
                    {contract?.match(c => !c ? "Loading..." : (
                        <Alert variant="secondary">
                            {renderState(c)}
                        </Alert>
                    ), err => (
                        <Alert variant="danger">
                            <div style={{color: "red"}}>{err}</div>
                        </Alert>
                    ))}
                </Col>
            </Row>
        </>
    )
}
