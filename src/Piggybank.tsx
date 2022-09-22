import {JsonRpcClient, toBuffer} from "@concordium/web-sdk";
import {err, ok} from "neverthrow";
import {Info} from "./Contract";
import {decodePiggybankState} from "./buffer";

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
    smashed: boolean,
    amount: string,
}

export default function Piggybank() {
    return (
        <div>TODO: Piggybank component!</div>
    );
}
