import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RouteProtegee } from '@/pages/RouteProtegee';
import { useSessionStore } from '@/stores/session';

describe('RouteProtegee', () => {
  beforeEach(() => {
    useSessionStore.getState().deconnecter();
  });

  it('redirige vers /connexion si non authentifié', () => {
    render(
      <MemoryRouter initialEntries={['/profil']}>
        <Routes>
          <Route path="/connexion" element={<div>Page de connexion</div>} />
          <Route
            path="/profil"
            element={
              <RouteProtegee>
                <div>Contenu privé</div>
              </RouteProtegee>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Page de connexion')).toBeInTheDocument();
    expect(screen.queryByText('Contenu privé')).not.toBeInTheDocument();
  });

  it('redirige vers /acces-interdit si rôle non autorisé', () => {
    useSessionStore.getState().definirSession('faux_jeton', {
      id: '1',
      telephone: '+237690000001',
      nom: 'Paul',
      role: 'acheteur',
      statutCompte: 'actif',
    });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/acces-interdit" element={<div>Accès refusé</div>} />
          <Route
            path="/admin"
            element={
              <RouteProtegee rolesAutorises={['admin', 'super_admin']}>
                <div>Dashboard Admin</div>
              </RouteProtegee>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Accès refusé')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard Admin')).not.toBeInTheDocument();
  });

  it('affiche les enfants si l’utilisateur est autorisé', () => {
    useSessionStore.getState().definirSession('faux_jeton', {
      id: '1',
      telephone: '+237690000001',
      nom: 'Paul',
      role: 'agriculteur',
      statutCompte: 'actif',
    });

    render(
      <MemoryRouter initialEntries={['/exploitations']}>
        <Routes>
          <Route
            path="/exploitations"
            element={
              <RouteProtegee rolesAutorises={['agriculteur']}>
                <div>Mes Exploitations</div>
              </RouteProtegee>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Mes Exploitations')).toBeInTheDocument();
  });
});
