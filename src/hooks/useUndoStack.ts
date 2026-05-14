// src/hooks/useUndoStack.ts
// Adapté au nouveau store : plus de undoStack global.
// Expose deux actions selon le contexte :
//   - removeLastAction(rallyId) si un rally est en cours
//   - undoLastPoint()           si aucun rally actif

import { useMatchStore } from '../store/matchStore';

export function useUndoStack() {
  const activeRallyId    = useMatchStore((s) => s.activeRallyId);
  const rallies          = useMatchStore((s) => s.rallies);
  const removeLastAction = useMatchStore((s) => s.removeLastAction);
  const undoLastPoint    = useMatchStore((s) => s.undoLastPoint);

  const activeRally = rallies.find((r) => r.id === activeRallyId) ?? null;
  const hasActions  = (activeRally?.actions.length ?? 0) > 0;

  // Peut annuler si : rally actif avec des actions, OU au moins un point terminé
  const canUndo = hasActions || rallies.length > 0;

  const lastLabel: string = (() => {
    if (activeRally && hasActions) {
      const last = activeRally.actions[activeRally.actions.length - 1];
      const labels: Record<string, string> = {
        service: 'service', service_fault: 'faute svc',
        reception: 'réception', set: 'passe', attack: 'attaque',
        defense: 'défense', block: 'bloc', support: 'soutiens',
      };
      return 'Annuler ' + (labels[last.kind] ?? last.kind);
    }
    if (rallies.length > 0) return 'Annuler point #' + rallies[rallies.length - 1].pointNumber;
    return 'Annuler';
  })();

  const undo = () => {
    if (activeRallyId && hasActions) {
      removeLastAction(activeRallyId);
    } else {
      undoLastPoint();
    }
  };

  return { canUndo, lastLabel, undo };
}
