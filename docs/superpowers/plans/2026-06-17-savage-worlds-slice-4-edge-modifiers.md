# Savage Worlds Sheets — Slice 4 (Edges/Hindrances stat modifiers) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let each Edge/Hindrance carry structured `StatModifier`s that automatically adjust derived stats (Parry/Toughness/Pace) and matching trait rolls, with backward-compatible v2→v3 persistence.

**Architecture:** Extends Slices 1–2 in place. New `StatModifier` type on `EdgeOrHindrance`; derived stats and the store's `rollTraitFor` sum matching modifiers; `pace()` becomes `pace(character)`; the migration backfills `modifiers: []` (keeping the v1 `arcaneBackground` backfill); `EdgesHindrancesPanel` gains a per-item modifier editor.

**Tech Stack:** unchanged.

## Global Constraints

- **TypeScript strict**, no `any`; `noUnusedLocals`/`noUnusedParameters` on — verify `npx tsc -b`.
- **Node:** prefix commands with `ASDF_NODEJS_VERSION=22.18.0`.
- **Pure domain layer:** `src/domain/*` imports nothing from React/DOM/Dexie/store.
- **Backward-compatible persistence:** v1 and v2 character JSON MUST still import — migrate to `schemaVersion: 3`, backfilling `modifiers: []` per edge/hindrance and `arcaneBackground: null` when absent. Never reject old data.
- **`characterSchema` is `satisfies z.ZodType<Character>`** — the Zod shape must match the `Character` type exactly (adding a required field to `EdgeOrHindrance` makes `tsc` red until the schema matches; that gap closes in Task 2).
- **Two existing tests must be updated, not duplicated:** the v1-migration test in `schema.test.ts` currently asserts `schemaVersion` `2` → becomes `3`; the `pace()` test in `derived.test.ts` becomes `pace(<character>)`.
- **Conventions:** derived helpers are pure and take `character`; build/edit CRUD is wired in SheetPage via the generic `update(id, recipe)`; trait modifiers fold into `rollTraitFor` (no new store action).
- **Commit after every task** with its final-step message. Focused tests: `ASDF_NODEJS_VERSION=22.18.0 npx vitest run <file>`.

---

## File Structure

```
src/domain/types.ts            # MODIFY: StatModifier(+target); EdgeOrHindrance.modifiers
src/domain/defaults.ts         # MODIFY: SCHEMA_VERSION=3; + newStatModifier
src/domain/defaults.test.ts    # MODIFY: schemaVersion 3 + newStatModifier tests
src/persistence/schema.ts      # MODIFY: statModifier zod; edge.modifiers; migrate v->3
src/persistence/schema.test.ts # MODIFY: modifier round-trip + v2->v3; update v1 assertion to 3
src/domain/derived.ts          # MODIFY: modifierTotal; parry/toughness/pace; traitModifierTotal
src/domain/derived.test.ts     # MODIFY: modifier tests; update pace() test to pace(character)
src/store/characterStore.ts    # MODIFY: rollTraitFor adds traitModifierTotal
src/store/characterStore.test.ts # MODIFY: trait-modifier roll test
src/components/EdgesHindrancesPanel.tsx       # MODIFY: per-item modifier editor + callbacks
src/components/EdgesHindrancesPanel.test.tsx  # CREATE
src/pages/SheetPage.tsx        # MODIFY: pace(character); edge modifiers:[] + modifier wiring
src/pages/SheetPage.test.tsx   # MODIFY: edge-toughness-modifier integration test
```

---

## Task 1: Domain types + factory (StatModifier)

**Files:** Modify `src/domain/types.ts`, `src/domain/defaults.ts`; Test `src/domain/defaults.test.ts`.

**Interfaces:** Produces `StatModifierTarget`, `StatModifier`; `EdgeOrHindrance.modifiers: StatModifier[]`; `SCHEMA_VERSION = 3`; `newStatModifier()`.

- [ ] **Step 1: Failing test** — append to `src/domain/defaults.test.ts`:

```ts
import { newStatModifier } from './defaults';

describe('stat modifiers', () => {
  it('blankCharacter is schema v3', () => {
    expect(blankCharacter().schemaVersion).toBe(3);
  });

  it('newStatModifier defaults to a +1 toughness modifier with a unique id', () => {
    const a = newStatModifier();
    const b = newStatModifier();
    expect(a).toMatchObject({ target: 'toughness', traitName: '', value: 1 });
    expect(a.id).not.toBe(b.id);
  });
});
```

