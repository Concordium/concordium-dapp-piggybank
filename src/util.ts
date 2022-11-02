import {err, ok, Result} from "neverthrow";
import {AccountTransactionPayload, GtuAmount, toBuffer} from "@concordium/web-sdk";
import {Info} from "./Contract";
import {MAX_CONTRACT_EXECUTION_ENERGY} from "./config";

export function resultFromTruthy<T, E = string>(value: T | undefined, msg: E): Result<T, E> {
    if (value) {
        return ok(value);
    }
    return err(msg);
}

export function resultFromTruthyResult<T, E = string>(value: Result<T, E> | undefined, msg: E): Result<T, E> {
    return resultFromTruthy(value, msg).andThen(r => r);
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

export function accountTransactionPayloadToJson(data: AccountTransactionPayload) {
    return JSON.stringify(data, (key, value) => {
        if (value instanceof GtuAmount) {
            return value.microGtuAmount.toString();
        }
        if (value?.type === "Buffer") {
            // Buffer has already been transformed by its 'toJSON' method.
            return toBuffer(value.data).toString("hex");
        }
        if (typeof value === "bigint") {
            return Number(value);
        }
        return value;
    });
}

