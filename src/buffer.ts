import { Buffer } from 'buffer/';
import { microCcdToCcdString } from './amount';
import { Info } from './Contract';
import { State } from './Piggybank';

export function decodeByte(buffer: Buffer, offset: number) {
    return [buffer.readUInt8(offset), offset + 1];
}

export function decodeAmount(buffer: Buffer, offset: number) {
    return [buffer.readBigUInt64LE(offset), offset + 8];
}

export function decodePiggybankState(buffer: Buffer, contract: Info, queryTime: Date): State {
    const [state] = decodeByte(buffer, 0);
    return {
        contract,
        isSmashed: Boolean(state),
        amount: microCcdToCcdString(contract.amount.microGtuAmount),
        ownerAddress: contract.owner.address,
        queryTime,
    };
}
