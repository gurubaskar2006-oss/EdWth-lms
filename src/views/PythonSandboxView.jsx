import React from 'react';
import { usePageTitle } from '../hooks/usePageTitle';
import { PythonSandbox } from '../components/PythonSandbox';

export const PythonSandboxView = () => {
  usePageTitle('Code Lab');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
      <PythonSandbox />
    </div>
  );
};
