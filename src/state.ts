import { JsonRpcClient, toBuffer } from '@concordium/web-sdk';
import { Buffer } from 'buffer/';
import { microCcdToCcdString } from './amount';
import { Info } from './Contract';

export interface PiggybankState {
    contract: Info;
    isSmashed: boolean;
    amount: string;
    ownerAddress: string;
    queryTime: Date;
}

export async function refreshPiggybankState(rpc: JsonRpcClient, contract: Info) {
    console.debug(`Refreshing piggybank state for contract ${contract.index.toString()}`);
    const { version, name, index, methods } = contract;

    const expectedMethods = ['insert', 'smash', 'view'].map((m) => `${name}.${m}`);
    if (!expectedMethods.every(methods.includes.bind(methods))) {
        throw new Error(
            `contract "${name}" is not a piggy bank as it lacks at least one of the expected methods (${expectedMethods.join(
                ', '
            )})`
        );
    }

    const method = `${name}.view`;
    const result = await rpc.invokeContract({ contract: { index, subindex: BigInt(0) }, method });
    if (!result) {
        throw new Error(`invocation of method "${method}" on contract "${index}" returned no result`);
    }
    switch (result.tag) {
        case 'failure': {
            throw new Error(
                `invocation of method "${method}" on v${version} contract "${index}" failed: ${JSON.stringify(
                    result.reason
                )}`
            );
        }
        case 'success': {
            const buffer = toBuffer(result.returnValue || '', 'hex');
            return decodePiggybankState(buffer, contract, new Date());
        }
        default: {
            throw new Error('unexpected result tag');
        }
    }
}

function decodePiggybankState(buffer: Buffer, contract: Info, queryTime: Date): PiggybankState {
    const [state] = decodeByte(buffer, 0);
    return {
        contract,
        isSmashed: Boolean(state),
        amount: microCcdToCcdString(contract.amount.microCcdAmount),
        ownerAddress: contract.owner.address,
        queryTime,
    };
}

function decodeByte(buffer: Buffer, offset: number) {
    return [buffer.readUInt8(offset), offset + 1];
}
