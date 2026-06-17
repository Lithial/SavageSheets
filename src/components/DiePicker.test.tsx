import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { DiePicker } from './DiePicker';

describe('DiePicker', () => {
  it('shows the current die and emits a new TraitDie on change', async () => {
    const onChange = vi.fn();
    render(<DiePicker label="Agility" value={{ sides: 6, bonus: 0 }} onChange={onChange} />);
    const select = screen.getByLabelText('Agility') as HTMLSelectElement;
    expect(select.value).toBe('6:0');
    await userEvent.selectOptions(select, '12:2');
    expect(onChange).toHaveBeenCalledWith({ sides: 12, bonus: 2 });
  });
});
