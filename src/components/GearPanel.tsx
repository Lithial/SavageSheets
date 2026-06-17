import type { Armor, GearItem, Weapon } from '../domain/types';

export function GearPanel({
  weapons,
  armor,
  gear,
  onAddWeapon,
  onChangeWeapon,
  onRemoveWeapon,
  onRollDamage,
  onAddArmor,
  onChangeArmor,
  onRemoveArmor,
  onAddGear,
  onChangeGear,
  onRemoveGear,
}: {
  weapons: Weapon[];
  armor: Armor[];
  gear: GearItem[];
  onAddWeapon: () => void;
  onChangeWeapon: (id: string, patch: Partial<Weapon>) => void;
  onRemoveWeapon: (id: string) => void;
  onRollDamage: (id: string) => void;
  onAddArmor: () => void;
  onChangeArmor: (id: string, patch: Partial<Armor>) => void;
  onRemoveArmor: (id: string) => void;
  onAddGear: () => void;
  onChangeGear: (id: string, patch: Partial<GearItem>) => void;
  onRemoveGear: (id: string) => void;
}) {
  return (
    <section className="rounded border p-3">
      <h2 className="mb-2 font-bold">Gear</h2>

      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-semibold">Weapons</h3>
          <button type="button" onClick={onAddWeapon} aria-label="Add weapon" className="rounded border px-2 py-1">+ Weapon</button>
        </div>
        <ul className="flex flex-col gap-2">
          {weapons.map((w) => (
            <li key={w.id} className="flex flex-wrap items-center gap-2">
              <input aria-label={`Weapon name ${w.id}`} value={w.name} onChange={(e) => onChangeWeapon(w.id, { name: e.target.value })} className="flex-1 rounded border px-2 py-1" />
              <label className="flex items-center gap-1 text-sm">
                <input type="checkbox" checked={w.addStrength} onChange={(e) => onChangeWeapon(w.id, { addStrength: e.target.checked })} />
                +Str
              </label>
              <input aria-label={`Damage bonus ${w.id}`} type="number" value={w.damageBonus} onChange={(e) => onChangeWeapon(w.id, { damageBonus: Number(e.target.value) })} className="w-16 rounded border px-2 py-1" />
              <button type="button" onClick={() => onRollDamage(w.id)} aria-label={`Roll ${w.name || 'weapon'} damage`} className="rounded bg-gray-800 px-2 py-1 text-white">Roll dmg</button>
              <button type="button" onClick={() => onRemoveWeapon(w.id)} aria-label={`Remove ${w.name || 'weapon'}`} className="rounded border px-2 py-1">✕</button>
            </li>
          ))}
        </ul>
      </div>

      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-semibold">Armor</h3>
          <button type="button" onClick={onAddArmor} aria-label="Add armor" className="rounded border px-2 py-1">+ Armor</button>
        </div>
        <ul className="flex flex-col gap-2">
          {armor.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2">
              <input aria-label={`Armor name ${a.id}`} value={a.name} onChange={(e) => onChangeArmor(a.id, { name: e.target.value })} className="flex-1 rounded border px-2 py-1" />
              <label className="flex items-center gap-1 text-sm">
                Armor
                <input aria-label={`Armor value ${a.id}`} type="number" value={a.armor} onChange={(e) => onChangeArmor(a.id, { armor: Number(e.target.value) })} className="w-16 rounded border px-2 py-1" />
              </label>
              <label className="flex items-center gap-1 text-sm">
                <input type="checkbox" checked={a.equipped} onChange={(e) => onChangeArmor(a.id, { equipped: e.target.checked })} />
                Equipped
              </label>
              <button type="button" onClick={() => onRemoveArmor(a.id)} aria-label={`Remove ${a.name || 'armor'}`} className="rounded border px-2 py-1">✕</button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-semibold">Other gear</h3>
          <button type="button" onClick={onAddGear} aria-label="Add gear" className="rounded border px-2 py-1">+ Item</button>
        </div>
        <ul className="flex flex-col gap-2">
          {gear.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center gap-2">
              <input aria-label={`Gear name ${g.id}`} value={g.name} onChange={(e) => onChangeGear(g.id, { name: e.target.value })} className="flex-1 rounded border px-2 py-1" />
              <input aria-label={`Gear qty ${g.id}`} type="number" value={g.quantity} onChange={(e) => onChangeGear(g.id, { quantity: Number(e.target.value) })} className="w-16 rounded border px-2 py-1" />
              <button type="button" onClick={() => onRemoveGear(g.id)} aria-label={`Remove ${g.name || 'item'}`} className="rounded border px-2 py-1">✕</button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
