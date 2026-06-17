import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SkillsPanel } from './SkillsPanel';
import { blankCharacter } from '../domain/defaults';

describe('SkillsPanel', () => {
  it('adds a skill and rolls an existing one', async () => {
    const onAddSkill = vi.fn();
    const onRoll = vi.fn();
    const c = blankCharacter();
    render(
      <SkillsPanel
        skills={c.skills}
        onChangeSkill={vi.fn()}
        onAddSkill={onAddSkill}
        onRemoveSkill={vi.fn()}
        onRoll={onRoll}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /add skill/i }));
    expect(onAddSkill).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /roll athletics/i }));
    expect(onRoll).toHaveBeenCalledWith(c.skills.find((s) => s.name === 'Athletics')!.id);
  });
});
