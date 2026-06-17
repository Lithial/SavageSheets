# Savage Worlds Sheets — Slice 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local-first React app that holds a roster of SWADE character sheets you can build, edit, and play from — rolling exploding trait/damage dice with the Wild Die and live-tracking Wounds, Fatigue, Shaken, and Bennies.

**Architecture:** A pure, framework-free domain layer (dice, derived stats, defaults) under `src/domain/`; a persistence layer (`src/persistence/`) with a Zod-validated `CharacterRepository` over Dexie/IndexedDB; a Zustand store (`src/store/`) that wires domain + persistence and exposes actions; presentational React components (`src/components/`, `src/pages/`) that receive data + callbacks. Data flows UI → store action → immer mutation → debounced persist → re-render.

**Tech Stack:** React 18, Vite, TypeScript (strict), Zustand (+ immer middleware), React Router v6, Tailwind CSS v4, Dexie 4, Zod 3, Vitest + React Testing Library + fake-indexeddb.

## Global Constraints

- **TypeScript strict mode** is on (Vite `react-ts` default); no `any` in committed code.
- **Local-first, no network:** the app makes no HTTP calls; all persistence is IndexedDB. No backend.
- **No copyrighted content:** ship no Pinnacle/SWADE prose. Edges/Hindrances/gear are user-entered; only mechanics and generic skill/attribute names are in code.
- **Pure domain layer:** files under `src/domain/` import nothing from React, the DOM, Dexie, or the store. They are deterministic given an injected `Rng`.
- **Deterministic dice in tests:** dice functions accept an `Rng = () => number` (default `Math.random`); tests inject a controlled RNG. Never assert on `Math.random` output.
- **Die step note:** "half a die" = `sides ÷ 2` → d4→2, d6→3, d8→4, d10→5, d12→6, plus `bonus` for d12+1/+2.
- **Commit after every task** with the message shown in its final step.

---

## File Structure

```
src/
  domain/
    types.ts          # Character + sub-entity types, constants
    dice.ts           # rollDie, rollTrait, rollDamage (pure, Rng-injected)
    format.ts         # formatDie, formatTraitRoll, formatDamageRoll
    derived.ts        # parry, toughness, pace, penalties, findSkill
    defaults.ts       # blankCharacter, CORE_SKILLS, newId, SCHEMA_VERSION
  persistence/
    schema.ts         # Zod schema + serialize/parse roster
    repository.ts     # CharacterRepository interface + Dexie impl
  store/
    characterStore.ts # makeCharacterStore(deps) + useCharacterStore
  components/
    DiePicker.tsx
    SheetHeader.tsx
    DerivedBar.tsx
    StatusTracker.tsx
    AttributesPanel.tsx
    SkillsPanel.tsx
    EdgesHindrancesPanel.tsx
    GearPanel.tsx
    DiceLog.tsx
  pages/
    RosterPage.tsx
    SheetPage.tsx
  test/
    rng.ts            # facesRng test helper
    setup.ts          # jest-dom + fake-indexeddb/auto
  App.tsx
  main.tsx
  index.css
```

---

## Task 1: Scaffold project + tooling

**Files:**
- Create: project files via Vite (`package.json`, `vite.config.ts`, `tsconfig*.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`)
- Create: `src/test/setup.ts`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Scaffold Vite app in the current directory**

Run:
```bash
npm create vite@latest . -- --template react-ts
```
When prompted "Current directory is not empty…", choose **"Ignore files and continue"** (keeps `.git/` and `docs/`).

- [ ] **Step 2: Install dependencies**

```bash
npm install
npm install zustand immer react-router-dom dexie zod
npm install -D tailwindcss @tailwindcss/vite vitest jsdom \
  @testing-library/react @testing-library/jest-dom @testing-library/user-event fake-indexeddb
```

- [ ] **Step 3: Configure Vite (Tailwind v4 + Vitest)**

Replace `vite.config.ts` with:
```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
});
```

- [ ] **Step 4: Wire Tailwind + test setup**

Replace `src/index.css` with:
```css
@import "tailwindcss";
```

Create `src/test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
```

Add the test script to `package.json` `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Replace App with a known marker**

Replace `src/App.tsx` with:
```tsx
export default function App() {
  return <h1>Savage Worlds Sheets</h1>;
}
```

- [ ] **Step 6: Write the smoke test**

Create `src/App.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders the app title', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /savage worlds sheets/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Run the test (expect PASS)**

Run: `npm test`
Expected: 1 passed.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite+React+TS with Tailwind v4 and Vitest"
```

---

## Task 2: Domain types + dice engine + formatting

**Files:**
- Create: `src/domain/types.ts`, `src/domain/dice.ts`, `src/domain/format.ts`, `src/test/rng.ts`
- Test: `src/domain/dice.test.ts`

**Interfaces:**
- Produces:
  - `types.ts`: `DieSides = 4|6|8|10|12`; `TraitDie = { sides: DieSides; bonus: number }`; `AttributeKey`; `ATTRIBUTE_KEYS`; `Skill`; `EdgeOrHindrance`; `Weapon`; `Armor`; `GearItem`; `Status`; `RollLogEntry`; `Character`; constants `MAX_WOUNDS=3`, `MAX_FATIGUE=2`, `BASE_PACE=6`.
  - `dice.ts`: `type Rng = () => number`; `DieResult = { sides; rolls: number[]; total }`; `rollDie(sides, rng?)`; `TraitRollOptions`; `TraitRollResult`; `rollTrait(opts, rng?)`; `DamageRollResult`; `rollDamage(dice, bonus?, rng?)`.
  - `format.ts`: `formatDie(die)`, `formatTraitRoll(res, tn?)`, `formatDamageRoll(res)`.
  - `test/rng.ts`: `facesRng(faces: Array<[number, number]>): Rng`.

- [ ] **Step 1: Write `src/domain/types.ts`** (no test of its own; exercised by later tasks)

```ts
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
```

- [ ] **Step 2: Write the test RNG helper `src/test/rng.ts`**

```ts
import type { Rng } from '../domain/dice';

// Yields exact die faces in order. Each entry is [sides, face]; converts to the
// float that rollDie maps back to `face` via Math.floor(rng()*sides)+1.
export function facesRng(faces: Array<[number, number]>): Rng {
  let i = 0;
  return () => {
    if (i >= faces.length) throw new Error('facesRng exhausted');
    const [sides, face] = faces[i++];
    return (face - 0.5) / sides;
  };
}
```

- [ ] **Step 3: Write the failing dice test `src/domain/dice.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { rollDie, rollTrait, rollDamage } from './dice';
import { facesRng } from '../test/rng';

describe('rollDie', () => {
  it('returns the face when below max', () => {
    const r = rollDie(6, facesRng([[6, 4]]));
    expect(r.rolls).toEqual([4]);
    expect(r.total).toBe(4);
  });

  it('aces (explodes) on max and sums', () => {
    const r = rollDie(6, facesRng([[6, 6], [6, 6], [6, 2]]));
    expect(r.rolls).toEqual([6, 6, 2]);
    expect(r.total).toBe(14);
  });
});

describe('rollTrait', () => {
  it('takes the higher of trait and wild die and applies the bonus to the trait only', () => {
    // trait d12+1 rolls 5 -> 5+1=6 ; wild d6 rolls 3 -> 3
    const res = rollTrait(
      { die: { sides: 12, bonus: 1 }, wild: true, tn: 4 },
      facesRng([[12, 5], [6, 3]]),
    );
    expect(res.traitTotal).toBe(6);
    expect(res.wildTotal).toBe(3);
    expect(res.total).toBe(6);
    expect(res.success).toBe(true);
    expect(res.raises).toBe(0);
  });

  it('counts a raise for every 4 over the TN', () => {
    const res = rollTrait({ die: { sides: 8, bonus: 0 }, wild: false, tn: 4 }, facesRng([[8, 8], [8, 4]]));
    // 8 aces -> +4 = 12; (12-4)/4 = 2 raises
    expect(res.total).toBe(12);
    expect(res.raises).toBe(2);
  });

  it('flags critical failure when trait and wild both show natural 1', () => {
    const res = rollTrait({ die: { sides: 8, bonus: 0 }, wild: true, tn: 4 }, facesRng([[8, 1], [6, 1]]));
    expect(res.criticalFailure).toBe(true);
    expect(res.success).toBe(false);
  });

  it('flags critical failure for an Extra (no wild die) on a single natural 1', () => {
    const res = rollTrait({ die: { sides: 6, bonus: 0 }, wild: false, tn: 4 }, facesRng([[6, 1]]));
    expect(res.criticalFailure).toBe(true);
  });

  it('applies negative modifiers (e.g. wound penalty)', () => {
    const res = rollTrait({ die: { sides: 8, bonus: 0 }, wild: false, tn: 4, modifier: -2 }, facesRng([[8, 5]]));
    expect(res.total).toBe(3);
    expect(res.success).toBe(false);
  });
});

