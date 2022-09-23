import {err, ok, Result} from "neverthrow";
import {GtuAmount, toBuffer} from "@concordium/web-sdk";
import {Info} from "./Contract";
import {MAX_CONTRACT_EXECUTION_ENERGY} from "./config";

export function resultFromTruthy<T, E = string>(value: T | undefined, msg: E): Result<T, E> {
    if (value) {
        return ok(value);
    }
    return err(msg);
}

export function contractUpdatePayload(amount: GtuAmount, contract: Info, method: string) {
    return {
        amount,
        contractAddress: {
            index: contract.index,
            subindex: BigInt(0),
        },
        receiveName: `${contract.name}.${method}`,
        maxContractExecutionEnergy: MAX_CONTRACT_EXECUTION_ENERGY,
        parameter: toBuffer(""),
    };
}
