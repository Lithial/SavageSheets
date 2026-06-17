export const DIE_SIDES = [4, 6, 8, 10, 12] as const;
export type DieSides = (typeof DIE_SIDES)[number];

export interface TraitDie {
  sides: DieSides;
  bonus: number; // 0,1,2 for d12+1/+2 (negatives allowed for special cases)
}

export type AttributeKey = 'agility' | 'smarts' | 'spirit' | 'strength' | 'vigor';
export const ATTRIBUTE_KEYS: AttributeKey[] = ['agility', 'smarts', 'spirit', 'strength', 'vigor'];

export interface Skill {
  id: string;
  name: string;
  attribute: AttributeKey;
  die: TraitDie;
}

export type EdgeHindranceType = 'edge' | 'hindrance';
export type HindranceSeverity = 'minor' | 'major';

export interface EdgeOrHindrance {
  id: string;
  name: string;
  type: EdgeHindranceType;
  severity: HindranceSeverity | null; // only meaningful for hindrances
  notes: string;
}

export interface Weapon {
  id: string;
  name: string;
  damageDice: TraitDie[]; // dice rolled for damage (ace)
  addStrength: boolean;   // prepend the character's Strength die
  damageBonus: number;    // flat bonus
  range: string;          // free text, e.g. "12/24/48"
  rof: number;
  ap: number;
  notes: string;
}

export interface Armor {
  id: string;
  name: string;
  armor: number;
  equipped: boolean; // contributes to Toughness when equipped
  notes: string;
}

export interface GearItem {
  id: string;
  name: string;
  quantity: number;
  notes: string;
}

export interface Status {
  shaken: boolean;
  wounds: number;  // 0..MAX_WOUNDS (MAX_WOUNDS = Incapacitated)
  fatigue: number; // 0..MAX_FATIGUE
}

export interface RollLogEntry {
  id: string;
  at: number;
  label: string;             // e.g. "Fighting", "Strength", "Longsword damage"
  kind: 'trait' | 'damage';
  detail: string;            // human-readable breakdown
  total: number;
  success: boolean | null;   // trait only
  raises: number | null;     // trait only
  criticalFailure: boolean | null;
}

export interface Character {
  id: string;
  schemaVersion: number;
  name: string;
  ancestry: string;
  isWildCard: boolean;
  bennies: number;
  attributes: Record<AttributeKey, TraitDie>;
  skills: Skill[];
  edgesHindrances: EdgeOrHindrance[];
  weapons: Weapon[];
  armor: Armor[];
  gear: GearItem[];
  status: Status;
  rollLog: RollLogEntry[];
  updatedAt: number;
}

export const MAX_WOUNDS = 3;
export const MAX_FATIGUE = 2;
export const BASE_PACE = 6;
