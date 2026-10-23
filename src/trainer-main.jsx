import React from 'react'
import ReactDOM from 'react-dom/client'
import { TrainerApp } from './TrainerApp.jsx'
import { LMSProvider } from './context/LMSContext.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LMSProvider>
      <ErrorBoundary>
        <TrainerApp />
      </ErrorBoundary>
    </LMSProvider>
  </React.StrictMode>,
)
