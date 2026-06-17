import type { TraitDie } from './types';
import type { DieResult, TraitRollResult, DamageRollResult } from './dice';

export function formatDie(die: TraitDie): string {
  return die.bonus ? `d${die.sides}+${die.bonus}` : `d${die.sides}`;
}

function dieStr(r: DieResult): string {
  const acing = r.rolls.length > 1 ? ` (${r.rolls.join('→')})` : '';
  return `d${r.sides}=${r.total}${acing}`;
}

export function formatTraitRoll(res: TraitRollResult): string {
  let s = `trait ${dieStr(res.trait)}`;
  if (res.wild) s += `, wild ${dieStr(res.wild)}`;
  if (res.modifier) s += `, mod ${res.modifier >= 0 ? '+' : ''}${res.modifier}`;
  s += ` → ${res.total} vs TN ${res.tn}`;
  if (res.criticalFailure) s += ' — Critical Failure!';
  else if (res.success) s += res.raises > 0 ? ` — Success, ${res.raises} raise${res.raises > 1 ? 's' : ''}` : ' — Success';
  else s += ' — Failure';
  return s;
}

export function formatDamageRoll(res: DamageRollResult): string {
  const dice = res.dice.map(dieStr).join(' + ');
  return `${dice}${res.bonus ? ` + ${res.bonus}` : ''} → ${res.total}`;
}
