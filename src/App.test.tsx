import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import App from './App';
import { useCharacterStore } from './store/characterStore';

beforeEach(() => {
  useCharacterStore.setState({ roster: [], activeId: null, lastError: null });
});

describe('App', () => {
  it('renders the roster heading', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole('heading', { name: /savage worlds sheets/i })).toBeInTheDocument());
  });
});
