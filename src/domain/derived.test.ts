import { describe, it, expect } from 'vitest';
import { parry, toughness, pace, halfDie, traitPenalty } from './derived';
import { blankCharacter } from './defaults';
import type { Character } from './types';

function make(overrides: (c: Character) => void): Character {
  const c = blankCharacter('Test');
  overrides(c);
  return c;
}

describe('halfDie', () => {
  it('is sides/2 plus bonus', () => {
    expect(halfDie({ sides: 6, bonus: 0 })).toBe(3);
    expect(halfDie({ sides: 12, bonus: 2 })).toBe(8);
  });
});

describe('parry', () => {
  it('is 2 when there is no Fighting skill', () => {
    const c = make((c) => { c.skills = c.skills.filter((s) => s.name !== 'Fighting'); });
    expect(parry(c)).toBe(2);
  });

  it('is 2 + half the Fighting die', () => {
    const c = make((c) => { c.skills.push({ id: 'f', name: 'Fighting', attribute: 'agility', die: { sides: 8, bonus: 0 } }); });
    expect(parry(c)).toBe(6); // 2 + 4
  });
});

describe('toughness', () => {
  it('is 2 + half Vigor + equipped armor', () => {
    const c = make((c) => {
      c.attributes.vigor = { sides: 10, bonus: 0 }; // half = 5
      c.armor.push({ id: 'a', name: 'Vest', armor: 2, equipped: true, notes: '' });
      c.armor.push({ id: 'b', name: 'Spare', armor: 4, equipped: false, notes: '' });
    });
    expect(toughness(c)).toBe(9); // 2 + 5 + 2 (spare not equipped)
  });
});

describe('pace', () => {
  it('is the base pace with no modifiers', () => {
    expect(pace(blankCharacter())).toBe(6);
  });
});

describe('traitPenalty', () => {
  it('is -1 per wound (max -3) plus -1 per fatigue (max -2)', () => {
    expect(traitPenalty({ shaken: false, wounds: 2, fatigue: 1 })).toBe(-3);
    expect(traitPenalty({ shaken: false, wounds: 5, fatigue: 5 })).toBe(-5);
  });
});

import { traitModifierTotal } from './derived';

function withEdgeMods(mods: Array<{ target: string; traitName?: string; value: number }>): Character {
  return make((c) => {
    c.edgesHindrances.push({
      id: 'e1', name: 'Test', type: 'edge', severity: null, notes: '',
      modifiers: mods.map((m, i) => ({ id: `m${i}`, target: m.target as never, traitName: m.traitName ?? '', value: m.value })),
    });
  });
}

describe('stat modifiers in derived stats', () => {
  it('parry and toughness include matching modifiers', () => {
    const c = withEdgeMods([{ target: 'parry', value: 1 }, { target: 'toughness', value: 2 }]);
    c.attributes.vigor = { sides: 6, bonus: 0 }; // half = 3 -> toughness base 5
    expect(parry(c)).toBe(3);      // 2 + 0 (no Fighting) + 1
    expect(toughness(c)).toBe(7);  // 2 + 3 + 0 armor + 2
  });

  it('pace adds pace modifiers to the base', () => {
    const c = withEdgeMods([{ target: 'pace', value: 2 }]);
    expect(pace(c)).toBe(8); // 6 + 2
  });

  it('traitModifierTotal matches trait modifiers by name, case-insensitively', () => {
    const c = withEdgeMods([
      { target: 'trait', traitName: 'Notice', value: 2 },
      { target: 'toughness', value: 5 },
    ]);
    expect(traitModifierTotal(c, 'notice')).toBe(2);
    expect(traitModifierTotal(c, 'Stealth')).toBe(0);
  });
});
