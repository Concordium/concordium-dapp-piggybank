import React from 'react';
import { createRoot } from 'react-dom/client';

import RootWalletConnect2 from './RootWalletConnect2';

import './index.css';

const container = document.getElementById('root');

if (!container) {
    throw new Error('Expected container DOM node to be defined');
}

const root = createRoot(container);
root.render(<RootWalletConnect2 />);
