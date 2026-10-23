import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import {
  Wifi,
  Laptop,
  Copy,
  Check,
  X,
  Share2,
  Globe,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Smartphone,
  Server
} from 'lucide-react';

export const NetworkShareModal = ({ isOpen, onClose }) => {
  const { addToast } = useLMS();
  const [copiedNetwork, setCopiedNetwork] = useState(false);
  const [copiedLocal, setCopiedLocal] = useState(false);

  if (!isOpen) return null;

  // Detected Local IPv4 on network
  const networkIp = '10.27.227.242';
  const port = '3000';
  const networkUrl = `http://${networkIp}:${port}`;
  const localUrl = `http://localhost:${port}`;

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'network') {
      setCopiedNetwork(true);
      setTimeout(() => setCopiedNetwork(false), 2000);
      addToast('Network Link Copied! 🌐', `Share ${text} with peers on your Wi-Fi/LAN`, 'emerald');
    } else {
      setCopiedLocal(true);
      setTimeout(() => setCopiedLocal(false), 2000);
      addToast('Local Link Copied! 🏠', 'Copied localhost URL to clipboard', 'emerald');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '580px', padding: '2rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: '#EFF6FF',
                color: 'var(--accent-learning)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #BFDBFE'
              }}
            >
              <Wifi size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.3rem', color: 'var(--text-primary)', fontWeight: 800 }}>
                Run & Share on Everyone's Laptop
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Host is open on <strong style={{ color: 'var(--accent-learning)' }}>0.0.0.0:3000</strong> for all devices
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon" style={{ width: '32px', height: '32px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Primary Network Link Card */}
        <div
          style={{
            background: '#F0FDF4',
            border: '1px solid #BBF7D0',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem',
            marginBottom: '1.5rem',
            boxShadow: 'var(--shadow-card)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 800, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
              <Globe size={15} />
              <span>Network Wi-Fi / LAN URL (Share with other laptops):</span>
            </div>
            <span
              style={{
                fontSize: '0.68rem',
                backgroundColor: '#DCFCE7',
                color: 'var(--accent-primary)',
                padding: '2px 6px',
                borderRadius: '4px',
                fontWeight: 800
              }}
            >
              ● LIVE ON LAN
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '0.65rem 0.85rem',
              marginTop: '0.35rem'
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '1.05rem',
                fontWeight: 800,
                color: 'var(--accent-primary)',
                letterSpacing: '0.02em'
              }}
            >
              {networkUrl}
            </span>

            <button
              onClick={() => handleCopy(networkUrl, 'network')}
              className="btn-primary"
              style={{ padding: '0.4rem 0.85rem', fontSize: '0.78rem', gap: '5px' }}
            >
              {copiedNetwork ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedNetwork ? 'Copied!' : 'Copy URL'}</span>
            </button>
          </div>
        </div>

        {/* Instructions for other laptops */}
        <div style={{ marginBottom: '1.5rem' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)', display: 'block', marginBottom: '0.65rem' }}>
            📋 How other laptops can connect in 3 steps:
          </span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                backgroundColor: 'var(--bg-surface-subtle)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                padding: '0.65rem 0.85rem',
                fontSize: '0.82rem',
                color: 'var(--text-secondary)'
              }}
            >
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#EFF6FF', color: 'var(--accent-learning)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.75rem' }}>
                1
              </div>
              <span>Ensure their laptop or phone is connected to the <strong>same Wi-Fi / Ethernet network</strong>.</span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                backgroundColor: 'var(--bg-surface-subtle)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                padding: '0.65rem 0.85rem',
                fontSize: '0.82rem',
                color: 'var(--text-secondary)'
              }}
            >
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#EFF6FF', color: 'var(--accent-learning)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.75rem' }}>
                2
              </div>
              <span>Open Chrome, Edge, Safari, or Firefox and paste <strong style={{ color: 'var(--accent-primary)' }}>{networkUrl}</strong> in the address bar.</span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                backgroundColor: 'var(--bg-surface-subtle)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                padding: '0.65rem 0.85rem',
                fontSize: '0.82rem',
                color: 'var(--text-secondary)'
              }}
            >
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#EFF6FF', color: 'var(--accent-learning)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.75rem' }}>
                3
              </div>
              <span>The full interactive LMS, classrooms, and compiler lab will load directly on their screen!</span>
            </div>
          </div>
        </div>

        {/* Localhost fallback & Host status */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: '1rem',
            fontSize: '0.78rem',
            color: 'var(--text-muted)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Server size={14} color="var(--accent-primary)" />
            <span>Local Host: <strong style={{ color: 'var(--text-primary)' }}>{localUrl}</strong></span>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => handleCopy(localUrl, 'local')}
              className="btn-secondary"
              style={{ fontSize: '0.74rem', padding: '0.3rem 0.6rem' }}
            >
              {copiedLocal ? 'Copied' : 'Copy Localhost'}
            </button>
            <button
              onClick={onClose}
              className="btn-primary"
              style={{ fontSize: '0.74rem', padding: '0.3rem 1rem' }}
            >
              Back / Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
