import {JsonRpcClient, toBuffer} from "@concordium/web-sdk";
import {err, ok, Result} from "neverthrow";
import {Info} from "./Contract";
import {decodePiggybankState} from "./buffer";
import {useCallback, useState} from "react";
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
    smashed: boolean;
    amount: string;
}

interface Props {
    state: State;
    submitDeposit: (amount: bigint) => void;
    submitSmash: () => void;
}

const parseAmount = Result.fromThrowable(BigInt, () => "invalid amount");

export default function Piggybank(props: Props) {
    const {state, submitDeposit, submitSmash} = props;
    const [depositInput, setDepositInput] = useState<string>("");
    const [validationError, setValidationError] = useState<string>();
    const handleSubmitDeposit = useCallback(
        () => {
            resultFromTruthy(depositInput)
                .andThen(parseAmount)
                .match(submitDeposit, setValidationError);
        },
        [depositInput],
    );
    return (
        <>
            <h1>Piggybank</h1>
            {state.smashed
                ? <p>Already smashed.</p>
                : <p>
                    <Button onClick={submitSmash}>Smash!</Button>
                </p>}
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
            <Button onClick={handleSubmitDeposit}>Deposit</Button>
        </>
    );
}
