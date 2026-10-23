import React from 'react'
import ReactDOM from 'react-dom/client'
import { AdminApp } from './AdminApp.jsx'
import { LMSProvider } from './context/LMSContext.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LMSProvider>
      <ErrorBoundary>
        <AdminApp />
      </ErrorBoundary>
    </LMSProvider>
  </React.StrictMode>,
)
