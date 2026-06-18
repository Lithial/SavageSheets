# Savage Worlds Sheets — Slice 2 (Powers / Arcane Backgrounds) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add Arcane Backgrounds and Powers to the existing character sheet: track Power Points, manage known Powers, and cast (roll the arcane skill via the existing dice engine and spend PP), with backward-compatible persistence.

**Architecture:** Extends Slice 1 in place. New domain types (`Power`, `ArcaneBackground`) and an optional `Character.arcaneBackground`; a Zod schema addition with a v1→v2 migration; dedicated store actions for the live "play" actions (PP spend/restore/reset + cast) while build/edit CRUD reuses the existing generic `update(id, recipe)`; a new presentational `PowersPanel`; SheetPage wiring.

**Tech Stack:** unchanged — React 18, Vite, TS, Zustand (+immer), Dexie, Zod, Vitest + RTL.

## Global Constraints

- **TypeScript strict**, no `any`. The project enables `noUnusedLocals`/`noUnusedParameters` — no unused imports. Verify with `npx tsc -b`.
- **Node:** commands need `ASDF_NODEJS_VERSION=22.18.0` (e.g. `ASDF_NODEJS_VERSION=22.18.0 npm test`); `.tool-versions` pins unresolved `nodejs lts`.
- **Pure domain layer:** `src/domain/*` imports nothing from React/DOM/Dexie/store; deterministic given an injected `Rng`.
- **No copyrighted content:** power names/ranges/durations/effects are user-entered.
- **Backward-compatible persistence:** existing v1 character JSON MUST still import — migrate to `schemaVersion: 2` with `arcaneBackground: null`, never reject.
- **`characterSchema` is `satisfies z.ZodType<Character>`** — the Zod shape must match the `Character` type exactly, or `tsc` fails.
- **Follow existing conventions:** store mutations go through the existing `mutate(id, recipe)` + `tracked` helpers; build/edit CRUD is wired in SheetPage via the generic `update(id, recipe)` (like Edges/Gear); only live "play" actions get dedicated store actions (like `spendBenny`, `rollTraitFor`).
- **Commit after every task** with the message in its final step. Run focused tests with `npx vitest run <file>`; full suite with `npm test`.

---

## File Structure

```
src/domain/types.ts          # MODIFY: add Power, ArcaneBackground; Character.arcaneBackground
src/domain/defaults.ts       # MODIFY: SCHEMA_VERSION=2; blankCharacter; + blankArcaneBackground, newPower
src/domain/defaults.test.ts  # MODIFY: add AB/power factory + null-default tests
src/persistence/schema.ts    # MODIFY: power + arcaneBackground zod; migration in parse paths
src/persistence/schema.test.ts # MODIFY: AB round-trip + v1->v2 migration tests
src/store/characterStore.ts  # MODIFY: spendPP/restorePP/resetPP/castPower actions
src/store/characterStore.test.ts # MODIFY: cast + PP-clamp tests
src/components/PowersPanel.tsx       # CREATE
src/components/PowersPanel.test.tsx  # CREATE
src/pages/SheetPage.tsx      # MODIFY: render + wire PowersPanel
src/pages/SheetPage.test.tsx # MODIFY: cast-from-sheet integration test
```

---

## Task 1: Domain types + factories (Power, ArcaneBackground)

**Files:**
- Modify: `src/domain/types.ts`, `src/domain/defaults.ts`
- Test: `src/domain/defaults.test.ts`

**Interfaces:**
- Produces: `Power`, `ArcaneBackground` types; `Character.arcaneBackground: ArcaneBackground | null`; `SCHEMA_VERSION = 2`; `blankArcaneBackground()`, `newPower()`.

- [ ] **Step 1: Write the failing test** — append to `src/domain/defaults.test.ts`:

```ts
import { blankArcaneBackground, newPower } from './defaults';

describe('arcane background factories', () => {
  it('blankCharacter has no arcane background and is schema v2', () => {
    const c = blankCharacter();
    expect(c.arcaneBackground).toBeNull();
    expect(c.schemaVersion).toBe(2);
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
```

