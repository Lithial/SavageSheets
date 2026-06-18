import type { Character, StatModifierTarget, Status, TraitDie } from './types';
import { BASE_PACE, MAX_FATIGUE, MAX_WOUNDS } from './types';

export function halfDie(die: TraitDie): number {
  return Math.floor(die.sides / 2) + die.bonus;
}

export function modifierTotal(character: Character, target: StatModifierTarget): number {
  let total = 0;
  for (const eh of character.edgesHindrances) {
    for (const m of eh.modifiers) {
      if (m.target === target) total += m.value;
    }
  }
  return total;
}

export function traitModifierTotal(character: Character, label: string): number {
  const key = label.toLowerCase();
  let total = 0;
  for (const eh of character.edgesHindrances) {
    for (const m of eh.modifiers) {
      if (m.target === 'trait' && m.traitName.toLowerCase() === key) total += m.value;
    }
  }
  return total;
}

export function findSkill(character: Character, name: string) {
  return character.skills.find((s) => s.name.toLowerCase() === name.toLowerCase());
}

export function parry(character: Character): number {
  const fighting = findSkill(character, 'Fighting');
  return 2 + (fighting ? halfDie(fighting.die) : 0) + modifierTotal(character, 'parry');
}

export function totalArmor(character: Character): number {
  return character.armor.filter((a) => a.equipped).reduce((sum, a) => sum + a.armor, 0);
}

export function toughness(character: Character): number {
  return 2 + halfDie(character.attributes.vigor) + totalArmor(character) + modifierTotal(character, 'toughness');
}

export function pace(character: Character): number {
  return BASE_PACE + modifierTotal(character, 'pace');
}

export function woundPenalty(status: Status): number {
  return -Math.min(status.wounds, MAX_WOUNDS);
}

export function fatiguePenalty(status: Status): number {
  return -Math.min(status.fatigue, MAX_FATIGUE);
}

export function traitPenalty(status: Status): number {
  return woundPenalty(status) + fatiguePenalty(status);
}
