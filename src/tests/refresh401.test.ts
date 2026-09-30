/**
 * Tests unitaires du rafraîchissement de session sur 401
 * (prompt F-02 frontend point 7). Deux garanties clés :
 * 1. single-flight : des 401 concurrents ne déclenchent QU'UN seul appel à
 *    /auth/rafraichir — deux rotations en parallèle seraient interprétées
 *    comme une réutilisation et révoqueraient toutes les sessions ;
 * 2. le middleware ne rejoue jamais une requête sur les routes publiques
 *    d'authentification (un 401 de connexion = mauvais identifiants).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  rafraichirSessionHttp: vi.fn(),
  deconnecterSession: vi.fn(),
  connecter: vi.fn(),
  inscrire: vi.fn(),
}));

vi.mock('@/services/api/auth', () => ({
  rafraichirSessionHttp: mocks.rafraichirSessionHttp,
  deconnecterSession: mocks.deconnecterSession,
  connecter: mocks.connecter,
  inscrire: mocks.inscrire,
}));

import { rafraichirSession, initialiserSession } from '@/services/sessionService';
import { useSessionStore, mapperUtilisateur, type UtilisateurApi } from '@/stores/session';
import { authMiddleware, definirCrochetRafraichissement, ErreurApi } from '@/services/api/client';

function utilisateurApi(): UtilisateurApi {
  return {
    id: 'u-1',
    nom: 'Paul Mbarga',
    telephone: '+237690000001',
    email: null,
    role: 'agriculteur',
    statut_compte: 'actif',
    region: null,
    doit_changer_mot_de_passe: false,
    reinitialisation_demandee_le: null,
    derniere_connexion_le: null,
    cree_le: '2026-01-01T00:00:00Z',
  };
}

function donneesRefresh(jeton: string) {
  return { jeton_acces: jeton, utilisateur: utilisateurApi(), expire_le: '2026-01-01T00:15:00Z' };
}

// ---------------------------------------------------------------------------
// Fakes minimaux Request / Headers / Response (jsdom ne fournit pas fetch)
// ---------------------------------------------------------------------------

class FakeHeaders {
  private map = new Map<string, string>();
  constructor(init?: FakeHeaders | Record<string, string>) {
    if (init instanceof FakeHeaders) {
      this.map = new Map(init.map);
    } else {
      for (const [cle, valeur] of Object.entries(init ?? {}))
        this.map.set(cle.toLowerCase(), valeur);
    }
  }
  get(cle: string) {
    return this.map.get(cle.toLowerCase()) ?? null;
  }
  set(cle: string, valeur: string) {
    this.map.set(cle.toLowerCase(), valeur);
  }
  has(cle: string) {
    return this.map.has(cle.toLowerCase());
  }
}

class FakeRequest {
  url: string;
  method: string;
  headers: FakeHeaders;
  signal?: unknown;
  constructor(
    input: { url: string; method?: string; headers?: FakeHeaders; signal?: unknown },
    init?: { headers?: FakeHeaders }
  ) {
    this.url = input.url;
    this.method = input.method ?? 'GET';
    this.headers = new FakeHeaders(init?.headers ?? input.headers);
    this.signal = input.signal;
  }
}

function fakeResponse(statut: number, corps?: unknown) {
  return {
    status: statut,
    ok: statut >= 200 && statut < 300,
    clone: () => ({ json: async () => corps }),
  };
}

// Le type du middleware exige des champs internes d'openapi-fetch (schemaPath…)
// inutiles ici : on passe par ces deux lanceurs typés une seule fois.
async function lancerOnReponse(requete: FakeRequest, reponse: unknown): Promise<unknown> {
  const appele = authMiddleware.onResponse;
  if (!appele) throw new Error('middleware non enregistré');
  return appele({ request: requete, response: reponse } as unknown as Parameters<typeof appele>[0]);
}

async function lancerOnRequete(requete: FakeRequest): Promise<unknown> {
  const appele = authMiddleware.onRequest;
  if (!appele) throw new Error('middleware non enregistré');
  return appele({ request: requete } as unknown as Parameters<typeof appele>[0]);
}

describe('sessionService.rafraichirSession (single-flight)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSessionStore.getState().definirSession('jeton-1', mapperUtilisateur(utilisateurApi()));
  });

  it('deux rafraîchissements concurrents ne produisent qu’un seul appel HTTP', async () => {
    let resoudre: ((v: unknown) => void) | undefined;
    mocks.rafraichirSessionHttp.mockImplementation(
      () => new Promise((resolve) => (resoudre = resolve))
    );

    const promesses = [rafraichirSession(), rafraichirSession()];
    resoudre?.(donneesRefresh('jeton-2'));
    const resultats = await Promise.all(promesses);

    expect(mocks.rafraichirSessionHttp).toHaveBeenCalledTimes(1);
    expect(resultats).toEqual(['jeton-2', 'jeton-2']);
    expect(useSessionStore.getState().token).toBe('jeton-2');
  });

  it('un jeton de rafraîchissement mort déconnecte la session', async () => {
    mocks.rafraichirSessionHttp.mockResolvedValue(null);

    await expect(rafraichirSession()).resolves.toBeNull();
    const etat = useSessionStore.getState();
    expect(etat.estConnecte).toBe(false);
    expect(etat.token).toBeNull();
  });

  it('une erreur réseau ne déconnecte pas : le jeton local reste utilisable', async () => {
    mocks.rafraichirSessionHttp.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(rafraichirSession()).resolves.toBe('jeton-1');
    expect(useSessionStore.getState().estConnecte).toBe(true);
  });

  it('initialiserSession ne rappelle pas l’API si la session est déjà ouverte', async () => {
    await initialiserSession();
    expect(mocks.rafraichirSessionHttp).not.toHaveBeenCalled();
    expect(useSessionStore.getState().estInitialise).toBe(true);
  });
});

describe('middleware 401 du client API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('Request', FakeRequest as unknown as typeof Request);
    vi.stubGlobal('Headers', FakeHeaders as unknown as typeof Headers);
  });

  it('rejoue une requête privée avec le nouveau jeton après un 401', async () => {
    const crochet = vi.fn().mockResolvedValue('jeton-neuf');
    definirCrochetRafraichissement(crochet);
    const reponseRejouee = fakeResponse(200, { id: 'u-1' });
    const fetchMock = vi.fn().mockResolvedValue(reponseRejouee);
    vi.stubGlobal('fetch', fetchMock);

    const requete = new FakeRequest({
      url: 'http://api/api/v1/utilisateurs/moi/',
      headers: new FakeHeaders({ authorization: 'Bearer expire' }),
    });
    const resultat = await lancerOnReponse(
      requete,
      fakeResponse(401, {
        erreur: { code: 'session_expiree', message: 'Session expirée.' },
      })
    );

    expect(crochet).toHaveBeenCalledTimes(1);
    expect(resultat).toBe(reponseRejouee);
    const rejouee = fetchMock.mock.calls[0]?.[0] as unknown as FakeRequest;
    expect(rejouee.headers.get('authorization')).toBe('Bearer jeton-neuf');
  });

  it('ne déclenche jamais de rafraîchissement sur les routes publiques d’auth', async () => {
    const crochet = vi.fn().mockResolvedValue('jeton-neuf');
    definirCrochetRafraichissement(crochet);
    vi.stubGlobal('fetch', vi.fn());

    const requete = new FakeRequest({ url: 'http://api/api/v1/auth/connexion/' });
    await expect(
      lancerOnReponse(
        requete,
        fakeResponse(401, {
          erreur: { code: 'identifiants_invalides', message: 'Identifiants incorrects.' },
        })
      )
    ).rejects.toThrow(ErreurApi);

    expect(crochet).not.toHaveBeenCalled();
  });

  it('sans nouveau jeton disponible, l’erreur 401 est propagée sans rejouer', async () => {
    definirCrochetRafraichissement(async () => null);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const requete = new FakeRequest({ url: 'http://api/api/v1/utilisateurs/moi/' });
    const erreur = await lancerOnReponse(
      requete,
      fakeResponse(401, {
        erreur: { code: 'session_invalide', message: 'Session invalide.' },
      })
    ).catch((e: unknown) => e);

    expect(erreur).toBeInstanceOf(ErreurApi);
    expect((erreur as ErreurApi).code).toBe('session_invalide');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('onRequest injecte le jeton du store et l’en-tête Accept JSON', async () => {
    useSessionStore.getState().definirSession('jeton-stock', mapperUtilisateur(utilisateurApi()));
    definirCrochetRafraichissement(async () => null);

    // signal fourni pour que le middleware n'installe pas de timer réel.
    const requete = new FakeRequest({ url: 'http://api/api/v1/utilisateurs/moi/', signal: {} });
    await lancerOnRequete(requete);

    expect(requete.headers.get('authorization')).toBe('Bearer jeton-stock');
    expect(requete.headers.get('accept')).toBe('application/json');
  });
});
