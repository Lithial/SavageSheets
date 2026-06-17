import type { Skill, TraitDie } from '../domain/types';
import { DiePicker } from './DiePicker';

export function SkillsPanel({
  skills,
  onChangeSkill,
  onAddSkill,
  onRemoveSkill,
  onRoll,
}: {
  skills: Skill[];
  onChangeSkill: (id: string, patch: Partial<Skill>) => void;
  onAddSkill: () => void;
  onRemoveSkill: (id: string) => void;
  onRoll: (skillId: string) => void;
}) {
  return (
    <section className="rounded border p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-bold">Skills</h2>
        <button type="button" onClick={onAddSkill} aria-label="Add skill" className="rounded border px-2 py-1">
          + Add skill
        </button>
      </div>
      <ul className="flex flex-col gap-2">
        {skills.map((s) => (
          <li key={s.id} className="flex items-center gap-2">
            <input
              aria-label={`Skill name ${s.id}`}
              value={s.name}
              onChange={(e) => onChangeSkill(s.id, { name: e.target.value })}
              className="flex-1 rounded border px-2 py-1"
            />
            <DiePicker label={`Die for ${s.name || 'skill'}`} value={s.die} onChange={(die: TraitDie) => onChangeSkill(s.id, { die })} />
            <button type="button" onClick={() => onRoll(s.id)} aria-label={`Roll ${s.name || 'skill'}`} className="rounded bg-gray-800 px-2 py-1 text-white">
              Roll
            </button>
            <button type="button" onClick={() => onRemoveSkill(s.id)} aria-label={`Remove ${s.name || 'skill'}`} className="rounded border px-2 py-1">
              ✕
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
