// src/components/layout/UndoButton.tsx
// Le nouveau store n'a plus de undoStack global.
// Le bouton Undo est maintenant géré directement dans InputView
// via removeLastAction / undoLastPoint.
// Ce composant devient un simple bouton flottant
// qui appelle le handler passé en prop depuis AppShell.

import React from 'react';

interface UndoButtonProps {
  onUndo: () => void;
  visible: boolean;
}

export function UndoButton({ onUndo, visible }: UndoButtonProps) {
  if (!visible) return null;

  return (
    <button
      onClick={onUndo}
      aria-label="Annuler le dernier clic terrain"
      style={{
        position: 'fixed',
        bottom: 64,
        right: 12,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: '#2a2a2a',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 24,
        padding: '10px 14px',
        color: '#f0ede6',
        fontSize: 12,
        fontWeight: 700,
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        cursor: 'pointer',
        minHeight: 44,
      }}
    >
      <span style={{ color: '#FFD700', fontSize: 16 }}>&#8629;</span>
      <span style={{ color: '#a0998e' }}>Annuler</span>
    </button>
  );
}
