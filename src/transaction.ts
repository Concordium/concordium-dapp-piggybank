import {
    AccountTransactionType,
    CcdAmount,
    ContractAddress,
    Energy,
    EntrypointName,
    ReceiveName,
} from '@concordium/web-sdk';
import { WalletConnection } from '@concordium/react-components';
import { Info } from './Contract';
import { MAX_CONTRACT_EXECUTION_ENERGY } from './config';

function contractUpdatePayload(amount: CcdAmount.Type, contract: Info, method: string) {
    return {
        amount,
        address: ContractAddress.create(contract.index, 0),
        receiveName: ReceiveName.create(contract.name, EntrypointName.fromString(method)),
        maxContractExecutionEnergy: Energy.create(MAX_CONTRACT_EXECUTION_ENERGY),
    };
}

export async function submitDeposit(
    connection: WalletConnection,
    amount: CcdAmount.Type,
    account: string,
    contract: Info
) {
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
        contractUpdatePayload(CcdAmount.fromMicroCcd(0), contract, 'smash')
    );
}
