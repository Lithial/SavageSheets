import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import { SheetPage } from './SheetPage';
import { useCharacterStore } from '../store/characterStore';
import { blankCharacter } from '../domain/defaults';

beforeEach(() => {
  useCharacterStore.setState({ roster: [], activeId: null, lastError: null });
});

function renderAt(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/c/${id}`]}>
      <Routes>
        <Route path="/c/:id" element={<SheetPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SheetPage', () => {
  it('shows derived Toughness and rolls an attribute into the log', async () => {
    const c = blankCharacter('Rolla');
    c.attributes.vigor = { sides: 10, bonus: 0 }; // toughness = 2 + 5 = 7 (distinct from Pace 6 / Parry 2)
    useCharacterStore.setState({ roster: [c], activeId: c.id });

    renderAt(c.id);

    expect(await screen.findByText('Toughness')).toBeInTheDocument();
    // Toughness value 7 is unique (Pace is 6, Parry is 2)
    expect(screen.getByText('7')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /roll vigor/i }));
    await waitFor(() => {
      const log = useCharacterStore.getState().roster.find((x) => x.id === c.id)!.rollLog;
      expect(log.length).toBe(1);
      expect(log[0].label).toBe('Vigor');
    });
  });
});
