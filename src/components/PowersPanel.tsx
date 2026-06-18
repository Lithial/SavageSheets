import type { ArcaneBackground, Power, TraitDie } from '../domain/types';
import { DiePicker } from './DiePicker';

export function PowersPanel({
  arcaneBackground,
  onAddArcaneBackground,
  onRemoveArcaneBackground,
  onChangeName,
  onChangeSkillName,
  onChangeSkillDie,
  onSetMaxPP,
  onSpendPP,
  onRestorePP,
  onResetPP,
  onAddPower,
  onChangePower,
  onRemovePower,
  onCast,
}: {
  arcaneBackground: ArcaneBackground | null;
  onAddArcaneBackground: () => void;
  onRemoveArcaneBackground: () => void;
  onChangeName: (name: string) => void;
  onChangeSkillName: (name: string) => void;
  onChangeSkillDie: (die: TraitDie) => void;
  onSetMaxPP: (n: number) => void;
  onSpendPP: () => void;
  onRestorePP: () => void;
  onResetPP: () => void;
  onAddPower: () => void;
  onChangePower: (powerId: string, patch: Partial<Power>) => void;
  onRemovePower: (powerId: string) => void;
  onCast: (powerId: string) => void;
}) {
  if (!arcaneBackground) {
    return (
      <section className="rounded border p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-bold">Powers</h2>
          <button type="button" onClick={onAddArcaneBackground} aria-label="Add arcane background" className="rounded border px-2 py-1">
            + Arcane Background
          </button>
        </div>
        <p className="text-sm text-gray-500">No Arcane Background.</p>
      </section>
    );
  }

  const ab = arcaneBackground;
  return (
    <section className="rounded border p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-bold">Powers</h2>
        <button type="button" onClick={onRemoveArcaneBackground} aria-label="Remove arcane background" className="rounded border px-2 py-1">
          Remove
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-sm">
          Arcane Background
          <input aria-label="Arcane background name" value={ab.name} onChange={(e) => onChangeName(e.target.value)} className="rounded border px-2 py-1" />
        </label>
        <label className="flex flex-col text-sm">
          Arcane skill
          <input aria-label="Arcane skill name" value={ab.arcaneSkillName} onChange={(e) => onChangeSkillName(e.target.value)} className="rounded border px-2 py-1" />
        </label>
        <DiePicker label="Arcane skill die" value={ab.arcaneSkillDie} onChange={onChangeSkillDie} />
        <div className="flex items-center gap-2 text-sm">
          <span>PP: {ab.powerPoints.current}/{ab.powerPoints.max}</span>
          <button type="button" onClick={onSpendPP} aria-label="Spend power point" className="rounded border px-2">−</button>
          <button type="button" onClick={onRestorePP} aria-label="Restore power point" className="rounded border px-2">+</button>
          <button type="button" onClick={onResetPP} aria-label="Reset power points" className="rounded border px-2 py-1">Reset</button>
          <label className="flex items-center gap-1">
            max
            <input aria-label="Max power points" type="number" value={ab.powerPoints.max} onChange={(e) => onSetMaxPP(Number(e.target.value))} className="w-16 rounded border px-2 py-1" />
          </label>
        </div>
      </div>

      <div className="mb-1 flex items-center justify-between">
        <h3 className="font-semibold">Known Powers</h3>
        <button type="button" onClick={onAddPower} aria-label="Add power" className="rounded border px-2 py-1">+ Power</button>
      </div>
      <ul className="flex flex-col gap-2">
        {ab.powers.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-2">
            <input aria-label={`Power name ${p.id}`} value={p.name} onChange={(e) => onChangePower(p.id, { name: e.target.value })} className="flex-1 rounded border px-2 py-1" />
            <label className="flex items-center gap-1 text-sm">
              PP
              <input aria-label={`Power cost ${p.id}`} type="number" value={p.ppCost} onChange={(e) => onChangePower(p.id, { ppCost: Number(e.target.value) })} className="w-16 rounded border px-2 py-1" />
            </label>
            <input aria-label={`Power range ${p.id}`} value={p.range} onChange={(e) => onChangePower(p.id, { range: e.target.value })} placeholder="range" className="w-24 rounded border px-2 py-1" />
            <input aria-label={`Power duration ${p.id}`} value={p.duration} onChange={(e) => onChangePower(p.id, { duration: e.target.value })} placeholder="duration" className="w-24 rounded border px-2 py-1" />
            <button
              type="button"
              onClick={() => onCast(p.id)}
              disabled={ab.powerPoints.current < p.ppCost}
              aria-label={`Cast ${p.name || 'power'}`}
              className="rounded bg-gray-800 px-2 py-1 text-white disabled:opacity-40"
            >
              Cast
            </button>
            <button type="button" onClick={() => onRemovePower(p.id)} aria-label={`Remove ${p.name || 'power'}`} className="rounded border px-2 py-1">✕</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
