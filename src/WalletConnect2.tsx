import SignClient from "@walletconnect/sign-client";
import {Alert, Button} from "react-bootstrap";
import QRCodeModal from "@walletconnect/qrcode-modal";
import {SessionTypes} from "@walletconnect/types";
import {Result, ResultAsync} from "neverthrow";
import {Info} from "./Contract";
import {contractUpdatePayload, resultFromTruthy} from "./util";
import {
    AccountAddress,
    AccountTransaction,
    AccountTransactionSignature,
    AccountTransactionType,
    getAccountTransactionHash,
    GtuAmount,
    JsonRpcClient,
    TransactionExpiry
} from "@concordium/web-sdk";
import {CHAIN_ID} from "./config";

async function connect(client: SignClient, setConnectedSession: (session: SessionTypes.Struct) => void) {
    try {
        const {uri, approval} = await client.connect({
            requiredNamespaces: {
                ccd: {
                    methods: [
                        'signTransaction',
                    ],
                    chains: [CHAIN_ID],
                    events: ['chainChanged', 'accountsChanged'],
                },
            },
        });

        // Open QRCode modal if a URI was returned (i.e. we're not connecting an existing pairing).
        if (uri) {
            console.log('opening QR code modal');
            QRCodeModal.open(uri, () => {
                console.debug('QR code modal closed');
            });
        }

        // Await session approval from the wallet.
        const session = await approval();
        setConnectedSession(session);
    } finally {
        // Close the QRCode modal in case it was open.
        QRCodeModal.close();
    }
}

async function disconnect(client: SignClient, session: SessionTypes.Struct, clearConnectedSession: () => void) {
    const {topic} = session;
    const reason = {code: 1337, message: "something something reason"};
    await client.disconnect({topic, reason})
    clearConnectedSession();
}

function stringifyJsonWithBigints(data: any) {
    return JSON.stringify(data, (key, value) => {
        if (typeof value === "bigint") {
            return value.toString();
        }
        return value;
    });
}

export async function signTransaction(client: SignClient, session: SessionTypes.Struct, chainId: string, transaction: AccountTransaction) {
    const params = {
        type: transaction.type.toString(),
        header: {
            sender: transaction.header.sender.address,
            expiry: transaction.header.expiry.toString(),
            nonce: transaction.header.nonce.toString(),
        },
        payload: stringifyJsonWithBigints(transaction.payload),
    };
    return await client.request({
        topic: session.topic,
        request: {
            method: "signTransaction",
            params,
        },
        chainId,
    }) as AccountTransactionSignature;
}

export async function sendTransaction(client: JsonRpcClient, transaction: AccountTransaction, signature: AccountTransactionSignature) {
    const result = await client.sendAccountTransaction(transaction, signature);
    if (!result) {
        throw new Error("transaction was rejected by the node");
    }
    return getAccountTransactionHash(transaction, signature);
}

export function resolveAccount(session: SessionTypes.Struct) {
    const fullAddress = session.namespaces["ccd"].accounts[0];
    return fullAddress.substring(fullAddress.lastIndexOf(":") + 1);
}

export async function signAndSendTransaction(signClient: SignClient, session: SessionTypes.Struct, rpcClient: JsonRpcClient, chainId: string, amount: GtuAmount, account: string, contract: Info, method: string) {
    const sender = new AccountAddress(account);
    const nonce = await rpcClient.getNextAccountNonce(sender).then(n => n?.nonce);
    if (!nonce) {
        throw new Error("cannot resolve next nonce");
    }
    const expiry = new TransactionExpiry(new Date(Date.now() + 3600000)); // from browser-wallet
    const transaction = {
        type: AccountTransactionType.UpdateSmartContractInstance,
        header: {sender, nonce, expiry},
        payload: contractUpdatePayload(amount, contract, method),
    };
    const signature = await signTransaction(signClient, session, chainId, transaction)
    return sendTransaction(rpcClient, transaction, signature);
}

