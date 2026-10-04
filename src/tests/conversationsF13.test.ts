import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * F-13 — service du chat (conversations, messages, blocage, ticket WS) et
 * pièce jointe temps réel : traduction des codes d'erreur propres au chat,
 * clés d'idempotence, dérivations d'URL, appels des routes via le client
 * openapi-fetch simulé, et file d'attente hors ligne (Q-46d).
 */

const fetchMock = vi.hoisted(() => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PUT: vi.fn(),
  PATCH: vi.fn(),
  DELETE: vi.fn(),
}));

vi.mock('@/services/api/client', async () => {
  const reel =
    await vi.importActual<typeof import('@/services/api/client')>('@/services/api/client');
  return { ...reel, apiClient: fetchMock };
});

const signalementMock = vi.hoisted(() => vi.fn());
vi.mock('@/services/api/litiges', () => ({
  creerSignalement: signalementMock,
}));

import { ErreurApi } from '@/services/api/client';
import { CODE_ERREUR_RESEAU } from '@/services/api/auth';
import {
  bloquer,
  creerConversation,
  debloquer,
  demanderTicketWs,
  envoyerMessage,
  genererIdClient,
  listerConversations,
  messageErreurConversations,
  obtenirConversation,
  signalerMessage,
} from '@/services/api/conversations';
import { deriverUrlWs } from '@/services/tempsReelContext';
import {
  creerDepotMemoire,
  empiler,
  lister,
  vidanger,
  type MessageEnAttente,
} from '@/services/fileAttente';

function item(id: string): MessageEnAttente {
  return { conversationId: 'conv1', corps: { contenu: id, id_client: id } };
}

describe('messageErreurConversations (codes SPEC-10)', () => {
  it('traduit le blocage, le message vide, la conversation et le ticket', () => {
    expect(messageErreurConversations(new ErreurApi('blocage_actif', 'x', 403))).toContain(
      'bloqué'
    );
    expect(messageErreurConversations(new ErreurApi('message_vide', 'x', 422))).toContain(
      'pièce jointe'
    );
    expect(
      messageErreurConversations(new ErreurApi('conversation_introuvable', 'x', 404))
    ).toContain('participant');
    expect(messageErreurConversations(new ErreurApi('ticket_invalide', 'x', 4001))).toContain(
      'Reconnexion'
    );
  });

  it('non-ErreurApi (réseau) → message générique de connexion', () => {
    expect(messageErreurConversations(new Error('panne'))).toContain('connexion');
  });
});

describe('genererIdClient (clé d’idempotence)', () => {
  it('produit un identifiant non vide et distinct à chaque appel', () => {
    const a = genererIdClient();
    const b = genererIdClient();
    expect(a).not.toBe('');
    expect(a).not.toBe(b);
  });
});

describe('deriverUrlWs', () => {
  it('dérive ws:// et wss:// depuis l’origine HTTP, avec /ws', () => {
    expect(deriverUrlWs('http://localhost:8000')).toBe('ws://localhost:8000/ws');
    expect(deriverUrlWs('https://api.agrisens.cm/')).toBe('wss://api.agrisens.cm/ws');
  });
});

