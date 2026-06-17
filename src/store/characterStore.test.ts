import { describe, it, expect } from 'vitest';
import { makeCharacterStore } from './characterStore';
import { DexieCharacterRepository, type CharacterRepository } from '../persistence/repository';
import { facesRng } from '../test/rng';
import type { Character } from '../domain/types';

// Repo whose mutating operations always reject, to exercise the error contract.
class FailingRepo implements CharacterRepository {
  list(): Promise<Character[]> { return Promise.reject(new Error('boom-list')); }
  get(): Promise<Character | undefined> { return Promise.resolve(undefined); }
  put(): Promise<void> { return Promise.reject(new Error('boom-put')); }
  remove(): Promise<void> { return Promise.reject(new Error('boom-remove')); }
  exportJson(): Promise<string> { return Promise.reject(new Error('boom-export')); }
  importJson(): Promise<Character[]> { return Promise.reject(new Error('boom-import')); }
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
