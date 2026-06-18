import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCharacterStore } from '../store/characterStore';
import { newId, blankArcaneBackground, newPower } from '../domain/defaults';
import { parry, toughness, pace } from '../domain/derived';
import type { AttributeKey } from '../domain/types';
import { SheetHeader } from '../components/SheetHeader';
import { DerivedBar } from '../components/DerivedBar';
import { StatusTracker } from '../components/StatusTracker';
import { AttributesPanel } from '../components/AttributesPanel';
import { SkillsPanel } from '../components/SkillsPanel';
import { EdgesHindrancesPanel } from '../components/EdgesHindrancesPanel';
import { GearPanel } from '../components/GearPanel';
import { PowersPanel } from '../components/PowersPanel';
import { DiceLog } from '../components/DiceLog';

const ATTR_LABEL: Record<AttributeKey, string> = {
  agility: 'Agility', smarts: 'Smarts', spirit: 'Spirit', strength: 'Strength', vigor: 'Vigor',
};

export function SheetPage() {
  const { id = '' } = useParams();
  const character = useCharacterStore((s) => s.roster.find((c) => c.id === id));
  const load = useCharacterStore((s) => s.load);
  const update = useCharacterStore((s) => s.update);
  const addWound = useCharacterStore((s) => s.addWound);
  const healWound = useCharacterStore((s) => s.healWound);
  const setFatigue = useCharacterStore((s) => s.setFatigue);
  const toggleShaken = useCharacterStore((s) => s.toggleShaken);
  const spendBenny = useCharacterStore((s) => s.spendBenny);
  const addBenny = useCharacterStore((s) => s.addBenny);
  const rollTraitFor = useCharacterStore((s) => s.rollTraitFor);
  const rollWeaponDamage = useCharacterStore((s) => s.rollWeaponDamage);
  const clearLog = useCharacterStore((s) => s.clearLog);
  const spendPP = useCharacterStore((s) => s.spendPP);
  const restorePP = useCharacterStore((s) => s.restorePP);
  const resetPP = useCharacterStore((s) => s.resetPP);
  const castPower = useCharacterStore((s) => s.castPower);

  useEffect(() => { if (!character) void load(); }, [character, load]);

  if (!character) {
    return (
      <main className="mx-auto max-w-3xl p-4">
        <p>Character not found. <Link to="/" className="underline">Back to roster</Link></p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 p-4">
      <Link to="/" className="underline">← Roster</Link>

      <SheetHeader
        character={character}
        onNameChange={(name) => update(id, (c) => { c.name = name; })}
        onAncestryChange={(ancestry) => update(id, (c) => { c.ancestry = ancestry; })}
        onToggleWildCard={() => update(id, (c) => { c.isWildCard = !c.isWildCard; })}
        onSpendBenny={() => spendBenny(id)}
        onAddBenny={() => addBenny(id)}
      />

      <DerivedBar parry={parry(character)} toughness={toughness(character)} pace={pace()} />

      <StatusTracker
        status={character.status}
        onAddWound={() => addWound(id)}
        onHealWound={() => healWound(id)}
        onSetFatigue={(n) => setFatigue(id, n)}
        onToggleShaken={() => toggleShaken(id)}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AttributesPanel
          attributes={character.attributes}
          onChangeAttribute={(key, die) => update(id, (c) => { c.attributes[key] = die; })}
          onRoll={(key) => rollTraitFor(id, ATTR_LABEL[key], character.attributes[key])}
        />
        <SkillsPanel
          skills={character.skills}
          onChangeSkill={(sid, patch) => update(id, (c) => {
            const s = c.skills.find((x) => x.id === sid);
            if (s) Object.assign(s, patch);
          })}
          onAddSkill={() => update(id, (c) => { c.skills.push({ id: newId(), name: 'New Skill', attribute: 'smarts', die: { sides: 4, bonus: 0 } }); })}
          onRemoveSkill={(sid) => update(id, (c) => { c.skills = c.skills.filter((x) => x.id !== sid); })}
          onRoll={(sid) => {
            const s = character.skills.find((x) => x.id === sid);
            if (s) rollTraitFor(id, s.name, s.die);
          }}
        />
      </div>

      <EdgesHindrancesPanel
        items={character.edgesHindrances}
        onAdd={(type) => update(id, (c) => {
          c.edgesHindrances.push({ id: newId(), name: '', type, severity: type === 'hindrance' ? 'minor' : null, notes: '' });
        })}
        onChange={(eid, patch) => update(id, (c) => {
          const it = c.edgesHindrances.find((x) => x.id === eid);
          if (it) Object.assign(it, patch);
        })}
        onRemove={(eid) => update(id, (c) => { c.edgesHindrances = c.edgesHindrances.filter((x) => x.id !== eid); })}
      />

      <GearPanel
        weapons={character.weapons}
        armor={character.armor}
        gear={character.gear}
        onAddWeapon={() => update(id, (c) => { c.weapons.push({ id: newId(), name: 'New Weapon', damageDice: [{ sides: 6, bonus: 0 }], addStrength: true, damageBonus: 0, range: '', rof: 1, ap: 0, notes: '' }); })}
        onChangeWeapon={(wid, patch) => update(id, (c) => { const w = c.weapons.find((x) => x.id === wid); if (w) Object.assign(w, patch); })}
        onRemoveWeapon={(wid) => update(id, (c) => { c.weapons = c.weapons.filter((x) => x.id !== wid); })}
        onRollDamage={(wid) => rollWeaponDamage(id, wid)}
        onAddArmor={() => update(id, (c) => { c.armor.push({ id: newId(), name: 'New Armor', armor: 2, equipped: true, notes: '' }); })}
        onChangeArmor={(aid, patch) => update(id, (c) => { const a = c.armor.find((x) => x.id === aid); if (a) Object.assign(a, patch); })}
        onRemoveArmor={(aid) => update(id, (c) => { c.armor = c.armor.filter((x) => x.id !== aid); })}
        onAddGear={() => update(id, (c) => { c.gear.push({ id: newId(), name: 'New Item', quantity: 1, notes: '' }); })}
        onChangeGear={(gid, patch) => update(id, (c) => { const g = c.gear.find((x) => x.id === gid); if (g) Object.assign(g, patch); })}
        onRemoveGear={(gid) => update(id, (c) => { c.gear = c.gear.filter((x) => x.id !== gid); })}
      />

      <PowersPanel
        arcaneBackground={character.arcaneBackground}
        onAddArcaneBackground={() => update(id, (c) => { c.arcaneBackground = blankArcaneBackground(); })}
        onRemoveArcaneBackground={() => update(id, (c) => { c.arcaneBackground = null; })}
        onChangeName={(name) => update(id, (c) => { if (c.arcaneBackground) c.arcaneBackground.name = name; })}
        onChangeSkillName={(name) => update(id, (c) => { if (c.arcaneBackground) c.arcaneBackground.arcaneSkillName = name; })}
        onChangeSkillDie={(die) => update(id, (c) => { if (c.arcaneBackground) c.arcaneBackground.arcaneSkillDie = die; })}
        onSetMaxPP={(n) => update(id, (c) => {
          if (c.arcaneBackground) {
            c.arcaneBackground.powerPoints.max = n;
            c.arcaneBackground.powerPoints.current = Math.min(c.arcaneBackground.powerPoints.current, n);
          }
        })}
        onSpendPP={() => spendPP(id, 1)}
        onRestorePP={() => restorePP(id, 1)}
        onResetPP={() => resetPP(id)}
        onAddPower={() => update(id, (c) => { c.arcaneBackground?.powers.push(newPower()); })}
        onChangePower={(pid, patch) => update(id, (c) => {
          const p = c.arcaneBackground?.powers.find((x) => x.id === pid);
          if (p) Object.assign(p, patch);
        })}
        onRemovePower={(pid) => update(id, (c) => {
          if (c.arcaneBackground) c.arcaneBackground.powers = c.arcaneBackground.powers.filter((x) => x.id !== pid);
        })}
        onCast={(pid) => castPower(id, pid)}
      />

      <DiceLog entries={character.rollLog} onClear={() => clearLog(id)} />
    </main>
  );
}
