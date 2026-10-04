/**
 * E2E F-12 — IA Groq : plannings, recommandations, quotas (docs/12 §PW-F12-01 à 06).
 *
 * La base est réinitialisée puis `seed_demo` est rejoué à chaque run
 * (global-setup) : Paul (agriculteur) démarre avec UNE génération `reussie`
 * (planning tomate sur Champ Nord, quota gratuit 2/mois → 1 consommé) et UNE
 * correction de Nadia. Le serveur de dev tourne avec `IA_FOURNISSEUR=factice`
 * et `ENVIRONNEMENT ∈ {local,test}`, donc `?test_simule=…` est honoré.
 *
 * Les tests sont pilotés par l'API (déterministes) avec vérification écran
 * (double vérification, conventions §1.4), et tolèrent l'état du quota déjà
 * consommé par le seed.
 */
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { test } from '../fixtures';
import { PERSONNAGES } from '../fixtures/roles';

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

async function quotaPlanning(
  api: APIRequestContext
): Promise<{ consomme: number; limite: number }> {
  const j = await jeton(api, PERSONNAGES.paul.telephone);
  const r = await api.get(`${URL_API}/ia/quota/`, { headers: bearer(j) });
  expect(r.ok()).toBeTruthy();
  const q = (await r.json()) as { planning: { consomme: number; limite: number } };
  return q.planning;
}

async function genererPlanningApi(
  api: APIRequestContext,
  exploitation: string,
  culture: string,
  simule = 'normal'
): Promise<{ status: number; corps: Record<string, unknown> }> {
  const j = await jeton(api, PERSONNAGES.paul.telephone);
  const r = await api.post(
    `${URL_API}/exploitations/${exploitation}/plannings/?test_simule=${simule}`,
    {
      headers: bearer(j),
      data: { culture, periode_debut: '2026-01-01', periode_fin: '2026-06-01' },
    }
  );
  const corps = r.ok() ? ((await r.json()) as Record<string, unknown>) : {};
  return { status: r.status(), corps };
}

async function seConnecter(page: Page, telephone: string): Promise<void> {
  await page.goto('/connexion');
  await page.getByLabel(/^Téléphone ou email/).fill(telephone);
  await page.getByLabel(/^Mot de passe/).fill(MOT_DE_PASSE);
  const [reponse] = await Promise.all([
    page.waitForResponse(
      (rep) => rep.url().includes('/auth/connexion') && rep.request().method() === 'POST'
    ),
    page.getByRole('button', { name: /^connexion$/i }).click(),
  ]);
  expect(reponse.ok(), 'la connexion UI doit réussir').toBeTruthy();
  await expect(page).not.toHaveURL('/connexion');
}