describe('rollDamage', () => {
  it('rolls and aces each die, adds die bonuses and a flat bonus', () => {
    const res = rollDamage(
      [{ sides: 6, bonus: 0 }, { sides: 6, bonus: 0 }],
      1,
      facesRng([[6, 6], [6, 2], [6, 3]]),
    );
    // first d6 aces 6->2 = 8 ; second d6 = 3 ; +1 flat
    expect(res.total).toBe(12);
  });
});
```

- [ ] **Step 4: Run the test (expect FAIL)**

Run: `npx vitest run src/domain/dice.test.ts`
Expected: FAIL — `rollDie`/`rollTrait`/`rollDamage` not exported.

- [ ] **Step 5: Implement `src/domain/dice.ts`**

```ts
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
  const criticalFailure = opts.wild ? traitNat1 && wildNat1 : traitNat1;

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
```

- [ ] **Step 6: Run the test (expect PASS)**

Run: `npx vitest run src/domain/dice.test.ts`
Expected: all pass.

- [ ] **Step 7: Implement `src/domain/format.ts`**

```ts
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
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(domain): types + exploding dice engine (trait/wild/damage) + formatting"
```

---

## Task 3: Derived stats

**Files:**
- Create: `src/domain/derived.ts`
- Test: `src/domain/derived.test.ts`

**Interfaces:**
- Consumes: `Character`, `TraitDie`, `Status`, `MAX_WOUNDS`, `MAX_FATIGUE`, `BASE_PACE` from `types.ts`.
- Produces: `halfDie(die)`, `findSkill(c, name)`, `parry(c)`, `totalArmor(c)`, `toughness(c)`, `pace()`, `woundPenalty(status)`, `fatiguePenalty(status)`, `traitPenalty(status)`.

- [ ] **Step 1: Write the failing test `src/domain/derived.test.ts`**

```ts
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
  it('is the base pace', () => {
    expect(pace()).toBe(6);
  });
});

describe('traitPenalty', () => {
  it('is -1 per wound (max -3) plus -1 per fatigue (max -2)', () => {
    expect(traitPenalty({ shaken: false, wounds: 2, fatigue: 1 })).toBe(-3);
    expect(traitPenalty({ shaken: false, wounds: 5, fatigue: 5 })).toBe(-5);
  });
});
```

- [ ] **Step 2: Run the test (expect FAIL)**

Run: `npx vitest run src/domain/derived.test.ts`
Expected: FAIL — `derived.ts` not found.

- [ ] **Step 3: Implement `src/domain/derived.ts`**

```ts
import type { Character, Status, TraitDie } from './types';
import { BASE_PACE, MAX_FATIGUE, MAX_WOUNDS } from './types';

export function halfDie(die: TraitDie): number {
  return Math.floor(die.sides / 2) + die.bonus;
}

export function findSkill(character: Character, name: string) {
  return character.skills.find((s) => s.name.toLowerCase() === name.toLowerCase());
}

export function parry(character: Character): number {
  const fighting = findSkill(character, 'Fighting');
  return 2 + (fighting ? halfDie(fighting.die) : 0);
}

export function totalArmor(character: Character): number {
  return character.armor.filter((a) => a.equipped).reduce((sum, a) => sum + a.armor, 0);
}

export function toughness(character: Character): number {
  return 2 + halfDie(character.attributes.vigor) + totalArmor(character);
}

export function pace(): number {
  return BASE_PACE;
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
```

- [ ] **Step 4: Run the test (expect PASS)**

Run: `npx vitest run src/domain/derived.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(domain): derived stats (parry/toughness/pace) and trait penalties"
```

---

## Task 4: Character factory + defaults

**Files:**
- Create: `src/domain/defaults.ts`
- Test: `src/domain/defaults.test.ts`

**Interfaces:**
- Consumes: `Character`, `AttributeKey`, `TraitDie`, `Skill` from `types.ts`.
- Produces: `SCHEMA_VERSION`, `CORE_SKILLS`, `newId()`, `blankCharacter(name?)`.

- [ ] **Step 1: Write the failing test `src/domain/defaults.test.ts`**

```ts
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
```

- [ ] **Step 2: Run the test (expect FAIL)**

Run: `npx vitest run src/domain/defaults.test.ts`
Expected: FAIL — `defaults.ts` not found.

- [ ] **Step 3: Implement `src/domain/defaults.ts`**

```ts
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
```

- [ ] **Step 4: Run the test (expect PASS)**

Run: `npx vitest run src/domain/defaults.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(domain): blank-character factory and core skills"
```

---

## Task 5: Persistence schema (Zod) + serialize/parse

**Files:**
- Create: `src/persistence/schema.ts`
- Test: `src/persistence/schema.test.ts`

**Interfaces:**
- Consumes: `Character` from `domain/types.ts`.
- Produces: `characterSchema` (Zod), `serializeRoster(chars)`, `parseRoster(json)` (throws on invalid), `parseCharacterValue(value)` (validates a single parsed object).

- [ ] **Step 1: Write the failing test `src/persistence/schema.test.ts`**

```ts
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
```

- [ ] **Step 2: Run the test (expect FAIL)**

Run: `npx vitest run src/persistence/schema.test.ts`
Expected: FAIL — `schema.ts` not found.

- [ ] **Step 3: Implement `src/persistence/schema.ts`**

```ts
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
  updatedAt: z.number(),
});

export const rosterSchema = z.array(characterSchema);

export function parseCharacterValue(value: unknown): Character {
  return characterSchema.parse(value) as Character;
}

export function serializeRoster(roster: Character[]): string {
  return JSON.stringify(roster, null, 2);
}

export function parseRoster(json: string): Character[] {
  const data = JSON.parse(json);
  return rosterSchema.parse(data) as Character[];
}
```

- [ ] **Step 4: Run the test (expect PASS)**

Run: `npx vitest run src/persistence/schema.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(persistence): Zod character schema + roster serialize/parse"
```

---

## Task 6: Dexie repository

**Files:**
- Create: `src/persistence/repository.ts`
- Test: `src/persistence/repository.test.ts`

**Interfaces:**
- Consumes: `Character` from `domain/types.ts`; `parseCharacterValue`, `serializeRoster` from `schema.ts`.
- Produces: `CharacterRepository` interface (`list`, `get`, `put`, `remove`, `exportJson`, `importJson`); `DexieCharacterRepository` class; `characterRepository` singleton.

- [ ] **Step 1: Write the failing test `src/persistence/repository.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { DexieCharacterRepository } from './repository';
import { blankCharacter } from '../domain/defaults';

let repo: DexieCharacterRepository;

beforeEach(async () => {
  repo = new DexieCharacterRepository(`test-${crypto.randomUUID()}`);
});

