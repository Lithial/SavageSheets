import { describe, it, expect } from 'vitest';
import { rollDie, rollTrait, rollDamage } from './dice';
import { facesRng } from '../test/rng';

describe('rollDie', () => {
  it('returns the face when below max', () => {
    const r = rollDie(6, facesRng([[6, 4]]));
    expect(r.rolls).toEqual([4]);
    expect(r.total).toBe(4);
  });

  it('aces (explodes) on max and sums', () => {
    const r = rollDie(6, facesRng([[6, 6], [6, 6], [6, 2]]));
    expect(r.rolls).toEqual([6, 6, 2]);
    expect(r.total).toBe(14);
  });
});

describe('rollTrait', () => {
  it('takes the higher of trait and wild die and applies the bonus to the trait only', () => {
    // trait d12+1 rolls 5 -> 5+1=6 ; wild d6 rolls 3 -> 3
    const res = rollTrait(
      { die: { sides: 12, bonus: 1 }, wild: true, tn: 4 },
      facesRng([[12, 5], [6, 3]]),
    );
    expect(res.traitTotal).toBe(6);
    expect(res.wildTotal).toBe(3);
    expect(res.total).toBe(6);
    expect(res.success).toBe(true);
    expect(res.raises).toBe(0);
  });

  it('counts a raise for every 4 over the TN', () => {
    const res = rollTrait({ die: { sides: 8, bonus: 0 }, wild: false, tn: 4 }, facesRng([[8, 8], [8, 4]]));
    // 8 aces -> +4 = 12; (12-4)/4 = 2 raises
    expect(res.total).toBe(12);
    expect(res.raises).toBe(2);
  });

  it('flags critical failure when trait and wild both show natural 1', () => {
    const res = rollTrait({ die: { sides: 8, bonus: 0 }, wild: true, tn: 4 }, facesRng([[8, 1], [6, 1]]));
    expect(res.criticalFailure).toBe(true);
    expect(res.success).toBe(false);
  });

  it('flags critical failure for an Extra (no wild die) on a single natural 1', () => {
    const res = rollTrait({ die: { sides: 6, bonus: 0 }, wild: false, tn: 4 }, facesRng([[6, 1]]));
    expect(res.criticalFailure).toBe(true);
    expect(res.success).toBe(false);
  });

  it('applies negative modifiers (e.g. wound penalty)', () => {
    const res = rollTrait({ die: { sides: 8, bonus: 0 }, wild: false, tn: 4, modifier: -2 }, facesRng([[8, 5]]));
    expect(res.total).toBe(3);
    expect(res.success).toBe(false);
  });
});

describe('rollDamage', () => {
  it('rolls and aces each die, adds die bonuses and a flat bonus', () => {
    const res = rollDamage(
      [{ sides: 6, bonus: 0 }, { sides: 6, bonus: 0 }],
      1,
      facesRng([[6, 6], [6, 2], [6, 3]]),
    );
    // first d6 aces 6->2 = 8 ; second d6 = 3 ; +1 flat
    expect(res.total).toBe(12);
  });
});
