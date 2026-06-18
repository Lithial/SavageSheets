import { z } from 'zod';
import type { Character } from '../domain/types';

const traitDie = z.object({
  sides: z.union([z.literal(4), z.literal(6), z.literal(8), z.literal(10), z.literal(12)]),
  bonus: z.number().int(),
});

const attributeKey = z.enum(['agility', 'smarts', 'spirit', 'strength', 'vigor']);

const skill = z.object({
  id: z.string(),
  name: z.string(),
  attribute: attributeKey,
  die: traitDie,
});

const edgeOrHindrance = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['edge', 'hindrance']),
  severity: z.enum(['minor', 'major']).nullable(),
  notes: z.string(),
});

const weapon = z.object({
  id: z.string(),
  name: z.string(),
  damageDice: z.array(traitDie),
  addStrength: z.boolean(),
  damageBonus: z.number().int(),
  range: z.string(),
  rof: z.number().int(),
  ap: z.number().int(),
  notes: z.string(),
});

const armor = z.object({
  id: z.string(),
  name: z.string(),
  armor: z.number().int(),
  equipped: z.boolean(),
  notes: z.string(),
});

const gearItem = z.object({
  id: z.string(),
  name: z.string(),
  quantity: z.number().int(),
  notes: z.string(),
});

const power = z.object({
  id: z.string(),
  name: z.string(),
  ppCost: z.number().int(),
  range: z.string(),
  duration: z.string(),
  notes: z.string(),
});

const arcaneBackground = z.object({
  name: z.string(),
  arcaneSkillName: z.string(),
  arcaneSkillDie: traitDie,
  powerPoints: z.object({ current: z.number().int(), max: z.number().int() }),
  powers: z.array(power),
});

const status = z.object({
  shaken: z.boolean(),
  wounds: z.number().int(),
  fatigue: z.number().int(),
});

const rollLogEntry = z.object({
  id: z.string(),
  at: z.number(),
  label: z.string(),
  kind: z.enum(['trait', 'damage']),
  detail: z.string(),
  total: z.number(),
  success: z.boolean().nullable(),
  raises: z.number().nullable(),
  criticalFailure: z.boolean().nullable(),
});

export const characterSchema = z.object({
  id: z.string(),
  schemaVersion: z.number().int(),
  name: z.string(),
  ancestry: z.string(),
  isWildCard: z.boolean(),
  bennies: z.number().int(),
  attributes: z.object({
    agility: traitDie,
    smarts: traitDie,
    spirit: traitDie,
    strength: traitDie,
    vigor: traitDie,
  }),
  skills: z.array(skill),
  edgesHindrances: z.array(edgeOrHindrance),
  weapons: z.array(weapon),
  armor: z.array(armor),
  gear: z.array(gearItem),
  status,
  rollLog: z.array(rollLogEntry),
  arcaneBackground: arcaneBackground.nullable(),
  updatedAt: z.number(),
}) satisfies z.ZodType<Character>;

export const rosterSchema = z.array(characterSchema);

// Backfill fields added after schemaVersion 1 so old data validates and upgrades.
function migrateCharacter(value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const v = value as Record<string, unknown>;
    if (!('arcaneBackground' in v)) {
      return { ...v, arcaneBackground: null, schemaVersion: 2 };
    }
  }
  return value;
}

export function parseCharacterValue(value: unknown): Character {
  return characterSchema.parse(migrateCharacter(value));
}

export function serializeRoster(roster: Character[]): string {
  return JSON.stringify(roster, null, 2);
}

export function parseRoster(json: string): Character[] {
  const data = JSON.parse(json);
  const migrated = Array.isArray(data) ? data.map(migrateCharacter) : data;
  return rosterSchema.parse(migrated);
}
