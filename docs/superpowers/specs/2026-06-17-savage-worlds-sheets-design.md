# Savage Worlds Interactive Character Sheets — Design

**Date:** 2026-06-17
**Status:** Draft (pending user review)
**Stack:** React 18 + Vite + TypeScript

## 1. Purpose

A browser app that holds a **collection** of **interactive** Savage Worlds (SWADE)
character sheets. It serves two jobs, with the play companion as the hero:

- **Play companion (hero):** at the table — roll attribute/skill/damage dice with
  exploding "Aces" and the Wild Die, and live-track Wounds, Fatigue, Shaken, and Bennies.
- **Builder / manager:** create and edit characters with auto-calculated derived stats,
  and manage a roster of many characters.

## 2. Assumptions

These are decisions made in the absence of explicit direction; revise at review.

- **Edition:** SWADE (Savage Worlds Adventure Edition) mechanics.
- **No backend:** local-first, browser-only, private. Backup/sharing via JSON
  export/import. Persistence sits behind an interface so cloud sync is a clean later
  addition, not a rewrite.
- **IP-safe:** the app models only game *mechanics* (not copyrightable). It ships **no**
  Pinnacle/SWADE prose. Edges, Hindrances, and gear are user-entered, with a small
  mechanics-only starter set (names + numeric fields the user fills in themselves).
- **Single user:** no accounts, no auth.

## 3. Domain model (SWADE mechanics)

### Trait dice
- A trait is rated by a die: `d4, d6, d8, d10, d12`, and beyond as `d12+1`, `d12+2`.
- **Acing (exploding):** when a die rolls its maximum, reroll and add; repeats.
- **Wild Die:** Wild Cards roll a `d6` Wild Die alongside the trait die (also Aces);
  the **higher** of (trait total, wild total) is the result.
- **Target Number (TN):** default 4. **Success** = result ≥ TN. **Raise** = each full 4
  points over the TN.
- **Critical failure:** trait die and Wild Die both show a natural 1.
- **Untrained skill:** roll `d4` at −2.

### Attributes (5)
Agility, Smarts, Spirit, Strength, Vigor — each a trait die (default `d4`).

### Skills
Each linked to an attribute, rated by a trait die. Core skills present by default:
Athletics, Common Knowledge, Notice, Persuasion, Stealth. Users add/remove others.

### Derived stats (auto-calculated)
- **Pace:** base 6 (running die `d6`).
- **Parry:** `2 + floor(Fighting die step / 2)`; if no Fighting skill, `2`.
- **Toughness:** `2 + floor(Vigor die step / 2) + armor`.
- **Load Limit:** `5 × Strength die step` (Slice 3; encumbrance deferred).
- **Rank:** derived from advance count — Novice 0–3, Seasoned 4–7, Veteran 8–11,
  Heroic 12–15, Legendary 16+ (advance tracking is Slice 3).

> "Die step" = 1 for d4, 2 for d6, 3 for d8, 4 for d10, 5 for d12 (then +1/+2 for d12+x).

### Status & resources (live during play)
- **Shaken:** boolean.
- **Wounds:** 0–3, then Incapacitated. Wild Cards take 3 wounds; Extras: 1 wound = out.
- **Fatigue:** 0–2, then Incapacitated.
- **Wound penalty:** −1 per wound to trait rolls, max −3.
- **Bennies:** integer counter (Wild Cards start a session with 3).
- **Wild Card vs Extra:** toggle; Extras have no Wild Die and no Bennies.

### Edges / Hindrances
List entries with `name`, `type` (Edge | Hindrance), Hindrance severity
(Minor | Major), and free-text notes. No shipped Pinnacle text; small starter set is
names-only scaffolding the user completes.

### Gear
- **Weapons:** name, damage (dice expression, e.g. `Str+d6`), range, RoF, AP, notes;
  rollable for damage.
- **Armor:** name, armor value, location/notes; feeds Toughness.
- **General gear:** name, quantity, notes.

### Powers / Arcane Background (Slice 2)
Power Points, arcane skill, known Powers (name, PP cost, range, duration, notes).
Optional per character.

## 4. Architecture

Layered units, each independently testable:

```
UI (Roster + Sheet sections + DiceLog)
  -> Store (Zustand: roster + active char + actions)
       -> domain (dice / derived / defaults — pure functions)
       -> persistence (CharacterRepository over Dexie/IndexedDB)
            -> JSON import/export (Zod-validated)
```

### Modules
1. **`domain/types.ts`** — TS types/enums for Character and sub-entities.
2. **`domain/dice.ts`** — pure engine: exploding dice, Wild Die (take higher),
   natural-(1,1) critical failure, TN + Raises, wound/fatigue/modifier application.
   No React, no I/O.
3. **`domain/derived.ts`** — pure calculators: Pace, Parry, Toughness, Load Limit,
   Rank. Boundary-aware (d12, d12+1/+2, no Fighting).
4. **`domain/defaults.ts`** — blank-character factory, core skills, mechanics-only
   starter Edge/Hindrance/gear entries.
5. **`persistence/repository.ts`** — `CharacterRepository` interface + Dexie
   (IndexedDB) implementation: CRUD + `exportJson` / `importJson`. This interface is
   the seam for future cloud sync.
6. **`store/characterStore.ts`** — Zustand (+ immer): roster, active character,
   actions (`updateTrait`, `addWound`, `spendBenny`, `rollTrait` -> log); debounced
   persistence; derived via selectors.
7. **UI**
   - **`RosterPage`** (`/`): list, create, duplicate, delete, import, export.
   - **`SheetPage`** (`/c/:id`): composed of focused section components —
     `SheetHeader` (name/ancestry/rank/Wild-Card toggle/Bennies), `DerivedBar`
     (Pace/Parry/Toughness), `StatusTracker` (Shaken/Wounds/Fatigue),
     `AttributesPanel`, `SkillsPanel`, `EdgesHindrancesPanel`, `GearPanel`
     (weapons roll damage).
   - **`DiePicker`** — reusable d4–d12(+) selector.
   - **`DiceLog`** — toast + panel showing each roll's full breakdown
     (e.g. `Fighting d8: 8->ace->3 = 11; Wild d6: 4 -> 11 vs TN 4 = Success, +1 Raise`).
   - Routing via React Router.

### Data flow
UI dispatches a store action -> immer mutates the active character -> derived stats
recompute (pure selectors) -> persistence saves (debounced) -> UI re-renders.
Rolls: store reads the current trait die + wound/fatigue penalties -> `dice.ts` ->
appends to the roll log -> toast.

## 5. Error handling
- **Save failure:** non-blocking banner; the in-memory character is never lost;
  export remains available as a manual fallback.
- **Import:** validated with Zod against the character schema; malformed input is
  rejected with a clear message and never corrupts the existing roster.

## 6. Testing (Vitest + React Testing Library)
- **dice:** acing terminates; Wild Die taken as the higher; critical failure on
  natural (1,1); raise math; modifier + wound/fatigue penalty application.
- **derived:** Parry/Toughness/Pace/Rank at boundaries (d12, d12+x, no Fighting).
- **persistence:** export -> import round-trip equals the original; malformed import
  rejected.
- **store:** wounds cap at Incapacitated; bennies floor at 0; rolling a trait applies
  the current wound penalty.

## 7. Scope

### Slice 1 — implementation target of this spec
Roster CRUD + JSON import/export; full build/edit (attributes, skills,
edges/hindrances, gear); auto derived stats; dice engine + trait/damage rolls with a
log; live status trackers (Shaken/Wounds/Fatigue) and Bennies; Wild Card/Extra toggle.

### Slice 2 — Powers / Arcane Backgrounds
Power Points, arcane skill, known Powers (name, PP cost, range, duration, notes);
per-character Arcane Background toggle.

### Slice 3 — Progression & creation polish
Advances log + Rank tracking; point-buy character-creation validator
(attribute/skill/hindrance points); encumbrance / Load Limit; curated mechanics-only
starter datasets.

### Later
Cloud sync (via the persistence interface) and a live GM view; theming.

## 8. Decisions (resolved at review)
1. **Edition:** SWADE.
2. **Architecture:** single-user, local-first for v1 (Approach A); the persistence
   interface keeps cloud sync reachable later without a rewrite.
3. **Slicing:** Powers / Arcane Backgrounds = Slice 2; Advances / Rank = Slice 3.
