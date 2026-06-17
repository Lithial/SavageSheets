import type { TraitDie } from '../domain/types';
import { formatDie } from '../domain/format';

const OPTIONS: TraitDie[] = [
  { sides: 4, bonus: 0 },
  { sides: 6, bonus: 0 },
  { sides: 8, bonus: 0 },
  { sides: 10, bonus: 0 },
  { sides: 12, bonus: 0 },
  { sides: 12, bonus: 1 },
  { sides: 12, bonus: 2 },
];

const keyOf = (d: TraitDie) => `${d.sides}:${d.bonus}`;

export function DiePicker({
  value,
  onChange,
  label,
}: {
  value: TraitDie;
  onChange: (die: TraitDie) => void;
  label: string;
}) {
  return (
    <select
      aria-label={label}
      value={keyOf(value)}
      onChange={(e) => {
        const die = OPTIONS.find((o) => keyOf(o) === e.target.value);
        if (die) onChange(die);
      }}
      className="rounded border border-gray-300 px-2 py-1"
    >
      {OPTIONS.map((o) => (
        <option key={keyOf(o)} value={keyOf(o)}>
          {formatDie(o)}
        </option>
      ))}
    </select>
  );
}
