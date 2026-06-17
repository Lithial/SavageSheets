import type { EdgeHindranceType, EdgeOrHindrance } from '../domain/types';

export function EdgesHindrancesPanel({
  items,
  onAdd,
  onChange,
  onRemove,
}: {
  items: EdgeOrHindrance[];
  onAdd: (type: EdgeHindranceType) => void;
  onChange: (id: string, patch: Partial<EdgeOrHindrance>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <section className="rounded border p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-bold">Edges &amp; Hindrances</h2>
        <div className="flex gap-2">
          <button type="button" onClick={() => onAdd('edge')} aria-label="Add edge" className="rounded border px-2 py-1">+ Edge</button>
          <button type="button" onClick={() => onAdd('hindrance')} aria-label="Add hindrance" className="rounded border px-2 py-1">+ Hindrance</button>
        </div>
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((it) => (
          <li key={it.id} className="flex flex-wrap items-center gap-2">
            <span className="w-20 text-xs uppercase text-gray-500">{it.type}</span>
            <input
              aria-label={`Name ${it.id}`}
              value={it.name}
              onChange={(e) => onChange(it.id, { name: e.target.value })}
              className="flex-1 rounded border px-2 py-1"
            />
            {it.type === 'hindrance' && (
              <select
                aria-label={`Severity ${it.id}`}
                value={it.severity ?? 'minor'}
                onChange={(e) => onChange(it.id, { severity: e.target.value as 'minor' | 'major' })}
                className="rounded border px-2 py-1"
              >
                <option value="minor">Minor</option>
                <option value="major">Major</option>
              </select>
            )}
            <input
              aria-label={`Notes ${it.id}`}
              value={it.notes}
              onChange={(e) => onChange(it.id, { notes: e.target.value })}
              placeholder="notes"
              className="flex-1 rounded border px-2 py-1"
            />
            <button type="button" onClick={() => onRemove(it.id)} aria-label={`Remove ${it.name || it.type}`} className="rounded border px-2 py-1">✕</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
