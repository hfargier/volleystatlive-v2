// src/hooks/usePhaseStateMachine.ts
// Machine à états finis pour guider la saisie d'un échange.
// Séquence : idle -> service_quality (P1)
//         ou idle -> reception_zone -> set_zone -> attack_zone -> quality_review (P2/P3)

import { useState, useCallback } from 'react';
import type { CourtZone, InputStep, PhaseType } from '../types';

export interface PhaseState {
  step: InputStep;
  phase: PhaseType;
  receptionZone: CourtZone | null;
  setZone: CourtZone | null;
  attackZone: CourtZone | null;
}

const INITIAL: PhaseState = {
  step: 'idle',
  phase: 'P1',
  receptionZone: null,
  setZone: null,
  attackZone: null,
};

const STEP_INSTRUCTIONS: Record<InputStep, string> = {
  idle: 'Prêt',
  service_quality: 'Qualité du service ?',
  reception_zone: 'Touchez la zone de réception',
  set_zone: 'Touchez la zone de passe',
  attack_zone: "Touchez la zone d'attaque",
  quality_review: 'Évaluez les qualités (optionnel)',
  point_ended: 'Point terminé',
};

export function usePhaseStateMachine() {
  const [state, setState] = useState<PhaseState>(INITIAL);

  // Démarre une nouvelle phase — réinitialise les zones
  const startPhase = useCallback((phase: PhaseType) => {
    setState({
      ...INITIAL,
      phase,
      step: phase === 'P1' ? 'service_quality' : 'reception_zone',
    });
  }, []);

  // Enregistre un clic sur une zone selon l'étape courante
  const selectZone = useCallback((zone: CourtZone) => {
    setState((prev) => {
      switch (prev.step) {
        case 'reception_zone':
          return { ...prev, receptionZone: zone, step: 'set_zone' };
        case 'set_zone':
          return { ...prev, setZone: zone, step: 'attack_zone' };
        case 'attack_zone':
          return { ...prev, attackZone: zone, step: 'quality_review' };
        default:
          return prev;
      }
    });
  }, []);

  // Remet à zéro (fin de rally ou annulation)
  const reset = useCallback(() => setState(INITIAL), []);

  // Forcer le passage en revue qualité (si toutes zones déjà remplies)
  const goToQualityReview = useCallback(() => {
    setState((prev) => ({ ...prev, step: 'quality_review' }));
  }, []);

  return {
    state,
    startPhase,
    selectZone,
    reset,
    goToQualityReview,
    instruction: STEP_INSTRUCTIONS[state.step],
    isReceptionStep: state.step === 'reception_zone',
    isSetStep: state.step === 'set_zone',
    isAttackStep: state.step === 'attack_zone',
    isQualityStep: state.step === 'quality_review',
  };
}