describe('appels API conversations (client simulé)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('listerConversations GET /conversations/', async () => {
    fetchMock.GET.mockResolvedValue({ data: { elements: [], total: 0 }, error: undefined });
    const res = await listerConversations();
    expect(res.elements).toEqual([]);
    expect(fetchMock.GET.mock.calls[0]![0]).toBe('/api/v1/conversations/');
  });

  it('obtenirConversation passe l’identifiant en chemin', async () => {
    fetchMock.GET.mockResolvedValue({ data: { id: 'c1' }, error: undefined });
    await obtenirConversation('c1');
    const [chemin, options] = fetchMock.GET.mock.calls[0] as [
      string,
      { params: { path: unknown } },
    ];
    expect(chemin).toBe('/api/v1/conversations/{id}/');
    expect(options.params.path).toEqual({ id: 'c1' });
  });

  it('creerConversation POST /conversations/ avec le rattachement', async () => {
    fetchMock.POST.mockResolvedValue({ data: { id: 'c1' }, error: undefined });
    await creerConversation({ commande_id: 'cmd1' });
    const [, options] = fetchMock.POST.mock.calls[0] as [string, { body: unknown }];
    expect(options.body).toEqual({ commande_id: 'cmd1' });
  });

  it('envoyerMessage porte le signal et le corps idempotent', async () => {
    fetchMock.POST.mockResolvedValue({ data: { id: 'm1' }, error: undefined });
    const signal = new AbortController().signal;
    await envoyerMessage('c1', { contenu: 'bonjour', id_client: 'k1' }, signal);
    const [chemin, options] = fetchMock.POST.mock.calls[0] as [
      string,
      { params: { path: unknown }; body: unknown; signal: unknown },
    ];
    expect(chemin).toBe('/api/v1/conversations/{id}/messages/');
    expect(options.params.path).toEqual({ id: 'c1' });
    expect(options.body).toEqual({ contenu: 'bonjour', id_client: 'k1' });
    expect(options.signal).toBe(signal);
  });

  it('bloquer POST /blocages/ ; debloquer DELETE /blocages/{id}', async () => {
    fetchMock.POST.mockResolvedValue({ data: { id: 'b1' }, error: undefined });
    await bloquer('u2');
    expect(fetchMock.POST.mock.calls[0]![0]).toBe('/api/v1/blocages/');
    fetchMock.DELETE.mockResolvedValue({ data: undefined, error: undefined });
    await debloquer('u2');
    const [chemin, options] = fetchMock.DELETE.mock.calls[0] as [
      string,
      { params: { path: unknown } },
    ];
    expect(chemin).toBe('/api/v1/blocages/{utilisateur_id}/');
    expect(options.params.path).toEqual({ utilisateur_id: 'u2' });
  });

  it('demanderTicketWs lit le dictionnaire brut {ticket, expire_dans}', async () => {
    fetchMock.POST.mockResolvedValue({
      data: { ticket: 'abc', expire_dans: 30 },
      error: undefined,
    });
    const ticket = await demanderTicketWs();
    expect(ticket).toEqual({ ticket: 'abc', expire_dans: 30 });
    expect(fetchMock.POST.mock.calls[0]![0]).toBe('/api/v1/ws/ticket/');
  });

  it('signalerMessage réutilise la file litiges avec cible « message »', async () => {
    signalementMock.mockResolvedValue({});
    await signalerMessage('m1', 'Contenu abusif', 'trop agressif');
    expect(signalementMock).toHaveBeenCalledWith({
      cible_type: 'message',
      cible_id: 'm1',
      motif: 'Contenu abusif',
      description: 'trop agressif',
    });
  });

  it('propage blocage_actif (403) remonté par le backend', async () => {
    fetchMock.POST.mockResolvedValue({
      data: undefined,
      error: new ErreurApi('blocage_actif', 'Bloqué.', 403),
    });
    const erreur = await envoyerMessage('c1', { contenu: 'x', id_client: 'k' }).catch((e) => e);
    expect(erreur).toBeInstanceOf(ErreurApi);
    expect((erreur as ErreurApi).code).toBe('blocage_actif');
  });
});

describe('file d’attente hors ligne (vidanger)', () => {
  // Les tests n’utilisent que des MessageEnAttente ; raccourci typé.
  const messagesEnAttente = (depot: ReturnType<typeof creerDepotMemoire>) =>
    lister(depot) as MessageEnAttente[];

  it('empiler déduplique par id_client et préserve l’ordre', () => {
    const depot = creerDepotMemoire();
    empiler(depot, item('a'));
    empiler(depot, item('b'));
    empiler(depot, item('a')); // doublon ignoré
    expect(messagesEnAttente(depot).map((i) => i.corps.id_client)).toEqual(['a', 'b']);
  });

  it('vidanger envoie tout et vide la file', async () => {
    const depot = creerDepotMemoire();
    empiler(depot, item('a'));
    empiler(depot, item('b'));
    const envoyes: string[] = [];
    const n = await vidanger(
      depot,
      async (i) => {
        envoyes.push((i as MessageEnAttente).corps.id_client as string);
      },
      () => false
    );
    expect(n).toBe(2);
    expect(envoyes).toEqual(['a', 'b']);
    expect(lister(depot)).toHaveLength(0);
  });

  it('sur erreur réseau, conserve le message fautif et le reste de la file', async () => {
    const depot = creerDepotMemoire();
    empiler(depot, item('a'));
    empiler(depot, item('b'));
    const erreurReseau = new ErreurApi(CODE_ERREUR_RESEAU, 'x', 0);
    const n = await vidanger(
      depot,
      async (i) => {
        if ((i as MessageEnAttente).corps.id_client === 'b') throw erreurReseau;
      },
      (e) => e instanceof ErreurApi && e.code === CODE_ERREUR_RESEAU
    );
    expect(n).toBe(1); // 'a' parti, 'b' reste
    expect(messagesEnAttente(depot).map((i) => i.corps.id_client)).toEqual(['b']);
  });

  it('sur erreur métier définitive, abandonne le message sans bloquer la suite', async () => {
    const depot = creerDepotMemoire();
    empiler(depot, item('a'));
    empiler(depot, item('b'));
    const n = await vidanger(
      depot,
      async (i) => {
        if ((i as MessageEnAttente).corps.id_client === 'a')
          throw new ErreurApi('blocage_actif', 'x', 403);
      },
      (e) => e instanceof ErreurApi && e.code === CODE_ERREUR_RESEAU
    );
    expect(n).toBe(1); // 'a' abandonné (non compté), 'b' envoyé
    expect(lister(depot)).toHaveLength(0);
  });
});
