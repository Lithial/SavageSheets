import { describe, it, expect } from 'vitest';
import { makeCharacterStore } from './characterStore';
import { DexieCharacterRepository, type CharacterRepository } from '../persistence/repository';
import { facesRng } from '../test/rng';
import type { Character } from '../domain/types';
import { blankCharacter } from '../domain/defaults';

// Repo whose mutating operations always reject, to exercise the error contract.
class FailingRepo implements CharacterRepository {
  list(): Promise<Character[]> { return Promise.reject(new Error('boom-list')); }
  get(): Promise<Character | undefined> { return Promise.resolve(undefined); }
  put(): Promise<void> { return Promise.reject(new Error('boom-put')); }
  remove(): Promise<void> { return Promise.reject(new Error('boom-remove')); }
  exportJson(): Promise<string> { return Promise.reject(new Error('boom-export')); }
  importJson(): Promise<Character[]> { return Promise.reject(new Error('boom-import')); }
}

// Repo whose list() returns a fixed snapshot, to exercise load()'s merge contract.
class SnapshotRepo implements CharacterRepository {
  private readonly snapshot: Character[];
  constructor(snapshot: Character[]) { this.snapshot = snapshot; }
  list(): Promise<Character[]> { return Promise.resolve(this.snapshot); }
  get(id: string): Promise<Character | undefined> { return Promise.resolve(this.snapshot.find((c) => c.id === id)); }
  put(): Promise<void> { return Promise.resolve(); }
  remove(): Promise<void> { return Promise.resolve(); }
  exportJson(): Promise<string> { return Promise.resolve('[]'); }
  importJson(): Promise<Character[]> { return Promise.resolve([]); }
}

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

describe('characterStore error contract', () => {
  it('surfaces awaited persistence failures through lastError and still rejects', async () => {
    const store = makeCharacterStore({ repo: new FailingRepo(), rng: () => 0.5, now: () => 1000 });

    await expect(store.getState().createCharacter()).rejects.toThrow('boom-put');
    expect(store.getState().lastError).toContain('boom-put');

    await expect(store.getState().deleteCharacter('x')).rejects.toThrow('boom-remove');
    expect(store.getState().lastError).toContain('boom-remove');

    await expect(store.getState().load()).rejects.toThrow('boom-list');
    expect(store.getState().lastError).toContain('boom-list');

    await expect(store.getState().importJson('[]')).rejects.toThrow('boom-import');
    expect(store.getState().lastError).toContain('boom-import');
  });

  it('clears lastError after a subsequent successful persistence', async () => {
    const { store } = setup();
    store.setState({ lastError: 'stale' });
    await store.getState().createCharacter();
    expect(store.getState().lastError).toBeNull();
  });
});

describe('characterStore load() merge contract', () => {
  it('retains an in-memory-only character and de-dupes ids present in the DB snapshot', async () => {
    const memOnly = blankCharacter('In-Memory Only'); // never persisted
    const shared = blankCharacter('Shared (stale in-memory)'); // also in the DB
    const dbCopy: Character = { ...blankCharacter('Shared (DB)'), id: shared.id }; // same id, DB version
    const dbOnly = blankCharacter('DB Only');

    const store = makeCharacterStore({
      repo: new SnapshotRepo([dbCopy, dbOnly]),
      rng: () => 0.5,
      now: () => 1000,
    });
    store.setState({ roster: [memOnly, shared] });

    await store.getState().load();
    const roster = store.getState().roster;

    // In-memory-only character survives, pinned at the front (most-recent-first).
    expect(roster.map((c) => c.id)).toEqual([memOnly.id, dbCopy.id, dbOnly.id]);
    expect(roster.find((c) => c.id === memOnly.id)?.name).toBe('In-Memory Only');

    // The shared id appears exactly once, with the DB copy winning the de-dupe.
    const sharedEntries = roster.filter((c) => c.id === shared.id);
    expect(sharedEntries).toHaveLength(1);
    expect(sharedEntries[0].name).toBe('Shared (DB)');
  });
});

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