export function trySignSend(client: Result<SignClient, string> | undefined, session: SessionTypes.Struct | undefined, contract: Info | undefined, signSend: (client: SignClient, session: SessionTypes.Struct, contractInfo: Info) => ResultAsync<string, string>) {
    return Result.combine<[Result<SignClient, string>, Result<SessionTypes.Struct, string>, Result<Info, string>]>([
        resultFromTruthy(client, "not initialized").andThen(r => r),
        resultFromTruthy(session, "no session connected"),
        resultFromTruthy(contract, "no contract"),
    ])
        .asyncAndThen(
            ([client, account, contract]) => signSend(client, account, contract),
        )
}

interface Props {
    client: SignClient;
    connectedSession?: SessionTypes.Struct;
    setConnectedSession: (session: SessionTypes.Struct | undefined) => void;
    connectionError: string | undefined;
}

export default function WalletConnect2(props: Props) {
    const {client, connectedSession, setConnectedSession, connectionError} = props;

    return (
        <>
            {!connectedSession && (
                <Button onClick={() => connect(client, setConnectedSession).catch(console.error)}>Connect</Button>
            )}
            {connectedSession && (
                <>
                    <Alert variant="success">
                        Connected:
                        <ul>
                            <li>Topic: {connectedSession.topic}</li>
                            <li>Relay protocol: {connectedSession.relay.protocol}</li>
                            <li>Relay data: {connectedSession.relay.data}</li>
                            <li>Expiry: {connectedSession.expiry}</li>
                            <li>Acknowledged: {connectedSession.acknowledged}</li>
                            <li>Controller: {connectedSession.controller}</li>
                            <li>
                                Namespaces:
                                <ul>
                                    {
                                        Object.entries(connectedSession.namespaces).map(
                                            ([key, ns]) => {
                                                return (
                                                    <li key={key}>
                                                        Key: {key}
                                                        Accounts: {ns.accounts.join(", ")}
                                                        Methods: {ns.methods.join(", ")}
                                                        Events: {ns.events.join(", ")}
                                                        Extension: {JSON.stringify(ns.extension)}
                                                    </li>
                                                );
                                            }
                                        )
                                    }
                                </ul>
                            </li>
                            <li>
                                Required namespaces:
                                <ul>
                                    {
                                        Object.entries(connectedSession.requiredNamespaces).map(
                                            ([key, ns]) => {
                                                return (
                                                    <li key={key}>
                                                        Key: {key}
                                                        Chains: {ns.chains.join(", ")}
                                                        Methods: {ns.methods.join(", ")}
                                                        Events: {ns.events.join(", ")}
                                                        Extension: {JSON.stringify(ns.extension)}
                                                    </li>
                                                );
                                            }
                                        )
                                    }
                                </ul>
                            </li>
                            <li>Self public key: {connectedSession.self.publicKey}</li>
                            <li>Self metadata name: {connectedSession.self.metadata.name}</li>
                            <li>Self metadata url: {connectedSession.self.metadata.url}</li>
                            <li>Self metadata icons: {connectedSession.self.metadata.icons.join(", ")}</li>
                            <li>Self metadata description: {connectedSession.self.metadata.description}</li>
                            <li>Peer public key: {connectedSession.peer.publicKey}</li>
                            <li>Peer metadata name: {connectedSession.peer.metadata.name}</li>
                            <li>Peer metadata url: {connectedSession.peer.metadata.url}</li>
                            <li>Peer metadata icons: {connectedSession.peer.metadata.icons.join(", ")}</li>
                            <li>Peer metadata description: {connectedSession.peer.metadata.description}</li>
                        </ul>
                    </Alert>
                    {connectionError && (
                        <Alert variant="danger">
                            Ping error: {connectionError}
                        </Alert>
                    )}
                    <Button
                        onClick={
                            () =>
                                disconnect(
                                    client,
                                    connectedSession,
                                    () => setConnectedSession(undefined),
                                )
                                    .catch(console.error)
                        }>
                        Disconnect
                    </Button>
                </>
            )}
        </>
    );
}
