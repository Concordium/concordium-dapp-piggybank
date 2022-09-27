import {JsonRpcClient, toBuffer} from "@concordium/web-sdk";
import {err, ok} from "neverthrow";
import {Info} from "./Contract";
import {decodePiggybankState} from "./buffer";
import {useCallback, useEffect, useState} from "react";
import {resultFromTruthy} from "./util";
import {Button, Form} from "react-bootstrap";

export async function refreshPiggybankState(rpc: JsonRpcClient, contractInfo: Info) {
    const {version, name, index, methods} = contractInfo;

    const expectedMethods = ["insert", "smash", "view"].map(m => `${name}.${m}`);
    if (!expectedMethods.every(methods.includes.bind(methods))) {
        return err(`contract "${name}" is not a piggy bank as it lacks at least one of the expected methods (${expectedMethods.join(", ")})`);
    }

    const method = `${name}.view`;
    const result = await rpc.invokeContract({contract: {index, subindex: BigInt(0)}, method})
    if (!result) {
        return err(`invocation of method "${method}" on contract "${index}" returned no result`);
    }
    switch (result.tag) {
        case "failure":
            return err(`invocation of method "${method}" on v${version} contract "${index}" returned error: ${JSON.stringify(result.reason)}`);
        case "success":
            const buffer = toBuffer(result.returnValue || "", "hex");
            let state = decodePiggybankState(buffer, contractInfo);
            return ok(state);
    }
}

export interface State {
    isSmashed: boolean;
    amount: string;
    ownerAddress: string;
}

interface Props {
    state: State;
    submitDeposit: (amount: bigint) => void;
    submitSmash: () => void;
    canUpdate: boolean;
    canSmash: boolean;
}

export default function Piggybank(props: Props) {
    const {state, submitDeposit, submitSmash, canUpdate, canSmash} = props;
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
            depositAmount && submitDeposit(depositAmount);
        },
        [depositAmount, submitDeposit],
    );
    return (
        <>
            {state.isSmashed
                ? <p>Already smashed.</p>
                :
                (
                    <p>
                        <Button onClick={submitSmash} disabled={!canSmash || !canUpdate}>Smash piggybank!</Button>
                    </p>
                )
            }
            <Form.Control
                type="text"
                placeholder="Deposit amount."
                value={depositInput}
                onChange={e => setDepositInput(e.target.value)}
                isInvalid={Boolean(validationError)}
            />
            <Form.Control.Feedback type="invalid">
                {validationError}
            </Form.Control.Feedback>
            <Button onClick={handleSubmitDeposit} disabled={!canUpdate || !depositInput}>Deposit</Button>
        </>
    );
}
