import { describe, it, expect } from 'vitest';
import { serializeRoster, parseRoster } from './schema';
import { blankCharacter } from '../domain/defaults';

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