- [ ] **Step 2: Run test (expect FAIL)**

Run: `ASDF_NODEJS_VERSION=22.18.0 npx vitest run src/domain/defaults.test.ts`
Expected: FAIL — `blankArcaneBackground`/`newPower` not exported; `arcaneBackground`/`schemaVersion` assertions fail.

- [ ] **Step 3: Add types to `src/domain/types.ts`**

Add these interfaces (after `GearItem`, before `Status`):
```ts
export interface Power {
  id: string;
  name: string;
  ppCost: number;
  range: string;
  duration: string;
  notes: string;
}

export interface ArcaneBackground {
  name: string;
  arcaneSkillName: string;
  arcaneSkillDie: TraitDie;
  powerPoints: { current: number; max: number };
  powers: Power[];
}
```

Add the field to the `Character` interface (after `gear: GearItem[];`):
```ts
  arcaneBackground: ArcaneBackground | null;
```

- [ ] **Step 4: Update `src/domain/defaults.ts`**

Change the import line to include the new types:
```ts
import type { ArcaneBackground, AttributeKey, Character, DieSides, Power, Skill, TraitDie } from './types';
```

Set the version:
```ts
export const SCHEMA_VERSION = 2;
```

Add the new factories (after `newId`):
```ts
export function blankArcaneBackground(): ArcaneBackground {
  return {
    name: '',
    arcaneSkillName: 'Spellcasting',
    arcaneSkillDie: d(4),
    powerPoints: { current: 10, max: 10 },
    powers: [],
  };
}

export function newPower(): Power {
  return { id: newId(), name: 'New Power', ppCost: 1, range: '', duration: '', notes: '' };
}
```

In `blankCharacter`, add the field to the returned object (after `gear: [],`):
```ts
    arcaneBackground: null,
```

- [ ] **Step 5: Run test (expect PASS)**

Run: `ASDF_NODEJS_VERSION=22.18.0 npx vitest run src/domain/defaults.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(domain): Power + ArcaneBackground types and factories; schema v2"
```

---

## Task 2: Persistence schema + v1→v2 migration

**Files:**
- Modify: `src/persistence/schema.ts`
- Test: `src/persistence/schema.test.ts`

**Interfaces:**
- Consumes: `Power`, `ArcaneBackground` from `domain/types.ts`.
- Produces: extended `characterSchema` (with nullable `arcaneBackground`); `parseCharacterValue` and `parseRoster` migrate v1 objects (missing `arcaneBackground` → `null`, `schemaVersion → 2`).

- [ ] **Step 1: Write the failing test** — append to `src/persistence/schema.test.ts`:

```ts
import { blankArcaneBackground, newPower } from '../domain/defaults';

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
    expect(back[0].schemaVersion).toBe(2);
  });
});
```

- [ ] **Step 2: Run test (expect FAIL)**

Run: `ASDF_NODEJS_VERSION=22.18.0 npx vitest run src/persistence/schema.test.ts`
Expected: FAIL — `arcaneBackground` not in schema (round-trip mismatch / migration absent).

- [ ] **Step 3: Update `src/persistence/schema.ts`**

Add the Zod sub-schemas (after the `gearItem` schema, before `status`):
```ts
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
```

Add the field to `characterSchema` (after `rollLog: z.array(rollLogEntry),`, before `updatedAt`):
```ts
  arcaneBackground: arcaneBackground.nullable(),
```

Replace the three parse helpers with migration-aware versions:
```ts
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
```

- [ ] **Step 4: Run test (expect PASS)**