describe('DexieCharacterRepository', () => {
  it('puts and lists characters newest-first', async () => {
    const a = { ...blankCharacter('A'), updatedAt: 1 };
    const b = { ...blankCharacter('B'), updatedAt: 2 };
    await repo.put(a);
    await repo.put(b);
    const list = await repo.list();
    expect(list.map((c) => c.name)).toEqual(['B', 'A']);
  });

  it('removes a character', async () => {
    const a = blankCharacter('A');
    await repo.put(a);
    await repo.remove(a.id);
    expect(await repo.get(a.id)).toBeUndefined();
  });

  it('exports and re-imports an equivalent roster', async () => {
    const a = blankCharacter('A');
    await repo.put(a);
    const json = await repo.exportJson();
    const fresh = new DexieCharacterRepository(`test-${crypto.randomUUID()}`);
    const imported = await fresh.importJson(json);
    expect(imported).toHaveLength(1);
    expect((await fresh.get(a.id))?.name).toBe('A');
  });

  it('rejects an invalid import without writing', async () => {
    await expect(repo.importJson('[{"bad":true}]')).rejects.toThrow();
    expect(await repo.list()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test (expect FAIL)**

Run: `npx vitest run src/persistence/repository.test.ts`
Expected: FAIL — `repository.ts` not found.

- [ ] **Step 3: Implement `src/persistence/repository.ts`**

```ts
import Dexie, { type Table } from 'dexie';
import type { Character } from '../domain/types';
import { parseCharacterValue, parseRoster, serializeRoster } from './schema';

export interface CharacterRepository {
  list(): Promise<Character[]>;
  get(id: string): Promise<Character | undefined>;
  put(character: Character): Promise<void>;
  remove(id: string): Promise<void>;
  exportJson(): Promise<string>;
  importJson(json: string): Promise<Character[]>;
}

class CharacterDb extends Dexie {
  characters!: Table<Character, string>;
  constructor(name: string) {
    super(name);
    this.version(1).stores({ characters: 'id, name, updatedAt' });
  }
}

export class DexieCharacterRepository implements CharacterRepository {
  private db: CharacterDb;

  constructor(dbName = 'savage-worlds') {
    this.db = new CharacterDb(dbName);
  }

  list(): Promise<Character[]> {
    return this.db.characters.orderBy('updatedAt').reverse().toArray();
  }

  get(id: string): Promise<Character | undefined> {
    return this.db.characters.get(id);
  }

  async put(character: Character): Promise<void> {
    // Validate before writing so corrupt data never reaches storage.
    await this.db.characters.put(parseCharacterValue(character));
  }

  async remove(id: string): Promise<void> {
    await this.db.characters.delete(id);
  }

  async exportJson(): Promise<string> {
    return serializeRoster(await this.list());
  }

  async importJson(json: string): Promise<Character[]> {
    const roster = parseRoster(json); // throws on invalid -> nothing written
    await this.db.characters.bulkPut(roster);
    return roster;
  }
}

export const characterRepository: CharacterRepository = new DexieCharacterRepository();
```

- [ ] **Step 4: Run the test (expect PASS)**

Run: `npx vitest run src/persistence/repository.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(persistence): Dexie character repository with validated import/export"
```

---

## Task 7: Zustand store

**Files:**
- Create: `src/store/characterStore.ts`
- Test: `src/store/characterStore.test.ts`

**Interfaces:**
- Consumes: `Character`, `TraitDie`, `Skill`, `Weapon`, `MAX_WOUNDS`, `MAX_FATIGUE` from `domain/types.ts`; `blankCharacter`, `newId` from `defaults.ts`; `rollTrait`, `rollDamage`, `type Rng` from `dice.ts`; `formatTraitRoll`, `formatDamageRoll` from `format.ts`; `traitPenalty`, `findSkill` from `derived.ts`; `CharacterRepository`, `characterRepository` from `repository.ts`.
- Produces: `StoreDeps`, `StoreState`, `makeCharacterStore(deps)`, `useCharacterStore` singleton. Key actions: `load()`, `createCharacter()`, `duplicateCharacter(id)`, `deleteCharacter(id)`, `update(id, recipe)`, `addWound(id)`, `healWound(id)`, `setFatigue(id, n)`, `toggleShaken(id)`, `spendBenny(id)`, `addBenny(id)`, `rollTraitFor(id, label, die, opts?)`, `rollWeaponDamage(id, weaponId)`, `clearLog(id)`, `importJson(json)`, `exportJson()`.

- [ ] **Step 1: Write the failing test `src/store/characterStore.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { makeCharacterStore } from './characterStore';
import { DexieCharacterRepository } from '../persistence/repository';
import { facesRng } from '../test/rng';
import type { Character } from '../domain/types';

function fixedRng(faces: Array<[number, number]>) {
  return facesRng(faces);
}

function setup(rng = () => 0.5) {
  const repo = new DexieCharacterRepository(`store-${crypto.randomUUID()}`);
  const store = makeCharacterStore({ repo, rng, now: () => 1000 });
  return { repo, store };
}

describe('characterStore', () => {
  it('creates a character and persists it', async () => {
    const { repo, store } = setup();
    const id = await store.getState().createCharacter();
    expect(store.getState().roster.find((c) => c.id === id)).toBeDefined();
    expect(await repo.get(id)).toBeDefined();
  });

  it('caps wounds at MAX_WOUNDS and floors healing at 0', async () => {
    const { store } = setup();
    const id = await store.getState().createCharacter();
    const s = store.getState();
    s.addWound(id); s.addWound(id); s.addWound(id); s.addWound(id);
    expect(store.getState().roster.find((c) => c.id === id)!.status.wounds).toBe(3);
    s.healWound(id); s.healWound(id); s.healWound(id); s.healWound(id);
    expect(store.getState().roster.find((c) => c.id === id)!.status.wounds).toBe(0);
  });

  it('floors bennies at 0 when spending', async () => {
    const { store } = setup();
    const id = await store.getState().createCharacter();
    const s = store.getState();
    s.spendBenny(id); s.spendBenny(id); s.spendBenny(id); s.spendBenny(id);
    expect(store.getState().roster.find((c) => c.id === id)!.bennies).toBe(0);
  });

  it('applies the current wound penalty when rolling a trait', async () => {
    // trait d8 rolls 5, wild d6 rolls 1; one wound => -1 modifier => total 4
    const { store } = setup(fixedRng([[8, 5], [6, 1]]));
    const id = await store.getState().createCharacter();
    store.getState().addWound(id);
    store.getState().rollTraitFor(id, 'Agility', { sides: 8, bonus: 0 });
    const entry = store.getState().roster.find((c) => c.id === id)!.rollLog[0];
    expect(entry.total).toBe(4);
    expect(entry.label).toBe('Agility');
    expect(entry.kind).toBe('trait');
  });
});
```

- [ ] **Step 2: Run the test (expect FAIL)**

Run: `npx vitest run src/store/characterStore.test.ts`
Expected: FAIL — `characterStore.ts` not found.

- [ ] **Step 3: Implement `src/store/characterStore.ts`**

```ts
import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Character, TraitDie } from '../domain/types';
import { MAX_FATIGUE, MAX_WOUNDS } from '../domain/types';
import { blankCharacter, newId } from '../domain/defaults';
import { rollTrait, rollDamage, type Rng } from '../domain/dice';
import { formatTraitRoll, formatDamageRoll } from '../domain/format';
import { traitPenalty } from '../domain/derived';
import { characterRepository, type CharacterRepository } from '../persistence/repository';

const LOG_LIMIT = 50;

export interface StoreDeps {
  repo: CharacterRepository;
  rng: Rng;
  now: () => number;
}

export interface RollTraitOptions {
  wildOverride?: boolean;
  modifier?: number;
  tn?: number;
}

export interface StoreState {
  roster: Character[];
  activeId: string | null;
  lastError: string | null;

  load: () => Promise<void>;
  setActive: (id: string | null) => void;

  createCharacter: () => Promise<string>;
  duplicateCharacter: (id: string) => Promise<string>;
  deleteCharacter: (id: string) => Promise<void>;

  update: (id: string, recipe: (c: Character) => void) => void;

  addWound: (id: string) => void;
  healWound: (id: string) => void;
  setFatigue: (id: string, n: number) => void;
  toggleShaken: (id: string) => void;
  spendBenny: (id: string) => void;
  addBenny: (id: string) => void;

  rollTraitFor: (id: string, label: string, die: TraitDie, opts?: RollTraitOptions) => void;
  rollWeaponDamage: (id: string, weaponId: string) => void;
  clearLog: (id: string) => void;

  importJson: (json: string) => Promise<void>;
  exportJson: () => Promise<string>;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function makeCharacterStore(deps: StoreDeps): UseBoundStore<StoreApi<StoreState>> {
  const persist = (c: Character) => {
    deps.repo.put(c).catch((err) => {
      useStore.setState({ lastError: `Save failed: ${String(err)}` });
    });
  };

  const useStore = create<StoreState>()(
    immer((set, get) => {
      // Apply an immer recipe to one character, stamp updatedAt, and persist.
      const mutate = (id: string, recipe: (c: Character) => void) => {
        let updated: Character | undefined;
        set((state) => {
          const c = state.roster.find((x) => x.id === id);
          if (!c) return;
          recipe(c);
          c.updatedAt = deps.now();
          updated = JSON.parse(JSON.stringify(c)) as Character; // plain copy for persistence
        });
        if (updated) persist(updated);
      };

      return {
        roster: [],
        activeId: null,
        lastError: null,

        load: async () => {
          const roster = await deps.repo.list();
          set((s) => { s.roster = roster; });
        },

        setActive: (id) => set((s) => { s.activeId = id; }),

        createCharacter: async () => {
          const c = blankCharacter();
          set((s) => { s.roster.unshift(c); });
          await deps.repo.put(c);
          return c.id;
        },

        duplicateCharacter: async (id) => {
          const src = get().roster.find((x) => x.id === id);
          if (!src) throw new Error('character not found');
          const copy: Character = JSON.parse(JSON.stringify(src));
          copy.id = newId();
          copy.name = `${src.name} (copy)`;
          copy.updatedAt = deps.now();
          set((s) => { s.roster.unshift(copy); });
          await deps.repo.put(copy);
          return copy.id;
        },

        deleteCharacter: async (id) => {
          set((s) => {
            s.roster = s.roster.filter((c) => c.id !== id);
            if (s.activeId === id) s.activeId = null;
          });
          await deps.repo.remove(id);
        },

        update: (id, recipe) => mutate(id, recipe),

        addWound: (id) => mutate(id, (c) => { c.status.wounds = clamp(c.status.wounds + 1, 0, MAX_WOUNDS); }),
        healWound: (id) => mutate(id, (c) => { c.status.wounds = clamp(c.status.wounds - 1, 0, MAX_WOUNDS); }),
        setFatigue: (id, n) => mutate(id, (c) => { c.status.fatigue = clamp(n, 0, MAX_FATIGUE); }),
        toggleShaken: (id) => mutate(id, (c) => { c.status.shaken = !c.status.shaken; }),
        spendBenny: (id) => mutate(id, (c) => { c.bennies = Math.max(0, c.bennies - 1); }),
        addBenny: (id) => mutate(id, (c) => { c.bennies += 1; }),

        rollTraitFor: (id, label, die, opts) => mutate(id, (c) => {
          const wild = opts?.wildOverride ?? c.isWildCard;
          const modifier = (opts?.modifier ?? 0) + traitPenalty(c.status);
          const res = rollTrait({ die, wild, modifier, tn: opts?.tn ?? 4 }, deps.rng);
          c.rollLog.unshift({
            id: newId(),
            at: deps.now(),
            label,
            kind: 'trait',
            detail: formatTraitRoll(res),
            total: res.total,
            success: res.success,
            raises: res.raises,
            criticalFailure: res.criticalFailure,
          });
          c.rollLog = c.rollLog.slice(0, LOG_LIMIT);
        }),

        rollWeaponDamage: (id, weaponId) => mutate(id, (c) => {
          const w = c.weapons.find((x) => x.id === weaponId);
          if (!w) return;
          const dice = w.addStrength ? [c.attributes.strength, ...w.damageDice] : [...w.damageDice];
          const res = rollDamage(dice, w.damageBonus, deps.rng);
          c.rollLog.unshift({
            id: newId(),
            at: deps.now(),
            label: `${w.name || 'Weapon'} damage`,
            kind: 'damage',
            detail: formatDamageRoll(res),
            total: res.total,
            success: null,
            raises: null,
            criticalFailure: null,
          });
          c.rollLog = c.rollLog.slice(0, LOG_LIMIT);
        }),

        clearLog: (id) => mutate(id, (c) => { c.rollLog = []; }),

        importJson: async (json) => {
          const imported = await deps.repo.importJson(json);
          await get().load();
          set((s) => { s.lastError = null; });
          void imported;
        },

        exportJson: () => deps.repo.exportJson(),
      };
    }),
  );

  return useStore;
}

export const useCharacterStore = makeCharacterStore({
  repo: characterRepository,
  rng: Math.random,
  now: () => Date.now(),
});
```

- [ ] **Step 4: Run the test (expect PASS)**

Run: `npx vitest run src/store/characterStore.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(store): Zustand character store with play actions and roll log"
```

---

## Task 8: DiePicker component

**Files:**
- Create: `src/components/DiePicker.tsx`
- Test: `src/components/DiePicker.test.tsx`

**Interfaces:**
- Consumes: `TraitDie`, `DieSides` from `domain/types.ts`; `formatDie` from `domain/format.ts`.
- Produces: `DiePicker({ value, onChange, label })`.

- [ ] **Step 1: Write the failing test `src/components/DiePicker.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { DiePicker } from './DiePicker';

describe('DiePicker', () => {
  it('shows the current die and emits a new TraitDie on change', async () => {
    const onChange = vi.fn();
    render(<DiePicker label="Agility" value={{ sides: 6, bonus: 0 }} onChange={onChange} />);
    const select = screen.getByLabelText('Agility') as HTMLSelectElement;
    expect(select.value).toBe('6:0');
    await userEvent.selectOptions(select, '12:2');
    expect(onChange).toHaveBeenCalledWith({ sides: 12, bonus: 2 });
  });
});
```

- [ ] **Step 2: Run the test (expect FAIL)**

Run: `npx vitest run src/components/DiePicker.test.tsx`
Expected: FAIL — `DiePicker.tsx` not found.

- [ ] **Step 3: Implement `src/components/DiePicker.tsx`**

```tsx
import type { TraitDie } from '../domain/types';
import { formatDie } from '../domain/format';

const OPTIONS: TraitDie[] = [
  { sides: 4, bonus: 0 },
  { sides: 6, bonus: 0 },
  { sides: 8, bonus: 0 },
  { sides: 10, bonus: 0 },
  { sides: 12, bonus: 0 },
  { sides: 12, bonus: 1 },
  { sides: 12, bonus: 2 },
];

const keyOf = (d: TraitDie) => `${d.sides}:${d.bonus}`;

export function DiePicker({
  value,
  onChange,
  label,
}: {
  value: TraitDie;
  onChange: (die: TraitDie) => void;
  label: string;
}) {
  return (
    <select
      aria-label={label}
      value={keyOf(value)}
      onChange={(e) => {
        const die = OPTIONS.find((o) => keyOf(o) === e.target.value);
        if (die) onChange(die);
      }}
      className="rounded border border-gray-300 px-2 py-1"
    >
      {OPTIONS.map((o) => (
        <option key={keyOf(o)} value={keyOf(o)}>
          {formatDie(o)}
        </option>
      ))}
    </select>
  );
}
```

- [ ] **Step 4: Run the test (expect PASS)**

Run: `npx vitest run src/components/DiePicker.test.tsx`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ui): reusable DiePicker"
```

---

## Task 9: SheetHeader, DerivedBar, StatusTracker

**Files:**
- Create: `src/components/SheetHeader.tsx`, `src/components/DerivedBar.tsx`, `src/components/StatusTracker.tsx`
- Test: `src/components/StatusTracker.test.tsx`

**Interfaces:**
- Consumes: `Character`, `Status` from `domain/types.ts`.
- Produces:
  - `SheetHeader({ character, onNameChange, onAncestryChange, onToggleWildCard, onSpendBenny, onAddBenny })`
  - `DerivedBar({ parry, toughness, pace })`
  - `StatusTracker({ status, onAddWound, onHealWound, onSetFatigue, onToggleShaken })`

- [ ] **Step 1: Write the failing test `src/components/StatusTracker.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { StatusTracker } from './StatusTracker';

describe('StatusTracker', () => {
  it('shows current wounds and fires add/heal handlers', async () => {
    const onAddWound = vi.fn();
    const onHealWound = vi.fn();
    render(
      <StatusTracker
        status={{ shaken: false, wounds: 1, fatigue: 0 }}
        onAddWound={onAddWound}
        onHealWound={onHealWound}
        onSetFatigue={vi.fn()}
        onToggleShaken={vi.fn()}
      />,
    );
    expect(screen.getByText(/wounds: 1/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /add wound/i }));
    expect(onAddWound).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /heal wound/i }));
    expect(onHealWound).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test (expect FAIL)**

Run: `npx vitest run src/components/StatusTracker.test.tsx`
Expected: FAIL — `StatusTracker.tsx` not found.

- [ ] **Step 3: Implement the three components**

`src/components/StatusTracker.tsx`:
```tsx
import type { Status } from '../domain/types';
import { MAX_FATIGUE, MAX_WOUNDS } from '../domain/types';

export function StatusTracker({
  status,
  onAddWound,
  onHealWound,
  onSetFatigue,
  onToggleShaken,
}: {
  status: Status;
  onAddWound: () => void;
  onHealWound: () => void;
  onSetFatigue: (n: number) => void;
  onToggleShaken: () => void;
}) {
  return (
    <section className="flex flex-wrap items-center gap-4 rounded border p-3">
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={status.shaken} onChange={onToggleShaken} />
        Shaken
      </label>

      <div className="flex items-center gap-2">
        <span>Wounds: {status.wounds}{status.wounds >= MAX_WOUNDS ? ' (Incapacitated)' : ''}</span>
        <button type="button" onClick={onHealWound} aria-label="Heal wound" className="rounded border px-2">−</button>
        <button type="button" onClick={onAddWound} aria-label="Add wound" className="rounded border px-2">+</button>
      </div>

      <label className="flex items-center gap-2">
        Fatigue:
        <select
          aria-label="Fatigue"
          value={status.fatigue}
          onChange={(e) => onSetFatigue(Number(e.target.value))}
          className="rounded border px-2 py-1"
        >
          {Array.from({ length: MAX_FATIGUE + 1 }, (_, i) => (
            <option key={i} value={i}>{i}</option>
          ))}
        </select>
      </label>
    </section>
  );
}
```

`src/components/DerivedBar.tsx`:
```tsx
export function DerivedBar({ parry, toughness, pace }: { parry: number; toughness: number; pace: number }) {
  const Stat = ({ label, value }: { label: string; value: number }) => (
    <div className="flex flex-col items-center rounded border px-4 py-2">
      <span className="text-xs uppercase text-gray-500">{label}</span>
      <span className="text-xl font-bold">{value}</span>
    </div>
  );
  return (
    <section className="flex gap-3">
      <Stat label="Pace" value={pace} />
      <Stat label="Parry" value={parry} />
      <Stat label="Toughness" value={toughness} />
    </section>
  );
}
```

`src/components/SheetHeader.tsx`:
```tsx
import type { Character } from '../domain/types';

export function SheetHeader({
  character,
  onNameChange,
  onAncestryChange,
  onToggleWildCard,
  onSpendBenny,
  onAddBenny,
}: {
  character: Character;
  onNameChange: (name: string) => void;
  onAncestryChange: (ancestry: string) => void;
  onToggleWildCard: () => void;
  onSpendBenny: () => void;
  onAddBenny: () => void;
}) {
  return (
    <header className="flex flex-wrap items-end gap-4 rounded border p-3">
      <label className="flex flex-col">
        <span className="text-xs uppercase text-gray-500">Name</span>
        <input
          aria-label="Name"
          value={character.name}
          onChange={(e) => onNameChange(e.target.value)}
          className="rounded border px-2 py-1"
        />
      </label>
      <label className="flex flex-col">
        <span className="text-xs uppercase text-gray-500">Ancestry</span>
        <input
          aria-label="Ancestry"
          value={character.ancestry}
          onChange={(e) => onAncestryChange(e.target.value)}
          className="rounded border px-2 py-1"
        />
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={character.isWildCard} onChange={onToggleWildCard} />
        Wild Card
      </label>
      <div className="flex items-center gap-2">
        <span>Bennies: {character.bennies}</span>
        <button type="button" onClick={onSpendBenny} aria-label="Spend benny" className="rounded border px-2">−</button>
        <button type="button" onClick={onAddBenny} aria-label="Add benny" className="rounded border px-2">+</button>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Run the test (expect PASS)**

Run: `npx vitest run src/components/StatusTracker.test.tsx`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ui): SheetHeader, DerivedBar, StatusTracker"
```

---

## Task 10: AttributesPanel + SkillsPanel

**Files:**
- Create: `src/components/AttributesPanel.tsx`, `src/components/SkillsPanel.tsx`
- Test: `src/components/AttributesPanel.test.tsx`, `src/components/SkillsPanel.test.tsx`

**Interfaces:**
- Consumes: `Character`, `AttributeKey`, `ATTRIBUTE_KEYS`, `Skill`, `TraitDie` from `domain/types.ts`; `DiePicker`; `formatDie` from `domain/format.ts`.
- Produces:
  - `AttributesPanel({ attributes, onChangeAttribute, onRoll })` where `onChangeAttribute(key, die)` and `onRoll(key)`.
  - `SkillsPanel({ skills, onChangeSkill, onAddSkill, onRemoveSkill, onRoll })` where `onChangeSkill(id, patch: Partial<Skill>)`, `onRoll(skillId)`.

- [ ] **Step 1: Write the failing tests**

`src/components/AttributesPanel.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { AttributesPanel } from './AttributesPanel';
import { blankCharacter } from '../domain/defaults';

describe('AttributesPanel', () => {
  it('rolls an attribute when its roll button is clicked', async () => {
    const onRoll = vi.fn();
    const c = blankCharacter();
    render(<AttributesPanel attributes={c.attributes} onChangeAttribute={vi.fn()} onRoll={onRoll} />);
    await userEvent.click(screen.getByRole('button', { name: /roll agility/i }));
    expect(onRoll).toHaveBeenCalledWith('agility');
  });
});
```

`src/components/SkillsPanel.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SkillsPanel } from './SkillsPanel';
import { blankCharacter } from '../domain/defaults';

describe('SkillsPanel', () => {
  it('adds a skill and rolls an existing one', async () => {
    const onAddSkill = vi.fn();
    const onRoll = vi.fn();
    const c = blankCharacter();
    render(
      <SkillsPanel
        skills={c.skills}
        onChangeSkill={vi.fn()}
        onAddSkill={onAddSkill}
        onRemoveSkill={vi.fn()}
        onRoll={onRoll}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /add skill/i }));
    expect(onAddSkill).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /roll athletics/i }));
    expect(onRoll).toHaveBeenCalledWith(c.skills.find((s) => s.name === 'Athletics')!.id);
  });
});
```

- [ ] **Step 2: Run the tests (expect FAIL)**

Run: `npx vitest run src/components/AttributesPanel.test.tsx src/components/SkillsPanel.test.tsx`
Expected: FAIL — components not found.

- [ ] **Step 3: Implement the two panels**

`src/components/AttributesPanel.tsx`:
```tsx
import type { AttributeKey, TraitDie } from '../domain/types';
import { ATTRIBUTE_KEYS } from '../domain/types';
import { DiePicker } from './DiePicker';

const LABELS: Record<AttributeKey, string> = {
  agility: 'Agility',
  smarts: 'Smarts',
  spirit: 'Spirit',
  strength: 'Strength',
  vigor: 'Vigor',
};

export function AttributesPanel({
  attributes,
  onChangeAttribute,
  onRoll,
}: {
  attributes: Record<AttributeKey, TraitDie>;
  onChangeAttribute: (key: AttributeKey, die: TraitDie) => void;
  onRoll: (key: AttributeKey) => void;
}) {
  return (
    <section className="rounded border p-3">
      <h2 className="mb-2 font-bold">Attributes</h2>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ATTRIBUTE_KEYS.map((key) => (
          <li key={key} className="flex items-center gap-2">
            <span className="w-24">{LABELS[key]}</span>
            <DiePicker label={LABELS[key]} value={attributes[key]} onChange={(die) => onChangeAttribute(key, die)} />
            <button type="button" onClick={() => onRoll(key)} aria-label={`Roll ${LABELS[key]}`} className="rounded bg-gray-800 px-2 py-1 text-white">
              Roll
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

`src/components/SkillsPanel.tsx`:
```tsx
import type { Skill, TraitDie } from '../domain/types';
import { DiePicker } from './DiePicker';

export function SkillsPanel({
  skills,
  onChangeSkill,
  onAddSkill,
  onRemoveSkill,
  onRoll,
}: {
  skills: Skill[];
  onChangeSkill: (id: string, patch: Partial<Skill>) => void;
  onAddSkill: () => void;
  onRemoveSkill: (id: string) => void;
  onRoll: (skillId: string) => void;
}) {
  return (
    <section className="rounded border p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-bold">Skills</h2>
        <button type="button" onClick={onAddSkill} aria-label="Add skill" className="rounded border px-2 py-1">
          + Add skill
        </button>
      </div>
      <ul className="flex flex-col gap-2">
        {skills.map((s) => (
          <li key={s.id} className="flex items-center gap-2">
            <input
              aria-label={`Skill name ${s.id}`}
              value={s.name}
              onChange={(e) => onChangeSkill(s.id, { name: e.target.value })}
              className="flex-1 rounded border px-2 py-1"
            />
            <DiePicker label={`Die for ${s.name || 'skill'}`} value={s.die} onChange={(die: TraitDie) => onChangeSkill(s.id, { die })} />
            <button type="button" onClick={() => onRoll(s.id)} aria-label={`Roll ${s.name || 'skill'}`} className="rounded bg-gray-800 px-2 py-1 text-white">
              Roll
            </button>
            <button type="button" onClick={() => onRemoveSkill(s.id)} aria-label={`Remove ${s.name || 'skill'}`} className="rounded border px-2 py-1">
              ✕
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: Run the tests (expect PASS)**

Run: `npx vitest run src/components/AttributesPanel.test.tsx src/components/SkillsPanel.test.tsx`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ui): AttributesPanel and SkillsPanel with rollable traits"
```

---

## Task 11: EdgesHindrancesPanel + GearPanel

**Files:**
- Create: `src/components/EdgesHindrancesPanel.tsx`, `src/components/GearPanel.tsx`
- Test: `src/components/GearPanel.test.tsx`

**Interfaces:**
- Consumes: `EdgeOrHindrance`, `EdgeHindranceType`, `Weapon`, `Armor`, `GearItem` from `domain/types.ts`.
- Produces:
  - `EdgesHindrancesPanel({ items, onAdd, onChange, onRemove })` where `onAdd(type: EdgeHindranceType)`, `onChange(id, patch: Partial<EdgeOrHindrance>)`.
  - `GearPanel({ weapons, armor, gear, onAddWeapon, onChangeWeapon, onRemoveWeapon, onRollDamage, onAddArmor, onChangeArmor, onRemoveArmor, onAddGear, onChangeGear, onRemoveGear })`.

- [ ] **Step 1: Write the failing test `src/components/GearPanel.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { GearPanel } from './GearPanel';
import type { Weapon } from '../domain/types';

const weapon: Weapon = {
  id: 'w1', name: 'Longsword', damageDice: [{ sides: 8, bonus: 0 }], addStrength: true,
  damageBonus: 0, range: '', rof: 1, ap: 0, notes: '',
};

describe('GearPanel', () => {
  it('rolls weapon damage and adds a weapon', async () => {
    const onRollDamage = vi.fn();
    const onAddWeapon = vi.fn();
    render(
      <GearPanel
        weapons={[weapon]} armor={[]} gear={[]}
        onAddWeapon={onAddWeapon} onChangeWeapon={vi.fn()} onRemoveWeapon={vi.fn()} onRollDamage={onRollDamage}
        onAddArmor={vi.fn()} onChangeArmor={vi.fn()} onRemoveArmor={vi.fn()}
        onAddGear={vi.fn()} onChangeGear={vi.fn()} onRemoveGear={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /roll longsword damage/i }));
    expect(onRollDamage).toHaveBeenCalledWith('w1');
    await userEvent.click(screen.getByRole('button', { name: /add weapon/i }));
    expect(onAddWeapon).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test (expect FAIL)**

Run: `npx vitest run src/components/GearPanel.test.tsx`
Expected: FAIL — `GearPanel.tsx` not found.

- [ ] **Step 3: Implement the two panels**

`src/components/EdgesHindrancesPanel.tsx`:
```tsx
import type { EdgeHindranceType, EdgeOrHindrance } from '../domain/types';

export function EdgesHindrancesPanel({
  items,
  onAdd,
  onChange,
  onRemove,
}: {
  items: EdgeOrHindrance[];
  onAdd: (type: EdgeHindranceType) => void;
  onChange: (id: string, patch: Partial<EdgeOrHindrance>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <section className="rounded border p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-bold">Edges &amp; Hindrances</h2>
        <div className="flex gap-2">
          <button type="button" onClick={() => onAdd('edge')} aria-label="Add edge" className="rounded border px-2 py-1">+ Edge</button>
          <button type="button" onClick={() => onAdd('hindrance')} aria-label="Add hindrance" className="rounded border px-2 py-1">+ Hindrance</button>
        </div>
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((it) => (
          <li key={it.id} className="flex flex-wrap items-center gap-2">
            <span className="w-20 text-xs uppercase text-gray-500">{it.type}</span>
            <input
              aria-label={`Name ${it.id}`}
              value={it.name}
              onChange={(e) => onChange(it.id, { name: e.target.value })}
              className="flex-1 rounded border px-2 py-1"
            />
            {it.type === 'hindrance' && (
              <select
                aria-label={`Severity ${it.id}`}
                value={it.severity ?? 'minor'}
                onChange={(e) => onChange(it.id, { severity: e.target.value as 'minor' | 'major' })}
                className="rounded border px-2 py-1"
              >
                <option value="minor">Minor</option>
                <option value="major">Major</option>
              </select>
            )}
            <input
              aria-label={`Notes ${it.id}`}
              value={it.notes}
              onChange={(e) => onChange(it.id, { notes: e.target.value })}
              placeholder="notes"
              className="flex-1 rounded border px-2 py-1"
            />
            <button type="button" onClick={() => onRemove(it.id)} aria-label={`Remove ${it.name || it.type}`} className="rounded border px-2 py-1">✕</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

`src/components/GearPanel.tsx`:
```tsx
import type { Armor, GearItem, Weapon } from '../domain/types';

export function GearPanel({
  weapons,
  armor,
  gear,
  onAddWeapon,
  onChangeWeapon,
  onRemoveWeapon,
  onRollDamage,
  onAddArmor,
  onChangeArmor,
  onRemoveArmor,
  onAddGear,
  onChangeGear,
  onRemoveGear,
}: {
  weapons: Weapon[];
  armor: Armor[];
  gear: GearItem[];
  onAddWeapon: () => void;
  onChangeWeapon: (id: string, patch: Partial<Weapon>) => void;
  onRemoveWeapon: (id: string) => void;
  onRollDamage: (id: string) => void;
  onAddArmor: () => void;
  onChangeArmor: (id: string, patch: Partial<Armor>) => void;
  onRemoveArmor: (id: string) => void;
  onAddGear: () => void;
  onChangeGear: (id: string, patch: Partial<GearItem>) => void;
  onRemoveGear: (id: string) => void;
}) {
  return (
    <section className="rounded border p-3">
      <h2 className="mb-2 font-bold">Gear</h2>

      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-semibold">Weapons</h3>
          <button type="button" onClick={onAddWeapon} aria-label="Add weapon" className="rounded border px-2 py-1">+ Weapon</button>
        </div>
        <ul className="flex flex-col gap-2">
          {weapons.map((w) => (
            <li key={w.id} className="flex flex-wrap items-center gap-2">
              <input aria-label={`Weapon name ${w.id}`} value={w.name} onChange={(e) => onChangeWeapon(w.id, { name: e.target.value })} className="flex-1 rounded border px-2 py-1" />
              <label className="flex items-center gap-1 text-sm">
                <input type="checkbox" checked={w.addStrength} onChange={(e) => onChangeWeapon(w.id, { addStrength: e.target.checked })} />
                +Str
              </label>
              <input aria-label={`Damage bonus ${w.id}`} type="number" value={w.damageBonus} onChange={(e) => onChangeWeapon(w.id, { damageBonus: Number(e.target.value) })} className="w-16 rounded border px-2 py-1" />
              <button type="button" onClick={() => onRollDamage(w.id)} aria-label={`Roll ${w.name || 'weapon'} damage`} className="rounded bg-gray-800 px-2 py-1 text-white">Roll dmg</button>
              <button type="button" onClick={() => onRemoveWeapon(w.id)} aria-label={`Remove ${w.name || 'weapon'}`} className="rounded border px-2 py-1">✕</button>
            </li>
          ))}
        </ul>
      </div>

      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-semibold">Armor</h3>
          <button type="button" onClick={onAddArmor} aria-label="Add armor" className="rounded border px-2 py-1">+ Armor</button>
        </div>
        <ul className="flex flex-col gap-2">
          {armor.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2">
              <input aria-label={`Armor name ${a.id}`} value={a.name} onChange={(e) => onChangeArmor(a.id, { name: e.target.value })} className="flex-1 rounded border px-2 py-1" />
              <label className="flex items-center gap-1 text-sm">
                Armor
                <input aria-label={`Armor value ${a.id}`} type="number" value={a.armor} onChange={(e) => onChangeArmor(a.id, { armor: Number(e.target.value) })} className="w-16 rounded border px-2 py-1" />
              </label>
              <label className="flex items-center gap-1 text-sm">
                <input type="checkbox" checked={a.equipped} onChange={(e) => onChangeArmor(a.id, { equipped: e.target.checked })} />
                Equipped
              </label>
              <button type="button" onClick={() => onRemoveArmor(a.id)} aria-label={`Remove ${a.name || 'armor'}`} className="rounded border px-2 py-1">✕</button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-semibold">Other gear</h3>
          <button type="button" onClick={onAddGear} aria-label="Add gear" className="rounded border px-2 py-1">+ Item</button>
        </div>
        <ul className="flex flex-col gap-2">
          {gear.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center gap-2">
              <input aria-label={`Gear name ${g.id}`} value={g.name} onChange={(e) => onChangeGear(g.id, { name: e.target.value })} className="flex-1 rounded border px-2 py-1" />
              <input aria-label={`Gear qty ${g.id}`} type="number" value={g.quantity} onChange={(e) => onChangeGear(g.id, { quantity: Number(e.target.value) })} className="w-16 rounded border px-2 py-1" />
              <button type="button" onClick={() => onRemoveGear(g.id)} aria-label={`Remove ${g.name || 'item'}`} className="rounded border px-2 py-1">✕</button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run the test (expect PASS)**

Run: `npx vitest run src/components/GearPanel.test.tsx`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ui): EdgesHindrancesPanel and GearPanel"
```

---

## Task 12: DiceLog

**Files:**
- Create: `src/components/DiceLog.tsx`
- Test: `src/components/DiceLog.test.tsx`

**Interfaces:**
- Consumes: `RollLogEntry` from `domain/types.ts`.
- Produces: `DiceLog({ entries, onClear })`.

- [ ] **Step 1: Write the failing test `src/components/DiceLog.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { DiceLog } from './DiceLog';
import type { RollLogEntry } from '../domain/types';

const entry: RollLogEntry = {
  id: 'r1', at: 1000, label: 'Fighting', kind: 'trait',
  detail: 'trait d8=5, wild d6=3 → 5 vs TN 4 — Success', total: 5,
  success: true, raises: 0, criticalFailure: false,
};

describe('DiceLog', () => {
  it('renders entries and clears on demand', async () => {
    const onClear = vi.fn();
    render(<DiceLog entries={[entry]} onClear={onClear} />);
    expect(screen.getByText(/Fighting/)).toBeInTheDocument();
    expect(screen.getByText(/Success/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /clear log/i }));
    expect(onClear).toHaveBeenCalled();
  });

  it('shows an empty state when there are no entries', () => {
    render(<DiceLog entries={[]} onClear={vi.fn()} />);
    expect(screen.getByText(/no rolls yet/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test (expect FAIL)**

Run: `npx vitest run src/components/DiceLog.test.tsx`
Expected: FAIL — `DiceLog.tsx` not found.

- [ ] **Step 3: Implement `src/components/DiceLog.tsx`**

```tsx
import type { RollLogEntry } from '../domain/types';

export function DiceLog({ entries, onClear }: { entries: RollLogEntry[]; onClear: () => void }) {
  return (
    <section className="rounded border p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-bold">Dice log</h2>
        <button type="button" onClick={onClear} aria-label="Clear log" className="rounded border px-2 py-1">Clear</button>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-gray-500">No rolls yet.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {entries.map((e) => (
            <li key={e.id} className={e.criticalFailure ? 'text-red-600' : ''}>
              <span className="font-semibold">{e.label}:</span> {e.detail}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run the test (expect PASS)**

Run: `npx vitest run src/components/DiceLog.test.tsx`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ui): DiceLog with breakdown and empty state"
```

---

## Task 13: RosterPage

**Files:**
- Create: `src/pages/RosterPage.tsx`
- Test: `src/pages/RosterPage.test.tsx`

**Interfaces:**
- Consumes: `useCharacterStore` from `store/characterStore.ts`; `Link`/`useNavigate` from `react-router-dom`.
- Produces: `RosterPage()` — lists characters, with create/duplicate/delete/import/export and links to `/c/:id`.

- [ ] **Step 1: Write the failing test `src/pages/RosterPage.test.tsx`**

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import { RosterPage } from './RosterPage';
import { useCharacterStore } from '../store/characterStore';

beforeEach(async () => {
  // Reset the singleton store to an empty roster for each test.
  useCharacterStore.setState({ roster: [], activeId: null, lastError: null });
});

describe('RosterPage', () => {
  it('creates a character and shows it in the list', async () => {
    render(
      <MemoryRouter>
        <RosterPage />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: /new character/i }));
    await waitFor(() => expect(screen.getByText(/new hero/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run the test (expect FAIL)**

Run: `npx vitest run src/pages/RosterPage.test.tsx`
Expected: FAIL — `RosterPage.tsx` not found.

- [ ] **Step 3: Implement `src/pages/RosterPage.tsx`**

```tsx
import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCharacterStore } from '../store/characterStore';

export function RosterPage() {
  const navigate = useNavigate();
  const roster = useCharacterStore((s) => s.roster);
  const load = useCharacterStore((s) => s.load);
  const createCharacter = useCharacterStore((s) => s.createCharacter);
  const duplicateCharacter = useCharacterStore((s) => s.duplicateCharacter);
  const deleteCharacter = useCharacterStore((s) => s.deleteCharacter);
  const importJson = useCharacterStore((s) => s.importJson);
  const exportJson = useCharacterStore((s) => s.exportJson);
  const lastError = useCharacterStore((s) => s.lastError);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => { void load(); }, [load]);

  const onExport = async () => {
    const json = await exportJson();
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'savage-worlds-roster.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImportFile = async (file: File) => {
    try {
      await importJson(await file.text());
    } catch (err) {
      useCharacterStore.setState({ lastError: `Import failed: ${String(err)}` });
    }
  };

  return (
    <main className="mx-auto max-w-3xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Savage Worlds Sheets</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={async () => { const id = await createCharacter(); navigate(`/c/${id}`); }}
            className="rounded bg-gray-800 px-3 py-2 text-white"
          >
            + New character
          </button>
          <button type="button" onClick={onExport} className="rounded border px-3 py-2">Export</button>
          <button type="button" onClick={() => fileInput.current?.click()} className="rounded border px-3 py-2">Import</button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            className="hidden"
            aria-label="Import roster file"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void onImportFile(f); e.target.value = ''; }}
          />
        </div>
      </div>

      {lastError && <p className="mb-3 rounded bg-red-100 p-2 text-red-700">{lastError}</p>}

      {roster.length === 0 ? (
        <p className="text-gray-500">No characters yet. Create one to get started.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {roster.map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded border p-3">
              <Link to={`/c/${c.id}`} className="font-semibold underline">{c.name || 'Unnamed'}</Link>
              <div className="flex gap-2">
                <button type="button" onClick={() => void duplicateCharacter(c.id)} className="rounded border px-2 py-1">Duplicate</button>
                <button type="button" onClick={() => void deleteCharacter(c.id)} aria-label={`Delete ${c.name || 'character'}`} className="rounded border px-2 py-1">Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Run the test (expect PASS)**

Run: `npx vitest run src/pages/RosterPage.test.tsx`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ui): RosterPage with create/duplicate/delete/import/export"
```

---

## Task 14: SheetPage + routing + app wiring

**Files:**
- Create: `src/pages/SheetPage.tsx`
- Modify: `src/App.tsx`, `src/main.tsx`
- Test: `src/pages/SheetPage.test.tsx`

**Interfaces:**
- Consumes: all section components; `useCharacterStore`; `parry`, `toughness`, `pace`, `findSkill` from `derived.ts`; `blankCharacter`/`newId` from `defaults.ts`; `useParams`/`Link` from `react-router-dom`.
- Produces: `SheetPage()`; `App()` with routes `/` → `RosterPage`, `/c/:id` → `SheetPage`.

- [ ] **Step 1: Write the failing test `src/pages/SheetPage.test.tsx`**

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import { SheetPage } from './SheetPage';
import { useCharacterStore } from '../store/characterStore';
import { blankCharacter } from '../domain/defaults';

beforeEach(() => {
  useCharacterStore.setState({ roster: [], activeId: null, lastError: null });
});

function renderAt(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/c/${id}`]}>
      <Routes>
        <Route path="/c/:id" element={<SheetPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SheetPage', () => {
  it('shows derived Toughness and rolls an attribute into the log', async () => {
    const c = blankCharacter('Rolla');
    c.attributes.vigor = { sides: 10, bonus: 0 }; // toughness = 2 + 5 = 7 (distinct from Pace 6 / Parry 2)
    useCharacterStore.setState({ roster: [c], activeId: c.id });

    renderAt(c.id);

    expect(await screen.findByText('Toughness')).toBeInTheDocument();
    // Toughness value 7 is unique (Pace is 6, Parry is 2)
    expect(screen.getByText('7')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /roll vigor/i }));
    await waitFor(() => {
      const log = useCharacterStore.getState().roster.find((x) => x.id === c.id)!.rollLog;
      expect(log.length).toBe(1);
      expect(log[0].label).toBe('Vigor');
    });
  });
});
```

- [ ] **Step 2: Run the test (expect FAIL)**

Run: `npx vitest run src/pages/SheetPage.test.tsx`
Expected: FAIL — `SheetPage.tsx` not found.

- [ ] **Step 3: Implement `src/pages/SheetPage.tsx`**

```tsx
import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCharacterStore } from '../store/characterStore';
import { newId } from '../domain/defaults';
import { parry, toughness, pace, findSkill } from '../domain/derived';
import type { AttributeKey, TraitDie } from '../domain/types';
import { SheetHeader } from '../components/SheetHeader';
import { DerivedBar } from '../components/DerivedBar';
import { StatusTracker } from '../components/StatusTracker';
import { AttributesPanel } from '../components/AttributesPanel';
import { SkillsPanel } from '../components/SkillsPanel';
import { EdgesHindrancesPanel } from '../components/EdgesHindrancesPanel';
import { GearPanel } from '../components/GearPanel';
import { DiceLog } from '../components/DiceLog';

const ATTR_LABEL: Record<AttributeKey, string> = {
  agility: 'Agility', smarts: 'Smarts', spirit: 'Spirit', strength: 'Strength', vigor: 'Vigor',
};

export function SheetPage() {
  const { id = '' } = useParams();
  const character = useCharacterStore((s) => s.roster.find((c) => c.id === id));
  const load = useCharacterStore((s) => s.load);
  const update = useCharacterStore((s) => s.update);
  const addWound = useCharacterStore((s) => s.addWound);
  const healWound = useCharacterStore((s) => s.healWound);
  const setFatigue = useCharacterStore((s) => s.setFatigue);
  const toggleShaken = useCharacterStore((s) => s.toggleShaken);
  const spendBenny = useCharacterStore((s) => s.spendBenny);
  const addBenny = useCharacterStore((s) => s.addBenny);
  const rollTraitFor = useCharacterStore((s) => s.rollTraitFor);
  const rollWeaponDamage = useCharacterStore((s) => s.rollWeaponDamage);
  const clearLog = useCharacterStore((s) => s.clearLog);

  useEffect(() => { if (!character) void load(); }, [character, load]);

  if (!character) {
    return (
      <main className="mx-auto max-w-3xl p-4">
        <p>Character not found. <Link to="/" className="underline">Back to roster</Link></p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 p-4">
      <Link to="/" className="underline">← Roster</Link>

      <SheetHeader
        character={character}
        onNameChange={(name) => update(id, (c) => { c.name = name; })}
        onAncestryChange={(ancestry) => update(id, (c) => { c.ancestry = ancestry; })}
        onToggleWildCard={() => update(id, (c) => { c.isWildCard = !c.isWildCard; })}
        onSpendBenny={() => spendBenny(id)}
        onAddBenny={() => addBenny(id)}
      />

      <DerivedBar parry={parry(character)} toughness={toughness(character)} pace={pace()} />

      <StatusTracker
        status={character.status}
        onAddWound={() => addWound(id)}
        onHealWound={() => healWound(id)}
        onSetFatigue={(n) => setFatigue(id, n)}
        onToggleShaken={() => toggleShaken(id)}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AttributesPanel
          attributes={character.attributes}
          onChangeAttribute={(key, die) => update(id, (c) => { c.attributes[key] = die; })}
          onRoll={(key) => rollTraitFor(id, ATTR_LABEL[key], character.attributes[key])}
        />
        <SkillsPanel
          skills={character.skills}
          onChangeSkill={(sid, patch) => update(id, (c) => {
            const s = c.skills.find((x) => x.id === sid);
            if (s) Object.assign(s, patch);
          })}
          onAddSkill={() => update(id, (c) => { c.skills.push({ id: newId(), name: 'New Skill', attribute: 'smarts', die: { sides: 4, bonus: 0 } }); })}
          onRemoveSkill={(sid) => update(id, (c) => { c.skills = c.skills.filter((x) => x.id !== sid); })}
          onRoll={(sid) => {
            const s = findSkill(character, character.skills.find((x) => x.id === sid)?.name ?? '');
            if (s) rollTraitFor(id, s.name, s.die);
          }}
        />
      </div>

      <EdgesHindrancesPanel
        items={character.edgesHindrances}
        onAdd={(type) => update(id, (c) => {
          c.edgesHindrances.push({ id: newId(), name: '', type, severity: type === 'hindrance' ? 'minor' : null, notes: '' });
        })}
        onChange={(eid, patch) => update(id, (c) => {
          const it = c.edgesHindrances.find((x) => x.id === eid);
          if (it) Object.assign(it, patch);
        })}
        onRemove={(eid) => update(id, (c) => { c.edgesHindrances = c.edgesHindrances.filter((x) => x.id !== eid); })}
      />

      <GearPanel
        weapons={character.weapons}
        armor={character.armor}
        gear={character.gear}
        onAddWeapon={() => update(id, (c) => { c.weapons.push({ id: newId(), name: 'New Weapon', damageDice: [{ sides: 6, bonus: 0 }], addStrength: true, damageBonus: 0, range: '', rof: 1, ap: 0, notes: '' }); })}
        onChangeWeapon={(wid, patch) => update(id, (c) => { const w = c.weapons.find((x) => x.id === wid); if (w) Object.assign(w, patch); })}
        onRemoveWeapon={(wid) => update(id, (c) => { c.weapons = c.weapons.filter((x) => x.id !== wid); })}
        onRollDamage={(wid) => rollWeaponDamage(id, wid)}
        onAddArmor={() => update(id, (c) => { c.armor.push({ id: newId(), name: 'New Armor', armor: 2, equipped: true, notes: '' }); })}
        onChangeArmor={(aid, patch) => update(id, (c) => { const a = c.armor.find((x) => x.id === aid); if (a) Object.assign(a, patch); })}
        onRemoveArmor={(aid) => update(id, (c) => { c.armor = c.armor.filter((x) => x.id !== aid); })}
        onAddGear={() => update(id, (c) => { c.gear.push({ id: newId(), name: 'New Item', quantity: 1, notes: '' }); })}
        onChangeGear={(gid, patch) => update(id, (c) => { const g = c.gear.find((x) => x.id === gid); if (g) Object.assign(g, patch); })}
        onRemoveGear={(gid) => update(id, (c) => { c.gear = c.gear.filter((x) => x.id !== gid); })}
      />

      <DiceLog entries={character.rollLog} onClear={() => clearLog(id)} />
    </main>
  );
}
```

- [ ] **Step 4: Wire routing in `src/App.tsx`**

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { RosterPage } from './pages/RosterPage';
import { SheetPage } from './pages/SheetPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RosterPage />} />
        <Route path="/c/:id" element={<SheetPage />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 5: Confirm `src/main.tsx` renders App with styles**

Ensure `src/main.tsx` matches (Vite's default plus the index.css import):
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 6: Update the App smoke test from Task 1**

The Task 1 test rendered `<App />` and expected an `<h1>`. With routing, `App` now renders `RosterPage`, whose `<h1>` is "Savage Worlds Sheets" — the assertion still holds, but `App` now uses `BrowserRouter`. Replace `src/App.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import App from './App';
import { useCharacterStore } from './store/characterStore';

beforeEach(() => {
  useCharacterStore.setState({ roster: [], activeId: null, lastError: null });
});

describe('App', () => {
  it('renders the roster heading', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole('heading', { name: /savage worlds sheets/i })).toBeInTheDocument());
  });
});
```

- [ ] **Step 7: Run the full test suite (expect PASS)**

Run: `npm test`
Expected: all test files pass.

- [ ] **Step 8: Manual smoke test**

Run: `npm run dev`, open the printed URL. Create a character, change Vigor to d8 (Toughness shows 8 → 2+4=6), roll an attribute (entry appears in the Dice log), add a wound (subsequent rolls show `mod -1`), reload the page (character persists), export then re-import the JSON (roster intact).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(ui): SheetPage, routing, and app wiring"
```

---

## Self-Review

**1. Spec coverage (Slice 1):**
- Roster CRUD → Task 13 (create/duplicate/delete) ✓
- JSON import/export → Task 6 (repo) + Task 13 (UI) ✓
- Attributes/skills build+edit+roll → Tasks 4, 10, 14 ✓
- Edges/Hindrances → Task 11 ✓
- Gear (weapons roll damage, armor feeds Toughness) → Tasks 3, 11, 14 ✓
- Derived stats (Pace/Parry/Toughness) → Task 3 + Task 9 (DerivedBar) + Task 14 ✓
- Dice engine (acing, Wild Die, crit-fail, Raises) → Task 2 ✓
- Roll log → Tasks 7, 12 ✓
- Status trackers (Shaken/Wounds/Fatigue) + Bennies → Tasks 7, 9 ✓
- Wild Card/Extra toggle → Task 9 (SheetHeader) + Task 7 (roll uses isWildCard) ✓
- Error handling (save banner, validated import) → Tasks 6, 7, 13 ✓

**2. Placeholder scan:** No "TBD/TODO"; every code step has complete code; commands have expected outcomes. ✓

**3. Type consistency:** `TraitDie`, `Character`, `RollLogEntry`, `Status`, store action names (`rollTraitFor`, `update`, `addWound`, etc.), and component prop names are defined in Tasks 2/7 and used identically in Tasks 8–14. The repo method set (`list/get/put/remove/exportJson/importJson`) matches between Task 6 and Task 7. ✓

Deferred per the spec (not in this plan): Powers/Arcane Backgrounds (Slice 2); Advances/Rank, point-buy creation validator, encumbrance/Load Limit, curated datasets (Slice 3); cloud sync + GM view (later).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-17-savage-worlds-sheets-slice-1.md`. Two execution options:

1. **Subagent-Driven (recommended)** — a fresh subagent per task, with review between tasks and fast iteration.
2. **Inline Execution** — execute tasks in this session via executing-plans, batched with checkpoints.

Which approach?

## Post-Implementation Notes (Slice 1)

Implemented on branch `feat/savage-sheets-slice-1`. 42 tests pass; `tsc -b` + `vite build` clean; real-browser smoke verified (create / edit Vigor / roll / wound penalty / reload-persistence).

Two plan corrections made during execution:
- **Extra Critical Failure:** an Extra's lone natural 1 IS a Critical Failure (RAW SWADE). Task 2 Step 3's test was reconciled to expect `true` (the implementation code in Step 5 was already correct).
- **`load()` contract:** changed from full-replace to a merge (DB wins per id, in-memory-only chars retained) to fix a mount-load race against an optimistic create; backward-compatible at cold start, documented in JSDoc and unit-pinned.

Deferred to Slice 1.x (triaged Minor at final review, non-blocking):
- GearPanel: per-weapon `damageDice` editor (currently the scaffold default die + flat bonus).
- `importJson`: optional replace-vs-merge mode (currently additive upsert-by-id).
- Zod schema: `.strict()` and numeric range checks on wounds/fatigue/bennies/quantity/armor.
- Page tests: isolate the shared fake-indexeddb between cases (currently reset in-memory state only).
- `formatDie`/`rollDie`: guards for negative bonus / non-standard sides (unreachable through typed callers today).
- `load()` mid-session concurrency: a stale DB copy could win over an in-flight same-id edit (harmless for current mount-time-only usage).
- `.tool-versions` pins `nodejs lts`, which asdf cannot resolve; commands need `ASDF_NODEJS_VERSION=<concrete>` until pinned to a concrete LTS.
