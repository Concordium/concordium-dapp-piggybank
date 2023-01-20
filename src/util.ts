import { err, ok, Result } from 'neverthrow';
import { AccountTransactionPayload, AccountTransactionType, CcdAmount, toBuffer } from '@concordium/web-sdk';
import { WalletConnection } from '@concordium/react-components';
import { Info } from './Contract';
import { MAX_CONTRACT_EXECUTION_ENERGY } from './config';

export function resultFromTruthy<T, E = string>(value: T | undefined, msg: E): Result<T, E> {
    if (value) {
        return ok(value);
    }
    return err(msg);
}

export function contractUpdatePayload(amount: CcdAmount, contract: Info, method: string) {
    return {
        amount,
        address: {
            index: contract.index,
            subindex: BigInt(0),
        },
        receiveName: `${contract.name}.${method}`,
        maxContractExecutionEnergy: MAX_CONTRACT_EXECUTION_ENERGY,
    };
}

export function accountTransactionPayloadToJson(data: AccountTransactionPayload) {
    return JSON.stringify(data, (key, value) => {
        if (value?.type === 'Buffer') {
            // Buffer has already been transformed by its 'toJSON' method.
            return toBuffer(value.data).toString('hex');
        }
        if (typeof value === 'bigint') {
            return Number(value);
        }
        return value;
    });
}

export async function deposit(connection: WalletConnection, amount: CcdAmount, account: string, contract: Info) {
    return connection.signAndSendTransaction(
        account,
        AccountTransactionType.Update,
        contractUpdatePayload(amount, contract, 'insert'),
        {},
        ''
    );
}

export async function smash(connection: WalletConnection, account: string, contract: Info) {
    return connection.signAndSendTransaction(
        account,
        AccountTransactionType.Update,
        contractUpdatePayload(new CcdAmount(BigInt(0)), contract, 'smash'),
        {},
        ''
    );
}
