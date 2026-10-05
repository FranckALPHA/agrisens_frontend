import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom';
import { useSessionStore } from '@/stores/session';

// Les deux layouts de chrome sont stubbés pour isoler la logique de choix
// du composant : le test vérifie uniquement quel layout est monté selon
// l'état de session, sans dépendre du WebSocket ni de Workbox.
vi.mock('@/components/layout/MiseEnPageConnectee', () => ({
  MiseEnPageConnectee: () => (
    <div data-testid="chrome-connecte">
      <Outlet />
    </div>
  ),
}));
vi.mock('@/components/layout/MiseEnPagePublique', () => ({
  MiseEnPagePublique: () => (
    <div data-testid="chrome-public">
      <Outlet />
    </div>
  ),
}));

import { MiseEnPageAdaptative } from '@/components/layout/MiseEnPageAdaptative';

const sessionAmina = {
  id: 'a',
  telephone: '+237690000002',
  nom: 'Amina',
  role: 'acheteur' as const,
  statutCompte: 'actif' as const,
};

describe('MiseEnPageAdaptative (chrome connecté / public selon session)', () => {
  beforeEach(() => {
    useSessionStore.getState().deconnecter();
  });

  const renderCatalogue = (chemin: string) =>
    render(
      <MemoryRouter initialEntries={[chemin]}>
        <Routes>
          <Route path="/catalogue" element={<MiseEnPageAdaptative />}>
            <Route index element={<div>PageCatalogueStub</div>} />
            <Route path=":identifiant" element={<div>PageDetailStub</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

  const renderAccesInterdit = (chemin: string) =>
    render(
      <MemoryRouter initialEntries={[chemin]}>
        <Routes>
          <Route path="/acces-interdit" element={<MiseEnPageAdaptative />}>
            <Route index element={<div>PageAccesInterditStub</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

  it('catalogue : chrome connecté quand la session est active', () => {
    useSessionStore.getState().definirSession('faux_jeton', sessionAmina);
    renderCatalogue('/catalogue');
    expect(screen.getByTestId('chrome-connecte')).toBeInTheDocument();
    expect(screen.queryByTestId('chrome-public')).not.toBeInTheDocument();
    expect(screen.getByText('PageCatalogueStub')).toBeInTheDocument();
  });

  it('catalogue : chrome public quand aucun jeton de session', () => {
    renderCatalogue('/catalogue');
    expect(screen.getByTestId('chrome-public')).toBeInTheDocument();
    expect(screen.queryByTestId('chrome-connecte')).not.toBeInTheDocument();
    expect(screen.getByText('PageCatalogueStub')).toBeInTheDocument();
  });

  it('catalogue : chrome connecté aussi sur la sous-route /catalogue/:id', () => {
    useSessionStore.getState().definirSession('faux_jeton', sessionAmina);
    renderCatalogue('/catalogue/abc-123');
    expect(screen.getByTestId('chrome-connecte')).toBeInTheDocument();
    expect(screen.getByText('PageDetailStub')).toBeInTheDocument();
  });

  it('acces-interdit : chrome connecté pour un utilisateur redirigé par RouteProtegee', () => {
    useSessionStore.getState().definirSession('faux_jeton', sessionAmina);
    renderAccesInterdit('/acces-interdit');
    expect(screen.getByTestId('chrome-connecte')).toBeInTheDocument();
    expect(screen.queryByTestId('chrome-public')).not.toBeInTheDocument();
    expect(screen.getByText('PageAccesInterditStub')).toBeInTheDocument();
  });

  it('acces-interdit : chrome public pour un visiteur non connecté', () => {
    renderAccesInterdit('/acces-interdit');
    expect(screen.getByTestId('chrome-public')).toBeInTheDocument();
    expect(screen.queryByTestId('chrome-connecte')).not.toBeInTheDocument();
    expect(screen.getByText('PageAccesInterditStub')).toBeInTheDocument();
  });
});
