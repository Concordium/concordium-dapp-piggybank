import { Buffer } from 'buffer/';
import {microCcdToCcdString} from "./amount";
import {Info} from "./Contract";

export function decodeByte(buffer: Buffer, offset: number) {
    return [buffer.readUInt8(offset), offset + 1];
}

export function decodeAmount(buffer: Buffer, offset: number) {
    return [buffer.readBigUInt64LE(offset), offset + 8];
}

export function decodePiggybankState(buffer: Buffer, contract: Info) {
    const [state] = decodeByte(buffer, 0);
    return {smashed: Boolean(state), amount: microCcdToCcdString(contract.amount.microGtuAmount)};
}
