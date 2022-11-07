import { Alert, Button } from 'react-bootstrap';
import { WalletApi } from '@concordium/browser-wallet-api-helpers';
import { AccountTransactionType, GtuAmount } from '@concordium/web-sdk';
import { Result, ResultAsync } from 'neverthrow';
import { Info } from './Contract';
import { contractUpdatePayload, resultFromTruthy, resultFromTruthyResult } from './util';
import { CCDSCAN_URL } from './config';

interface Props {
    client: WalletApi;
    connectedAccount: string | undefined;
    setConnectedAccount: (a: string | undefined) => void;
}

async function connect(client: WalletApi, setConnectedAccount: (a: string | undefined) => void) {
    const account = await client.connect();
    return setConnectedAccount(account);
}

export async function deposit(client: WalletApi, amount: GtuAmount, account: string, contract: Info) {
    return client.sendTransaction(
        account,
        AccountTransactionType.UpdateSmartContractInstance,
        contractUpdatePayload(amount, contract, 'insert')
    );
}

export async function smash(client: WalletApi, account: string, contract: Info) {
    return client.sendTransaction(
        account,
        AccountTransactionType.UpdateSmartContractInstance,
        contractUpdatePayload(new GtuAmount(BigInt(0)), contract, 'smash')
    );
}

// TODO Replace this crap with wrapper of 'client.sendTransaction' and just use that instead...
export function wrapPromise<C, S>(send: (client: C, session: S, contract: Info) => Promise<string>) {
    return (client: C, session: S, contract: Info) =>
        ResultAsync.fromPromise(send(client, session, contract), (e) => (e as Error).message);
}

export function trySendTransaction(
    client: Result<WalletApi, string> | undefined,
    account: string | undefined,
    contract: Info | undefined,
    send: (client: WalletApi, account: string, contract: Info) => ResultAsync<string, string>
) {
    return Result.combine<[Result<WalletApi, string>, Result<string, string>, Result<Info, string>]>([
        resultFromTruthyResult(client, 'not initialized'),
        resultFromTruthy(account, 'no account connected'),
        resultFromTruthy(contract, 'no contract'),
    ])
        .asyncAndThen(([client, account, contract]) => send(client, account, contract))
        .map((txHash) => {
            console.debug(`https://${CCDSCAN_URL}/?dcount=1&dentity=transaction&dhash=${txHash}`);
            return txHash;
        });
}

export default function BrowserWallet(props: Props) {
    const { client, connectedAccount, setConnectedAccount } = props;

    return (
        <>
            {connectedAccount && (
                <Alert variant="success">
                    <p>
                        Connected to account <code>{connectedAccount}</code>.
                    </p>
                    <p>
                        The wallet currently only exposes the %quot;most recently selected%quot; connected account, even
                        if more than one is actually connected. Select and disconnect accounts through the wallet.
                    </p>
                </Alert>
            )}
            {!connectedAccount && (
                <>
                    <p>No wallet connection</p>
                    <Button onClick={() => connect(client, setConnectedAccount).catch(console.error)}>Connect</Button>
                </>
            )}
        </>
    );
}
