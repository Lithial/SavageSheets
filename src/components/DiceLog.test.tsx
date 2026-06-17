import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { DiceLog } from './DiceLog';
import type { RollLogEntry } from '../domain/types';

const entry: RollLogEntry = {
  id: 'r1', at: 1000, label: 'Fighting', kind: 'trait',
  detail: 'trait d8=5, wild d6=3 → 5 vs TN 4 — Success', total: 5,
  success: true, raises: 0, criticalFailure: false,
};

describe('DiceLog', () => {
  it('renders entries and clears on demand', async () => {
    const onClear = vi.fn();
    render(<DiceLog entries={[entry]} onClear={onClear} />);
    expect(screen.getByText(/Fighting/)).toBeInTheDocument();
    expect(screen.getByText(/Success/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /clear log/i }));
    expect(onClear).toHaveBeenCalled();
  });

  it('shows an empty state when there are no entries', () => {
    render(<DiceLog entries={[]} onClear={vi.fn()} />);
    expect(screen.getByText(/no rolls yet/i)).toBeInTheDocument();
  });
});
