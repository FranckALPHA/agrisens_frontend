import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { History, Lock, Plus, RotateCcw } from 'lucide-react';
import { BadgeStatut } from '@/components/BadgeStatut';
import { Bouton } from '@/components/Bouton';
import { Champ } from '@/components/Champ';
import { DialogueConfirmation } from '@/components/DialogueConfirmation';
import { EtatChargement } from '@/components/EtatChargement';
import { EtatErreur } from '@/components/EtatErreur';
import { EtatVide } from '@/components/EtatVide';
import { Select } from '@/components/Select';
import { useToast } from '@/components/Toast';
import { ErreurApi } from '@/services/api/client';
import { formaterPrix } from '@/services/api/produits';
import { useSessionStore } from '@/stores/session';
import {
  LIBELLE_GROUPES,
  TYPES_REFERENTIELS,
  ajouterReferentiel,
  creerVersionOffre,
  desactiverReferentiel,
  definirParametre,
  formaterValeurParametre,
  historiqueParametre,
  listerOffresAdmin,
  listerParametresAdmin,
  listerReferentielsAdmin,
  renommerReferentiel,
  restaurerParametre,
  type ParametreAdminApi,
  type ReferentielAdminApi,
} from '@/services/api/parametres';
import { MESSAGES } from '@/theme/messages';

/** Message d'erreur lisible pour les toasts et les champs en erreur. */
function messageErreur(erreur: unknown): string {
  return erreur instanceof ErreurApi ? erreur.message : MESSAGES.erreurReseau;
}

/** Date locale du champ datetime-local → ISO UTC (vide = immédiat). */
function dateEffetIso(valeurLocale: string): string | undefined {
  if (!valeurLocale) return undefined;
  return new Date(valeurLocale).toISOString();
}

function formatDateCourt(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

/* ---------------------------------------------------------------------------
 * Onglet Paramètres (ADM-04) — grouped values, edit form with impact, history.
 * ------------------------------------------------------------------------- */

const FormulaireParametre: React.FC<{ parametre: ParametreAdminApi; baseFcfa?: number }> = ({
  parametre,
  baseFcfa,
}) => {
  const clientRequete = useQueryClient();
  const { afficherToast } = useToast();
  const [valeur, setValeur] = useState(String(parametre.valeur));
  const [dateEffet, setDateEffet] = useState('');
  const [motif, setMotif] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      definirParametre(parametre.cle, {
        valeur: Number(valeur),
        date_effet: dateEffetIso(dateEffet),
        motif,
      }),
    onSuccess: () => {
      afficherToast(
        dateEffet
          ? `Valeur planifiée pour le ${formatDateCourt(new Date(dateEffet).toISOString())}.`
          : 'Nouvelle valeur appliquée immédiatement.',
        'succes'
      );
      setMotif('');
      setDateEffet('');
      setErreur(null);
      void clientRequete.invalidateQueries({ queryKey: ['admin', 'parametres'] });
      void clientRequete.invalidateQueries({ queryKey: ['admin', 'historique-parametre'] });
    },
    onError: (e: unknown) => setErreur(messageErreur(e)),
  });

  const valeurNum = Number(valeur);
  const horsBornes =
    !Number.isInteger(valeurNum) || valeurNum < parametre.minimum || valeurNum > parametre.maximum;

  // Illustration d'impact (journal §4) : les tarifs au km se traduisent en
  // prix de course — 6 km pour la livraison (avec le tarif de base en
  // vigueur), 12 km pour un déplacement (indicatif, hors minimum/plafond).
  const illustration =
    parametre.cle === 'livraison.tarif_km_fcfa' && baseFcfa !== undefined
      ? { distance: 6, base: baseFcfa }
      : parametre.cle === 'deplacement.tarif_km_fcfa'
        ? { distance: 12, base: 0 }
        : null;

  return (
    <form
      noValidate
      className="flex flex-col gap-3 p-4 rounded-lg border border-bordure bg-surface-survol"
      onSubmit={(e) => {
        e.preventDefault();
        if (horsBornes) {
          setErreur(
            `La valeur doit être comprise entre ${formaterValeurParametre(parametre.cle, parametre.minimum)} et ${formaterValeurParametre(parametre.cle, parametre.maximum)}.`
          );
          return;
        }
        if (!motif.trim()) {
          setErreur('Le motif est obligatoire.');
          return;
        }
        mutation.mutate();
      }}
      data-testid={`form-parametre-${parametre.cle}`}
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Champ
          label="Nouvelle valeur"
          type="number"
          value={valeur}
          min={parametre.minimum}
          max={parametre.maximum}
          onChange={(e) => setValeur(e.target.value)}
          aide={`Bornes : ${formaterValeurParametre(parametre.cle, parametre.minimum)} – ${formaterValeurParametre(parametre.cle, parametre.maximum)}`}
          erreur={erreur && horsBornes ? erreur : undefined}
          data-testid={`champ-valeur-${parametre.cle}`}
        />
        <Champ
          label="Date d’effet (optionnelle)"
          type="datetime-local"
          value={dateEffet}
          onChange={(e) => setDateEffet(e.target.value)}
          aide={
            dateEffet
              ? `Planifiée : ${formatDateCourt(new Date(dateEffet).toISOString())}`
              : 'Vide = immédiate'
          }
          data-testid={`champ-date-effet-${parametre.cle}`}
        />
        <Champ
          label="Motif"
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          placeholder="Ex. : hausse du carburant"
          required
          data-testid={`champ-motif-${parametre.cle}`}
        />
      </div>
      {illustration && Number.isInteger(valeurNum) && (
        <p className="text-sm text-texte-secondaire" data-testid={`impact-${parametre.cle}`}>
          Illustration : une course de {illustration.distance} km passe de{' '}
          <strong>
            {formaterPrix(illustration.base + illustration.distance * parametre.valeur)}
          </strong>{' '}
          à <strong>{formaterPrix(illustration.base + illustration.distance * valeurNum)}</strong>
          {parametre.cle === 'deplacement.tarif_km_fcfa'
            ? ' (indicatif, hors minimum et plafond).'
            : ' (avec le tarif de base actuel).'}
        </p>
      )}
      {erreur && !horsBornes && (
        <p
          className="text-sm text-erreur font-medium"
          role="alert"
          data-testid={`erreur-${parametre.cle}`}
        >
          {erreur}
        </p>
      )}
      <div className="flex justify-end">
        <Bouton
          type="submit"
          variante="primaire"
          chargement={mutation.isPending}
          disabled={!motif.trim()}
          data-testid={`bouton-enregistrer-${parametre.cle}`}
        >
          Enregistrer
        </Bouton>
      </div>
    </form>
  );
};

