/**
 * E2E F-10 — Administration : paramètres, audit, soldes, reversements
 * (docs/12-plan-tests-playwright.md §2, PW-F10-01 à 08).
 * Règles §1.4 : rôles/libellés d'abord, aucune attente fixe, données uniques
 * par test, identifiant dans chaque titre, double vérification écran + API,
 * montants comparés à la valeur exacte attendue.
 * Les tests qui modifient le tarif partagé sont en describe.serial et
 * restaurent la valeur 150 FCFA après chacun.
 * NB : tous les appels API passent par le fixture `request` (jarre de cookies
 * propre) pour ne jamais écraser le cookie de rafraîchissement de la SPA.
 */
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { test } from '../fixtures';
import { PERSONNAGES } from '../fixtures/roles';
import { verifierAccessibilite } from '../utils/a11y';

const URL_API = 'http://127.0.0.1:8001/api/v1';
const MOT_DE_PASSE = 'Motdepasse123!';
const POINT_YAOUNDE = { type: 'Point', coordinates: [11.5137, 3.848] };
const CLE_TARIF = 'livraison.tarif_km_fcfa';

function suffixeUnique(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

function bearer(jeton: string): Record<string, string> {
  return { Authorization: `Bearer ${jeton}` };
}

async function connexionApiAvecJeton(api: APIRequestContext, identifiant: string): Promise<string> {
  const reponse = await api.post(`${URL_API}/auth/connexion/`, {
    data: { identifiant, mot_de_passe: MOT_DE_PASSE },
  });
  expect(reponse.ok(), 'la connexion API doit réussir').toBeTruthy();
  return ((await reponse.json()) as { jeton_acces: string }).jeton_acces;
}

async function connexionUI(page: Page, telephone: string): Promise<void> {
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

async function nouvellePage(
  contexteParent: import('@playwright/test').BrowserContext
): Promise<Page> {
  const navigateur = contexteParent.browser();
  const contexte = await navigateur!.newContext({
    baseURL: 'http://127.0.0.1:4173',
    locale: 'fr-FR',
    timezoneId: 'Africa/Douala',
  });
  return contexte.newPage();
}

async function exploitationDePaul(api: APIRequestContext, jeton: string): Promise<string> {
  const reponse = await api.get(`${URL_API}/exploitations/`, { headers: bearer(jeton) });
  expect(reponse.ok()).toBeTruthy();
  const liste = (await reponse.json()) as Array<{ id: string; nom: string }>;
  const champ = liste.find((e) => e.nom === 'Champ Nord') ?? liste[0];
  expect(champ, 'exploitation requise').toBeDefined();
  return champ!.id;
}

async function adresseAmina(api: APIRequestContext, jeton: string): Promise<string> {
  const reponse = await api.get(`${URL_API}/utilisateurs/moi/adresses/`, { headers: bearer(jeton) });
  expect(reponse.ok()).toBeTruthy();
  const corps = (await reponse.json()) as
    | Array<{ id: string; libelle: string }>
    | { elements: Array<{ id: string; libelle: string }> };
  const liste = Array.isArray(corps) ? corps : corps.elements;
  const adresse = liste.find((a) => a.libelle === 'Domicile');
  expect(adresse, 'adresse Domicile requise (seed, à 6 km de Champ Nord)').toBeDefined();
  return adresse!.id;
}

/* ---------------------------------------------------------------------------
 * Helpers paramètres et soldes (via API, jeton super-admin).
 * ------------------------------------------------------------------------- */

interface ParametreApi {
  cle: string;
  groupe: string;
  valeur: number;
  minimum: number;
  maximum: number;
  public: boolean;
  planifiees: Array<{ valeur: number; date_effet: string }>;
}

async function valeurParametreApi(api: APIRequestContext, jetonSadm: string, cle: string) {
  const reponse = await api.get(`${URL_API}/admin/parametres/`, { headers: bearer(jetonSadm) });
  expect(reponse.ok()).toBeTruthy();
  const liste = (await reponse.json()) as ParametreApi[];
  return liste.find((p) => p.cle === cle)!.valeur;
}

interface LigneHistoriqueApi {
  id: string;
  valeur: number;
  date_effet: string;
  motif: string | null;
}

async function historiqueParametreApi(
  api: APIRequestContext,
  jetonSadm: string,
  cle: string
): Promise<LigneHistoriqueApi[]> {
  const reponse = await api.get(`${URL_API}/admin/parametres/${cle}/historique/`, {
    headers: bearer(jetonSadm),
  });
  expect(reponse.ok()).toBeTruthy();
  return (await reponse.json()) as LigneHistoriqueApi[];
}

async function definirParametreApi(
  api: APIRequestContext,
  jetonSadm: string,
  cle: string,
  valeur: number,
  motif: string
): Promise<void> {
  const reponse = await api.post(`${URL_API}/admin/parametres/${cle}/`, {
    headers: { ...bearer(jetonSadm), 'Content-Type': 'application/json' },
    data: { valeur, motif },
  });
  expect(reponse.ok(), `définition API de ${cle} doit réussir`).toBeTruthy();
}

interface SoldeDetailApi {
  gains_acquis: number;
  remboursements_imputes: number;
  deja_reverse: number;
  solde: number;
}

async function soldeMoiApi(api: APIRequestContext, jeton: string): Promise<SoldeDetailApi> {
  const reponse = await api.get(`${URL_API}/soldes/moi/`, { headers: bearer(jeton) });
  expect(reponse.ok()).toBeTruthy();
  return (await reponse.json()) as SoldeDetailApi;
}

/* ---------------------------------------------------------------------------
 * Chaîne commande → livraison (mêmes montants que f09, helpers non partagés).
 * ------------------------------------------------------------------------- */

interface Course {
  commandeId: string;
  livraisonId: string;
  sousTotalFcfa: number;
  fraisLivraisonFcfa: number;
  jetonPaul: string;
  jetonAmina: string;
  jetonJean: string;
}

async function rendreDisponible(api: APIRequestContext, jeton: string, disponible: boolean) {
  const reponse = await api.put(`${URL_API}/livreurs/moi/disponibilite/`, {
    headers: { ...bearer(jeton), 'Content-Type': 'application/json' },
    data: disponible
      ? { disponible: true, position: POINT_YAOUNDE, zone: 'centre' }
      : { disponible: false },
  });
  expect(reponse.ok()).toBeTruthy();
}

/** Commande de 10 kg à 500 FCFA livrée à Domicile (6 km), payée par webhook. */
async function commandePayee(api: APIRequestContext, suffixe: string): Promise<Course> {
  const jetonPaul = await connexionApiAvecJeton(api, PERSONNAGES.paul.telephone);
  const exploitationId = await exploitationDePaul(api, jetonPaul);
  const produit = await api.post(`${URL_API}/produits/`, {
    headers: { ...bearer(jetonPaul), 'Content-Type': 'application/json' },
    data: {
      nom: `Tomates Adm E2E-${suffixe}`,
      categorie: 'legumes',
      unite: 'kg',
      prix_unitaire_fcfa: 500,
      quantite_stock: '100',
      exploitation_id: exploitationId,
    },
  });
  expect(produit.status()).toBe(201);
  const produitId = ((await produit.json()) as { id: string }).id;

  const jetonAmina = await connexionApiAvecJeton(api, PERSONNAGES.amina.telephone);
  const domicileId = await adresseAmina(api, jetonAmina);
  const commande = await api.post(`${URL_API}/commandes/`, {
    headers: { ...bearer(jetonAmina), 'Content-Type': 'application/json' },
    data: { lignes: [{ produit_id: produitId, quantite: '10' }], adresse_id: domicileId },
  });
  expect(commande.status()).toBe(201);
  const json = (await commande.json()) as {
    id: string;
    sous_total_fcfa: number;
    frais_livraison_fcfa: number;
    total_fcfa: number;
  };

  const acceptation = await api.post(`${URL_API}/commandes/${json.id}/accepter/`, {
    headers: bearer(jetonPaul),
  });
  expect(acceptation.ok()).toBeTruthy();

  const init = await api.post(`${URL_API}/commandes/${json.id}/paiements/`, {
    headers: {
      ...bearer(jetonAmina),
      'Content-Type': 'application/json',
      'Idempotency-Key': `e2e-f10-${suffixe}`,
    },
    data: { operateur: 'mtn_momo' },
  });
  expect(init.status()).toBe(201);
  const initJson = (await init.json()) as { reference_interne: string; montant_fcfa: number };

  const { envoyerWebhook, evenementReussi } = await import('../utils/notchpay');
  const webhook = await envoyerWebhook(
    api,
    evenementReussi(initJson.reference_interne, initJson.montant_fcfa, `f10-${suffixe}`)
  );
  expect(webhook.status()).toBe(200);

  const livraison = await api.get(`${URL_API}/commandes/${json.id}/livraison/`, {
    headers: bearer(jetonAmina),
  });
  expect(livraison.status()).toBe(200);
  const jetonJean = await connexionApiAvecJeton(api, PERSONNAGES.jean.telephone);
  return {
    commandeId: json.id,
    livraisonId: ((await livraison.json()) as { id: string }).id,
    sousTotalFcfa: json.sous_total_fcfa,
    fraisLivraisonFcfa: json.frais_livraison_fcfa,
    jetonPaul,
    jetonAmina,
    jetonJean,
  };
}

/** Course payée conduite jusqu'à `livree` (Jean remet, code saisi via API). */
async function commandeLivree(api: APIRequestContext, suffixe: string): Promise<Course> {
  const course = await commandePayee(api, suffixe);
  await rendreDisponible(api, course.jetonJean, true);
  const acceptation = await api.post(`${URL_API}/livraisons/${course.livraisonId}/accepter/`, {
    headers: bearer(course.jetonJean),
  });
  expect(acceptation.ok()).toBeTruthy();
  const preparation = await api.post(`${URL_API}/commandes/${course.commandeId}/preparer/`, {
    headers: bearer(course.jetonPaul),
  });
  expect(preparation.ok()).toBeTruthy();
  const demarrage = await api.post(`${URL_API}/livraisons/${course.livraisonId}/demarrer/`, {
    headers: bearer(course.jetonJean),
  });
  expect(demarrage.ok()).toBeTruthy();

  const codeReponse = await api.get(`${URL_API}/commandes/${course.commandeId}/code-remise/`, {
    headers: bearer(course.jetonAmina),
  });
  expect(codeReponse.ok()).toBeTruthy();
  const code = ((await codeReponse.json()) as { code: string }).code;
  const remise = await api.post(`${URL_API}/livraisons/${course.livraisonId}/confirmer-remise/`, {
    headers: { ...bearer(course.jetonJean), 'Content-Type': 'application/json' },
    data: { code },
  });
  expect(remise.ok()).toBeTruthy();
  return course;
}

/** Chaîne « 2026-10-03T14:30 » dans le fuseau du navigateur (datetime-local). */
function dateLocaleDouala(minutesApres: number): string {
  const d = new Date(Date.now() + minutesApres * 60_000);
  const parties = Object.fromEntries(
    new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Africa/Douala',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .formatToParts(d)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value])
  );
  const heure = parties.hour === '24' ? '00' : parties.hour;
  return `${parties.year}-${parties.month}-${parties.day}T${heure}:${parties.minute}`;
}

/** Texte formaté « 4 750 FCFA » → expression régulière tolérante aux espaces. */
function regexMontant(montant: number): RegExp {
  return new RegExp(montant.toLocaleString('fr-FR').replace(/\s/g, '\\s'));
}

test.describe('F-10 — Administration (paramètres, audit, soldes)', () => {
  test.describe.configure({ mode: 'serial' });

  test.afterEach(async ({ request }) => {
    // Base E2E partagée : horloge réelle et Jean remis indisponible (état seed).
    const reponse = await request.delete(`${URL_API}/dev/horloge`);
    expect(reponse.ok()).toBeTruthy();
    const jetonJean = await connexionApiAvecJeton(request, PERSONNAGES.jean.telephone);
    await rendreDisponible(request, jetonJean, false);
  });

  test('PW-F10-01 @critique tarif 150 → 200 FCFA : impact 6 km, nouvelle commande à 1 700, ancienne à 1 400, audit', async ({
    page,
    request,
  }) => {
    const jetonSadm = await connexionApiAvecJeton(request, PERSONNAGES.superadmin.telephone);
    expect(await valeurParametreApi(request, jetonSadm, CLE_TARIF)).toBe(150);

    // Ancienne commande passée au tarif 150 : livraison 500 + 6 × 150 = 1 400.
    const ancienne = await commandePayee(request, suffixeUnique());
    expect(ancienne.fraisLivraisonFcfa).toBe(1400);

    // UI super-admin : modification avec illustration d'impact avant envoi.
    await connexionUI(page, PERSONNAGES.superadmin.telephone);
    await page.goto('/admin/parametres');
    await verifierAccessibilite(page);
    await expect(page.getByTestId(`parametre-${CLE_TARIF}`)).toContainText('150 FCFA');
    await page.getByTestId(`bouton-modifier-${CLE_TARIF}`).click();
    await page.getByTestId(`champ-valeur-${CLE_TARIF}`).fill('200');
    const impact = page.getByTestId(`impact-${CLE_TARIF}`);
    await expect(impact).toContainText(/6 km/);
    await expect(impact).toContainText(/1\s?400/);
    await expect(impact).toContainText(/1\s?700/);
    await page.getByTestId(`champ-motif-${CLE_TARIF}`).fill('Hausse carburant (PW-F10-01)');
    await page.getByTestId(`bouton-enregistrer-${CLE_TARIF}`).click();
    await expect(page.getByText('Nouvelle valeur appliquée')).toBeVisible();
    expect(await valeurParametreApi(request, jetonSadm, CLE_TARIF)).toBe(200);

    // Double vérification : nouvelle commande à 6 km = 500 + 6 × 200 = 1 700 ;
    // l'ancienne garde sa facture de 1 400 (snapshot à la création).
    const nouvelle = await commandePayee(request, suffixeUnique());
    expect(nouvelle.fraisLivraisonFcfa).toBe(1700);
    const detailAncienne = await request.get(`${URL_API}/commandes/${ancienne.commandeId}/`, {
      headers: bearer(ancienne.jetonAmina),
    });
    expect(
      ((await detailAncienne.json()) as { frais_livraison_fcfa: number }).frais_livraison_fcfa
    ).toBe(1400);

    // ADM-05 : l'audit montre les deux valeurs de la modification.
    const listeAudit = await request.get(
      `${URL_API}/admin/audit/?entite_type=parametre_plateforme&action=modifier_parametre`,
      { headers: bearer(jetonSadm) }
    );
    expect(listeAudit.ok()).toBeTruthy();
    const entrees = ((await listeAudit.json()) as {
      elements: Array<{ id: string; ancienne_valeur: { valeur: number } | null; nouvelle_valeur: { valeur: number } | null }>;
    }).elements;
    // L'entrée exacte 150 → 200 (d'autres entrées existent : nettoyage serial).
    const entree = entrees.find(
      (e) => e.ancienne_valeur?.valeur === 150 && e.nouvelle_valeur?.valeur === 200
    );
    expect(entree, 'l’audit doit contenir la modification 150 → 200').toBeDefined();
    await page.goto('/admin/audit');
    await verifierAccessibilite(page);
    await page.getByTestId('filtre-entite').selectOption('parametre_plateforme');
    await page.getByTestId('filtre-action').fill('modifier_parametre');
    // Le tableau responsive rend chaque ligne deux fois (table + cartes) : visible.
    await page.locator(`[data-testid="lien-audit-${entree?.id}"]:visible`).click();
    await expect(page.getByTestId('detail-audit')).toBeVisible();
    await expect(page.getByTestId('audit-ancienne-valeur')).toContainText('150');
    await expect(page.getByTestId('audit-nouvelle-valeur')).toContainText('200');

    // Restauration du tarif partagé pour les tests suivants (§1.4 indépendance).
    await definirParametreApi(request, jetonSadm, CLE_TARIF, 150, 'Retour après PW-F10-01');
    expect(await valeurParametreApi(request, jetonSadm, CLE_TARIF)).toBe(150);
  });

  test('PW-F10-02 valeur hors bornes refusée avec les bornes affichées', async ({
    page,
    request,
  }) => {
    const jetonSadm = await connexionApiAvecJeton(request, PERSONNAGES.superadmin.telephone);
    await connexionUI(page, PERSONNAGES.superadmin.telephone);
    await page.goto('/admin/parametres');
    await page.getByTestId(`bouton-modifier-${CLE_TARIF}`).click();
    await page.getByTestId(`champ-valeur-${CLE_TARIF}`).fill('2500');
    await page.getByTestId(`champ-motif-${CLE_TARIF}`).fill('Test hors bornes (PW-F10-02)');
    await page.getByTestId(`bouton-enregistrer-${CLE_TARIF}`).click();
    await expect(page.getByRole('alert')).toContainText(/comprise entre/);
    // Vérification API : aucune écriture n'a eu lieu.
    expect(await valeurParametreApi(request, jetonSadm, CLE_TARIF)).toBe(150);
  });

  test('PW-F10-03 date d’effet future : planifiée, puis appliquée après l’horloge', async ({
    page,
    request,
  }) => {
    const jetonSadm = await connexionApiAvecJeton(request, PERSONNAGES.superadmin.telephone);
    await connexionUI(page, PERSONNAGES.superadmin.telephone);
    await page.goto('/admin/parametres');
    await page.getByTestId(`bouton-modifier-${CLE_TARIF}`).click();
    await page.getByTestId(`champ-valeur-${CLE_TARIF}`).fill('180');
    await page.getByTestId(`champ-date-effet-${CLE_TARIF}`).fill(dateLocaleDouala(120));
    await page.getByTestId(`champ-motif-${CLE_TARIF}`).fill('Planification (PW-F10-03)');
    await page.getByTestId(`bouton-enregistrer-${CLE_TARIF}`).click();
    await expect(page.getByText(/Valeur planifiée/)).toBeVisible();
    await expect(page.getByTestId(`planifiee-${CLE_TARIF}`)).toContainText('180');

    // Non appliquée avant l'heure : la valeur en vigueur reste 150.
    expect(await valeurParametreApi(request, jetonSadm, CLE_TARIF)).toBe(150);

    // On avance l'horloge backend de 3 h : la valeur planifiée s'applique.
    const decalage = await request.post(`${URL_API}/dev/horloge`, {
      data: { decalage_minutes: 180 },
    });
    expect(decalage.ok()).toBeTruthy();
    // Vérification API (source de vérité) : la valeur en vigueur est passée à 180.
    expect(await valeurParametreApi(request, jetonSadm, CLE_TARIF)).toBe(180);

    // Nettoyage : horloge réelle puis retour immédiat à 150.
    const reset = await request.delete(`${URL_API}/dev/horloge`);
    expect(reset.ok()).toBeTruthy();
    await definirParametreApi(request, jetonSadm, CLE_TARIF, 150, 'Retour après PW-F10-03');
    expect(await valeurParametreApi(request, jetonSadm, CLE_TARIF)).toBe(150);
  });

  test('PW-F10-04 restauration de la valeur précédente = nouvelle entrée d’historique', async ({
    page,
    request,
  }) => {
    const jetonSadm = await connexionApiAvecJeton(request, PERSONNAGES.superadmin.telephone);
    await definirParametreApi(request, jetonSadm, CLE_TARIF, 170, 'Valeur test (PW-F10-04)');
    expect(await valeurParametreApi(request, jetonSadm, CLE_TARIF)).toBe(170);

    // Source de vérité : la valeur restaurée est celle de l'avant-dernière ligne
    // d'historique (tri -date_effet), quelle que soit la planification laissée
    // par PW-F10-03.
    const avant = await historiqueParametreApi(request, jetonSadm, CLE_TARIF);
    expect(avant.length, 'au moins deux lignes d\'historique').toBeGreaterThanOrEqual(2);
    const valeurAttendue = avant[1]!.valeur;

    await connexionUI(page, PERSONNAGES.superadmin.telephone);
    await page.goto('/admin/parametres');
    await page.getByTestId(`bouton-historique-${CLE_TARIF}`).click();
    await expect(page.getByTestId(`historique-${CLE_TARIF}`)).toBeVisible();
    await page.getByTestId('bouton-restaurer').click();
    await expect(page.getByText(/Valeur précédente restaurée/)).toBeVisible();

    // 170 est remplacé par la valeur d'avant via une NOUVELLE entrée d'historique.
    expect(await valeurParametreApi(request, jetonSadm, CLE_TARIF)).toBe(valeurAttendue);
    const apres = await historiqueParametreApi(request, jetonSadm, CLE_TARIF);
    expect(apres.length).toBe(avant.length + 1);
    const nouvelleEntree = apres.find((l) => l.motif === 'Restauration de la valeur précédente');
    expect(nouvelleEntree, 'nouvelle entrée créée par la restauration').toBeDefined();
    expect(nouvelleEntree!.valeur).toBe(valeurAttendue);
    await expect(page.getByTestId(`parametre-${CLE_TARIF}`)).toContainText(
      `${valeurAttendue} FCFA`
    );

    // Nettoyage : retour immédiat au tarif de référence 150 pour les tests suivants.
    await definirParametreApi(request, jetonSadm, CLE_TARIF, 150, 'Retour après PW-F10-04');
    expect(await valeurParametreApi(request, jetonSadm, CLE_TARIF)).toBe(150);
  });

  test('PW-F10-05 un admin simple voit les paramètres en lecture seule', async ({
    page,
    request,
  }) => {
    await connexionUI(page, PERSONNAGES.mireille.telephone);
    await page.goto('/admin/parametres');
    await verifierAccessibilite(page);
    await expect(page.getByTestId('banniere-lecture-seule')).toBeVisible();
    await expect(page.getByTestId(`bouton-modifier-${CLE_TARIF}`)).toHaveCount(0);

    // Vérification API : l'écriture est refusée côté serveur aussi.
    const jetonMireille = await connexionApiAvecJeton(request, PERSONNAGES.mireille.telephone);
    const refus = await request.post(`${URL_API}/admin/parametres/${CLE_TARIF}/`, {
      headers: { ...bearer(jetonMireille), 'Content-Type': 'application/json' },
      data: { valeur: 199, motif: 'Tente d’écrire en tant qu’admin (PW-F10-05)' },
    });
    expect(refus.status()).toBe(403);
  });

  test('PW-F10-06 reversement à Paul : montant > solde refusé, montant valide diminue le solde', async ({
    page,
    request,
  }) => {
    const suffixe = suffixeUnique();
    await commandeLivree(request, suffixe); // Paul gagne sous-total − 5 %.

    const jetonSadm = await connexionApiAvecJeton(request, PERSONNAGES.superadmin.telephone);
    const file = await request.get(`${URL_API}/admin/soldes/`, { headers: bearer(jetonSadm) });
    expect(file.ok()).toBeTruthy();
    const lignes = (await file.json()) as Array<{
      beneficiaire_id: string;
      nom: string;
      solde: number;
    }>;
    const lignePaul = lignes.find((l) => l.nom === PERSONNAGES.paul.nom);
    expect(lignePaul, 'Paul doit avoir un solde positif').toBeDefined();
    const soldeAvant = lignePaul!.solde;
    expect(soldeAvant).toBeGreaterThan(0);

    await connexionUI(page, PERSONNAGES.mireille.telephone);
    await page.goto('/admin/soldes');
    await verifierAccessibilite(page);
    await expect(page.getByTestId('file-soldes')).toBeVisible();
    // Double rendu du tableau responsive : cibler la ligne visible.
    await page
      .locator(`[data-testid="choisir-beneficiaire-${lignePaul!.beneficiaire_id}"]:visible`)
      .click();
    await expect(page.getByTestId('form-reversement')).toBeVisible();

    // T1 : montant supérieur au solde → refusé, solde inchangé.
    await page.getByTestId('champ-montant-reversement').fill(String(soldeAvant + 1000));
    await page.getByTestId('champ-reference-reversement').fill(`MTN-E2E-TROP-${suffixe}`);
    await page.getByTestId('bouton-confirmer-reversement').click();
    await expect(page.getByTestId('erreur-reversement')).toContainText(/dépasse le solde/);
    const fileApresRefus = await request.get(`${URL_API}/admin/soldes/`, {
      headers: bearer(jetonSadm),
    });
    const paulApresRefus = ((await fileApresRefus.json()) as typeof lignes).find(
      (l) => l.beneficiaire_id === lignePaul!.beneficiaire_id
    );
    expect(paulApresRefus!.solde).toBe(soldeAvant);

    // T2 : montant exact 1 000 → le solde diminue de 1 000 (écran + API).
    await page.getByTestId('champ-montant-reversement').fill('1000');
    await page.getByTestId('champ-reference-reversement').fill(`MTN-E2E-${suffixe}`);
    await page.getByTestId('bouton-confirmer-reversement').click();
    await expect(page.getByText(/Reversement de .* enregistré/)).toBeVisible();
    const jetonPaul = await connexionApiAvecJeton(request, PERSONNAGES.paul.telephone);
    await expect
      .poll(async () => (await soldeMoiApi(request, jetonPaul)).solde)
      .toBe(soldeAvant - 1000);
    const historique = await request.get(
      `${URL_API}/admin/reversements/?beneficiaire=${lignePaul!.beneficiaire_id}`,
      { headers: bearer(jetonSadm) }
    );
    expect(historique.ok()).toBeTruthy();
    const elements = ((await historique.json()) as {
      elements: Array<{ montant_fcfa: number; reference_operateur: string }>;
    }).elements;
    const premier = elements[0];
    expect(premier, 'le reversement doit apparaître dans l’historique').toBeDefined();
    expect(premier?.montant_fcfa).toBe(1000);
    expect(premier?.reference_operateur).toBe(`MTN-E2E-${suffixe}`);
  });

  test('PW-F10-07 « Mes gains » de Paul et Jean : montants exacts après une commande livrée', async ({
    page,
    request,
  }) => {
    const jetonPaulAvant = await connexionApiAvecJeton(request, PERSONNAGES.paul.telephone);
    const jetonJeanAvant = await connexionApiAvecJeton(request, PERSONNAGES.jean.telephone);
    const paulAvant = await soldeMoiApi(request, jetonPaulAvant);
    const jeanAvant = await soldeMoiApi(request, jetonJeanAvant);

    const course = await commandeLivree(request, suffixeUnique());
    // 10 kg à 500 FCFA = 5 000 ; commission 5 % = 250 → Paul +4 750 ;
    // Jean encaisse les frais de livraison au tarif 150 : 500 + 6 × 150 = 1 400.
    expect(course.sousTotalFcfa).toBe(5000);
    expect(course.fraisLivraisonFcfa).toBe(1400);

    const pagePaul = await nouvellePage(page.context());
    await connexionUI(pagePaul, PERSONNAGES.paul.telephone);
    await pagePaul.goto('/mes-gains');
    await verifierAccessibilite(pagePaul);
    await expect(pagePaul.getByTestId('solde-moi')).toContainText(regexMontant(paulAvant.solde + 4750));
    await expect(pagePaul.getByTestId('gain-gains_acquis')).toContainText(
      regexMontant(paulAvant.gains_acquis + 4750)
    );
    await pagePaul.context().close();

    const pageJean = await nouvellePage(page.context());
    await connexionUI(pageJean, PERSONNAGES.jean.telephone);
    await pageJean.goto('/mes-gains');
    await expect(pageJean.getByTestId('solde-moi')).toContainText(regexMontant(jeanAvant.solde + 1400));
    await pageJean.context().close();

    // Vérification API : la commission figée est bien de 250 FCFA.
    const detail = await request.get(`${URL_API}/commandes/${course.commandeId}/`, {
      headers: bearer(course.jetonAmina),
    });
    expect(((await detail.json()) as { commission_fcfa: number }).commission_fcfa).toBe(250);
  });

  test('PW-F10-08 export de l’audit réservé au super-admin', async ({ page, request }) => {
    const jetonSadm = await connexionApiAvecJeton(request, PERSONNAGES.superadmin.telephone);
    const jetonMireille = await connexionApiAvecJeton(request, PERSONNAGES.mireille.telephone);

    // API : liste et export accessibles au super-admin, refusés à l'admin.
    expect(
      (await request.get(`${URL_API}/admin/audit/`, { headers: bearer(jetonMireille) })).status()
    ).toBe(403);
    expect(
      (
        await request.get(`${URL_API}/admin/audit/export/`, {
          headers: bearer(jetonMireille),
        })
      ).status()
    ).toBe(403);
    expect(
      (await request.get(`${URL_API}/admin/audit/`, { headers: bearer(jetonSadm) })).status()
    ).toBe(200);

    // UI : Mireille n'a pas l'entrée de menu et est renvoyée vers accès interdit.
    await connexionUI(page, PERSONNAGES.mireille.telephone);
    await expect(page.getByRole('link', { name: 'Audit', exact: true })).toHaveCount(0);
    await page.goto('/admin/audit');
    await expect(page).toHaveURL(/acces-interdit/);

    // UI super-admin : l'export déclenche le téléchargement du CSV.
    await connexionUI(page, PERSONNAGES.superadmin.telephone);
    await page.goto('/admin/audit');
    await expect(page.getByTestId('page-audit')).toBeVisible();
    const [telechargement] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('bouton-export-audit').click(),
    ]);
    expect(telechargement.suggestedFilename()).toBe('audit-agrisens.csv');
  });
});