- [ ] **Step 2: Run (expect FAIL)** — `ASDF_NODEJS_VERSION=22.18.0 npx vitest run src/domain/defaults.test.ts` → `newStatModifier` missing / schemaVersion is 2.

- [ ] **Step 3: Edit `src/domain/types.ts`** — add (after `EdgeHindranceType`/`HindranceSeverity`, before `EdgeOrHindrance`):

```ts
export type StatModifierTarget = 'parry' | 'toughness' | 'pace' | 'trait';

export interface StatModifier {
  id: string;
  target: StatModifierTarget;
  traitName: string; // matched against the roll label when target === 'trait'; '' otherwise
  value: number;     // signed; hindrances use negatives
}
```

Add to the `EdgeOrHindrance` interface (after `notes: string;`):
```ts
  modifiers: StatModifier[];
```

- [ ] **Step 4: Edit `src/domain/defaults.ts`** — change version and add the import + factory:

Set `export const SCHEMA_VERSION = 3;`

Add `StatModifier` to the type import:
```ts
import type { ArcaneBackground, AttributeKey, Character, DieSides, Power, Skill, StatModifier, TraitDie } from './types';
```

Add factory (after `newPower`):
```ts
export function newStatModifier(): StatModifier {
  return { id: newId(), target: 'toughness', traitName: '', value: 1 };
}
```

- [ ] **Step 5: Run (expect PASS)** — `ASDF_NODEJS_VERSION=22.18.0 npx vitest run src/domain/defaults.test.ts`.

> Note: `tsc -b` is intentionally RED after this task — `characterSchema satisfies z.ZodType<Character>` in schema.ts won't match the new required `EdgeOrHindrance.modifiers` until Task 2. Do not run a full build gate here.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(domain): StatModifier type + factory; schema v3"
```

---

## Task 2: Persistence schema + v2→v3 migration

**Files:** Modify `src/persistence/schema.ts`; Test `src/persistence/schema.test.ts`.

**Interfaces:** Consumes `StatModifier`. Produces extended `characterSchema` (edge `modifiers`); `migrateCharacter` backfills `modifiers: []` per edge + `arcaneBackground: null` + `schemaVersion: 3`.

- [ ] **Step 1: Failing test** — append to `src/persistence/schema.test.ts`:

```ts
import { newStatModifier } from '../domain/defaults';

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
```

Also UPDATE the existing v1-migration test in this file: its assertion `expect(back[0].schemaVersion).toBe(2)` becomes `expect(back[0].schemaVersion).toBe(3)` (do not add a second test — change the number in place).

- [ ] **Step 2: Run (expect FAIL)** — `ASDF_NODEJS_VERSION=22.18.0 npx vitest run src/persistence/schema.test.ts`.

- [ ] **Step 3: Edit `src/persistence/schema.ts`**

Add the modifier schema (before `edgeOrHindrance`):
```ts
const statModifier = z.object({
  id: z.string(),
  target: z.enum(['parry', 'toughness', 'pace', 'trait']),
  traitName: z.string(),
  value: z.number().int(),
});
```

Add `modifiers` to the `edgeOrHindrance` schema (after `notes: z.string(),`):
```ts
  modifiers: z.array(statModifier),
```

Replace `migrateCharacter` with the v3-aware version:
```ts
// Backfill fields added after schemaVersion 1 so old data validates and upgrades to v3.
function migrateCharacter(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const v = value as Record<string, unknown>;
  const needsAB = !('arcaneBackground' in v);
  const edges = Array.isArray(v.edgesHindrances) ? (v.edgesHindrances as unknown[]) : null;
  const needsEdgeMods = edges?.some(
    (e) => e !== null && typeof e === 'object' && !('modifiers' in (e as Record<string, unknown>)),
  ) ?? false;
  if (!needsAB && !needsEdgeMods && v.schemaVersion === 3) return value;
  return {
    ...v,
    arcaneBackground: needsAB ? null : v.arcaneBackground,
    edgesHindrances: edges
      ? edges.map((e) =>
          e !== null && typeof e === 'object' && !('modifiers' in (e as Record<string, unknown>))
            ? { ...(e as Record<string, unknown>), modifiers: [] }
            : e,
        )
      : v.edgesHindrances,
    schemaVersion: 3,
  };
}
```

(`parseCharacterValue`/`parseRoster` are unchanged — they already call `migrateCharacter`.)

- [ ] **Step 4: Run (expect PASS)** — `ASDF_NODEJS_VERSION=22.18.0 npx vitest run src/persistence/schema.test.ts`.

- [ ] **Step 5: Confirm tsc green** — `ASDF_NODEJS_VERSION=22.18.0 npx tsc -b` → exit 0 (the type/schema gap from Task 1 is now closed).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(persistence): edge modifiers schema + v2->v3 migration"
```