const PanneauHistorique: React.FC<{ cle: string; surRestauree: () => void }> = ({
  cle,
  surRestauree,
}) => {
  const { afficherToast } = useToast();
  const requete = useQuery({
    queryKey: ['admin', 'historique-parametre', cle],
    queryFn: () => historiqueParametre(cle),
  });
  const [erreurRestauration, setErreurRestauration] = useState<string | null>(null);

  const restauration = useMutation({
    mutationFn: () => restaurerParametre(cle),
    onSuccess: () => {
      afficherToast('Valeur précédente restaurée (nouvelle entrée d’historique).', 'succes');
      setErreurRestauration(null);
      surRestauree();
    },
    onError: (e: unknown) => setErreurRestauration(messageErreur(e)),
  });

  if (requete.isLoading) return <EtatChargement message="Chargement de l’historique…" />;
  if (requete.isError)
    return <EtatErreur message={MESSAGES.erreurReseau} surReessayer={() => requete.refetch()} />;

  const lignes = requete.data ?? [];

  return (
    <div className="flex flex-col gap-2" data-testid={`historique-${cle}`}>
      <ul className="divide-y divide-bordure rounded-lg border border-bordure bg-surface">
        {lignes.map((ligne) => (
          <li key={ligne.id} className="p-3 text-sm flex flex-wrap items-center gap-2">
            <span className="font-semibold text-texte">
              {formaterValeurParametre(cle, ligne.valeur)}
            </span>
            <span className="text-texte-secondaire">
              effet {formatDateCourt(ligne.date_effet)} · {ligne.auteur_nom ?? 'système'}
            </span>
            {ligne.motif && <em className="text-texte-secondaire">— {ligne.motif}</em>}
          </li>
        ))}
      </ul>
      {erreurRestauration && (
        <p className="text-sm text-erreur font-medium" role="alert">
          {erreurRestauration}
        </p>
      )}
      <div>
        <Bouton
          variante="secondaire"
          taille="sm"
          iconeGauche={<RotateCcw size={16} aria-hidden="true" />}
          chargement={restauration.isPending}
          disabled={lignes.length < 2}
          onClick={() => restauration.mutate()}
          data-testid="bouton-restaurer"
        >
          Restaurer la valeur précédente
        </Bouton>
      </div>
    </div>
  );
};

