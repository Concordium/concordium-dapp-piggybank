import {
    ConcordiumGRPCClient,
    ContractAddress,
    ContractName,
    EntrypointName,
    ReceiveName,
    ReturnValue,
} from '@concordium/web-sdk';
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

export async function refreshPiggybankState(rpc: ConcordiumGRPCClient, contract: Info) {
    console.debug(`Refreshing piggybank state for contract ${contract.index.toString()}`);
    const { version, name, index, methods } = contract;

    const expectedMethods = ['insert', 'smash', 'view'].map((m) => `${ContractName.toString(name)}.${m}`);
    if (!expectedMethods.every((e) => methods.map(ReceiveName.toString).includes(e))) {
        throw new Error(
            `contract "${ContractName.toString(
                name
            )}" is not a piggy bank as it lacks at least one of the expected methods (${expectedMethods.join(', ')})`
        );
    }

    const method = ReceiveName.create(name, EntrypointName.fromString('view'));
    const result = await rpc.invokeContract({ contract: ContractAddress.create(index, 0), method });
    console.log('result', result);
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
            const buffer = Buffer.from(ReturnValue.toBuffer(result.returnValue ?? ReturnValue.empty()));
            return decodePiggybankState(buffer, contract, new Date());
        }
        default: {
            throw new Error('unexpected result tag');
        }
    }
}

function decodePiggybankState(buffer: Buffer, contract: Info, queryTime: Date): PiggybankState {
    const [state] = decodeByte(buffer, 0);
    console.log(state);
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
