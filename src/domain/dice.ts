import type { TraitDie } from './types';

export type Rng = () => number;

export interface DieResult {
  sides: number;
  rolls: number[];
  total: number;
}

const WILD_DIE_SIDES = 6;

export function rollDie(sides: number, rng: Rng = Math.random): DieResult {
  const rolls: number[] = [];
  let face: number;
  do {
    face = Math.floor(rng() * sides) + 1;
    rolls.push(face);
  } while (face === sides); // a max roll "Aces" and explodes
  return { sides, rolls, total: rolls.reduce((a, b) => a + b, 0) };
}

export interface TraitRollOptions {
  die: TraitDie;
  wild: boolean;     // Wild Cards roll an extra d6 Wild Die
  modifier?: number; // situational + wound/fatigue penalties, summed by caller
  tn?: number;       // default 4
}

export interface TraitRollResult {
  trait: DieResult;
  traitTotal: number;
  wild: DieResult | null;
  wildTotal: number | null;
  modifier: number;
  tn: number;
  total: number;
  criticalFailure: boolean;
  success: boolean;
  raises: number;
}

export function rollTrait(opts: TraitRollOptions, rng: Rng = Math.random): TraitRollResult {
  const tn = opts.tn ?? 4;
  const modifier = opts.modifier ?? 0;

  const trait = rollDie(opts.die.sides, rng);
  const traitTotal = trait.total + opts.die.bonus + modifier; // bonus applies to trait die only

  let wild: DieResult | null = null;
  let wildTotal: number | null = null;
  if (opts.wild) {
    wild = rollDie(WILD_DIE_SIDES, rng);
    wildTotal = wild.total + modifier; // Wild Die is a plain d6 (no trait bonus)
  }

  const total = Math.max(traitTotal, wildTotal ?? Number.NEGATIVE_INFINITY);

  const traitNat1 = trait.rolls[0] === 1;
  const wildNat1 = wild ? wild.rolls[0] === 1 : false;
  // SWADE: a Critical Failure requires snake-eyes — a Wild Card showing natural 1 on BOTH
  // the trait and Wild Die. An Extra (no Wild Die) rolling a single 1 is a plain failure.
  const criticalFailure = opts.wild ? traitNat1 && wildNat1 : false;

  const success = !criticalFailure && total >= tn;
  const raises = success ? Math.floor((total - tn) / 4) : 0;

  return { trait, traitTotal, wild, wildTotal, modifier, tn, total, criticalFailure, success, raises };
}

export interface DamageRollResult {
  dice: DieResult[];
  bonus: number; // total flat bonus (die bonuses + flat)
  total: number;
}

export function rollDamage(dice: TraitDie[], bonus = 0, rng: Rng = Math.random): DamageRollResult {
  const results = dice.map((d) => rollDie(d.sides, rng));
  const diceBonus = dice.reduce((a, d) => a + d.bonus, 0);
  const totalBonus = diceBonus + bonus;
  const total = results.reduce((a, r) => a + r.total, 0) + totalBonus;
  return { dice: results, bonus: totalBonus, total };
}
