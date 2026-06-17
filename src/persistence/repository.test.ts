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
