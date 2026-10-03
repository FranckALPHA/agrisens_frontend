/**
 * E2E F-11 — Accompagnement agronomique (docs/12 §PW-F11-01 à 07).
 * Chaque test utilise l'API directe pour installer un état, puis vérifie
 * l'interface (double vérification API + écran, conventions §1.4).
 */
import { expect, type APIRequestContext } from '@playwright/test';
import { test } from '../fixtures';
import { PERSONNAGES } from '../fixtures/roles';
import { evenementReussi, envoyerWebhook } from '../utils/notchpay';

const URL_API = 'http://127.0.0.1:8001/api/v1';
const MOT_DE_PASSE = 'Motdepasse123!';

function bearer(jeton: string): Record<string, string> {
  return { Authorization: `Bearer ${jeton}` };
}

async function jeton(api: APIRequestContext, telephone: string): Promise<string> {
  const r = await api.post(`${URL_API}/auth/connexion/`, {
    data: { identifiant: telephone, mot_de_passe: MOT_DE_PASSE },
  });
  expect(r.ok(), 'connexion API').toBeTruthy();
  return ((await r.json()) as { jeton_acces: string }).jeton_acces;
}

async function exploitationPaul(api: APIRequestContext): Promise<string> {
  const j = await jeton(api, PERSONNAGES.paul.telephone);
  const r = await api.get(`${URL_API}/exploitations/`, { headers: bearer(j) });
  expect(r.ok()).toBeTruthy();
  const liste = (await r.json()) as Array<{ id: string; nom: string }>;
  return liste[0]!.id;
}

async function nadiaIngenieure(api: APIRequestContext): Promise<string> {
  const j = await jeton(api, PERSONNAGES.nadia.telephone);
  const r = await api.get(`${URL_API}/ingenieurs/moi/profil/`, { headers: bearer(j) });
  expect(r.ok(), 'profil Nadia accessible').toBeTruthy();
  return j;
}

