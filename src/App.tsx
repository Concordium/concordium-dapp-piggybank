import React, {useEffect, useMemo, useState} from 'react';
import Alert from 'react-bootstrap/Alert';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';

import './App.css';
import {Container} from "react-bootstrap";
import {Contract, State as ContractState} from "./Contract"
import {HttpProvider, JsonRpcClient, toBuffer} from "@concordium/web-sdk";
import {JSON_RPC_URL} from "./config";
import {err, ok, Result} from "neverthrow";

const rpc = new JsonRpcClient(new HttpProvider(JSON_RPC_URL));

export default function App() {
    const [contract, setContract] = useState<ContractState>();

    return (
        <Container>
            <Row>
                <Col>
                    <h1>Piggybank dApp</h1>
                </Col>
            </Row>
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
                                <hr/>
                                <Row>
                                    <Col><h5>Piggybank state</h5></Col>
                                </Row>
                                <Row>
                                    <Col>
                                        <PiggybankState rpc={rpc} contract={contract}/>
                                    </Col>
                                </Row>
                            </Alert>
                        )}
                    </Contract>
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

    console.debug(`Loading Piggybank contract state.`);
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
        ({smashed, amount}) => <strong>Piggybank is {smashed ? "smashed" : "not smashed"}.</strong>,
        e => <i>{e}</i>
    ) || <Spinner animation="border"/>;
}
