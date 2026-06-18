import type { EdgeHindranceType, EdgeOrHindrance, StatModifier, StatModifierTarget } from '../domain/types';

const TARGETS: StatModifierTarget[] = ['parry', 'toughness', 'pace', 'trait'];

export function EdgesHindrancesPanel({
  items,
  onAdd,
  onChange,
  onRemove,
  onAddModifier,
  onChangeModifier,
  onRemoveModifier,
}: {
  items: EdgeOrHindrance[];
  onAdd: (type: EdgeHindranceType) => void;
  onChange: (id: string, patch: Partial<EdgeOrHindrance>) => void;
  onRemove: (id: string) => void;
  onAddModifier: (id: string) => void;
  onChangeModifier: (id: string, modId: string, patch: Partial<StatModifier>) => void;
  onRemoveModifier: (id: string, modId: string) => void;
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
      <ul className="flex flex-col gap-3">
        {items.map((it) => (
          <li key={it.id} className="flex flex-col gap-2 rounded border p-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-20 text-xs uppercase text-gray-500">{it.type}</span>
              <input aria-label={`Name ${it.id}`} value={it.name} onChange={(e) => onChange(it.id, { name: e.target.value })} className="flex-1 rounded border px-2 py-1" />
              {it.type === 'hindrance' && (
                <select aria-label={`Severity ${it.id}`} value={it.severity ?? 'minor'} onChange={(e) => onChange(it.id, { severity: e.target.value as 'minor' | 'major' })} className="rounded border px-2 py-1">
                  <option value="minor">Minor</option>
                  <option value="major">Major</option>
                </select>
              )}
              <input aria-label={`Notes ${it.id}`} value={it.notes} onChange={(e) => onChange(it.id, { notes: e.target.value })} placeholder="notes" className="flex-1 rounded border px-2 py-1" />
              <button type="button" onClick={() => onRemove(it.id)} aria-label={`Remove ${it.name || it.type}`} className="rounded border px-2 py-1">✕</button>
            </div>

            <div className="flex flex-col gap-1 pl-2">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase text-gray-500">Modifiers</span>
                <button type="button" onClick={() => onAddModifier(it.id)} aria-label="Add modifier" className="rounded border px-2 py-0.5 text-sm">+ Modifier</button>
              </div>
              {it.modifiers.map((m) => (
                <div key={m.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <select
                    aria-label={`Modifier target ${m.id}`}
                    value={m.target}
                    onChange={(e) => onChangeModifier(it.id, m.id, { target: e.target.value as StatModifierTarget })}
                    className="rounded border px-2 py-1"
                  >
                    {TARGETS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {m.target === 'trait' && (
                    <input
                      aria-label={`Modifier trait ${m.id}`}
                      value={m.traitName}
                      onChange={(e) => onChangeModifier(it.id, m.id, { traitName: e.target.value })}
                      placeholder="trait name"
                      className="w-32 rounded border px-2 py-1"
                    />
                  )}
                  <input
                    aria-label={`Modifier value ${m.id}`}
                    type="number"
                    value={m.value}
                    onChange={(e) => onChangeModifier(it.id, m.id, { value: Number(e.target.value) })}
                    className="w-16 rounded border px-2 py-1"
                  />
                  <button type="button" onClick={() => onRemoveModifier(it.id, m.id)} aria-label={`Remove modifier ${m.id}`} className="rounded border px-2 py-1">✕</button>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
