import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { StatusTracker } from './StatusTracker';

describe('StatusTracker', () => {
  it('shows current wounds and fires add/heal handlers', async () => {
    const onAddWound = vi.fn();
    const onHealWound = vi.fn();
    render(
      <StatusTracker
        status={{ shaken: false, wounds: 1, fatigue: 0 }}
        onAddWound={onAddWound}
        onHealWound={onHealWound}
        onSetFatigue={vi.fn()}
        onToggleShaken={vi.fn()}
      />,
    );
    expect(screen.getByText(/wounds: 1/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /add wound/i }));
    expect(onAddWound).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /heal wound/i }));
    expect(onHealWound).toHaveBeenCalled();
  });
});
