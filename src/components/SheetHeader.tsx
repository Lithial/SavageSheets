import type { Character } from '../domain/types';

export function SheetHeader({
  character,
  onNameChange,
  onAncestryChange,
  onToggleWildCard,
  onSpendBenny,
  onAddBenny,
}: {
  character: Character;
  onNameChange: (name: string) => void;
  onAncestryChange: (ancestry: string) => void;
  onToggleWildCard: () => void;
  onSpendBenny: () => void;
  onAddBenny: () => void;
}) {
  return (
    <header className="flex flex-wrap items-end gap-4 rounded border p-3">
      <label className="flex flex-col">
        <span className="text-xs uppercase text-gray-500">Name</span>
        <input
          aria-label="Name"
          value={character.name}
          onChange={(e) => onNameChange(e.target.value)}
          className="rounded border px-2 py-1"
        />
      </label>
      <label className="flex flex-col">
        <span className="text-xs uppercase text-gray-500">Ancestry</span>
        <input
          aria-label="Ancestry"
          value={character.ancestry}
          onChange={(e) => onAncestryChange(e.target.value)}
          className="rounded border px-2 py-1"
        />
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={character.isWildCard} onChange={onToggleWildCard} />
        Wild Card
      </label>
      <div className="flex items-center gap-2">
        <span>Bennies: {character.bennies}</span>
        <button type="button" onClick={onSpendBenny} aria-label="Spend benny" className="rounded border px-2">−</button>
        <button type="button" onClick={onAddBenny} aria-label="Add benny" className="rounded border px-2">+</button>
      </div>
    </header>
  );
}
