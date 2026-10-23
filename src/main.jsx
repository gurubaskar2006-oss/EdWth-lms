import React from 'react';
import ReactDOM from 'react-dom/client';
import { LMSProvider } from './context/LMSContext';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LMSProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </LMSProvider>
  </React.StrictMode>
);
