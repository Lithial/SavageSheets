import type { AttributeKey, Character, DieSides, Skill, TraitDie } from './types';

export const SCHEMA_VERSION = 1;

const d = (sides: DieSides, bonus = 0): TraitDie => ({ sides, bonus });

export const CORE_SKILLS: Array<{ name: string; attribute: AttributeKey }> = [
  { name: 'Athletics', attribute: 'agility' },
  { name: 'Common Knowledge', attribute: 'smarts' },
  { name: 'Notice', attribute: 'smarts' },
  { name: 'Persuasion', attribute: 'spirit' },
  { name: 'Stealth', attribute: 'agility' },
];

export function newId(): string {
  return crypto.randomUUID();
}

export function blankCharacter(name = 'New Hero'): Character {
  const now = Date.now();
  const skills: Skill[] = CORE_SKILLS.map((s) => ({
    id: newId(),
    name: s.name,
    attribute: s.attribute,
    die: d(4),
  }));
  return {
    id: newId(),
    schemaVersion: SCHEMA_VERSION,
    name,
    ancestry: '',
    isWildCard: true,
    bennies: 3,
    attributes: {
      agility: d(4),
      smarts: d(4),
      spirit: d(4),
      strength: d(4),
      vigor: d(4),
    },
    skills,
    edgesHindrances: [],
    weapons: [],
    armor: [],
    gear: [],
    status: { shaken: false, wounds: 0, fatigue: 0 },
    rollLog: [],
    updatedAt: now,
  };
}
