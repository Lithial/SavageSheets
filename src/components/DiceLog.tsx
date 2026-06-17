import type { RollLogEntry } from '../domain/types';

export function DiceLog({ entries, onClear }: { entries: RollLogEntry[]; onClear: () => void }) {
  return (
    <section className="rounded border p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-bold">Dice log</h2>
        <button type="button" onClick={onClear} aria-label="Clear log" className="rounded border px-2 py-1">Clear</button>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-gray-500">No rolls yet.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {entries.map((e) => (
            <li key={e.id} className={e.criticalFailure ? 'text-red-600' : ''}>
              <span className="font-semibold">{e.label}:</span> {e.detail}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