---

## Task 3: Derived modifiers + pace(character)

**Files:** Modify `src/domain/derived.ts`, `src/pages/SheetPage.tsx`; Test `src/domain/derived.test.ts`.

**Interfaces:** Produces `modifierTotal(character, target)`, `traitModifierTotal(character, label)`; `parry`/`toughness` include modifiers; `pace(character)` (signature change).

- [ ] **Step 1: Failing test** — append to `src/domain/derived.test.ts` (and update the existing pace test, see Step 3):

```ts
import { modifierTotal, traitModifierTotal } from './derived';

function withEdgeMods(mods: Array<{ target: string; traitName?: string; value: number }>): Character {
  return make((c) => {
    c.edgesHindrances.push({
      id: 'e1', name: 'Test', type: 'edge', severity: null, notes: '',
      modifiers: mods.map((m, i) => ({ id: `m${i}`, target: m.target as never, traitName: m.traitName ?? '', value: m.value })),
    });
  });
}

describe('stat modifiers in derived stats', () => {
  it('parry and toughness include matching modifiers', () => {
    const c = withEdgeMods([{ target: 'parry', value: 1 }, { target: 'toughness', value: 2 }]);
    c.attributes.vigor = { sides: 6, bonus: 0 }; // half = 3 -> toughness base 5
    expect(parry(c)).toBe(3);      // 2 + 0 (no Fighting) + 1
    expect(toughness(c)).toBe(7);  // 2 + 3 + 0 armor + 2
  });

  it('pace adds pace modifiers to the base', () => {
    const c = withEdgeMods([{ target: 'pace', value: 2 }]);
    expect(pace(c)).toBe(8); // 6 + 2
  });

  it('traitModifierTotal matches trait modifiers by name, case-insensitively', () => {
    const c = withEdgeMods([
      { target: 'trait', traitName: 'Notice', value: 2 },
      { target: 'toughness', value: 5 },
    ]);
    expect(traitModifierTotal(c, 'notice')).toBe(2);
    expect(traitModifierTotal(c, 'Stealth')).toBe(0);
  });
});
```

- [ ] **Step 2: Run (expect FAIL)** — `ASDF_NODEJS_VERSION=22.18.0 npx vitest run src/domain/derived.test.ts` → `modifierTotal`/`traitModifierTotal` missing; `pace(c)` arity error.

- [ ] **Step 3: Edit `src/domain/derived.ts`**

Update the import to add `StatModifierTarget`:
```ts
import type { Character, StatModifierTarget, Status, TraitDie } from './types';
```

Add the modifier helpers (after `halfDie`):
```ts
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
```

Update `parry`, `toughness`, and `pace`:
```ts
export function parry(character: Character): number {
  const fighting = findSkill(character, 'Fighting');
  return 2 + (fighting ? halfDie(fighting.die) : 0) + modifierTotal(character, 'parry');
}

export function toughness(character: Character): number {
  return 2 + halfDie(character.attributes.vigor) + totalArmor(character) + modifierTotal(character, 'toughness');
}

export function pace(character: Character): number {
  return BASE_PACE + modifierTotal(character, 'pace');
}
```

Update the **existing** pace test in `src/domain/derived.test.ts` (it currently calls `pace()`):
```ts
describe('pace', () => {
  it('is the base pace with no modifiers', () => {
    expect(pace(blankCharacter())).toBe(6);
  });
});
```

- [ ] **Step 4: Fix the `pace()` caller in `src/pages/SheetPage.tsx`** (keep tsc green) — change the `DerivedBar` line:
```tsx
      <DerivedBar parry={parry(character)} toughness={toughness(character)} pace={pace(character)} />
```

