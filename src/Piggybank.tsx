import {JsonRpcClient, toBuffer} from "@concordium/web-sdk";
import {err, ok} from "neverthrow";
import {Info} from "./Contract";
import {decodePiggybankState} from "./buffer";
import {useCallback, useEffect, useState} from "react";
import {resultFromTruthy} from "./util";
import {Button, Col, Form, InputGroup, Row} from "react-bootstrap";

export async function refreshPiggybankState(rpc: JsonRpcClient, contract: Info)  {
    console.debug(`Refreshing piggybank state for contract ${contract.index.toString()}`);
    const {version, name, index, methods} = contract;

    const expectedMethods = ["insert", "smash", "view"].map(m => `${name}.${m}`);
    if (!expectedMethods.every(methods.includes.bind(methods))) {
        throw new Error(`contract "${name}" is not a piggy bank as it lacks at least one of the expected methods (${expectedMethods.join(", ")})`);
    }

    const method = `${name}.view`;
    const result = await rpc.invokeContract({contract: {index, subindex: BigInt(0)}, method})
    if (!result) {
        throw new Error(`invocation of method "${method}" on contract "${index}" returned no result`);
    }
    switch (result.tag) {
        case "failure":
            throw new Error(`invocation of method "${method}" on v${version} contract "${index}" returned error: ${JSON.stringify(result.reason)}`);
        case "success":
            const buffer = toBuffer(result.returnValue || "", "hex");
            return decodePiggybankState(buffer, contract, new Date());
    }
}

export interface State {
    contract: Info;
    isSmashed: boolean;
    amount: string;
    ownerAddress: string;
    queryTime: Date,
}

interface Props {
    submitDeposit: (amount: bigint) => void;
    submitSmash: () => void;
    canUpdate: boolean;
    canSmash: boolean;
}

export default function Piggybank(props: Props) {
    const {submitDeposit, submitSmash, canUpdate, canSmash} = props;
    const [depositInput, setDepositInput] = useState<string>("");
    const [depositAmount, setDepositAmount] = useState<bigint>();
    const [validationError, setValidationError] = useState<string>();

    useEffect(
        () => {
            const [amount, error] =
                resultFromTruthy(depositInput, undefined)
                    .andThen(input => {
                        const amount = Number(input);
                        return Number.isNaN(amount) ? err("invalid input") : ok(amount);
                    })
                    .match<[bigint?, string?]>(
                        a => [BigInt(Math.round(a * 1e6)), undefined],
                        e => [undefined, e],
                    );
            setDepositAmount(amount);
            setValidationError(error);
        },
        [depositInput],
    );

    const handleSubmitDeposit = useCallback(
        () => {
            console.log(`Attempting to deposit ${depositAmount} uCCD.`)
            if (depositAmount) {
                submitDeposit(depositAmount);
                setDepositInput("");
            }
        },
        [depositAmount, submitDeposit],
    );
    return (
        <Row>
            <Form.Group as={Col} md={8}>
                <InputGroup className="mb-3" hasValidation>
                    <InputGroup.Text id="basic-addon1">CCD</InputGroup.Text>
                    <Form.Control
                        type="text"
                        placeholder="Amount to deposit"
                        value={depositInput}
                        onChange={e => setDepositInput(e.target.value)}
                        isInvalid={Boolean(validationError)}
                    />
                    <Button variant="primary" onClick={handleSubmitDeposit}
                            disabled={!canUpdate || !depositAmount}>Deposit</Button>
                    <Form.Control.Feedback type="invalid">
                        {validationError}
                    </Form.Control.Feedback>
                </InputGroup>
            </Form.Group>
            <Form.Group as={Col} md={4}>
                <Button variant="danger" className="w-100" onClick={submitSmash} disabled={!canSmash || !canUpdate}>Smash!</Button>
            </Form.Group>
        </Row>
    );
}
