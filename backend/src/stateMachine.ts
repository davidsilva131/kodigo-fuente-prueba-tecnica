import type { Status } from './types.js';

/**
 * Máquina de estados de una promoción:
 *   Programada (scheduled) → Activa (active) → Finalizada (finished)
 * Solo se permite transitar al estado siguiente. Nunca hacia atrás.
 */
const TRANSITIONS: Record<Status, Status[]> = {
  scheduled: ['active'],
  active: ['finished'],
  finished: [],
};

export function nextStates(status: Status): Status[] {
  return TRANSITIONS[status];
}

export function isTransitionAllowed(from: Status, to: Status): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** Devuelve el motivo del rechazo o null si la transición es válida. */
export function transitionError(from: Status, to: Status): string | null {
  if (from === to) {
    return `La promoción ya está en estado ${to}`;
  }
  if (!isTransitionAllowed(from, to)) {
    const allowed = TRANSITIONS[from].join(', ') || 'ninguna';
    return `Transición inválida: ${from} → ${to} (permitida: ${allowed})`;
  }
  return null;
}