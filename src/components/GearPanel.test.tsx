import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { GearPanel } from './GearPanel';
import type { Weapon } from '../domain/types';

const weapon: Weapon = {
  id: 'w1', name: 'Longsword', damageDice: [{ sides: 8, bonus: 0 }], addStrength: true,
  damageBonus: 0, range: '', rof: 1, ap: 0, notes: '',
};

describe('GearPanel', () => {
  it('rolls weapon damage and adds a weapon', async () => {
    const onRollDamage = vi.fn();
    const onAddWeapon = vi.fn();
    render(
      <GearPanel
        weapons={[weapon]} armor={[]} gear={[]}
        onAddWeapon={onAddWeapon} onChangeWeapon={vi.fn()} onRemoveWeapon={vi.fn()} onRollDamage={onRollDamage}
        onAddArmor={vi.fn()} onChangeArmor={vi.fn()} onRemoveArmor={vi.fn()}
        onAddGear={vi.fn()} onChangeGear={vi.fn()} onRemoveGear={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /roll longsword damage/i }));
    expect(onRollDamage).toHaveBeenCalledWith('w1');
    await userEvent.click(screen.getByRole('button', { name: /add weapon/i }));
    expect(onAddWeapon).toHaveBeenCalled();
  });
});