Run: `ASDF_NODEJS_VERSION=22.18.0 npx vitest run src/persistence/schema.test.ts`
Expected: PASS (new tests + existing round-trip/rejection tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(persistence): arcane background schema + v1->v2 migration"
```

---

## Task 3: Store actions (PP + cast)

**Files:**
- Modify: `src/store/characterStore.ts`
- Test: `src/store/characterStore.test.ts`

**Interfaces:**
- Consumes: existing `mutate`, `clamp`, `rollTrait`, `traitPenalty`, `formatTraitRoll`, `newId`, `LOG_LIMIT`.
- Produces (on `StoreState` and the store): `spendPP(id, n)`, `restorePP(id, n)`, `resetPP(id)`, `castPower(id, powerId)`.

- [ ] **Step 1: Write the failing test** — append to `src/store/characterStore.test.ts`:

```ts
import { blankArcaneBackground } from '../domain/defaults';

describe('characterStore — powers', () => {
  function withAB(store: ReturnType<typeof makeCharacterStore>, id: string, patch: (c: Character) => void) {
    store.getState().update(id, (c) => { c.arcaneBackground = blankArcaneBackground(); patch(c); });
  }

  it('casts a power: rolls the arcane skill, spends PP, and logs it', async () => {
    // arcane skill d8 -> 5, wild d6 -> 2 ; total 5 ; spend 3 of 10
    const { store } = setup(fixedRng([[8, 5], [6, 2]]));
    const id = await store.getState().createCharacter();
    withAB(store, id, (c) => {
      c.arcaneBackground!.arcaneSkillDie = { sides: 8, bonus: 0 };
      c.arcaneBackground!.powerPoints = { current: 10, max: 10 };
      c.arcaneBackground!.powers = [{ id: 'p1', name: 'Bolt', ppCost: 3, range: '', duration: '', notes: '' }];
    });
    store.getState().castPower(id, 'p1');
    const c = store.getState().roster.find((x) => x.id === id)!;
    expect(c.arcaneBackground!.powerPoints.current).toBe(7);
    expect(c.rollLog[0].label).toBe('Bolt');
    expect(c.rollLog[0].total).toBe(5);
  });

  it('does not cast when current PP is below the power cost', async () => {
    const { store } = setup(() => 0.5);
    const id = await store.getState().createCharacter();
    withAB(store, id, (c) => {
      c.arcaneBackground!.powerPoints = { current: 2, max: 10 };
      c.arcaneBackground!.powers = [{ id: 'p1', name: 'Bolt', ppCost: 3, range: '', duration: '', notes: '' }];
    });
    store.getState().castPower(id, 'p1');
    const c = store.getState().roster.find((x) => x.id === id)!;
    expect(c.arcaneBackground!.powerPoints.current).toBe(2);
    expect(c.rollLog).toHaveLength(0);
  });

  it('clamps PP spend/restore/reset to 0..max', async () => {
    const { store } = setup();
    const id = await store.getState().createCharacter();
    withAB(store, id, (c) => { c.arcaneBackground!.powerPoints = { current: 5, max: 10 }; });
    const cur = () => store.getState().roster.find((x) => x.id === id)!.arcaneBackground!.powerPoints.current;
    store.getState().spendPP(id, 100); expect(cur()).toBe(0);
    store.getState().restorePP(id, 100); expect(cur()).toBe(10);
    store.getState().spendPP(id, 4); store.getState().resetPP(id); expect(cur()).toBe(10);
  });
});
```

- [ ] **Step 2: Run test (expect FAIL)**

Run: `ASDF_NODEJS_VERSION=22.18.0 npx vitest run src/store/characterStore.test.ts`
Expected: FAIL — `spendPP`/`restorePP`/`resetPP`/`castPower` not defined.

- [ ] **Step 3: Add actions to the store**

In `src/store/characterStore.ts`, add to the `StoreState` interface (after `clearLog`):
```ts
  spendPP: (id: string, n: number) => void;
  restorePP: (id: string, n: number) => void;
  resetPP: (id: string) => void;
  castPower: (id: string, powerId: string) => void;
```

Add the implementations inside the returned object (after `clearLog`, before `importJson`):
```ts
        spendPP: (id, n) => mutate(id, (c) => {
          const ab = c.arcaneBackground;
          if (ab) ab.powerPoints.current = clamp(ab.powerPoints.current - n, 0, ab.powerPoints.max);
        }),
        restorePP: (id, n) => mutate(id, (c) => {
          const ab = c.arcaneBackground;
          if (ab) ab.powerPoints.current = clamp(ab.powerPoints.current + n, 0, ab.powerPoints.max);
        }),
        resetPP: (id) => mutate(id, (c) => {
          const ab = c.arcaneBackground;
          if (ab) ab.powerPoints.current = ab.powerPoints.max;
        }),

        castPower: (id, powerId) => mutate(id, (c) => {
          const ab = c.arcaneBackground;
          if (!ab) return;
          const power = ab.powers.find((p) => p.id === powerId);
          if (!power) return;
          if (ab.powerPoints.current < power.ppCost) return; // insufficient PP: no-op
          const res = rollTrait(
            { die: ab.arcaneSkillDie, wild: c.isWildCard, modifier: traitPenalty(c.status), tn: 4 },
            deps.rng,
          );
          ab.powerPoints.current = Math.max(0, ab.powerPoints.current - power.ppCost);
          c.rollLog.unshift({
            id: newId(),
            at: deps.now(),
            label: power.name || 'Power',
            kind: 'trait',
            detail: `${formatTraitRoll(res)}; spent ${power.ppCost} PP (${ab.powerPoints.current} left)`,
            total: res.total,
            success: res.success,
            raises: res.raises,
            criticalFailure: res.criticalFailure,
          });
          c.rollLog = c.rollLog.slice(0, LOG_LIMIT);
        }),
```

- [ ] **Step 4: Run test (expect PASS)**

Run: `ASDF_NODEJS_VERSION=22.18.0 npx vitest run src/store/characterStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(store): power-point actions and castPower"
```

---

## Task 4: PowersPanel component

**Files:**
- Create: `src/components/PowersPanel.tsx`
- Test: `src/components/PowersPanel.test.tsx`

**Interfaces:**
- Consumes: `ArcaneBackground`, `Power`, `TraitDie` from `domain/types.ts`; `DiePicker`.
- Produces: `PowersPanel({ arcaneBackground, onAddArcaneBackground, onRemoveArcaneBackground, onChangeName, onChangeSkillName, onChangeSkillDie, onSetMaxPP, onSpendPP, onRestorePP, onResetPP, onAddPower, onChangePower, onRemovePower, onCast })`.

- [ ] **Step 1: Write the failing test `src/components/PowersPanel.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PowersPanel } from './PowersPanel';
import type { ArcaneBackground } from '../domain/types';

