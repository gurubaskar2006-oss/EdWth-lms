import React from 'react';
import { usePageTitle } from '../hooks/usePageTitle';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { useLMS } from '../context/LMSContext';

export const NotFoundView = () => {
  usePageTitle('Page Not Found');
  const { setActiveTab } = useLMS();

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '60vh',
      textAlign: 'center'
    }}>
      <AlertCircle size={64} color="var(--text-muted)" style={{ opacity: 0.5, marginBottom: '1rem' }} />
      <h2 style={{ fontSize: '2rem', color: 'var(--text-primary)', fontWeight: 800 }}>404 - View Not Found</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        The page or view you are looking for does not exist or you don't have access to it.
      </p>
      <button 
        onClick={() => setActiveTab('dashboard')} 
        className="btn-primary" 
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
      >
        <ArrowLeft size={16} /> Return to Dashboard
      </button>
    </div>
  );
};
