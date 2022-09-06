import React from 'react';
import { createRoot } from 'react-dom/client';
import { Buffer } from 'buffer';

import RootWalletConnect1 from './RootWalletConnect1';

import './index.css';

// From 'https://github.com/Uniswap/web3-react/issues/423#issuecomment-1161180629'.
window.Buffer = window.Buffer || Buffer;

const container = document.getElementById('root');

if (!container) {
    throw new Error('Expected container DOM node to be defined');
}

const root = createRoot(container);
root.render(<RootWalletConnect1 />);