- [ ] **Step 5: Run (expect PASS)** — `ASDF_NODEJS_VERSION=22.18.0 npx vitest run src/domain/derived.test.ts` then `ASDF_NODEJS_VERSION=22.18.0 npx tsc -b` (exit 0).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(domain): derived stats include edge/hindrance modifiers; pace(character)"
```

---

## Task 4: Store applies trait modifiers in rollTraitFor

**Files:** Modify `src/store/characterStore.ts`; Test `src/store/characterStore.test.ts`.

**Interfaces:** Consumes `traitModifierTotal`. `rollTraitFor`'s modifier becomes `(opts?.modifier ?? 0) + traitPenalty(c.status) + traitModifierTotal(c, label)`.

- [ ] **Step 1: Failing test** — append to `src/store/characterStore.test.ts`:

```ts
describe('characterStore — trait modifiers', () => {
  it('adds a matching edge trait modifier to a trait roll', async () => {
    // Notice skill d6 -> 3, wild d6 -> 2 ; +2 from edge "Alertness" => total 5
    const { store } = setup(fixedRng([[6, 3], [6, 2]]));
    const id = await store.getState().createCharacter();
    store.getState().update(id, (c) => {
      c.edgesHindrances.push({
        id: 'e1', name: 'Alertness', type: 'edge', severity: null, notes: '',
        modifiers: [{ id: 'm1', target: 'trait', traitName: 'Notice', value: 2 }],
      });
    });
    store.getState().rollTraitFor(id, 'Notice', { sides: 6, bonus: 0 });
    const c = store.getState().roster.find((x) => x.id === id)!;
    expect(c.rollLog[0].total).toBe(5); // max(3,2) + 2
  });
});
```

- [ ] **Step 2: Run (expect FAIL)** — `ASDF_NODEJS_VERSION=22.18.0 npx vitest run src/store/characterStore.test.ts` → total is 3, not 5.

- [ ] **Step 3: Edit `src/store/characterStore.ts`**

Add `traitModifierTotal` to the derived import:
```ts
import { traitPenalty, traitModifierTotal } from '../domain/derived';
```

In `rollTraitFor`, change the `modifier` line to include trait modifiers:
```ts
          const modifier = (opts?.modifier ?? 0) + traitPenalty(c.status) + traitModifierTotal(c, label);
```

- [ ] **Step 4: Run (expect PASS)** — `ASDF_NODEJS_VERSION=22.18.0 npx vitest run src/store/characterStore.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(store): apply matching edge trait modifiers to trait rolls"
```

---

## Task 5: EdgesHindrancesPanel modifier editor + SheetPage wiring + integration

**Files:** Modify `src/components/EdgesHindrancesPanel.tsx`, `src/pages/SheetPage.tsx`; Create `src/components/EdgesHindrancesPanel.test.tsx`; Test `src/pages/SheetPage.test.tsx`.

**Interfaces:** `EdgesHindrancesPanel` gains `onAddModifier(id)`, `onChangeModifier(id, modId, patch: Partial<StatModifier>)`, `onRemoveModifier(id, modId)`. SheetPage wires them via `update` and creates edges with `modifiers: []`.

- [ ] **Step 1: Failing tests**

Create `src/components/EdgesHindrancesPanel.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { EdgesHindrancesPanel } from './EdgesHindrancesPanel';
import type { EdgeOrHindrance } from '../domain/types';

const stub = {
  onAdd: vi.fn(), onChange: vi.fn(), onRemove: vi.fn(),
  onAddModifier: vi.fn(), onChangeModifier: vi.fn(), onRemoveModifier: vi.fn(),
};

const toughnessItem: EdgeOrHindrance[] = [
  { id: 'e1', name: 'Brawny', type: 'edge', severity: null, notes: '',
    modifiers: [{ id: 'm1', target: 'toughness', traitName: '', value: 1 }] },
];

describe('EdgesHindrancesPanel modifiers', () => {
  it('adds a modifier to an item', async () => {
    const onAddModifier = vi.fn();
    render(<EdgesHindrancesPanel items={toughnessItem} {...stub} onAddModifier={onAddModifier} />);
    await userEvent.click(screen.getByRole('button', { name: /add modifier/i }));
    expect(onAddModifier).toHaveBeenCalledWith('e1');
  });

  it('shows a trait-name input only for trait-target modifiers', () => {
    const traitItem: EdgeOrHindrance[] = [
      { id: 'e1', name: 'Alert', type: 'edge', severity: null, notes: '',
        modifiers: [{ id: 'm1', target: 'trait', traitName: 'Notice', value: 2 }] },
    ];
    const { rerender } = render(<EdgesHindrancesPanel items={traitItem} {...stub} />);
    expect(screen.getByLabelText(/modifier trait m1/i)).toBeInTheDocument();
    rerender(<EdgesHindrancesPanel items={toughnessItem} {...stub} />);
    expect(screen.queryByLabelText(/modifier trait m1/i)).toBeNull();
  });

  it('changes a modifier value', async () => {
    const onChangeModifier = vi.fn();
    render(<EdgesHindrancesPanel items={toughnessItem} {...stub} onChangeModifier={onChangeModifier} />);
    const value = screen.getByLabelText(/modifier value m1/i);
    await userEvent.clear(value);
    await userEvent.type(value, '3');
    expect(onChangeModifier).toHaveBeenCalled();
  });
});
```

Append to `src/pages/SheetPage.test.tsx` (reuse existing `renderAt`/`beforeEach`; add `toughness` import from `../domain/derived` and `blankCharacter` if not already imported):
```ts
import { toughness } from '../domain/derived';

