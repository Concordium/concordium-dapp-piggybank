import { WithWalletConnector } from '@concordium/react-components';
import React from 'react';
import App from './App';
import { TESTNET } from './config';

export default function Root() {
    return <WithWalletConnector network={TESTNET}>{(props) => <App {...props} />}</WithWalletConnector>;
}
