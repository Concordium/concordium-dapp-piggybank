import { AccountTransactionType, CcdAmount } from '@concordium/web-sdk';
import { WalletConnection } from '@concordium/react-components';
import { Info } from './Contract';
import { MAX_CONTRACT_EXECUTION_ENERGY } from './config';

function contractUpdatePayload(amount: CcdAmount, contract: Info, method: string) {
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

export async function submitDeposit(connection: WalletConnection, amount: CcdAmount, account: string, contract: Info) {
    return connection.signAndSendTransaction(
        account,
        AccountTransactionType.Update,
        contractUpdatePayload(amount, contract, 'insert')
    );
}

export async function submitSmash(connection: WalletConnection, account: string, contract: Info) {
    return connection.signAndSendTransaction(
        account,
        AccountTransactionType.Update,
        contractUpdatePayload(new CcdAmount(BigInt(0)), contract, 'smash')
    );
}
