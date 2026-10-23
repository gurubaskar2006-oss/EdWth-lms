import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem', textAlign: 'center' }}>
          <div className="card" style={{ maxWidth: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', border: '1px solid #FECACA', backgroundColor: '#FEF2F2' }}>
            <AlertTriangle size={48} color="var(--accent-urgent)" />
            <h2 style={{ fontSize: '1.5rem', color: 'var(--text-primary)' }}>Something went wrong</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              We're sorry, but the application encountered an unexpected error.
            </p>
            <button 
              className="btn-primary" 
              onClick={() => window.location.reload()}
              style={{ marginTop: '1rem' }}
            >
              <RefreshCw size={16} />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
