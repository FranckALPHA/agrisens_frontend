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

  it('affiche un écran de chargement tant que la session n’est pas initialisée', () => {
    useSessionStore.getState().deconnecter();
    useSessionStore.setState({ estInitialise: false });

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

    // Le message est rendu deux fois (visuel + sr-only) par EtatChargement.
    expect(screen.getAllByText(/Vérification de votre session/).length).toBeGreaterThan(0);
    expect(screen.queryByText('Page de connexion')).not.toBeInTheDocument();
    expect(screen.queryByText('Contenu privé')).not.toBeInTheDocument();
  });

  it('affiche l’écran « compte suspendu » au lieu du contenu privé', () => {
    useSessionStore.getState().definirSession('faux_jeton', {
      id: '2',
      telephone: '+237690000099',
      nom: 'Suspendu',
      role: 'acheteur',
      statutCompte: 'suspendu',
    });

    render(
      <MemoryRouter initialEntries={['/profil']}>
        <Routes>
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

    expect(screen.getByTestId('ecran-suspendu')).toBeInTheDocument();
    expect(screen.queryByText('Contenu privé')).not.toBeInTheDocument();
  });

  it('affiche l’écran « compte en attente » pour un ingénieur non validé (D-13)', () => {
    useSessionStore.getState().definirSession('faux_jeton', {
      id: '3',
      telephone: '+237690000004',
      nom: 'Nadia',
      role: 'ingenieur_agronome',
      statutCompte: 'en_attente_validation',
    });

    render(
      <MemoryRouter initialEntries={['/profil']}>
        <Routes>
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

    expect(screen.getByTestId('ecran-attente')).toBeInTheDocument();
  });

  it('laisse un compte en attente atteindre une route autorisée (ING-02, D-13)', () => {
    useSessionStore.getState().definirSession('faux_jeton', {
      id: '3',
      telephone: '+237690000004',
      nom: 'Nadia',
      role: 'ingenieur_agronome',
      statutCompte: 'en_attente_validation',
    });

    render(
      <MemoryRouter initialEntries={['/ingenieur/profil-pro']}>
        <Routes>
          <Route
            path="/ingenieur/profil-pro"
            element={
              <RouteProtegee rolesAutorises={['ingenieur_agronome']} autoriserEnAttente>
                <div>Profil professionnel</div>
              </RouteProtegee>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Profil professionnel')).toBeInTheDocument();
    expect(screen.queryByTestId('ecran-attente')).not.toBeInTheDocument();
  });

  it('impose le changement de mot de passe quand le drapeau est levé (Q-23)', () => {
    useSessionStore.getState().definirSession('faux_jeton', {
      id: '4',
      telephone: '+237690000005',
      nom: 'Jean',
      role: 'livreur',
      statutCompte: 'actif',
      doitChangerMotDePasse: true,
    });

    render(
      <MemoryRouter initialEntries={['/profil']}>
        <Routes>
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

    expect(screen.getByTestId('ecran-changement-mot-de-passe')).toBeInTheDocument();
    expect(screen.queryByText('Contenu privé')).not.toBeInTheDocument();
  });
});
