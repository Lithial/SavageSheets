# Savage Worlds Sheets — Slice 4: Edges/Hindrances that modify stats — Design

**Date:** 2026-06-17
**Status:** Draft (pending user review)
**Builds on:** Slices 1–2 (shipped). Stack unchanged.

## 1. Purpose

Let Edges (Savage Worlds "advantages") and Hindrances carry **mechanical modifiers**
that automatically feed the derived stats and the trait-roll pipeline, instead of being
free-text only. E.g. an Edge with `+1 Toughness` raises the sheet's Toughness; an Edge
with `+2 Notice` adds to Notice rolls; a Hindrance with `-1 Pace` lowers Pace.

## 2. Decisions (assumptions; revise at review)

- **Structured modifiers per edge/hindrance** (Approach A): each `EdgeOrHindrance` owns
  a `modifiers: StatModifier[]`, preserving the "this edge causes this effect" link.
  (Rejected: a flat character-level modifier list — loses provenance; free-text only —
  the status quo being replaced.)
- **`StatModifier = { id, target, traitName, value }`**; `target ∈ {parry, toughness,
  pace, trait}`; `value` is a signed integer (hindrances use negatives); `traitName` is
  used only when `target === 'trait'`.
- **Derived** `parry`/`toughness`/`pace` add the sum of their matching modifiers;
  `pace()` becomes `pace(character)`.
- **Trait rolls** apply `trait`-target modifiers **matched by name** against the roll
  label (attribute name e.g. "Vigor", or skill name e.g. "Notice"), case-insensitive,
  inside `rollTraitFor`. Reuses the existing label; no new plumbing.
- **Scope:** the three derived stats + attribute/skill rolls. `castPower` (arcane skill)
  trait-modifier application is **deferred**. Targets beyond parry/toughness/pace/trait
  are deferred.
- **Migration:** `SCHEMA_VERSION` 2 → 3; backfill `modifiers: []` on every edge/hindrance
  (and keep the v1 `arcaneBackground` backfill) on all read/write/import paths.

## 3. Domain model

A character's Edges and Hindrances can grant flat bonuses/penalties to derived stats
(Parry, Toughness, Pace) and to specific trait rolls (an attribute or skill, by name).
Modifiers stack additively.

## 4. Data model additions (`src/domain/types.ts`)

```ts
export type StatModifierTarget = 'parry' | 'toughness' | 'pace' | 'trait';

export interface StatModifier {
  id: string;
  target: StatModifierTarget;
  traitName: string; // matched against the roll label when target === 'trait'; '' otherwise
  value: number;     // signed; hindrances use negatives
}

// EdgeOrHindrance gains:
//   modifiers: StatModifier[];
```

`SCHEMA_VERSION` becomes `3`.

## 5. Architecture (modules touched)

- **`domain/derived.ts`**
  - `modifierTotal(character, target: StatModifierTarget): number` — sum of all
    edge/hindrance modifiers with that target (for derived targets).
  - `parry(c) = 2 + halfDie(Fighting) + modifierTotal(c, 'parry')`.
  - `toughness(c) = 2 + halfDie(Vigor) + totalArmor(c) + modifierTotal(c, 'toughness')`.
  - `pace(character) = BASE_PACE + modifierTotal(character, 'pace')` (signature change
    from `pace()`).
  - `traitModifierTotal(character, label: string): number` — sum of modifiers where
    `target === 'trait'` and `traitName.toLowerCase() === label.toLowerCase()`.
- **`domain/defaults.ts`** — `SCHEMA_VERSION = 3`; `newStatModifier()` factory
  (`{ id, target: 'toughness', traitName: '', value: 1 }`); edge/hindrance creation
  includes `modifiers: []`.
- **`persistence/schema.ts`** — `statModifier` Zod object; `edgeOrHindrance.modifiers`
  = `z.array(statModifier)`; extend `migrateCharacter` to backfill `modifiers: []` on
  each edge/hindrance lacking it and bump `schemaVersion` to 3 (retain the v1
  `arcaneBackground: null` backfill). Applies on `parseCharacterValue` (write + read
  path) and `parseRoster` (import).
- **`store/characterStore.ts`** — `rollTraitFor` modifier becomes
  `(opts?.modifier ?? 0) + traitPenalty(c.status) + traitModifierTotal(c, label)`
  (import `traitModifierTotal` from `derived`).
- **`components/EdgesHindrancesPanel.tsx`** — per-item modifiers editor under each
  edge/hindrance row: an "Add modifier" button and one row per modifier with a target
  `<select>` (Parry/Toughness/Pace/Trait), a trait-name input shown only when
  `target === 'trait'`, a numeric value input, and a remove button. New callbacks:
  `onAddModifier(id)`, `onChangeModifier(id, modId, patch)`, `onRemoveModifier(id, modId)`.
- **`pages/SheetPage.tsx`** — wire the three modifier callbacks via `update(id, recipe)`;
  create new edges with `modifiers: []`; change the `pace()` call to `pace(character)`.

## 6. Data flow

Edge modifier edits → `update` → derived recompute → `DerivedBar` shows new
Parry/Toughness/Pace immediately. Trait modifiers fold into the roll at cast time and
appear in the dice-log breakdown via the existing `mod ±N` rendering.

## 7. Error handling

- Migration backfills missing `modifiers` (read/write/import) so older data never
  rejects; malformed input still rejected by Zod.
- A `trait` modifier with an unmatched `traitName` simply contributes nothing.

## 8. Testing (Vitest + RTL)

- **derived:** parry/toughness/pace with positive and negative edge modifiers;
  `traitModifierTotal` matches by name case-insensitively and ignores non-`trait`
  targets.
- **store:** a trait roll whose label matches an edge `trait` modifier includes the
  bonus (deterministic RNG).
- **schema:** round-trip a character whose edge has modifiers; **migrate a v2 character
  (edges without `modifiers`) → `modifiers: []`, `schemaVersion: 3`**; a v1 character
  still backfills `arcaneBackground: null` as well.
- **EdgesHindrancesPanel:** add/change/remove modifier fire their callbacks; the
  trait-name input renders only when the target is `trait`.
- **SheetPage:** adding an edge with a `+1 Toughness` modifier increments the DerivedBar
  Toughness value.

## 9. Scope

### In (Slice 4)
`StatModifier` model; derived parry/toughness/pace incorporate modifiers; `pace(character)`;
trait-roll modifiers by name in `rollTraitFor`; v2→v3 migration; EdgesHindrancesPanel
modifier editor; SheetPage wiring.

### Deferred
`castPower` trait modifiers; non-derived targets (Size, Charisma, run die, etc.);
conditional/situational modifiers; a starter library of named Edges/Hindrances.

## 10. Open questions for review
1. Trait modifiers matched by **name/label** — acceptable, or do you want explicit
   attribute/skill pickers (ids)?
2. Apply trait modifiers to **casting** (the arcane skill) too, or leave to a later pass?
3. Are `parry / toughness / pace / trait` enough modifier targets for now?
