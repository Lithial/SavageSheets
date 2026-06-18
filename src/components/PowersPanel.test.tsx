import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PowersPanel } from './PowersPanel';
import type { ArcaneBackground } from '../domain/types';

const handlers = {
  onAddArcaneBackground: vi.fn(), onRemoveArcaneBackground: vi.fn(),
  onChangeName: vi.fn(), onChangeSkillName: vi.fn(), onChangeSkillDie: vi.fn(),
  onSetMaxPP: vi.fn(), onSpendPP: vi.fn(), onRestorePP: vi.fn(), onResetPP: vi.fn(),
  onAddPower: vi.fn(), onChangePower: vi.fn(), onRemovePower: vi.fn(), onCast: vi.fn(),
};

const ab: ArcaneBackground = {
  name: 'Magic', arcaneSkillName: 'Spellcasting', arcaneSkillDie: { sides: 6, bonus: 0 },
  powerPoints: { current: 2, max: 10 },
  powers: [
    { id: 'p1', name: 'Bolt', ppCost: 1, range: '', duration: '', notes: '' },
    { id: 'p2', name: 'Fireball', ppCost: 3, range: '', duration: '', notes: '' },
  ],
};

describe('PowersPanel', () => {
  it('offers to add an Arcane Background when there is none', async () => {
    const onAddArcaneBackground = vi.fn();
    render(<PowersPanel arcaneBackground={null} {...handlers} onAddArcaneBackground={onAddArcaneBackground} />);
    await userEvent.click(screen.getByRole('button', { name: /add arcane background/i }));
    expect(onAddArcaneBackground).toHaveBeenCalled();
  });

  it('casts an affordable power and disables an unaffordable one', async () => {
    const onCast = vi.fn();
    render(<PowersPanel arcaneBackground={ab} {...handlers} onCast={onCast} />);
    await userEvent.click(screen.getByRole('button', { name: /cast bolt/i }));
    expect(onCast).toHaveBeenCalledWith('p1');
    expect(screen.getByRole('button', { name: /cast fireball/i })).toBeDisabled();
  });

  it('adds a power', async () => {
    const onAddPower = vi.fn();
    render(<PowersPanel arcaneBackground={ab} {...handlers} onAddPower={onAddPower} />);
    await userEvent.click(screen.getByRole('button', { name: /add power/i }));
    expect(onAddPower).toHaveBeenCalled();
  });
});
