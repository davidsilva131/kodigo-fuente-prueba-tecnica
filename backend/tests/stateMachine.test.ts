import { describe, expect, it } from 'vitest';
import { isTransitionAllowed, nextStates, transitionError } from '../src/stateMachine';

describe('stateMachine', () => {
  it('permite transiciones secuenciales válidas', () => {
    expect(isTransitionAllowed('scheduled', 'active')).toBe(true);
    expect(isTransitionAllowed('active', 'finished')).toBe(true);
  });

  it('prohíbe saltos y transiciones hacia atrás', () => {
    expect(isTransitionAllowed('scheduled', 'finished')).toBe(false);
    expect(isTransitionAllowed('active', 'scheduled')).toBe(false);
    expect(isTransitionAllowed('finished', 'active')).toBe(false);
    expect(isTransitionAllowed('finished', 'scheduled')).toBe(false);
    expect(isTransitionAllowed('scheduled', 'scheduled')).toBe(false);
  });

  it('nextStates solo expone el estado siguiente', () => {
    expect(nextStates('scheduled')).toEqual(['active']);
    expect(nextStates('active')).toEqual(['finished']);
    expect(nextStates('finished')).toEqual([]);
  });

  it('transitionError devuelve motivo para transiciones inválidas', () => {
    expect(transitionError('scheduled', 'finished')).toMatch(/inválida/i);
    expect(transitionError('active', 'active')).toMatch(/ya está/i);
    expect(transitionError('scheduled', 'active')).toBeNull();
  });
});