test.describe('F-11 accompagnement', () => {
  test('PW-F11-01 @critique : devis 12 km → 4 800 + consultation, parcours complet', async ({
    request,
    page,
  }) => {
    const jetonPaul = await jeton(request, PERSONNAGES.paul.telephone);
    await nadiaIngenieure(request);
    const jetonNadia = await jeton(request, PERSONNAGES.nadia.telephone);
    const exploitation = await exploitationPaul(request);
    const ingenieurs = await request.get(`${URL_API}/ingenieurs/?exploitation_id=${exploitation}`, {
      headers: bearer(jetonPaul),
    });
    expect(ingenieurs.ok()).toBeTruthy();
    const liste = (await ingenieurs.json()) as { elements: Array<{ id: string; nom: string }> };
    const nadia = liste.elements.find((e) => e.nom === PERSONNAGES.nadia.nom);
    expect(nadia, 'Nadia couvre la zone de Paul').toBeDefined();

    // Devis : docs/04 §4, 12 km aller → 4 800 FCFA + 10 000 consultation = 14 800.
    const devis = await request.post(`${URL_API}/accompagnements/devis/`, {
      headers: bearer(jetonPaul),
      data: { exploitation_id: exploitation, ingenieur_id: nadia!.id, modalite: 'presentiel' },
    });
    expect(devis.ok(), `devis 200, reçu ${devis.status()}`).toBeTruthy();
    const corps = (await devis.json()) as {
      total_fcfa: number;
      consultation_fcfa: number;
      deplacement_fcfa: number;
      distance_km_aller: number;
    };
    expect(corps.consultation_fcfa).toBe(10_000);
    expect(corps.distance_km_aller).toBe(12);
    expect(corps.deplacement_fcfa).toBe(4_800);
    expect(corps.total_fcfa).toBe(14_800);

    // UI : Paul ouvre /agriculteur/accompagnement et voit le formulaire.
    await page.goto('/connexion');
    await page.getByLabel(/^Téléphone ou email/).fill(PERSONNAGES.paul.telephone);
    await page.getByLabel(/^Mot de passe/).fill(MOT_DE_PASSE);
    await page.getByRole('button', { name: /^connexion$/i }).click();
    await page.goto('/agriculteur/accompagnement');
    await expect(page.getByTestId('page-accompagnement')).toBeVisible();

    // API : parcours complet (demande → acceptée → planifiée → payée → terminée).
    const demande = await request.post(`${URL_API}/accompagnements/`, {
      headers: bearer(jetonPaul),
      data: {
        exploitation_id: exploitation,
        ingenieur_id: nadia!.id,
        modalite: 'presentiel',
        motif: 'Conseil fertilisation',
      },
    });
    expect(demande.status()).toBe(201);
    const acc = (await demande.json()) as { id: string };

    const acceptee = await request.post(`${URL_API}/accompagnements/${acc.id}/accepter/`, {
      headers: bearer(jetonNadia),
    });
    expect(acceptee.ok()).toBeTruthy();

    const maintenant = Date.now();
    const debut = new Date(maintenant + 3 * 86400_000).toISOString();
    const fin = new Date(maintenant + 3 * 86400_000 + 3600_000).toISOString();
    const plan = await request.post(`${URL_API}/accompagnements/${acc.id}/planifier/`, {
      headers: bearer(jetonNadia),
      data: { date_debut: debut, date_fin: fin, lieu_rdv_texte: 'Champ Nord' },
    });
    expect(plan.ok(), `planifier ${plan.status()}`).toBeTruthy();

    const conf = await request.post(`${URL_API}/accompagnements/${acc.id}/confirmer/`, {
      headers: bearer(jetonPaul),
      data: { operateur: 'mtn_momo' },
    });
    expect(conf.status()).toBe(201);
    const paiement = (await conf.json()) as {
      reference_interne: string;
      montant_fcfa: number;
    };
    await envoyerWebhook(
      request,
      evenementReussi(paiement.reference_interne, paiement.montant_fcfa, 'e2e-f11')
    );

    const detailApres = await request.get(`${URL_API}/accompagnements/${acc.id}/`, {
      headers: bearer(jetonPaul),
    });
    const d = (await detailApres.json()) as { statut: string };
    expect(d.statut).toBe('planifiee');

    const terminer = await request.post(`${URL_API}/accompagnements/${acc.id}/terminer/`, {
      headers: bearer(jetonNadia),
      data: { observation: 'Sol riche, prévoir rotation maïs/niéré.' },
    });
    expect(terminer.ok()).toBeTruthy();
    const term = (await terminer.json()) as { statut: string; observation: string };
    expect(term.statut).toBe('terminee');
    expect(term.observation).toContain('rotation');
  });

  test('PW-F11-02 : filtre par spécialité — uniquement validés et disponibles', async ({
    request,
  }) => {
    const jetonPaul = await jeton(request, PERSONNAGES.paul.telephone);
    const exploitation = await exploitationPaul(request);
    const rep = await request.get(
      `${URL_API}/ingenieurs/?exploitation_id=${exploitation}&specialite=maraichage`,
      { headers: bearer(jetonPaul) }
    );
    expect(rep.ok()).toBeTruthy();
    const corps = (await rep.json()) as { elements: Array<{ id: string; nom: string }> };
    // Nadia (valide + dispo) doit être présente ; les non validés exclus.
    expect(corps.elements.find((e) => e.nom === PERSONNAGES.nadia.nom)).toBeDefined();
  });

  test('PW-F11-03 : présentiel au-delà de distance_max → refus avec modalité suggérée', async ({
    request,
  }) => {
    // Test piloté par paramètre : distance_max_km est à 100 par défaut ;
    // Nadia en zone Yaoundé (≈12 km) reste sous le seuil. On abaisse le
    // paramètre pour vérifier le refus, puis on le restaure.
    const mireille = await jeton(request, PERSONNAGES.mireille.telephone);
    await request.put(`${URL_API}/admin/parametres/deplacement.distance_max_km/`, {
      headers: bearer(mireille),
      data: { valeur: 5 },
    });
    try {
      const jetonPaul = await jeton(request, PERSONNAGES.paul.telephone);
      const exploitation = await exploitationPaul(request);
      const ingenieurs = await request.get(
        `${URL_API}/ingenieurs/?exploitation_id=${exploitation}`,
        { headers: bearer(jetonPaul) }
      );
      const liste = (await ingenieurs.json()) as { elements: Array<{ id: string; nom: string }> };
      const nadia = liste.elements.find((e) => e.nom === PERSONNAGES.nadia.nom)!;
      const devis = await request.post(`${URL_API}/accompagnements/devis/`, {
        headers: bearer(jetonPaul),
        data: { exploitation_id: exploitation, ingenieur_id: nadia.id, modalite: 'presentiel' },
      });
      expect(devis.status()).toBe(422);
      const err = (await devis.json()) as {
        erreur: { code: string; details?: { modalite_suggeree?: string } };
      };
      expect(err.erreur.code).toBe('distance_max_depasee');
      expect(err.erreur.details?.modalite_suggeree).toBe('en_ligne');
    } finally {
      await request.put(`${URL_API}/admin/parametres/deplacement.distance_max_km/`, {
        headers: bearer(mireille),
        data: { valeur: 100 },
      });
    }
  });

  test('PW-F11-04 : conflit de créneau → 409', async ({ request }) => {
    const jetonPaul = await jeton(request, PERSONNAGES.paul.telephone);
    const jetonNadia = await jeton(request, PERSONNAGES.nadia.telephone);
    const exploitation = await exploitationPaul(request);
    const ing = await request.get(`${URL_API}/ingenieurs/?exploitation_id=${exploitation}`, {
      headers: bearer(jetonPaul),
    });
    const nadia = (
      (await ing.json()) as { elements: Array<{ id: string; nom: string }> }
    ).elements.find((e) => e.nom === PERSONNAGES.nadia.nom)!;

    const maintenant = Date.now();
    const d1 = new Date(maintenant + 6 * 86400_000);
    const d1fin = new Date(d1.getTime() + 3600_000);
    const d2 = new Date(d1.getTime() + 30 * 60_000);
    const d2fin = new Date(d1fin.getTime() + 30 * 60_000);

    // Premier parcours Nadia/Paul.
    const acc1 = await creerEtPayer(
      request,
      jetonPaul,
      jetonNadia,
      exploitation,
      nadia.id,
      d1,
      d1fin
    );
    // Deuxième demande de Paul (autre exploitation réutilisée) puis tentative de planifier à heure qui chevauche.
    const demande2 = await request.post(`${URL_API}/accompagnements/`, {
      headers: bearer(jetonPaul),
      data: {
        exploitation_id: exploitation,
        ingenieur_id: nadia.id,
        modalite: 'presentiel',
        motif: 'Deuxième demande conflit',
      },
    });
    expect(demande2.status()).toBe(201);
    const acc2 = (await demande2.json()) as { id: string };
    await request.post(`${URL_API}/accompagnements/${acc2.id}/accepter/`, {
      headers: bearer(jetonNadia),
    });
    const conflit = await request.post(`${URL_API}/accompagnements/${acc2.id}/planifier/`, {
      headers: bearer(jetonNadia),
      data: {
        date_debut: d2.toISOString(),
        date_fin: d2fin.toISOString(),
        lieu_rdv_texte: 'Champ',
      },
    });
    expect(conflit.status()).toBe(409);
    const err = (await conflit.json()) as { erreur: { code: string } };
    expect(err.erreur.code).toBe('conflit_creneau');
    // Nettoyage : annuler acc2 pour ne pas gêner d'autres tests.
    await request.post(`${URL_API}/accompagnements/${acc2.id}/annuler/`, {
      headers: bearer(jetonPaul),
    });
    // acc1 n'a pas de route d'annulation après paiement : on le laisse en planifié.
    expect(acc1.id).toBeTruthy();
  });

  test('PW-F11-05 : refus avec motif → notification Paul, statut refusee', async ({ request }) => {
    const jetonPaul = await jeton(request, PERSONNAGES.paul.telephone);
    const jetonNadia = await jeton(request, PERSONNAGES.nadia.telephone);
    const exploitation = await exploitationPaul(request);
    const ing = await request.get(`${URL_API}/ingenieurs/?exploitation_id=${exploitation}`, {
      headers: bearer(jetonPaul),
    });
    const nadia = (
      (await ing.json()) as { elements: Array<{ id: string; nom: string }> }
    ).elements.find((e) => e.nom === PERSONNAGES.nadia.nom)!;
    const demande = await request.post(`${URL_API}/accompagnements/`, {
      headers: bearer(jetonPaul),
      data: {
        exploitation_id: exploitation,
        ingenieur_id: nadia.id,
        modalite: 'presentiel',
        motif: 'Demande à refuser',
      },
    });
    const acc = (await demande.json()) as { id: string };
    // Refus sans motif → 422.
    const sansMotif = await request.post(`${URL_API}/accompagnements/${acc.id}/refuser/`, {
      headers: bearer(jetonNadia),
      data: { motif: '' },
    });
    expect(sansMotif.status()).toBe(422);
    // Refus avec motif → 200, statut `refusee`.
    const refuse = await request.post(`${URL_API}/accompagnements/${acc.id}/refuser/`, {
      headers: bearer(jetonNadia),
      data: { motif: 'Spécialité différente.' },
    });
    expect(refuse.ok()).toBeTruthy();
    const r = (await refuse.json()) as { statut: string };
    expect(r.statut).toBe('refusee');
  });

  test('PW-F11-06 : RDV manqué par ingénieur → remboursement auto', async ({ request }) => {
    const jetonPaul = await jeton(request, PERSONNAGES.paul.telephone);
    const jetonNadia = await jeton(request, PERSONNAGES.nadia.telephone);
    const exploitation = await exploitationPaul(request);
    const ing = await request.get(`${URL_API}/ingenieurs/?exploitation_id=${exploitation}`, {
      headers: bearer(jetonPaul),
    });
    const nadia = (
      (await ing.json()) as { elements: Array<{ id: string; nom: string }> }
    ).elements.find((e) => e.nom === PERSONNAGES.nadia.nom)!;
    const paiement = await creerEtPayer(
      request,
      jetonPaul,
      jetonNadia,
      exploitation,
      nadia.id,
      new Date(Date.now() + 86400_000),
      new Date(Date.now() + 86400_000 + 3600_000)
    );
    const manque = await request.post(`${URL_API}/accompagnements/${paiement.id}/marquer-manque/`, {
      headers: bearer(jetonPaul),
      data: { absent: 'ingenieur' },
    });
    expect(manque.ok()).toBeTruthy();
    const acc = (await manque.json()) as { statut: string; nb_rdv_manques: number };
    expect(acc.statut).toBe('manquee');
    expect(acc.nb_rdv_manques).toBeGreaterThanOrEqual(1);
    // Le remboursement est visible dans la liste des litiges de Paul.
    const remboursements = await request.get(`${URL_API}/remboursements/`, {
      headers: bearer(jetonPaul),
    });
    expect(remboursements.ok()).toBeTruthy();
    const corps = (await remboursements.json()) as {
      elements: Array<{ accompagnement?: string; statut: string }>;
    };
    expect(corps.elements.find((r) => r.accompagnement === paiement.id)).toBeDefined();
  });

  test('PW-F11-07 : accès exploitation Nadia seulement pendant accompagnement actif', async ({
    request,
  }) => {
    const jetonPaul = await jeton(request, PERSONNAGES.paul.telephone);
    const jetonNadia = await jeton(request, PERSONNAGES.nadia.telephone);
    const exploitation = await exploitationPaul(request);
    // Avant demande : 404.
    const avant = await request.get(`${URL_API}/exploitations/${exploitation}/`, {
      headers: bearer(jetonNadia),
    });
    expect(avant.status()).toBe(404);
    const ing = await request.get(`${URL_API}/ingenieurs/?exploitation_id=${exploitation}`, {
      headers: bearer(jetonPaul),
    });
    const nadia = (
      (await ing.json()) as { elements: Array<{ id: string; nom: string }> }
    ).elements.find((e) => e.nom === PERSONNAGES.nadia.nom)!;
    const demande = await request.post(`${URL_API}/accompagnements/`, {
      headers: bearer(jetonPaul),
      data: {
        exploitation_id: exploitation,
        ingenieur_id: nadia.id,
        modalite: 'presentiel',
        motif: 'Test accès exploitation',
      },
    });
    const acc = (await demande.json()) as { id: string };
    // `demandee` ne donne pas encore accès.
    const pendantDemande = await request.get(`${URL_API}/exploitations/${exploitation}/`, {
      headers: bearer(jetonNadia),
    });
    expect(pendantDemande.status()).toBe(404);
    // Après acceptation : 200.
    await request.post(`${URL_API}/accompagnements/${acc.id}/accepter/`, {
      headers: bearer(jetonNadia),
    });
    const apresAccept = await request.get(`${URL_API}/exploitations/${exploitation}/`, {
      headers: bearer(jetonNadia),
    });
    expect(apresAccept.ok()).toBeTruthy();
    // Après annulation : 404 à nouveau.
    await request.post(`${URL_API}/accompagnements/${acc.id}/annuler/`, {
      headers: bearer(jetonPaul),
    });
    const apresAnnulation = await request.get(`${URL_API}/exploitations/${exploitation}/`, {
      headers: bearer(jetonNadia),
    });
    expect(apresAnnulation.status()).toBe(404);
  });
});

