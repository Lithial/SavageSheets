import type { Status } from '../domain/types';
import { MAX_FATIGUE, MAX_WOUNDS } from '../domain/types';

export function StatusTracker({
  status,
  onAddWound,
  onHealWound,
  onSetFatigue,
  onToggleShaken,
}: {
  status: Status;
  onAddWound: () => void;
  onHealWound: () => void;
  onSetFatigue: (n: number) => void;
  onToggleShaken: () => void;
}) {
  return (
    <section className="flex flex-wrap items-center gap-4 rounded border p-3">
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={status.shaken} onChange={onToggleShaken} />
        Shaken
      </label>

      <div className="flex items-center gap-2">
        <span>Wounds: {status.wounds}{status.wounds >= MAX_WOUNDS ? ' (Incapacitated)' : ''}</span>
        <button type="button" onClick={onHealWound} aria-label="Heal wound" className="rounded border px-2">−</button>
        <button type="button" onClick={onAddWound} aria-label="Add wound" className="rounded border px-2">+</button>
      </div>

      <label className="flex items-center gap-2">
        Fatigue:
        <select
          aria-label="Fatigue"
          value={status.fatigue}
          onChange={(e) => onSetFatigue(Number(e.target.value))}
          className="rounded border px-2 py-1"
        >
          {Array.from({ length: MAX_FATIGUE + 1 }, (_, i) => (
            <option key={i} value={i}>{i}</option>
          ))}
        </select>
      </label>
    </section>
  );
}
