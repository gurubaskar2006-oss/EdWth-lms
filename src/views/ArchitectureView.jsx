import React from 'react';
import { ShieldAlert, Lock } from 'lucide-react';
import { usePageTitle } from '../hooks/usePageTitle';

/**
 * ArchitectureView (Decommissioned / Access Restricted)
 *
 * Internal cloud topology, provider configurations, and infrastructure schemas
 * have been permanently decommissioned from authenticated web views to prevent
 * architectural information disclosure.
 */
export const ArchitectureView = () => {
  usePageTitle('Infrastructure Access Restricted');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', padding: '2rem' }}>
      <div style={{ width: '64px', height: '64px', borderRadius: '16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
        <ShieldAlert size={32} color="#EF4444" />
      </div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>
        Infrastructure Console Restricted
      </h2>
      <p style={{ color: 'var(--text-secondary)', maxWidth: '520px', fontSize: '0.9rem', lineHeight: 1.5, margin: '0 0 1.5rem' }}>
        Direct infrastructure topologies, execution cluster nodes, and low-level schemas are restricted to secure out-of-band DevOps tooling and cannot be viewed through application portals.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        <Lock size={14} />
        <span>Strict Infrastructure Boundary Active</span>
      </div>
    </div>
  );
};

export default ArchitectureView;
