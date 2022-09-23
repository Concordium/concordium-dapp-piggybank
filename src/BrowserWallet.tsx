import {Alert, Button} from "react-bootstrap";
import {WalletApi} from "@concordium/browser-wallet-api-helpers";
import {AccountTransactionType, GtuAmount, toBuffer} from "@concordium/web-sdk";
import {Info} from "./Contract";
import {MAX_CONTRACT_EXECUTION_ENERGY} from "./config";

interface Props {
    client: WalletApi,
    connectedAccount: string | undefined;
    setConnectedAccount: (a: string | undefined) => void;
}

async function connect(client: WalletApi, setConnectedAccount: (a: string | undefined) => void) {
    const account = await client.connect();
    return setConnectedAccount(account);
}

export async function deposit(client: WalletApi, amount: GtuAmount, account: string, contractInfo: Info) {
    return client.sendTransaction(account, AccountTransactionType.UpdateSmartContractInstance, {
        amount,
        contractAddress: {
            index: contractInfo.index,
            subindex: BigInt(0),
        },
        receiveName: `${contractInfo.name}.insert`,
        maxContractExecutionEnergy: MAX_CONTRACT_EXECUTION_ENERGY,
        parameter: toBuffer(""),
    })
        .then(txHash =>
            console.debug(`https://testnet.ccdscan.io/?dcount=1&dentity=transaction&dhash=${txHash}`)
        )
}

export async function smash(client: WalletApi, account: string, contractInfo: Info) {
    return client.sendTransaction(account, AccountTransactionType.UpdateSmartContractInstance, {
        amount: new GtuAmount(BigInt(0)),
        contractAddress: {
            index: contractInfo.index,
            subindex: BigInt(0),
        },
        receiveName: `${contractInfo.name}.smash`,
        maxContractExecutionEnergy: MAX_CONTRACT_EXECUTION_ENERGY,
        parameter: toBuffer(""),
    })
        .then(txHash =>
            console.debug(`https://testnet.ccdscan.io/?dcount=1&dentity=transaction&dhash=${txHash}`)
        )
}

export default function BrowserWallet(props: Props) {
    const {client, connectedAccount, setConnectedAccount} = props;

    return (
        <>
            {connectedAccount && (
                <>
                    <Alert variant="success">
                        <p>
                            Connected to account <code>{connectedAccount}</code>.
                        </p>
                        <p>
                            The wallet currently only exposes the "most recently selected" connected account,
                            even if more than one is actually connected.
                            Select and disconnect accounts through the wallet.
                        </p>
                    </Alert>
                </>
            )}
            {!connectedAccount && (
                <>
                    <p>No wallet connection</p>
                    <Button onClick={() => connect(client, setConnectedAccount).catch(console.error)}>
                        Connect
                    </Button>
                </>
            )}
        </>
    );
}
