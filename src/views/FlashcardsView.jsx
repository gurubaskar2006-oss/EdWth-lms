import React from 'react';
import { CreditCard } from 'lucide-react';
import { usePageTitle } from '../hooks/usePageTitle';
import { FlashcardsPortal } from '../components/FlashcardsPortal';

export const FlashcardsView = () => {
  usePageTitle('Flashcards');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>


      <FlashcardsPortal />
    </div>
  );
};
