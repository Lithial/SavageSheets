import type { AttributeKey, TraitDie } from '../domain/types';
import { ATTRIBUTE_KEYS } from '../domain/types';
import { DiePicker } from './DiePicker';

const LABELS: Record<AttributeKey, string> = {
  agility: 'Agility',
  smarts: 'Smarts',
  spirit: 'Spirit',
  strength: 'Strength',
  vigor: 'Vigor',
};

export function AttributesPanel({
  attributes,
  onChangeAttribute,
  onRoll,
}: {
  attributes: Record<AttributeKey, TraitDie>;
  onChangeAttribute: (key: AttributeKey, die: TraitDie) => void;
  onRoll: (key: AttributeKey) => void;
}) {
  return (
    <section className="rounded border p-3">
      <h2 className="mb-2 font-bold">Attributes</h2>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ATTRIBUTE_KEYS.map((key) => (
          <li key={key} className="flex items-center gap-2">
            <span className="w-24">{LABELS[key]}</span>
            <DiePicker label={LABELS[key]} value={attributes[key]} onChange={(die) => onChangeAttribute(key, die)} />
            <button type="button" onClick={() => onRoll(key)} aria-label={`Roll ${LABELS[key]}`} className="rounded bg-gray-800 px-2 py-1 text-white">
              Roll
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
