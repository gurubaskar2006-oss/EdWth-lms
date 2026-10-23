import React from 'react';
import { useLMS } from '../context/LMSContext';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export const ToastNotifications = () => {
  const { toasts, removeToast, isAuthenticated } = useLMS();

  if (!isAuthenticated || !toasts || toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        zIndex: 9999,
        pointerEvents: 'none'
      }}
    >
      {toasts.map((toast) => {
        const isUrgent = toast.type === 'urgent';
        const isSubtle = toast.type === 'subtle';

        return (
          <div
            key={toast.id}
            style={{
              pointerEvents: 'auto',
              minWidth: '300px',
              maxWidth: '380px',
              backgroundColor: 'var(--bg-surface)',
              border: isUrgent ? '1px solid #FECACA' : isSubtle ? '1px solid var(--border-default)' : '1px solid #A7F3D0',
              borderRadius: 'var(--radius-lg)',
              padding: '0.85rem 1rem',
              boxShadow: isUrgent
                ? '0 8px 24px rgba(220, 38, 38, 0.12)'
                : '0 8px 24px rgba(0, 0, 0, 0.08)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              animation: 'scaleUp 0.25s ease-out'
            }}
          >
            {isUrgent ? (
              <AlertCircle size={18} color="var(--accent-urgent)" style={{ flexShrink: 0, marginTop: '2px' }} />
            ) : (
              <CheckCircle2 size={18} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: isUrgent ? 'var(--accent-urgent)' : 'var(--text-primary)'
                }}
              >
                {toast.title}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {toast.message}
              </div>
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              style={{
                color: 'var(--text-muted)',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px'
              }}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
