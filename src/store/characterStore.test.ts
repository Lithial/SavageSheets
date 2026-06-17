import { describe, it, expect } from 'vitest';
import { makeCharacterStore } from './characterStore';
import { DexieCharacterRepository } from '../persistence/repository';
import { facesRng } from '../test/rng';

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