const handlers = {
  onAddArcaneBackground: vi.fn(), onRemoveArcaneBackground: vi.fn(),
  onChangeName: vi.fn(), onChangeSkillName: vi.fn(), onChangeSkillDie: vi.fn(),
  onSetMaxPP: vi.fn(), onSpendPP: vi.fn(), onRestorePP: vi.fn(), onResetPP: vi.fn(),
  onAddPower: vi.fn(), onChangePower: vi.fn(), onRemovePower: vi.fn(), onCast: vi.fn(),
};

const ab: ArcaneBackground = {
  name: 'Magic', arcaneSkillName: 'Spellcasting', arcaneSkillDie: { sides: 6, bonus: 0 },
  powerPoints: { current: 2, max: 10 },
  powers: [
    { id: 'p1', name: 'Bolt', ppCost: 1, range: '', duration: '', notes: '' },
    { id: 'p2', name: 'Fireball', ppCost: 3, range: '', duration: '', notes: '' },
  ],
};

describe('PowersPanel', () => {
  it('offers to add an Arcane Background when there is none', async () => {
    const onAddArcaneBackground = vi.fn();
    render(<PowersPanel arcaneBackground={null} {...handlers} onAddArcaneBackground={onAddArcaneBackground} />);
    await userEvent.click(screen.getByRole('button', { name: /add arcane background/i }));
    expect(onAddArcaneBackground).toHaveBeenCalled();
  });

  it('casts an affordable power and disables an unaffordable one', async () => {
    const onCast = vi.fn();
    render(<PowersPanel arcaneBackground={ab} {...handlers} onCast={onCast} />);
    await userEvent.click(screen.getByRole('button', { name: /cast bolt/i }));
    expect(onCast).toHaveBeenCalledWith('p1');
    expect(screen.getByRole('button', { name: /cast fireball/i })).toBeDisabled();
  });

  it('adds a power', async () => {
    const onAddPower = vi.fn();
    render(<PowersPanel arcaneBackground={ab} {...handlers} onAddPower={onAddPower} />);
    await userEvent.click(screen.getByRole('button', { name: /add power/i }));
    expect(onAddPower).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test (expect FAIL)**

Run: `ASDF_NODEJS_VERSION=22.18.0 npx vitest run src/components/PowersPanel.test.tsx`
Expected: FAIL — `PowersPanel.tsx` not found.

- [ ] **Step 3: Implement `src/components/PowersPanel.tsx`**

```tsx
import type { ArcaneBackground, Power, TraitDie } from '../domain/types';
import { DiePicker } from './DiePicker';

export function PowersPanel({
  arcaneBackground,
  onAddArcaneBackground,
  onRemoveArcaneBackground,
  onChangeName,
  onChangeSkillName,
  onChangeSkillDie,
  onSetMaxPP,
  onSpendPP,
  onRestorePP,
  onResetPP,
  onAddPower,
  onChangePower,
  onRemovePower,
  onCast,
}: {
  arcaneBackground: ArcaneBackground | null;
  onAddArcaneBackground: () => void;
  onRemoveArcaneBackground: () => void;
  onChangeName: (name: string) => void;
  onChangeSkillName: (name: string) => void;
  onChangeSkillDie: (die: TraitDie) => void;
  onSetMaxPP: (n: number) => void;
  onSpendPP: () => void;
  onRestorePP: () => void;
  onResetPP: () => void;
  onAddPower: () => void;
  onChangePower: (powerId: string, patch: Partial<Power>) => void;
  onRemovePower: (powerId: string) => void;
  onCast: (powerId: string) => void;
}) {
  if (!arcaneBackground) {
    return (
      <section className="rounded border p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-bold">Powers</h2>
          <button type="button" onClick={onAddArcaneBackground} aria-label="Add arcane background" className="rounded border px-2 py-1">
            + Arcane Background
          </button>
        </div>
        <p className="text-sm text-gray-500">No Arcane Background.</p>
      </section>
    );
  }

  const ab = arcaneBackground;
  return (
    <section className="rounded border p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-bold">Powers</h2>
        <button type="button" onClick={onRemoveArcaneBackground} aria-label="Remove arcane background" className="rounded border px-2 py-1">
          Remove
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-sm">
          Arcane Background
          <input aria-label="Arcane background name" value={ab.name} onChange={(e) => onChangeName(e.target.value)} className="rounded border px-2 py-1" />
        </label>
        <label className="flex flex-col text-sm">
          Arcane skill
          <input aria-label="Arcane skill name" value={ab.arcaneSkillName} onChange={(e) => onChangeSkillName(e.target.value)} className="rounded border px-2 py-1" />
        </label>
        <DiePicker label="Arcane skill die" value={ab.arcaneSkillDie} onChange={onChangeSkillDie} />
        <div className="flex items-center gap-2 text-sm">
          <span>PP: {ab.powerPoints.current}/{ab.powerPoints.max}</span>
          <button type="button" onClick={onSpendPP} aria-label="Spend power point" className="rounded border px-2">−</button>
          <button type="button" onClick={onRestorePP} aria-label="Restore power point" className="rounded border px-2">+</button>
          <button type="button" onClick={onResetPP} aria-label="Reset power points" className="rounded border px-2 py-1">Reset</button>
          <label className="flex items-center gap-1">
            max
            <input aria-label="Max power points" type="number" value={ab.powerPoints.max} onChange={(e) => onSetMaxPP(Number(e.target.value))} className="w-16 rounded border px-2 py-1" />
          </label>
        </div>
      </div>

      <div className="mb-1 flex items-center justify-between">
        <h3 className="font-semibold">Known Powers</h3>
        <button type="button" onClick={onAddPower} aria-label="Add power" className="rounded border px-2 py-1">+ Power</button>
      </div>
      <ul className="flex flex-col gap-2">
        {ab.powers.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-2">
            <input aria-label={`Power name ${p.id}`} value={p.name} onChange={(e) => onChangePower(p.id, { name: e.target.value })} className="flex-1 rounded border px-2 py-1" />
            <label className="flex items-center gap-1 text-sm">
              PP
              <input aria-label={`Power cost ${p.id}`} type="number" value={p.ppCost} onChange={(e) => onChangePower(p.id, { ppCost: Number(e.target.value) })} className="w-16 rounded border px-2 py-1" />
            </label>
            <input aria-label={`Power range ${p.id}`} value={p.range} onChange={(e) => onChangePower(p.id, { range: e.target.value })} placeholder="range" className="w-24 rounded border px-2 py-1" />
            <input aria-label={`Power duration ${p.id}`} value={p.duration} onChange={(e) => onChangePower(p.id, { duration: e.target.value })} placeholder="duration" className="w-24 rounded border px-2 py-1" />
            <button
              type="button"
              onClick={() => onCast(p.id)}
              disabled={ab.powerPoints.current < p.ppCost}
              aria-label={`Cast ${p.name || 'power'}`}
              className="rounded bg-gray-800 px-2 py-1 text-white disabled:opacity-40"
            >
              Cast
            </button>
            <button type="button" onClick={() => onRemovePower(p.id)} aria-label={`Remove ${p.name || 'power'}`} className="rounded border px-2 py-1">✕</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: Run test (expect PASS)**

Run: `ASDF_NODEJS_VERSION=22.18.0 npx vitest run src/components/PowersPanel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ui): PowersPanel with cast and PP controls"
```

---

## Task 5: SheetPage wiring + integration test

**Files:**
- Modify: `src/pages/SheetPage.tsx`
- Test: `src/pages/SheetPage.test.tsx`

**Interfaces:**
- Consumes: `PowersPanel`; `blankArcaneBackground`, `newPower` from `defaults`; store actions `spendPP`, `restorePP`, `resetPP`, `castPower`.

- [ ] **Step 1: Write the failing test** — append to `src/pages/SheetPage.test.tsx` (reuse the file's existing `renderAt` helper and `beforeEach` store reset):

```ts
import { blankCharacter } from '../domain/defaults';

describe('SheetPage — powers', () => {
  it('casts a power from the sheet, spending PP and logging it', async () => {
    const c = blankCharacter('Mage');
    c.arcaneBackground = {
      name: 'Magic', arcaneSkillName: 'Spellcasting', arcaneSkillDie: { sides: 6, bonus: 0 },
      powerPoints: { current: 5, max: 10 },
      powers: [{ id: 'p1', name: 'Bolt', ppCost: 2, range: '', duration: '', notes: '' }],
    };
    useCharacterStore.setState({ roster: [c], activeId: c.id });
    renderAt(c.id);
    await userEvent.click(await screen.findByRole('button', { name: /cast bolt/i }));
    await waitFor(() => {
      const cc = useCharacterStore.getState().roster.find((x) => x.id === c.id)!;
      expect(cc.arcaneBackground!.powerPoints.current).toBe(3);
      expect(cc.rollLog[0].label).toBe('Bolt');
    });
  });
});
```

> If `src/pages/SheetPage.test.tsx` does not already import `blankCharacter`, `waitFor`, or `userEvent`, add them to the existing imports rather than duplicating. Use the existing `renderAt` and `beforeEach` reset already in the file.

- [ ] **Step 2: Run test (expect FAIL)**

Run: `ASDF_NODEJS_VERSION=22.18.0 npx vitest run src/pages/SheetPage.test.tsx`
Expected: FAIL — no "Cast bolt" button (PowersPanel not wired).

- [ ] **Step 3: Wire PowersPanel into `src/pages/SheetPage.tsx`**

Update the defaults import:
```ts
import { newId, blankArcaneBackground, newPower } from '../domain/defaults';
```

Add the import for the panel (with the other component imports):
```ts
import { PowersPanel } from '../components/PowersPanel';
```

Add the store selectors (with the other `useCharacterStore` selectors):
```ts
  const spendPP = useCharacterStore((s) => s.spendPP);
  const restorePP = useCharacterStore((s) => s.restorePP);
  const resetPP = useCharacterStore((s) => s.resetPP);
  const castPower = useCharacterStore((s) => s.castPower);
```

Render `PowersPanel` immediately before the `<DiceLog … />` line:
```tsx
      <PowersPanel
        arcaneBackground={character.arcaneBackground}
        onAddArcaneBackground={() => update(id, (c) => { c.arcaneBackground = blankArcaneBackground(); })}
        onRemoveArcaneBackground={() => update(id, (c) => { c.arcaneBackground = null; })}
        onChangeName={(name) => update(id, (c) => { if (c.arcaneBackground) c.arcaneBackground.name = name; })}
        onChangeSkillName={(name) => update(id, (c) => { if (c.arcaneBackground) c.arcaneBackground.arcaneSkillName = name; })}
        onChangeSkillDie={(die) => update(id, (c) => { if (c.arcaneBackground) c.arcaneBackground.arcaneSkillDie = die; })}
        onSetMaxPP={(n) => update(id, (c) => {
          if (c.arcaneBackground) {
            c.arcaneBackground.powerPoints.max = n;
            c.arcaneBackground.powerPoints.current = Math.min(c.arcaneBackground.powerPoints.current, n);
          }
        })}
        onSpendPP={() => spendPP(id, 1)}
        onRestorePP={() => restorePP(id, 1)}
        onResetPP={() => resetPP(id)}
        onAddPower={() => update(id, (c) => { c.arcaneBackground?.powers.push(newPower()); })}
        onChangePower={(pid, patch) => update(id, (c) => {
          const p = c.arcaneBackground?.powers.find((x) => x.id === pid);
          if (p) Object.assign(p, patch);
        })}
        onRemovePower={(pid) => update(id, (c) => {
          if (c.arcaneBackground) c.arcaneBackground.powers = c.arcaneBackground.powers.filter((x) => x.id !== pid);
        })}
        onCast={(pid) => castPower(id, pid)}
      />
```

- [ ] **Step 4: Run test (expect PASS)**

Run: `ASDF_NODEJS_VERSION=22.18.0 npx vitest run src/pages/SheetPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full suite + build + commit**

```bash
ASDF_NODEJS_VERSION=22.18.0 npm test
ASDF_NODEJS_VERSION=22.18.0 npm run build
git add -A
git commit -m "feat(ui): wire PowersPanel into the sheet"
```
Expected: all tests pass; `tsc -b && vite build` exit 0.

---

## Self-Review

**1. Spec coverage (Slice 2):**
- AB add/remove → Task 1 (factory) + Task 5 (wiring) ✓
- Arcane skill (name + die) → Task 1 type + Task 4 UI ✓
- PP pool spend/restore/reset → Task 3 (actions) + Task 4 (UI) ✓
- Powers CRUD → Task 1 (`newPower`) + Task 4 (UI) + Task 5 (wiring) ✓
- Cast (roll + PP spend + log) → Task 3 (`castPower`) + Task 4 (button, disabled when PP<cost) + Task 5 (integration test) ✓
- v1→v2 migration → Task 2 ✓
- Insufficient-PP guard → Task 3 (`castPower` no-op) + Task 4 (disabled button) ✓

**2. Placeholder scan:** none; every step has concrete code + commands.

**3. Type consistency:** `Power`/`ArcaneBackground` shapes are identical across `types.ts` (Task 1), the Zod schema (Task 2), the store (Task 3), `PowersPanel` props (Task 4), and SheetPage wiring (Task 5). Store action names `spendPP/restorePP/resetPP/castPower` match between Task 3 (definition) and Task 5 (consumption). `castPower(id, powerId)` signature consistent. `characterSchema satisfies z.ZodType<Character>` holds because `arcaneBackground.nullable()` matches `ArcaneBackground | null`.

Deferred per spec (not built): multiple ABs; time-based PP recovery; powers auto-applying stat modifiers (Slice 4); curated datasets (Slice 3).

---

## Execution Handoff

Execute via superpowers:subagent-driven-development — fresh implementer + task reviewer per task, fix loops, then a final whole-branch review. Tasks are mostly mechanical (complete code provided): cheap-tier implementers, mid-tier reviewers; Task 5 (integration) on a standard model; final review on the most capable model.
