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
  /**
   * Most recent persistence (repository) outcome: `null` when the last persist
   * succeeded, otherwise a human-readable error string. This is the single
   * error channel — EVERY action that touches the repo clears it on success and
   * sets it on failure, so the UI can rely on it alone. Awaited actions (load,
   * createCharacter, duplicateCharacter, deleteCharacter, importJson)
   * additionally reject so callers may handle failures programmatically;
   * fire-and-forget play actions (addWound, spendBenny, rolls, ...) surface
   * failures only through this field.
   */
  lastError: string | null;

  /**
   * Loads the persisted roster and MERGES it over the in-memory roster: each
   * loaded entry replaces any in-memory entry with the same id (DB copy wins),
   * and in-memory characters whose id is absent from the snapshot are RETAINED
   * at the front (most-recent-first). This is intentionally not a full replace
   * — a just-created, already-persisted character must survive an initial
   * `load()` whose `repo.list()` resolved before that character was written.
   * Trade-off: `load()` therefore does not reflect DB-side removal of an entry
   * still held in memory. Safe today because all mutations route through the
   * store and import is additive.
   */
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
    deps.repo
      .put(c)
      .then(() => {
        useStore.setState({ lastError: null });
      })
      .catch((err) => {
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

      // Awaited repo operations mirror persist()'s contract: clear lastError on
      // success, record it on failure, then rethrow so callers awaiting the
      // returned promise can also react.
      const tracked = async <T>(label: string, op: () => Promise<T>): Promise<T> => {
        try {
          const result = await op();
          set((s) => { s.lastError = null; });
          return result;
        } catch (err) {
          set((s) => { s.lastError = `${label}: ${String(err)}`; });
          throw err;
        }
      };

      return {
        roster: [],
        activeId: null,
        lastError: null,

        load: async () => {
          const loaded = await tracked('Load failed', () => deps.repo.list());
          set((s) => {
            // Keep any in-memory characters created while this load was in
            // flight: their id is absent from the loaded snapshot, so without
            // this guard a slow initial load would clobber a just-created
            // (and already-persisted) character back out of the roster.
            const loadedIds = new Set(loaded.map((c) => c.id));
            s.roster = [...s.roster.filter((c) => !loadedIds.has(c.id)), ...loaded];
          });
        },

        setActive: (id) => set((s) => { s.activeId = id; }),

        createCharacter: async () => {
          const c = blankCharacter();
          set((s) => { s.roster.unshift(c); });
          await tracked('Save failed', () => deps.repo.put(c));
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
          await tracked('Save failed', () => deps.repo.put(copy));
          return copy.id;
        },

        deleteCharacter: async (id) => {
          set((s) => {
            s.roster = s.roster.filter((c) => c.id !== id);
            if (s.activeId === id) s.activeId = null;
          });
          await tracked('Delete failed', () => deps.repo.remove(id));
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
          await tracked('Import failed', async () => {
            await deps.repo.importJson(json);
            await get().load();
          });
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