describe('SheetPage — edge modifiers', () => {
  it('adding an edge with a toughness modifier raises Toughness', async () => {
    const c = blankCharacter('Mod'); // vigor d4 -> toughness 4
    useCharacterStore.setState({ roster: [c], activeId: c.id });
    renderAt(c.id);
    await userEvent.click(await screen.findByRole('button', { name: /add edge/i }));
    await userEvent.click(await screen.findByRole('button', { name: /add modifier/i }));
    await waitFor(() => {
      const cc = useCharacterStore.getState().roster.find((x) => x.id === c.id)!;
      expect(cc.edgesHindrances[0].modifiers[0]).toMatchObject({ target: 'toughness', value: 1 });
      expect(toughness(cc)).toBe(5); // 4 + 1
    });
  });
});
```

- [ ] **Step 2: Run (expect FAIL)** — `ASDF_NODEJS_VERSION=22.18.0 npx vitest run src/components/EdgesHindrancesPanel.test.tsx src/pages/SheetPage.test.tsx`.

- [ ] **Step 3: Rewrite `src/components/EdgesHindrancesPanel.tsx`**

```tsx
import type { EdgeHindranceType, EdgeOrHindrance, StatModifier, StatModifierTarget } from '../domain/types';

const TARGETS: StatModifierTarget[] = ['parry', 'toughness', 'pace', 'trait'];

