import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * F-09 — composants acheteur de la page détail commande : garde-fous de la
 * demande de remboursement (justificatif obligatoire, montant ≤ payé) et
 * formulaire d'évaluation (une seule évaluation, note livreur conditionnelle).
 * Les appels réseau sont simulés au niveau du service litiges.
 */

const serviceMock = vi.hoisted(() => ({
  demanderRemboursement: vi.fn(),
  creerEvaluation: vi.fn(),
  obtenirEvaluation: vi.fn(),
  creerSignalement: vi.fn(),
}));

vi.mock('@/services/api/litiges', async () => {
  const reel =
    await vi.importActual<typeof import('@/services/api/litiges')>('@/services/api/litiges');
  return { ...reel, ...serviceMock };
});

import { DemandeRemboursement } from '@/pages/commandes/DemandeRemboursement';
import { FormulaireEvaluation } from '@/pages/commandes/FormulaireEvaluation';
import { ErreurApi } from '@/services/api/client';

const rendre = (composant: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(MemoryRouter, null, composant)
    )
  );
};

describe('DemandeRemboursement (ACH-07)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('désactive l’envoi sans justificatif quand le motif l’exige (PW-F09-04)', () => {
    rendre(<DemandeRemboursement commandeId="c1" montantPayeFcfa={10000} />);
    fireEvent.click(screen.getByTestId('bouton-demander-remboursement'));
    fireEvent.change(screen.getByTestId('champ-montant-remboursement'), {
      target: { value: '5000' },
    });
    expect(screen.getByTestId('bouton-confirmer-remboursement')).toBeDisabled();
    expect(screen.getByTestId('aide-justificatif-requis')).toBeInTheDocument();
  });

  it('refuse un montant supérieur au paiement (PW-F09-03)', () => {
    rendre(<DemandeRemboursement commandeId="c1" montantPayeFcfa={10000} />);
    fireEvent.click(screen.getByTestId('bouton-demander-remboursement'));
    fireEvent.change(screen.getByTestId('selecteur-motif-remboursement'), {
      target: { value: 'autre' },
    });
    fireEvent.change(screen.getByTestId('champ-montant-remboursement'), {
      target: { value: '15000' },
    });
    expect(screen.getByTestId('bouton-confirmer-remboursement')).toBeDisabled();
  });

  it('envoie la demande quand tout est valide et notifie le parent', async () => {
    serviceMock.demanderRemboursement.mockResolvedValue({ id: 'r1', statut: 'demande' });
    const onDemande = vi.fn();
    rendre(<DemandeRemboursement commandeId="c1" montantPayeFcfa={10000} onDemande={onDemande} />);
    fireEvent.click(screen.getByTestId('bouton-demander-remboursement'));
    fireEvent.change(screen.getByTestId('selecteur-motif-remboursement'), {
      target: { value: 'autre' },
    });
    fireEvent.change(screen.getByTestId('champ-montant-remboursement'), {
      target: { value: '2000' },
    });
    fireEvent.click(screen.getByTestId('bouton-confirmer-remboursement'));
    await waitFor(() => expect(serviceMock.demanderRemboursement).toHaveBeenCalled());
    const [premierAppel] = serviceMock.demanderRemboursement.mock.calls;
    expect(premierAppel?.[0]).toMatchObject({
      commande_id: 'c1',
      motif: 'autre',
      montant_demande_fcfa: 2000,
    });

    await waitFor(() => expect(onDemande).toHaveBeenCalled());
  });

  it('affiche le message du délai dépassé renvoyé par l’API', async () => {
    serviceMock.demanderRemboursement.mockRejectedValue(
      new ErreurApi('delai_depasse', 'Trop tard.', 422)
    );
    rendre(<DemandeRemboursement commandeId="c1" montantPayeFcfa={10000} />);
    fireEvent.click(screen.getByTestId('bouton-demander-remboursement'));
    fireEvent.change(screen.getByTestId('selecteur-motif-remboursement'), {
      target: { value: 'autre' },
    });
    fireEvent.change(screen.getByTestId('champ-montant-remboursement'), {
      target: { value: '2000' },
    });
    fireEvent.click(screen.getByTestId('bouton-confirmer-remboursement'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('48 h'));
  });
});

describe('FormulaireEvaluation (ACH-08)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('affiche la lecture seule si l’évaluation existe déjà (PW-F09-05)', async () => {
    serviceMock.obtenirEvaluation.mockResolvedValue({
      id: 'e1',
      note_agriculteur: 4,
      note_livreur: null,
      commentaire: 'RAS',
    });
    rendre(<FormulaireEvaluation commandeId="c1" aUnLivreur={false} />);
    await waitFor(() => expect(screen.getByTestId('evaluation-deja-faite')).toBeInTheDocument());
    expect(screen.getByTestId('evaluation-resume')).toHaveTextContent('4/5');
    expect(screen.queryByTestId('formulaire-evaluation')).not.toBeInTheDocument();
  });

  it('propose la note livreur seulement si un livreur est impliqué', async () => {
    serviceMock.obtenirEvaluation.mockResolvedValue(null);
    const { rerender } = rendre(<FormulaireEvaluation commandeId="c1" aUnLivreur={false} />);
    await waitFor(() => expect(screen.getByTestId('formulaire-evaluation')).toBeInTheDocument());
    expect(screen.queryByTestId('note-livreur')).not.toBeInTheDocument();
    serviceMock.obtenirEvaluation.mockResolvedValue(null);
    rerender(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter>
          <FormulaireEvaluation commandeId="c1" aUnLivreur />
        </MemoryRouter>
      </QueryClientProvider>
    );
    await waitFor(() =>
      expect(screen.getAllByTestId('formulaire-evaluation').length).toBeGreaterThan(0)
    );
  });

  it('envoie la note agriculteur obligatoire et le commentaire', async () => {
    serviceMock.obtenirEvaluation.mockResolvedValue(null);
    serviceMock.creerEvaluation.mockResolvedValue({ id: 'e1' });
    rendre(<FormulaireEvaluation commandeId="c1" aUnLivreur={false} />);
    await waitFor(() => expect(screen.getByTestId('formulaire-evaluation')).toBeInTheDocument());
    expect(screen.getByTestId('bouton-envoyer-evaluation')).toBeDisabled();
    fireEvent.click(
      within(screen.getByTestId('note-agriculteur')).getByRole('button', { name: /5 sur 5/ })
    );
    fireEvent.change(screen.getByTestId('champ-commentaire-evaluation'), {
      target: { value: 'Qualité au rendez-vous' },
    });
    fireEvent.click(screen.getByTestId('bouton-envoyer-evaluation'));
    await waitFor(() => expect(serviceMock.creerEvaluation).toHaveBeenCalled());
    expect(serviceMock.creerEvaluation.mock.calls[0]).toEqual([
      'c1',
      { note_agriculteur: 5, note_livreur: null, commentaire: 'Qualité au rendez-vous' },
    ]);
  });
});
