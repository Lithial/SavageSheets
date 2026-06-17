import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { AttributesPanel } from './AttributesPanel';
import { blankCharacter } from '../domain/defaults';

describe('AttributesPanel', () => {
  it('rolls an attribute when its roll button is clicked', async () => {
    const onRoll = vi.fn();
    const c = blankCharacter();
    render(<AttributesPanel attributes={c.attributes} onChangeAttribute={vi.fn()} onRoll={onRoll} />);
    await userEvent.click(screen.getByRole('button', { name: /roll agility/i }));
    expect(onRoll).toHaveBeenCalledWith('agility');
  });
});
