import { Alert } from 'react-bootstrap';

interface Props {
    account: string | undefined;
}

export default function BrowserWallet({ account }: Props) {
    if (!account) {
        return null;
    }
    return (
        <Alert variant="success">
            <p>
                Connected to account <code>{account}</code>.
            </p>
            <p>
                The wallet currently only exposes the &quot;most recently selected&quot; connected account, even if more
                than one is actually connected. Select and disconnect accounts through the wallet.
            </p>
        </Alert>
    );
}