export function EdgesHindrancesPanel({
  items,
  onAdd,
  onChange,
  onRemove,
  onAddModifier,
  onChangeModifier,
  onRemoveModifier,
}: {
  items: EdgeOrHindrance[];
  onAdd: (type: EdgeHindranceType) => void;
  onChange: (id: string, patch: Partial<EdgeOrHindrance>) => void;
  onRemove: (id: string) => void;
  onAddModifier: (id: string) => void;
  onChangeModifier: (id: string, modId: string, patch: Partial<StatModifier>) => void;
  onRemoveModifier: (id: string, modId: string) => void;
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
      <ul className="flex flex-col gap-3">
        {items.map((it) => (
          <li key={it.id} className="flex flex-col gap-2 rounded border p-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-20 text-xs uppercase text-gray-500">{it.type}</span>
              <input aria-label={`Name ${it.id}`} value={it.name} onChange={(e) => onChange(it.id, { name: e.target.value })} className="flex-1 rounded border px-2 py-1" />
              {it.type === 'hindrance' && (
                <select aria-label={`Severity ${it.id}`} value={it.severity ?? 'minor'} onChange={(e) => onChange(it.id, { severity: e.target.value as 'minor' | 'major' })} className="rounded border px-2 py-1">
                  <option value="minor">Minor</option>
                  <option value="major">Major</option>
                </select>
              )}
              <input aria-label={`Notes ${it.id}`} value={it.notes} onChange={(e) => onChange(it.id, { notes: e.target.value })} placeholder="notes" className="flex-1 rounded border px-2 py-1" />
              <button type="button" onClick={() => onRemove(it.id)} aria-label={`Remove ${it.name || it.type}`} className="rounded border px-2 py-1">✕</button>
            </div>

            <div className="flex flex-col gap-1 pl-2">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase text-gray-500">Modifiers</span>
                <button type="button" onClick={() => onAddModifier(it.id)} aria-label="Add modifier" className="rounded border px-2 py-0.5 text-sm">+ Modifier</button>
              </div>
              {it.modifiers.map((m) => (
                <div key={m.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <select
                    aria-label={`Modifier target ${m.id}`}
                    value={m.target}
                    onChange={(e) => onChangeModifier(it.id, m.id, { target: e.target.value as StatModifierTarget })}
                    className="rounded border px-2 py-1"
                  >
                    {TARGETS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {m.target === 'trait' && (
                    <input
                      aria-label={`Modifier trait ${m.id}`}
                      value={m.traitName}
                      onChange={(e) => onChangeModifier(it.id, m.id, { traitName: e.target.value })}
                      placeholder="trait name"
                      className="w-32 rounded border px-2 py-1"
                    />
                  )}
                  <input
                    aria-label={`Modifier value ${m.id}`}
                    type="number"
                    value={m.value}
                    onChange={(e) => onChangeModifier(it.id, m.id, { value: Number(e.target.value) })}
                    className="w-16 rounded border px-2 py-1"
                  />
                  <button type="button" onClick={() => onRemoveModifier(it.id, m.id)} aria-label={`Remove modifier ${m.id}`} className="rounded border px-2 py-1">✕</button>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: Wire `src/pages/SheetPage.tsx`**

Add `newStatModifier` to the defaults import:
```ts
import { newId, blankArcaneBackground, newPower, newStatModifier } from '../domain/defaults';
```

Replace the `EdgesHindrancesPanel` element with the modifier-aware wiring (edge creation now includes `modifiers: []`):
```tsx
      <EdgesHindrancesPanel
        items={character.edgesHindrances}
        onAdd={(type) => update(id, (c) => {
          c.edgesHindrances.push({ id: newId(), name: '', type, severity: type === 'hindrance' ? 'minor' : null, notes: '', modifiers: [] });
        })}
        onChange={(eid, patch) => update(id, (c) => {
          const it = c.edgesHindrances.find((x) => x.id === eid);
          if (it) Object.assign(it, patch);
        })}
        onRemove={(eid) => update(id, (c) => { c.edgesHindrances = c.edgesHindrances.filter((x) => x.id !== eid); })}
        onAddModifier={(eid) => update(id, (c) => {
          const it = c.edgesHindrances.find((x) => x.id === eid);
          if (it) it.modifiers.push(newStatModifier());
        })}
        onChangeModifier={(eid, mid, patch) => update(id, (c) => {
          const m = c.edgesHindrances.find((x) => x.id === eid)?.modifiers.find((x) => x.id === mid);
          if (m) Object.assign(m, patch);
        })}
        onRemoveModifier={(eid, mid) => update(id, (c) => {
          const it = c.edgesHindrances.find((x) => x.id === eid);
          if (it) it.modifiers = it.modifiers.filter((x) => x.id !== mid);
        })}
      />
```

- [ ] **Step 5: Run focused tests, full suite, build** — all green:
```bash
ASDF_NODEJS_VERSION=22.18.0 npx vitest run src/components/EdgesHindrancesPanel.test.tsx src/pages/SheetPage.test.tsx
ASDF_NODEJS_VERSION=22.18.0 npm test
ASDF_NODEJS_VERSION=22.18.0 npm run build
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(ui): edge/hindrance modifier editor wired into the sheet"
```

---

## Self-Review

**1. Spec coverage (Slice 4):**
- `StatModifier` model → Task 1 ✓
- derived parry/toughness/pace include modifiers; `pace(character)` → Task 3 ✓
- trait-roll modifiers by name in `rollTraitFor` → Task 4 ✓
- v2→v3 migration (modifiers backfill, keep AB backfill) → Task 2 ✓
- EdgesHindrancesPanel modifier editor + SheetPage wiring → Task 5 ✓
- Integration (edge toughness modifier raises Toughness) → Task 5 ✓

**2. Placeholder scan:** none; every step has concrete code/commands.

**3. Type consistency:** `StatModifier`/`StatModifierTarget` identical across `types.ts` (T1), Zod (T2), `derived.ts` (T3), store (T4), panel props (T5), SheetPage wiring (T5). `EdgeOrHindrance.modifiers` required field added in T1 and matched in the schema in T2 (closing the `satisfies` gap). `pace(character)` signature change (T3) updates its only caller (SheetPage) in the same task. Existing-test updates (schema v1 assertion 2→3; derived `pace()`→`pace(character)`) are called out in T2/T3.

Deferred per spec: castPower trait modifiers; non-derived targets; conditional modifiers; starter edge library.

---

## Execution Handoff

Execute via superpowers:subagent-driven-development — cheap-tier implementers for the mechanical transcription tasks (1–4), standard model for Task 5 (UI + integration), mid-tier reviewers, most-capable final whole-branch review. Build gate is a post-Task-2 checkpoint (Task 1 leaves `tsc` red by design).
