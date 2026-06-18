import { describe, it, expect } from 'vitest';
import { serializeRoster, parseRoster } from './schema';
import { blankCharacter } from '../domain/defaults';
import { blankArcaneBackground, newPower } from '../domain/defaults';
import { newStatModifier } from '../domain/defaults';

describe('roster serialization', () => {
  it('round-trips a roster through serialize -> parse unchanged', () => {
    const roster = [blankCharacter('A'), blankCharacter('B')];
    const json = serializeRoster(roster);
    const back = parseRoster(json);
    expect(back).toEqual(roster);
  });

  it('rejects malformed JSON', () => {
    expect(() => parseRoster('{ not json')).toThrow();
  });

  it('rejects a roster with an invalid die', () => {
    const roster = [blankCharacter('A')];
    const obj = JSON.parse(serializeRoster(roster));
    obj[0].attributes.agility.sides = 7; // not a valid die
    expect(() => parseRoster(JSON.stringify(obj))).toThrow();
  });
});

describe('arcane background persistence', () => {
  it('round-trips a character with an Arcane Background and powers', () => {
    const c = blankCharacter('Mage');
    c.arcaneBackground = blankArcaneBackground();
    c.arcaneBackground.powers.push(newPower());
    const back = parseRoster(serializeRoster([c]));
    expect(back).toEqual([c]);
  });

  it('migrates a v1 character (no arcaneBackground) to v2 with a null AB', () => {
    const c = blankCharacter('Old');
    const v1 = JSON.parse(serializeRoster([c])) as Array<Record<string, unknown>>;
    delete v1[0].arcaneBackground;
    v1[0].schemaVersion = 1;
    const back = parseRoster(JSON.stringify(v1));
    expect(back[0].arcaneBackground).toBeNull();
    expect(back[0].schemaVersion).toBe(3);
  });
});

describe('stat modifier persistence', () => {
  it('round-trips an edge with a modifier', () => {
    const c = blankCharacter('Mod');
    c.edgesHindrances.push({ id: 'e1', name: 'Brawny', type: 'edge', severity: null, notes: '', modifiers: [newStatModifier()] });
    const back = parseRoster(serializeRoster([c]));
    expect(back).toEqual([c]);
  });

  it('migrates a v2 character (edges without modifiers) to v3', () => {
    const c = blankCharacter('Old2');
    c.edgesHindrances.push({ id: 'e1', name: 'Quick', type: 'edge', severity: null, notes: '', modifiers: [] });
    const v2 = JSON.parse(serializeRoster([c])) as Array<Record<string, unknown>>;
    v2[0].schemaVersion = 2;
    delete (v2[0].edgesHindrances as Array<Record<string, unknown>>)[0].modifiers;
    const back = parseRoster(JSON.stringify(v2));
    expect(back[0].schemaVersion).toBe(3);
    expect(back[0].edgesHindrances[0].modifiers).toEqual([]);
  });
});
