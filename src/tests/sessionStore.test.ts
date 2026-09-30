/**
 * Tests unitaires du store de session (prompt F-02 frontend point 7) :
 * mapping API → session, transitions d'état et non-pérennisation du
 * jeton (Q-25 : jamais dans localStorage ni sessionStorage).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useSessionStore, mapperUtilisateur, type UtilisateurApi } from '@/stores/session';

function utilisateurApi(surcharges: Partial<UtilisateurApi> = {}): UtilisateurApi {
  return {
    id: 'u-1',
    nom: 'Paul Mbarga',
    telephone: '+237690000001',
    email: 'paul@agrisens.cm',
    role: 'agriculteur',
    statut_compte: 'actif',
    region: 'Littoral',
    doit_changer_mot_de_passe: false,
    reinitialisation_demandee_le: null,
    derniere_connexion_le: null,
    cree_le: '2026-01-01T00:00:00Z',
    ...surcharges,
  };
}

describe('mapperUtilisateur', () => {
  it('convertit snake_case API en camelCase session', () => {
    const session = mapperUtilisateur(utilisateurApi());
    expect(session).toEqual({
      id: 'u-1',
      telephone: '+237690000001',
      email: 'paul@agrisens.cm',
      nom: 'Paul Mbarga',
      role: 'agriculteur',
      statutCompte: 'actif',
      region: 'Littoral',
      doitChangerMotDePasse: false,
    });
  });

  it('conserve le drapeau de changement obligatoire de mot de passe', () => {
    const session = mapperUtilisateur(utilisateurApi({ doit_changer_mot_de_passe: true }));
    expect(session.doitChangerMotDePasse).toBe(true);
  });
});

describe('store de session', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    useSessionStore.getState().deconnecter();
  });

  it('definirSession ouvre la session et marque l’initialisation', () => {
    const utilisateur = mapperUtilisateur(utilisateurApi());
    useSessionStore.getState().definirSession('jeton-acces', utilisateur);

    const etat = useSessionStore.getState();
    expect(etat.token).toBe('jeton-acces');
    expect(etat.utilisateur?.nom).toBe('Paul Mbarga');
    expect(etat.estConnecte).toBe(true);
    expect(etat.estInitialise).toBe(true);
  });

  it('definirJeton remplace le jeton sans toucher au profil', () => {
    const utilisateur = mapperUtilisateur(utilisateurApi());
    useSessionStore.getState().definirSession('jeton-1', utilisateur);
    useSessionStore.getState().definirJeton('jeton-2');

    const etat = useSessionStore.getState();
    expect(etat.token).toBe('jeton-2');
    expect(etat.utilisateur).toEqual(utilisateur);
  });

  it('definirUtilisateur met à jour le profil après PATCH moi, jeton inchangé', () => {
    useSessionStore.getState().definirSession('jeton-1', mapperUtilisateur(utilisateurApi()));
    useSessionStore
      .getState()
      .definirUtilisateur(mapperUtilisateur(utilisateurApi({ nom: 'Paul M.' })));

    const etat = useSessionStore.getState();
    expect(etat.utilisateur?.nom).toBe('Paul M.');
    expect(etat.token).toBe('jeton-1');
  });

  it('deconnecter vide token et profil mais garde estInitialise vrai', () => {
    useSessionStore.getState().definirSession('jeton-1', mapperUtilisateur(utilisateurApi()));
    useSessionStore.getState().deconnecter();

    const etat = useSessionStore.getState();
    expect(etat.token).toBeNull();
    expect(etat.utilisateur).toBeNull();
    expect(etat.estConnecte).toBe(false);
    expect(etat.estInitialise).toBe(true); // la vérification a bien eu lieu
  });

  it('le jeton n’est jamais écrit dans les stockages persistants (Q-25)', () => {
    useSessionStore.getState().definirSession('jeton-secret', mapperUtilisateur(utilisateurApi()));

    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });
});