const OngletParametres: React.FC<{ lectureSeule: boolean }> = ({ lectureSeule }) => {
  const [modification, setModification] = useState<string | null>(null);
  const [historiqueOuvert, setHistoriqueOuvert] = useState<string | null>(null);

  const requete = useQuery({
    queryKey: ['admin', 'parametres'],
    queryFn: listerParametresAdmin,
  });

  if (requete.isLoading) return <EtatChargement message="Chargement des paramètres…" />;
  if (requete.isError)
    return <EtatErreur message={MESSAGES.erreurReseau} surReessayer={() => requete.refetch()} />;

  const parametres = requete.data ?? [];
  const baseLivraison = parametres.find((p) => p.cle === 'livraison.base_fcfa')?.valeur;

  const groupes = new Map<string, ParametreAdminApi[]>();
  parametres.forEach((p) => {
    const liste = groupes.get(p.groupe) ?? [];
    liste.push(p);
    groupes.set(p.groupe, liste);
  });

  return (
    <div className="flex flex-col gap-6" data-testid="onglet-parametres">
      {lectureSeule && (
        <p
          className="flex items-center gap-2 text-sm text-texte-secondaire rounded-lg border border-bordure bg-surface p-3"
          data-testid="banniere-lecture-seule"
        >
          <Lock size={16} aria-hidden="true" />
          consultation en lecture seule — seul le super-admin modifie les valeurs.
        </p>
      )}
      {[...groupes.entries()].map(([groupe, lignes]) => (
        <section key={groupe} aria-label={`Groupe ${groupe}`} data-testid={`groupe-${groupe}`}>
          <h3 className="text-base font-bold text-texte mb-3">
            {LIBELLE_GROUPES[groupe] ?? groupe}
          </h3>
          <ul className="flex flex-col gap-3">
            {lignes.map((p) => (
              <li key={p.cle} className="rounded-lg border border-bordure bg-surface p-4">
                <div
                  className="flex flex-wrap items-start justify-between gap-2"
                  data-testid={`parametre-${p.cle}`}
                >
                  <div>
                    <p className="text-sm font-medium text-texte">{p.cle}</p>
                    <p className="text-2xl font-bold text-texte leading-tight">
                      {formaterValeurParametre(p.cle, p.valeur)}
                    </p>
                    <p className="text-xs text-texte-secondaire mt-1">
                      Bornes : {formaterValeurParametre(p.cle, p.minimum)} –{' '}
                      {formaterValeurParametre(p.cle, p.maximum)}
                      {p.public ? ' · visible du public' : ' · interne'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {p.planifiees.map((planifiee, index) => (
                      <span
                        key={`${planifiee.date_effet}-${index}`}
                        className="text-xs px-2 py-1 rounded-full bg-primaire text-white font-medium"
                        data-testid={`planifiee-${p.cle}`}
                      >
                        Planifiée : {formaterValeurParametre(p.cle, planifiee.valeur)} le{' '}
                        {formatDateCourt(planifiee.date_effet)}
                      </span>
                    ))}
                    {!lectureSeule && (
                      <div className="flex gap-2">
                        <Bouton
                          variante="discret"
                          taille="sm"
                          iconeGauche={<History size={16} aria-hidden="true" />}
                          onClick={() =>
                            setHistoriqueOuvert(historiqueOuvert === p.cle ? null : p.cle)
                          }
                          data-testid={`bouton-historique-${p.cle}`}
                        >
                          Historique
                        </Bouton>
                        <Bouton
                          variante="secondaire"
                          taille="sm"
                          iconeGauche={<Plus size={16} aria-hidden="true" />}
                          onClick={() => setModification(modification === p.cle ? null : p.cle)}
                          data-testid={`bouton-modifier-${p.cle}`}
                        >
                          Modifier
                        </Bouton>
                      </div>
                    )}
                  </div>
                </div>
                {modification === p.cle && (
                  <div className="mt-3">
                    <FormulaireParametre parametre={p} baseFcfa={baseLivraison} />
                  </div>
                )}
                {historiqueOuvert === p.cle && (
                  <div className="mt-3">
                    <PanneauHistorique
                      cle={p.cle}
                      surRestauree={() => {
                        void requete.refetch();
                        setHistoriqueOuvert(null);
                      }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};

/* ---------------------------------------------------------------------------
 * Onglet Offres (P-05) — versions d'OFFRE_ABONNEMENT.
 * ------------------------------------------------------------------------- */

const OngletOffres: React.FC<{ lectureSeule: boolean }> = ({ lectureSeule }) => {
  const clientRequete = useQueryClient();
  const { afficherToast } = useToast();
  const requete = useQuery({ queryKey: ['admin', 'offres'], queryFn: listerOffresAdmin });
  const [code, setCode] = useState('gratuit');
  const [nom, setNom] = useState('');
  const [prix, setPrix] = useState('0');
  const [quotaPlanning, setQuotaPlanning] = useState('2');
  const [quotaRecommandation, setQuotaRecommandation] = useState('5');
  const [erreur, setErreur] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      creerVersionOffre({
        code,
        nom: nom.trim() || code,
        prix_mensuel_fcfa: Number(prix),
        quota_planning_mois: Number(quotaPlanning),
        quota_recommandation_mois: Number(quotaRecommandation),
      }),
    onSuccess: () => {
      afficherToast('Nouvelle version d’offre enregistrée (auditée).', 'succes');
      setErreur(null);
      void clientRequete.invalidateQueries({ queryKey: ['admin', 'offres'] });
    },
    onError: (e: unknown) => setErreur(messageErreur(e)),
  });

  if (requete.isLoading) return <EtatChargement message="Chargement des offres…" />;
  if (requete.isError)
    return <EtatErreur message={MESSAGES.erreurReseau} surReessayer={() => requete.refetch()} />;

  const offres = requete.data ?? [];

  return (
    <div className="flex flex-col gap-4" data-testid="onglet-offres">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {offres.map((offre) => (
          <div key={offre.code} className="rounded-lg border border-bordure bg-surface p-4">
            <p className="text-sm font-bold text-texte">{offre.nom}</p>
            <p className="text-xs text-texte-secondaire mb-2">{offre.code}</p>
            <p className="text-lg font-bold text-primaire">
              {offre.prix_mensuel_fcfa !== null ? formaterPrix(offre.prix_mensuel_fcfa) : '—'}
            </p>
            <ul className="text-xs text-texte-secondaire mt-2">
              <li>Plannings IA : {offre.quota_planning_mois ?? '—'} / mois</li>
              <li>Recommandations : {offre.quota_recommandation_mois ?? '—'} / mois</li>
              <li>{offre.versions.length} version(s) conservée(s)</li>
            </ul>
          </div>
        ))}
      </div>

      {!lectureSeule ? (
        <form
          noValidate
          className="flex flex-col gap-3 p-4 rounded-lg border border-bordure bg-surface-survol"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          data-testid="form-offre"
        >
          <h3 className="text-sm font-bold text-texte">Nouvelle version d’une offre</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <Select
              label="Offre"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              options={offres.map((o) => ({ valeur: o.code, libelle: o.nom }))}
              data-testid="champ-code-offre"
            />
            <Champ
              label="Nom"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ex. : Gratuit"
              data-testid="champ-nom-offre"
            />
            <Champ
              label="Prix mensuel (FCFA)"
              type="number"
              min={0}
              value={prix}
              onChange={(e) => setPrix(e.target.value)}
              data-testid="champ-prix-offre"
            />
            <Champ
              label="Plannings IA / mois"
              type="number"
              min={0}
              value={quotaPlanning}
              onChange={(e) => setQuotaPlanning(e.target.value)}
              data-testid="champ-quota-planning-offre"
            />
            <Champ
              label="Recommandations / mois"
              type="number"
              min={0}
              value={quotaRecommandation}
              onChange={(e) => setQuotaRecommandation(e.target.value)}
              data-testid="champ-quota-reco-offre"
            />
          </div>
          {erreur && (
            <p className="text-sm text-erreur font-medium" role="alert" data-testid="erreur-offre">
              {erreur}
            </p>
          )}
          <div className="flex justify-end">
            <Bouton
              type="submit"
              variante="primaire"
              chargement={mutation.isPending}
              data-testid="bouton-enregistrer-offre"
            >
              Enregistrer la version
            </Bouton>
          </div>
        </form>
      ) : (
        <p className="text-sm text-texte-secondaire" data-testid="banniere-lecture-seule-offres">
          Seul le super-admin enregistre de nouvelles versions d’offre.
        </p>
      )}
    </div>
  );
};

/* ---------------------------------------------------------------------------
 * Onglet Référentiels — ajout, renommage, désactivation (jamais de suppression).
 * ------------------------------------------------------------------------- */

const LigneReferentiel: React.FC<{
  entree: ReferentielAdminApi;
  typeRef: string;
  surModifie: () => void;
}> = ({ entree, typeRef, surModifie }) => {
  const { afficherToast } = useToast();
  const [renommageOuvert, setRenommageOuvert] = useState(false);
  const [nouveauLibelle, setNouveauLibelle] = useState(entree.libelle);
  const [confirmationOuverte, setConfirmationOuverte] = useState(false);

  const renommage = useMutation({
    mutationFn: () => renommerReferentiel(entree.id, nouveauLibelle),
    onSuccess: () => {
      afficherToast('Libellé renommé ; le code est conservé (audité).', 'succes');
      setRenommageOuvert(false);
      surModifie();
    },
    onError: (e: unknown) => afficherToast(messageErreur(e), 'erreur'),
  });

  const desactivation = useMutation({
    mutationFn: () => desactiverReferentiel(entree.id),
    onSuccess: () => {
      afficherToast('Entrée désactivée ; elle disparaît des formulaires.', 'succes');
      setConfirmationOuverte(false);
      surModifie();
    },
    onError: (e: unknown) => afficherToast(messageErreur(e), 'erreur'),
  });

  return (
    <li
      className="flex flex-wrap items-center gap-2 p-3 rounded-lg border border-bordure bg-surface"
      data-testid={`referentiel-${typeRef}-${entree.code}`}
    >
      <span className="font-mono text-xs text-texte-secondaire w-32 truncate">{entree.code}</span>
      <span
        className={`flex-1 text-sm ${entree.actif ? 'text-texte' : 'text-texte-muet line-through'}`}
      >
        {entree.libelle}
      </span>
      <BadgeStatut
        statut={entree.actif ? 'actif' : 'inactif'}
        registre={{
          actif: { libelle: 'Actif', variante: 'succes' },
          inactif: { libelle: 'Désactivé', variante: 'neutre' },
        }}
        taille="sm"
      />
      <Bouton
        variante="discret"
        taille="sm"
        onClick={() => setRenommageOuvert(!renommageOuvert)}
        data-testid={`bouton-renommer-${entree.code}`}
      >
        Renommer
      </Bouton>
      {entree.actif && (
        <Bouton
          variante="discret"
          taille="sm"
          onClick={() => setConfirmationOuverte(true)}
          data-testid={`bouton-desactiver-${entree.code}`}
        >
          Désactiver
        </Bouton>
      )}
      {renommageOuvert && (
        <span className="flex gap-2 w-full sm:w-auto">
          <Champ
            label="Nouveau libellé"
            value={nouveauLibelle}
            onChange={(e) => setNouveauLibelle(e.target.value)}
            className="sm:w-56"
            data-testid={`champ-nouveau-libelle-${entree.code}`}
          />
          <Bouton
            variante="primaire"
            taille="sm"
            chargement={renommage.isPending}
            disabled={!nouveauLibelle.trim()}
            onClick={() => renommage.mutate()}
            data-testid={`bouton-valider-renommage-${entree.code}`}
          >
            Valider
          </Bouton>
        </span>
      )}
      <DialogueConfirmation
        ouvert={confirmationOuverte}
        titre="Désactiver cette entrée ?"
        message={`« ${entree.libelle} » ne sera plus proposée dans les formulaires. Un code déjà utilisé n'est jamais supprimé.`}
        texteConfirmer="Désactiver"
        danger
        chargement={desactivation.isPending}
        surConfirmer={() => desactivation.mutate()}
        surAnnuler={() => setConfirmationOuverte(false)}
      />
    </li>
  );
};

const OngletReferentiels: React.FC<{ lectureSeule: boolean }> = ({ lectureSeule }) => {
  const { afficherToast } = useToast();
  const [typeRef, setTypeRef] = useState('region');
  const [code, setCode] = useState('');
  const [libelle, setLibelle] = useState('');
  const requete = useQuery({
    queryKey: ['admin', 'referentiels', typeRef],
    queryFn: () => listerReferentielsAdmin(typeRef),
  });

  const ajout = useMutation({
    mutationFn: () => ajouterReferentiel(typeRef, { code: code.trim(), libelle: libelle.trim() }),
    onSuccess: () => {
      afficherToast('Entrée ajoutée au référentiel (auditée).', 'succes');
      setCode('');
      setLibelle('');
      void requete.refetch();
    },
    onError: (e: unknown) => afficherToast(messageErreur(e), 'erreur'),
  });

  return (
    <div className="flex flex-col gap-4" data-testid="onglet-referentiels">
      <div className="w-full sm:w-72">
        <Select
          label="Référentiel"
          value={typeRef}
          onChange={(e) => setTypeRef(e.target.value)}
          options={TYPES_REFERENTIELS}
          data-testid="select-type-referentiel"
        />
      </div>

      {requete.isLoading && <EtatChargement message="Chargement du référentiel…" />}
      {requete.isError && (
        <EtatErreur message={MESSAGES.erreurReseau} surReessayer={() => requete.refetch()} />
      )}
      {!requete.isLoading && !requete.isError && (requete.data ?? []).length === 0 && (
        <EtatVide titre={MESSAGES.aucunResultat} message="Aucune entrée pour ce référentiel." />
      )}
      {requete.data && requete.data.length > 0 && (
        <ul className="flex flex-col gap-2">
          {requete.data.map((entree) => (
            <LigneReferentiel
              key={entree.id}
              entree={{ ...entree, type: entree.type ?? typeRef }}
              typeRef={typeRef}
              surModifie={() => requete.refetch()}
            />
          ))}
        </ul>
      )}

      {!lectureSeule && (
        <form
          noValidate
          className="flex flex-col gap-3 p-4 rounded-lg border border-bordure bg-surface-survol sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (!code.trim() || !libelle.trim()) return;
            ajout.mutate();
          }}
          data-testid="form-ajout-referentiel"
        >
          <Champ
            label="Code (stable, jamais modifié ensuite)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Ex. : nord"
            data-testid="champ-code-referentiel"
          />
          <Champ
            label="Libellé"
            value={libelle}
            onChange={(e) => setLibelle(e.target.value)}
            placeholder="Ex. : Nord"
            data-testid="champ-libelle-referentiel"
          />
          <Bouton
            type="submit"
            variante="primaire"
            chargement={ajout.isPending}
            disabled={!code.trim() || !libelle.trim()}
            data-testid="bouton-ajouter-referentiel"
          >
            Ajouter
          </Bouton>
        </form>
      )}
    </div>
  );
};

/* ---------------------------------------------------------------------------
 * Page ADM-04 — trois onglets, garde de rôle : l'admin est en lecture seule.
 * ------------------------------------------------------------------------- */

const ONGLETS = [
  { id: 'parametres', libelle: 'Paramètres' },
  { id: 'offres', libelle: 'Offres' },
  { id: 'referentiels', libelle: 'Référentiels' },
] as const;

type IdentifiantOnglet = (typeof ONGLETS)[number]['id'];

export const PageParametresAdmin: React.FC = () => {
  const role = useSessionStore((s) => s.utilisateur?.role);
  const lectureSeule = role !== 'super_admin';
  const [onglet, setOnglet] = useState<IdentifiantOnglet>('parametres');

  return (
    <div className="py-6 flex flex-col gap-6">
      <header>
        <h1 className="text-xl md:text-2xl font-bold text-texte">Paramètres de la plateforme</h1>
        <p className="text-sm text-texte-secondaire mt-1">
          Tarifs, limites, offres et référentiels — chaque modification est motivée, datée et
          auditée.
        </p>
      </header>

      <nav
        aria-label="Sections d’administration"
        className="flex gap-1 border-b border-bordure"
        data-testid="onglets-admin"
      >
        {ONGLETS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setOnglet(item.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              onglet === item.id
                ? 'border-primaire text-primaire'
                : 'border-transparent text-texte-secondaire hover:text-texte'
            }`}
            aria-current={onglet === item.id ? 'page' : undefined}
            data-testid={`onglet-${item.id}`}
          >
            {item.libelle}
          </button>
        ))}
      </nav>

      {onglet === 'parametres' && <OngletParametres lectureSeule={lectureSeule} />}
      {onglet === 'offres' && <OngletOffres lectureSeule={lectureSeule} />}
      {onglet === 'referentiels' && <OngletReferentiels lectureSeule={lectureSeule} />}
    </div>
  );
};

export default PageParametresAdmin;
