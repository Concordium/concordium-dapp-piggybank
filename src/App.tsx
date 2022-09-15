import React, {useEffect, useState} from 'react';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';

import './App.css';
import {Container} from "react-bootstrap";
import {Contract, ContractResult, State as ContractState} from "./Contract"
import {HttpProvider, JsonRpcClient} from "@concordium/web-sdk";
import {JSON_RPC_URL} from "./config";
import {err, ok, Result} from "neverthrow";

const rpc = new JsonRpcClient(new HttpProvider(JSON_RPC_URL));

export default function App() {
    const [contract, setContract] = useState<ContractResult>();

    return (
        <Container>
            <Row>
                <Col>
                    <h1>Piggybank dApp</h1>
                </Col>
            </Row>
            <Row>
                <Col>
                    <Contract
                        rpc={rpc}
                        contract={contract}
                        setContract={setContract}
                        renderState={(contract) => (
                            <>
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
                                <PiggybankState rpc={rpc} contract={contract}/>
                            </>
                        )}
                    />
                </Col>
            </Row>
        </Container>
    );
}

async function refreshPiggybankState(rpc: JsonRpcClient, contractState: ContractState, setPiggybankState: React.Dispatch<Result<string, string>>) {
    const {name, index, methods} = contractState;

    const expectedMethods = ["insert", "smash", "view"].map(m => `${name}.${m}`);
    if (!expectedMethods.every(methods.includes.bind(methods))) {
        return setPiggybankState(err(`contract "${index}" is not a piggy bank (it's lacking at least one of the methods ${expectedMethods.join(", ")})`))
    }

    console.debug(`Loading Piggybank contract state.`);
    const method = `${name}.view`;
    const result = await rpc.invokeContract({contract: {index, subindex: BigInt(0)}, method})
    if (!result) {
        return setPiggybankState(err(`failed invoking method "${method}" on contract "${index}"`));
    }
    switch (result.tag) {
        case "failure":
            return setPiggybankState(err(`invocation failed: ${result.reason}`))
        case "success":
            return setPiggybankState(ok(result.returnValue || ""))
    }
}

function PiggybankState(props: {rpc: JsonRpcClient, contract: ContractState}) {
    const {rpc, contract} = props;
    const [piggybankState, setPiggybankState] = useState<Result<string, string>>();

    useEffect(() => {
        refreshPiggybankState(rpc, contract, setPiggybankState).catch(console.error);
    }, [contract]);

    return piggybankState?.match(state => (
        <div>State: {state}</div>
    ), err =>
        <i>{err}</i>
    ) || <div>Loading...</div>;
}