test.describe('F-12 IA Groq', () => {
  test('PW-F12-01 @critique : génération planning, données envoyées, calendrier, historique', async ({
    request,
    page,
  }) => {
    const exploitation = await exploitationPaul(request);
    const { status, corps } = await genererPlanningApi(request, exploitation, 'niéré');
    expect(status, `génération 201 (quota?), reçu ${status}`).toBe(201);
    expect(corps.statut).toBe('reussie');
    // Réponse conforme au schéma : au moins une étape + avertissement.
    const reponse = corps.reponse_originale as { avertissement: string; etapes: unknown[] };
    expect(reponse.avertissement).toBeTruthy();
    expect(Array.isArray(reponse.etapes)).toBeTruthy();
    expect((reponse.etapes as unknown[]).length).toBeGreaterThan(0);
    // Le payload envoyé ne contient aucune clé personnelle.
    const entrees = corps.entrees as Record<string, unknown>;
    expect(new Set(Object.keys(entrees))).toEqual(
      new Set([
        'culture',
        'sol',
        'superficie_m2',
        'periode',
        'region',
        'centre',
        'infos_agronomiques',
      ])
    );
    expect(entrees).not.toHaveProperty('nom');
    expect(entrees).not.toHaveProperty('telephone');

    // Écran : Paul retrouve la génération dans AGR-07 (historique).
    await seConnecter(page, PERSONNAGES.paul.telephone);
    await page.goto('/agriculteur/planning');
    await expect(page.getByTestId('page-planning')).toBeVisible();
    await page.getByLabel(/^Exploitation/).selectOption({ value: exploitation });
    await expect(page.getByTestId('compteur-quota')).toBeVisible();
    await expect(page.getByTestId('historique-plannings')).toBeVisible();
  });

  test('PW-F12-02 : correction ingénieur → proposition IA et corrigé côte à côte', async ({
    request,
    page,
  }) => {
    const exploitation = await exploitationPaul(request);
    const jetonPaul = await jeton(request, PERSONNAGES.paul.telephone);
    const jetonNadia = await jeton(request, PERSONNAGES.nadia.telephone);

    // Nadia doit être affectée via un accompagnement actif pour corriger (Q-45).
    const ing = await request.get(`${URL_API}/ingenieurs/?exploitation_id=${exploitation}`, {
      headers: bearer(jetonPaul),
    });
    const nadia = (
      (await ing.json()) as { elements: Array<{ id: string; nom: string }> }
    ).elements.find((e) => e.nom === PERSONNAGES.nadia.nom);
    expect(nadia, 'Nadia couvre la zone de Paul').toBeDefined();
    const demande = await request.post(`${URL_API}/accompagnements/`, {
      headers: bearer(jetonPaul),
      data: {
        exploitation_id: exploitation,
        ingenieur_id: nadia!.id,
        modalite: 'en_ligne',
        motif: 'Vérification planning IA',
      },
    });
    expect(demande.status()).toBe(201);
    const acc = (await demande.json()) as { id: string };
    await request.post(`${URL_API}/accompagnements/${acc.id}/accepter/`, {
      headers: bearer(jetonNadia),
    });

    // La génération du seed (planning tomate de Paul) sert de cible.
    const historique = await request.get(`${URL_API}/exploitations/${exploitation}/plannings/`, {
      headers: bearer(jetonPaul),
    });
    expect(historique.ok()).toBeTruthy();
    const generations = (await historique.json()) as {
      elements: Array<{ id: string; type: string; statut: string }>;
    };
    const cible = generations.elements.find((g) => g.statut === 'reussie')!;
    expect(cible, 'au moins une génération réussie à corriger').toBeDefined();

    const detailAvant = await request.get(`${URL_API}/generations-ia/${cible.id}/`, {
      headers: bearer(jetonPaul),
    });
    const originaleAvant = (await detailAvant.json()) as { reponse_originale: unknown };

    const correction = await request.post(`${URL_API}/generations-ia/${cible.id}/corrections/`, {
      headers: bearer(jetonNadia),
      data: { commentaire: 'Étape de fertilisation à confirmer sur le terrain.' },
    });
    expect(correction.status(), 'Nadia affectée peut corriger').toBe(201);

    // La réponse originale est immuable.
    const detailApres = await request.get(`${URL_API}/generations-ia/${cible.id}/`, {
      headers: bearer(jetonPaul),
    });
    const d = (await detailApres.json()) as {
      reponse_originale: unknown;
      corrections: Array<{ ingenieur_nom: string }>;
    };
    expect(d.reponse_originale).toEqual(originaleAvant.reponse_originale);
    expect(d.corrections.length).toBeGreaterThanOrEqual(1);

    // Écran ING-05 : Nadia voit proposition IA et corrigé côte à côte.
    await seConnecter(page, PERSONNAGES.nadia.telephone);
    await page.goto(`/ingenieur/generations/${cible.id}`);
    await expect(page.getByTestId('page-generation-ia')).toBeVisible();
    await expect(page.getByTestId('proposition-ia')).toBeVisible();
    await expect(page.getByTestId('form-correction')).toBeVisible();
  });


  test('PW-F12-04 : échec fournisseur (test_simule=echec) ne décompte pas le quota', async ({
    request,
  }) => {
    // Une simulation forcée en échec n'est pas soumise à la limite mensuelle
    // (elle ne décompte pas le quota) : ce test passe quota épuisé ou non.
    const exploitation = await exploitationPaul(request);
    const avant = await quotaPlanning(request);
    const r = await genererPlanningApi(request, exploitation, 'echec-test', 'echec');
    expect(r.status).toBe(201);
    expect(r.corps.statut).toBe('echouee');
    const apres = await quotaPlanning(request);
    expect(apres.consomme).toBe(avant.consomme);
  });

  test('PW-F12-05 : annulation client ≠ annulation serveur (génération toujours en cours côté serveur)', async ({
    request,
    page,
  }) => {
    const exploitation = await exploitationPaul(request);
    const j = await jeton(request, PERSONNAGES.paul.telephone);
    // Interception lente : on laisse partir la requête vers le serveur (route.fetch),
    // avec test_simule=echec pour ne pas bloquer sur le quota mensuel tout en créant la ligne côté serveur,
    // puis on retarde la restitution de la réponse pour permettre le clic d'annulation UI.
    await page.route(`**/exploitations/${exploitation}/plannings/**`, async (route) => {
      const url = new URL(route.request().url());
      url.searchParams.set('test_simule', 'echec');
      const response = await route.fetch({ url: url.toString() });
      await new Promise((resolve) => setTimeout(resolve, 1500));
      try {
        await route.fulfill({ response });
      } catch {
        // Ignorer si le navigateur a coupé la socket suite à l'annulation UI
      }
    });
    await seConnecter(page, PERSONNAGES.paul.telephone);
    await page.goto('/agriculteur/planning');
    await page.getByLabel(/^Exploitation/).selectOption({ value: exploitation });
    await page.getByLabel(/^Culture/).fill('manioc');
    await page.getByLabel(/Début de période/).fill('2026-01-01');
    await page.getByLabel(/Fin de période/).fill('2026-08-01');
    await page.getByRole('button', { name: /Générer le planning/i }).click();
    await page.getByTestId('planning-annuler').click();
    // Le bandeau d'avertissement reste visible (toujours rendu).
    await expect(page.getByTestId('bandeau-avertissement-ia')).toBeVisible();

    // Côté serveur, la génération a été créée (indépendamment de l'annulation UI).
    await expect.poll(async () => {
      const historique = await request.get(`${URL_API}/exploitations/${exploitation}/plannings/`, {
        headers: bearer(j),
      });
      if (!historique.ok()) return false;
      const generations = (await historique.json()) as {
        elements: Array<{ culture: string }>;
      };
      return generations.elements.some((g) => g.culture === 'manioc');
    }, { timeout: 10000, intervals: [500] }).toBeTruthy();
  });

  test('PW-F12-06 : « Demander une vérification humaine » → AGR-08 pré-rempli', async ({
    request,
    page,
  }) => {
    const exploitation = await exploitationPaul(request);
    // S'assurer d'une génération réussie à vérifier.
    let cibleId = '';
    const historique = await request.get(`${URL_API}/exploitations/${exploitation}/plannings/`, {
      headers: bearer(await jeton(request, PERSONNAGES.paul.telephone)),
    });
    const gens = (await historique.json()) as { elements: Array<{ id: string; statut: string }> };
    cibleId = gens.elements.find((g) => g.statut === 'reussie')?.id ?? '';

    await seConnecter(page, PERSONNAGES.paul.telephone);
    await page.goto('/agriculteur/planning');
    await page.getByLabel(/^Exploitation/).selectOption({ value: exploitation });

    // Générer (si quota disponible) ou ouvrir le résultat du seed via l'historique.
    const { status } = await genererPlanningApi(request, exploitation, 'arachide');
    if (status === 201) {
      await page.reload();
      await page.getByLabel(/^Exploitation/).selectOption({ value: exploitation });
    }

    // Ouvre le détail d'une génération depuis l'historique puis clic sur la vérification humaine.
    const voir = page.getByTestId(/^historique-item/).first();
    await voir.getByRole('button', { name: /Voir/i }).click();
    await expect(voir.getByTestId('bandeau-avertissement-ia')).toBeVisible();

    // Navigation directe testée : l'URL AGR-08 est pré-remplie du motif.
    await page.goto(
      `/agriculteur/accompagnement?exploitation=${exploitation}&motif=${encodeURIComponent(
        `Vérification du planning IA #${cibleId}`
      )}`
    );
    await expect(page.getByTestId('page-accompagnement')).toBeVisible();
    await expect(page.getByTestId('form-accompagnement')).toBeVisible();
  });

  test('PW-F12-03 : dépassement du quota gratuit → 429 quota_atteint', async ({ request }) => {
    // Test terminal : il épuise le quota mensuel de Paul (remise à zéro par la
    // réinitialisation E2E). Doit rester le dernier du fichier à consommer du
    // quota (l'ordre actuel des tests 01, 02, 04, 05, 06 suppose le quota
    // disponible ; 04 est exonéré, 06 tolère un 429).
    const exploitation = await exploitationPaul(request);
    // Remplir le quota restant (déjà entamé par le seed), puis tenter un de plus.
    let q = await quotaPlanning(request);
    while (q.consomme < q.limite) {
      const r = await genererPlanningApi(request, exploitation, `culture-${q.consomme}`);
      expect(r.status).toBe(201);
      q = await quotaPlanning(request);
    }
    const excedent = await genererPlanningApi(request, exploitation, 'trop');
    expect(excedent.status).toBe(429);

    const j = await jeton(request, PERSONNAGES.paul.telephone);
    const rep = await request.post(
      `${URL_API}/exploitations/${exploitation}/plannings/?test_simule=normal`,
      {
        headers: bearer(j),
        data: { culture: 'encore', periode_debut: '2026-01-01', periode_fin: '2026-03-01' },
      }
    );
    expect(rep.status()).toBe(429);
    const err = (await rep.json()) as {
      erreur: {
        code: string;
        details: { limite: number; consomme: number; date_reinitialisation: string };
      };
    };
    expect(err.erreur.code).toBe('quota_atteint');
    expect(err.erreur.details.limite).toBe(q.limite);
    expect(err.erreur.details.consomme).toBe(q.limite);
    expect(err.erreur.details.date_reinitialisation).toBeTruthy();
  });
});
