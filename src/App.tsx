import React, { useEffect } from 'react';
import './styles/globals.css';
import { AppShell } from './components/layout/AppShell';
import { initDb } from './api/volleyApi';

export default function App() {
  // Initialise les tables BDD une fois au démarrage (idempotent)
  useEffect(() => {
    initDb().catch(() => { /* silencieux si hors-ligne */ });
  }, []);

  return <AppShell />;
}