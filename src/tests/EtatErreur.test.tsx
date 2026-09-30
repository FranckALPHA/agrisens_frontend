import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EtatErreur } from '@/components/EtatErreur';

describe('EtatErreur', () => {
  it('affiche le message d’erreur et le titre', () => {
    render(
      <EtatErreur
        titre="Erreur de connexion"
        message="Le serveur est temporairement inaccessible."
      />
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Erreur de connexion')).toBeInTheDocument();
    expect(screen.getByText('Le serveur est temporairement inaccessible.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /réessayer/i })).not.toBeInTheDocument();
  });

  it('affiche le bouton Réessayer et déclenche le callback au clic', async () => {
    const user = userEvent.setup();
    const mockReessayer = vi.fn();

    render(<EtatErreur message="Erreur réseau" surReessayer={mockReessayer} />);

    const bouton = screen.getByRole('button', { name: /réessayer/i });
    expect(bouton).toBeInTheDocument();

    await user.click(bouton);
    expect(mockReessayer).toHaveBeenCalledTimes(1);
  });
});
