import { TESTNET, WalletConnection } from '@concordium/react-components';
import { Result, ResultAsync } from 'neverthrow';
import { useCallback } from 'react';
import { CcdAmount } from '@concordium/web-sdk';
import { Info } from './Contract';
import { resultFromTruthy } from './util';
import { submitDeposit, submitSmash } from './transaction';
import { errorString } from './error';

export function usePiggybank(
    connection: WalletConnection | undefined,
    account: string | undefined,
    contract: Info | undefined
) {
    const canDeposit = Boolean(account);
    const canSmash = canDeposit && account === contract?.owner.address;
    const deposit = useCallback(
        (amount: bigint) =>
            Result.combine([
                resultFromTruthy(connection, 'no connection initialized'),
                resultFromTruthy(account, 'no account connected'),
                resultFromTruthy(contract, 'no contract'),
            ])
                .asyncAndThen(([client, account, contract]) =>
                    ResultAsync.fromPromise(
                        submitDeposit(client, CcdAmount.fromMicroCcd(amount), account, contract),
                        errorString
                    )
                )
                .map((txHash) => {
                    console.debug(`${TESTNET.ccdScanBaseUrl}/?dcount=1&dentity=transaction&dhash=${txHash}`);
                    return txHash;
                })
                .match(
                    (txHash) => console.log('deposit transaction submitted', { hash: txHash }),
                    (e) => console.error('cannot submit deposit transaction', { error: e })
                ),
        [connection, account, contract]
    );
    const smash = useCallback(
        () =>
            Result.combine([
                resultFromTruthy(connection, 'no connection initialized'),
                resultFromTruthy(account, 'no account connected'),
                resultFromTruthy(contract, 'no contract'),
            ])
                .asyncAndThen(([client, account, contract]) =>
                    ResultAsync.fromPromise(submitSmash(client, account, contract), errorString)
                )
                .map((txHash) => {
                    console.debug(`${TESTNET.ccdScanBaseUrl}/?dcount=1&dentity=transaction&dhash=${txHash}`);
                    return txHash;
                })
                .match(
                    (txHash) => console.log('smash transaction submitted', { hash: txHash }),
                    (e) => console.error('cannot submit smash transaction', { error: e })
                ),
        [connection, account, contract]
    );
    return { canDeposit, canSmash, deposit, smash };
}
