import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export const ConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = "Confirm", 
  cancelText = "Cancel",
  isDestructive = true
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div 
        className="modal-content" 
        style={{ maxWidth: '420px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              borderRadius: '10px', 
              backgroundColor: isDestructive ? '#FEF2F2' : '#FFFBEB',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              border: `1px solid ${isDestructive ? '#FECACA' : '#FDE68A'}`,
              color: isDestructive ? 'var(--accent-urgent)' : '#D97706'
            }}>
              <AlertTriangle size={20} />
            </div>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>{title}</h3>
          </div>
          <button onClick={onClose} className="btn-icon">
            <X size={18} />
          </button>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.5 }}>
          {message}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button className="btn-secondary" onClick={onClose}>
            {cancelText}
          </button>
          <button 
            className="btn-primary" 
            onClick={() => {
              onConfirm();
              onClose();
            }}
            style={{ 
              backgroundColor: isDestructive ? '#DC2626' : 'var(--accent-primary)',
              borderColor: isDestructive ? '#DC2626' : 'var(--accent-primary)',
              color: '#FFFFFF'
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
