import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import { RosterPage } from './RosterPage';
import { useCharacterStore } from '../store/characterStore';

beforeEach(async () => {
  // Reset the singleton store to an empty roster for each test.
  useCharacterStore.setState({ roster: [], activeId: null, lastError: null });
});

describe('RosterPage', () => {
  it('creates a character and shows it in the list', async () => {
    render(
      <MemoryRouter>
        <RosterPage />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: /new character/i }));
    await waitFor(() => expect(screen.getByText(/new hero/i)).toBeInTheDocument());
  });
});