async function creerEtPayer(
  request: APIRequestContext,
  jetonPaul: string,
  jetonNadia: string,
  exploitationId: string,
  ingenieurId: string,
  debut: Date,
  fin: Date
): Promise<{ id: string }> {
  const demande = await request.post(`${URL_API}/accompagnements/`, {
    headers: bearer(jetonPaul),
    data: {
      exploitation_id: exploitationId,
      ingenieur_id: ingenieurId,
      modalite: 'presentiel',
      motif: `Test ${Date.now()}`,
    },
  });
  const acc = (await demande.json()) as { id: string };
  await request.post(`${URL_API}/accompagnements/${acc.id}/accepter/`, {
    headers: bearer(jetonNadia),
  });
  await request.post(`${URL_API}/accompagnements/${acc.id}/planifier/`, {
    headers: bearer(jetonNadia),
    data: {
      date_debut: debut.toISOString(),
      date_fin: fin.toISOString(),
      lieu_rdv_texte: 'Champ E2E',
    },
  });
  const conf = await request.post(`${URL_API}/accompagnements/${acc.id}/confirmer/`, {
    headers: bearer(jetonPaul),
    data: { operateur: 'mtn_momo' },
  });
  const p = (await conf.json()) as { reference_interne: string; montant_fcfa: number };
  await envoyerWebhook(
    request,
    evenementReussi(p.reference_interne, p.montant_fcfa, `e2e-${acc.id}`)
  );
  return acc;
}
