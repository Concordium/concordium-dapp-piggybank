import React, {useEffect, useState} from 'react';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';

import './App.css';
import {Container} from "react-bootstrap";
import Alert from 'react-bootstrap/Alert';
import {AccountAddress, GtuAmount, HttpProvider, isInstanceInfoV0, JsonRpcClient} from "@concordium/web-sdk";
import {err, ok, Result} from "neverthrow";

const JSON_RPC_URL = "https://json-rpc.testnet.concordium.com";
const rpc = new JsonRpcClient(new HttpProvider(JSON_RPC_URL));

interface Contract {
    name: string;
    amount: GtuAmount;
    owner: AccountAddress;
}

function App() {
    const [contractInput, setContractInput] = useState("");
    const [contract, setContract] = useState<Result<Contract, string>>();

    useEffect(
        () => {
            setContract(undefined);
            if (contractInput) {
                console.debug(`Looking up contract {contract}`);
                rpc.getInstanceInfo({index: BigInt(contractInput), subindex: BigInt(0)}).then((info) => {
                    if (!info) {
                        return setContract(err(`contract ${contractInput} not found`));
                    }

                    const {version, name, owner, amount} = info;
                    const prefix = "init_";
                    if (!name.startsWith(prefix)) {
                        return setContract(err(`name "${(name)}" doesn't start with "init_"`));
                    }
                    const trimmedName = name.substring(prefix.length);
                    // Check smart contract version - only v0 is supported.
                    if (!isInstanceInfoV0(info)) {
                        return setContract(err(`unsupported smart contract version: ${version}`));
                    }
                    return setContract(ok({name: trimmedName, amount, owner}));
                });
            }
        }, [contractInput]
    )

    return (
        <Container>
            <Row>
                <h1>Piggybank dApp</h1>
            </Row>
            <Row>
                <Col>
                    <Form>
                        <Form.Group as={Row} className="mb-3" controlId="contract">
                            <Form.Label column sm={2}>
                                Contract
                            </Form.Label>
                            <Col sm={10}>
                                <Form.Control type="text" placeholder="Address (index)" value={contractInput}
                                              onChange={e => setContractInput(e.currentTarget.value)}/>
                            </Col>
                        </Form.Group>
                    </Form>
                </Col>
            </Row>
            <Row>
                <Col sm={2}/>
                <Col sm={10}>
                    {contract?.match(c => (
                        <Alert variant="secondary">
                                <Row>
                                    <Col sm={2}> Name: </Col>
                                    <Col sm={10}>
                                        <code>{c.name}</code>
                                    </Col>
                                </Row>
                                <Row>
                                    <Col sm={2}> Owner: </Col>
                                    <Col sm={10}>
                                        <code>{c.owner.address}</code>
                                    </Col>
                                </Row>
                                <Row>
                                    <Col sm={2}>
                                        Balance:
                                    </Col>
                                    <Col sm={10}>
                                        {c.amount.microGtuAmount.toString()} μCCD
                                    </Col>
                                </Row>
                        </Alert>
                        ), err =>
                            <Alert variant="danger">
                                <div style={{color: "red"}}>{err}</div>
                            </Alert>
                    )}
                </Col>
            </Row>
            <hr/>
        </Container>
    );
}

export default App;
