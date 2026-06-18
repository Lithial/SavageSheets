import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { EdgesHindrancesPanel } from './EdgesHindrancesPanel';
import type { EdgeOrHindrance } from '../domain/types';

const stub = {
  onAdd: vi.fn(), onChange: vi.fn(), onRemove: vi.fn(),
  onAddModifier: vi.fn(), onChangeModifier: vi.fn(), onRemoveModifier: vi.fn(),
};

const toughnessItem: EdgeOrHindrance[] = [
  { id: 'e1', name: 'Brawny', type: 'edge', severity: null, notes: '',
    modifiers: [{ id: 'm1', target: 'toughness', traitName: '', value: 1 }] },
];

describe('EdgesHindrancesPanel modifiers', () => {
  it('adds a modifier to an item', async () => {
    const onAddModifier = vi.fn();
    render(<EdgesHindrancesPanel items={toughnessItem} {...stub} onAddModifier={onAddModifier} />);
    await userEvent.click(screen.getByRole('button', { name: /add modifier/i }));
    expect(onAddModifier).toHaveBeenCalledWith('e1');
  });

  it('shows a trait-name input only for trait-target modifiers', () => {
    const traitItem: EdgeOrHindrance[] = [
      { id: 'e1', name: 'Alert', type: 'edge', severity: null, notes: '',
        modifiers: [{ id: 'm1', target: 'trait', traitName: 'Notice', value: 2 }] },
    ];
    const { rerender } = render(<EdgesHindrancesPanel items={traitItem} {...stub} />);
    expect(screen.getByLabelText(/modifier trait m1/i)).toBeInTheDocument();
    rerender(<EdgesHindrancesPanel items={toughnessItem} {...stub} />);
    expect(screen.queryByLabelText(/modifier trait m1/i)).toBeNull();
  });

  it('changes a modifier value', async () => {
    const onChangeModifier = vi.fn();
    render(<EdgesHindrancesPanel items={toughnessItem} {...stub} onChangeModifier={onChangeModifier} />);
    const value = screen.getByLabelText(/modifier value m1/i);
    await userEvent.clear(value);
    await userEvent.type(value, '3');
    expect(onChangeModifier).toHaveBeenCalled();
  });
});
