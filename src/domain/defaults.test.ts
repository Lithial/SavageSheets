import { describe, it, expect } from 'vitest';
import { blankCharacter, CORE_SKILLS, SCHEMA_VERSION } from './defaults';
import { ATTRIBUTE_KEYS } from './types';

describe('blankCharacter', () => {
  it('is a Wild Card with 3 bennies and the current schema version', () => {
    const c = blankCharacter();
    expect(c.isWildCard).toBe(true);
    expect(c.bennies).toBe(3);
    expect(c.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('starts every attribute at d4', () => {
    const c = blankCharacter();
    for (const key of ATTRIBUTE_KEYS) {
      expect(c.attributes[key]).toEqual({ sides: 4, bonus: 0 });
    }
  });

  it('includes the five core skills at d4', () => {
    const c = blankCharacter();
    expect(c.skills.map((s) => s.name).sort()).toEqual(CORE_SKILLS.map((s) => s.name).sort());
    expect(c.skills.every((s) => s.die.sides === 4)).toBe(true);
  });

  it('gives each character and skill a unique id', () => {
    const a = blankCharacter();
    const b = blankCharacter();
    expect(a.id).not.toBe(b.id);
    const ids = a.skills.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

import { blankArcaneBackground, newPower } from './defaults';

describe('arcane background factories', () => {
  it('blankCharacter has no arcane background and is schema v3', () => {
    const c = blankCharacter();
    expect(c.arcaneBackground).toBeNull();
    expect(c.schemaVersion).toBe(3);
  });

  it('blankArcaneBackground has a d4 arcane skill, 10/10 PP, and no powers', () => {
    const ab = blankArcaneBackground();
    expect(ab.arcaneSkillDie).toEqual({ sides: 4, bonus: 0 });
    expect(ab.powerPoints).toEqual({ current: 10, max: 10 });
    expect(ab.powers).toEqual([]);
  });

  it('newPower returns a unique id and zero-ish defaults', () => {
    const a = newPower();
    const b = newPower();
    expect(a.id).not.toBe(b.id);
    expect(a.ppCost).toBe(1);
  });
});

import { newStatModifier } from './defaults';

describe('stat modifiers', () => {
  it('blankCharacter is schema v3', () => {
    expect(blankCharacter().schemaVersion).toBe(3);
  });

  it('newStatModifier defaults to a +1 toughness modifier with a unique id', () => {
    const a = newStatModifier();
    const b = newStatModifier();
    expect(a).toMatchObject({ target: 'toughness', traitName: '', value: 1 });
    expect(a.id).not.toBe(b.id);
  });
});
