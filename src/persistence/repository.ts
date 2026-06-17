import Dexie, { type Table } from 'dexie';
import type { Character } from '../domain/types';
import { parseCharacterValue, parseRoster, serializeRoster } from './schema';

export interface CharacterRepository {
  list(): Promise<Character[]>;
  get(id: string): Promise<Character | undefined>;
  put(character: Character): Promise<void>;
  remove(id: string): Promise<void>;
  exportJson(): Promise<string>;
  importJson(json: string): Promise<Character[]>;
}

class CharacterDb extends Dexie {
  characters!: Table<Character, string>;
  constructor(name: string) {
    super(name);
    this.version(1).stores({ characters: 'id, name, updatedAt' });
  }
}

export class DexieCharacterRepository implements CharacterRepository {
  private db: CharacterDb;

  constructor(dbName = 'savage-worlds') {
    this.db = new CharacterDb(dbName);
  }

  list(): Promise<Character[]> {
    return this.db.characters.orderBy('updatedAt').reverse().toArray();
  }

  get(id: string): Promise<Character | undefined> {
    return this.db.characters.get(id);
  }

  async put(character: Character): Promise<void> {
    // Validate before writing so corrupt data never reaches storage.
    await this.db.characters.put(parseCharacterValue(character));
  }

  async remove(id: string): Promise<void> {
    await this.db.characters.delete(id);
  }

  async exportJson(): Promise<string> {
    return serializeRoster(await this.list());
  }

  async importJson(json: string): Promise<Character[]> {
    const roster = parseRoster(json); // throws on invalid -> nothing written
    await this.db.characters.bulkPut(roster);
    return roster;
  }
}

export const characterRepository: CharacterRepository = new DexieCharacterRepository();
