# Savage Worlds Sheets — Slice 2: Powers / Arcane Backgrounds — Design

**Date:** 2026-06-17
**Status:** Draft (pending user review)
**Builds on:** Slice 1 (shipped). Stack unchanged: React 18 + Vite + TS, Zustand,
Dexie/IndexedDB, Zod, Vitest + RTL.

## 1. Purpose

Add Arcane Backgrounds and Powers to the character sheet so spellcasters can be built
and played: track Power Points, list known Powers, and **cast** (roll the arcane skill
via the existing dice engine and spend Power Points), with results in the dice log.

## 2. Decisions (assumptions; revise at review)

- **One Arcane Background per character.** Covers the common case; the data is shaped
  so multiple ABs (a list) is a later, non-breaking extension.
- **The AB owns its arcane skill** (name + `TraitDie`) rather than referencing the
  character's skills list. Self-contained and immediately rollable. (Alternative
  considered: link to an existing `Skill` — more faithful, adds a picker + coupling;
  deferred.)
- **Casting** rolls the arcane skill as a normal trait roll (Wild Die if the character
  is a Wild Card, TN 4, current wound/fatigue penalty applied) **and** spends the
  power's PP cost. Per RAW SWADE, PP is spent on activation regardless of success. A
  cast requires `current ≥ ppCost` to attempt.
- **Power Points** are a single `{ current, max }` pool with spend / restore /
  reset-to-max controls. No automatic time-based recovery in this slice.
- **Schema migration:** bump `SCHEMA_VERSION` 1 → 2. Characters without the field load
  with `arcaneBackground: null`; old JSON backups import (migrate, not reject).
- **No copyrighted content:** power names/ranges/durations/effects are user-entered;
  only mechanics ship.

## 3. Domain model (SWADE)

- An **Arcane Background** grants an **arcane skill** (e.g. Spellcasting, Faith,
  Psionics, Weird Science), a **Power Point** pool, and known **Powers**.
- **Casting a power:** roll the arcane skill vs TN 4; success activates the power, a
  raise often improves it (left to the player). PP is spent on activation whether or
  not the roll succeeds.
- A **Power** has a PP cost, range, duration, and effect.

## 4. Data model additions (`src/domain/types.ts`)

```ts
export interface Power {
  id: string;
  name: string;
  ppCost: number;
  range: string;     // free text
  duration: string;  // free text
  notes: string;     // effect / trapping, user-entered
}

export interface ArcaneBackground {
  name: string;            // free text label, e.g. "Magic", "Miracles"
  arcaneSkillName: string; // e.g. "Spellcasting"
  arcaneSkillDie: TraitDie;
  powerPoints: { current: number; max: number };
  powers: Power[];
}

// Character gains:
//   arcaneBackground: ArcaneBackground | null;
```

`SCHEMA_VERSION` becomes `2`.

## 5. Architecture (modules touched)

- **`domain/defaults.ts`** — `SCHEMA_VERSION = 2`; `blankCharacter` sets
  `arcaneBackground: null`; add `blankArcaneBackground()` (name "", arcane skill
  "Spellcasting" at d4, PP `{ current: 10, max: 10 }`, no powers) and `newPower()`.
- **`persistence/schema.ts`** — add `power` and `arcaneBackground` Zod schemas;
  `characterSchema.arcaneBackground` is `nullable`. `parseCharacterValue` runs a
  migration: a parsed object missing `arcaneBackground` gets `null` and
  `schemaVersion: 2` before validation (so v1 backups import cleanly).
- **`store/characterStore.ts`** — new actions (all via the existing `mutate` +
  `tracked` persistence path):
  - `setArcaneBackground(id, ab: ArcaneBackground | null)` — add/remove the AB.
  - `updateArcaneBackground(id, patch: Partial<ArcaneBackground>)`.
  - `addPower(id)`, `updatePower(id, powerId, patch)`, `removePower(id, powerId)`.
  - `spendPP(id, n)`, `restorePP(id, n)`, `resetPP(id)` — clamp to `0..max`.
  - `castPower(id, powerId)` — guard `current ≥ ppCost`; roll the arcane skill via
    `rollTrait` (wild = `isWildCard`, modifier = `traitPenalty(status)`, TN 4) with the
    injected `rng`; deduct `ppCost`; append a `RollLogEntry`
    (`label` = power name, `kind: 'trait'`, detail = roll breakdown + PP spent/left).
- **`components/PowersPanel.tsx`** — presentational. When `arcaneBackground` is null,
  shows an "Add Arcane Background" button. When present: AB name input, arcane skill
  name input + `DiePicker`, PP `current/max` trackers (spend −, restore +, reset),
  remove-AB button, and a powers list (name, PP cost, range, duration, notes) with a
  per-power **Cast** button disabled when `current < ppCost`, plus add/remove power.
- **`pages/SheetPage.tsx`** — render `PowersPanel`, wiring the store actions.
- **`derived.ts`** — unchanged (Powers do not feed Parry/Toughness/Pace).

## 6. Data flow

UI → store action → immer mutate `character.arcaneBackground` → `tracked` persist →
re-render. Cast: store reads the arcane skill die + status penalty → `dice.ts` →
deduct PP → append to roll log → DiceLog/toast.

## 7. Error handling

- **Insufficient PP:** the Cast button is disabled (`current < ppCost`); no silent PP
  waste, no roll.
- **Migration:** importing/loading a v1 character backfills `arcaneBackground: null`
  and bumps `schemaVersion`; malformed input still rejected by Zod.

## 8. Testing (Vitest + RTL)

- **store:** `castPower` rolls + deducts PP + logs, and is blocked when
  `current < ppCost`; `spendPP/restorePP/resetPP` clamp to `0..max`;
  `addPower/removePower`; `setArcaneBackground` add then remove. Dice deterministic via
  injected RNG.
- **schema:** export → import round-trip with an Arcane Background; **v1 → v2
  migration** (a character object lacking `arcaneBackground` parses to `null`,
  `schemaVersion: 2`).
- **PowersPanel:** Cast fires `castPower`; add-power adds a row; Cast button disabled
  when PP < cost; Add-Arcane-Background appears only when AB is null.

## 9. Scope

### In (Slice 2)
AB add/remove; arcane skill (name + die); PP pool with spend/restore/reset; Powers CRUD;
cast (roll + PP spend + log); v1 → v2 migration.

### Deferred
Multiple Arcane Backgrounds per character (Approach C); time-based PP recovery; powers
auto-applying modifiers to other stats (overlaps Slice 4); curated mechanics-only power
datasets (Slice 3).

## 10. Open questions for review
1. One AB per character acceptable for now (vs. supporting multiple up front)?
2. AB-owned arcane skill (Approach A) vs. linking the arcane skill to the skills list
   (Approach B)?
3. Default starting PP for a new AB — 10/10 a sensible default, or leave at 0/0 for the
   user to set?
