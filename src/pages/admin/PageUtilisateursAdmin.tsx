import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Eye, KeyRound, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import { BadgeStatut } from '@/components/BadgeStatut';
import { Bouton } from '@/components/Bouton';
import { Champ } from '@/components/Champ';
import { ChampRecherche } from '@/components/ChampRecherche';
import { DialogueConfirmation } from '@/components/DialogueConfirmation';
import { EtatChargement } from '@/components/EtatChargement';
import { EtatErreur } from '@/components/EtatErreur';
import { EtatVide } from '@/components/EtatVide';
import { Pagination } from '@/components/Pagination';
import { Select } from '@/components/Select';
import { TableauResponsive, type Colonne } from '@/components/TableauResponsive';
import { useToast } from '@/components/Toast';
import {
  listerUtilisateursAdmin,
  obtenirUtilisateurAdmin,
  validerIngenieur,
  refuserIngenieur,
  suspendreUtilisateur,
  reactiverUtilisateur,
  reinitialiserMotDePasse,
  type ProfilIngenieurAdminApi,
  type UtilisateurAdminListeApi,
} from '@/services/api/administration';
import { chargerContenuFichier } from '@/services/api/fichiers';
import {
  STATUTS_JUSTIFICATIF,
  STATUTS_ROLE,
  STATUTS_UTILISATEUR,
  STATUTS_VALIDATION_INGENIEUR,
} from '@/theme/statuts';
import { MESSAGES } from '@/theme/messages';

/**
 * ADM-02 — Gestion des utilisateurs (prompt F-03 frontend point 5, D-13, Q-23) :
 * recherche, filtres rôle/statut, détail, visualisation des justificatifs,
 * valider / refuser avec motif obligatoire, suspendre (révoque les sessions) /
 * réactiver, mot de passe temporaire affiché une seule fois.
 */

const ROLE_OPTIONS = [
  { valeur: '', libelle: 'Tous les rôles' },
  { valeur: 'agriculteur', libelle: 'Agriculteurs' },
  { valeur: 'acheteur', libelle: 'Acheteurs' },
  { valeur: 'ingenieur_agronome', libelle: 'Ingénieurs agronomes' },
  { valeur: 'livreur', libelle: 'Livreurs' },
  { valeur: 'admin', libelle: 'Administrateurs' },
];

const STATUT_OPTIONS = [
  { valeur: '', libelle: 'Tous les statuts' },
  { valeur: 'actif', libelle: 'Actifs' },
  { valeur: 'en_attente_validation', libelle: 'En attente de validation' },
  { valeur: 'suspendu', libelle: 'Suspendus' },
];

const LIBELLES_JUSTIFICATIF: Record<string, string> = {
  diplome: 'Diplôme',
  piece_identite: 'Pièce d’identité',
  autre: 'Autre document',
};

/** Panneau détail d'un utilisateur + actions d'administration. */
const DetailUtilisateur: React.FC<{
  idUtilisateur: string;
  onFermer: () => void;
}> = ({ idUtilisateur, onFermer }) => {
  const queryClient = useQueryClient();
  const { afficherToast } = useToast();
  const [motifRefus, setMotifRefus] = useState('');
  const [motifSuspension, setMotifSuspension] = useState('');
  const [dialogue, setDialogue] = useState<'suspendre' | 'reinitialiser' | null>(null);
  const [motDePasseTemporaire, setMotDePasseTemporaire] = useState<string | null>(null);

  const requete = useQuery({
    queryKey: ['admin', 'utilisateur', idUtilisateur],
    queryFn: () => obtenirUtilisateurAdmin(idUtilisateur),
  });

  const fraichir = () => {
    queryClient.invalidateQueries({ queryKey: ['admin'] });
  };

  const optionsMutation = {
    onSuccess: fraichir,
    onError: () => afficherToast(MESSAGES.erreurReseau, 'erreur'),
  };

  const mutationValider = useMutation({
    mutationFn: () => validerIngenieur(idUtilisateur),
    ...optionsMutation,
  });
  const mutationRefuser = useMutation({
    mutationFn: (motif: string) => refuserIngenieur(idUtilisateur, motif),
    onSuccess: () => {
      fraichir();
      setMotifRefus('');
      afficherToast('Ingénieur refusé ; motif notifié.', 'succes');
    },
    onError: () => afficherToast(MESSAGES.erreurReseau, 'erreur'),
  });
  const mutationSuspendre = useMutation({
    mutationFn: () => suspendreUtilisateur(idUtilisateur, motifSuspension),
    onSuccess: () => {
      fraichir();
      setDialogue(null);
      setMotifSuspension('');
      afficherToast('Compte suspendu, sessions révoquées.', 'succes');
    },
    onError: () => afficherToast(MESSAGES.erreurReseau, 'erreur'),
  });
  const mutationReactiver = useMutation({
    mutationFn: () => reactiverUtilisateur(idUtilisateur),
    ...optionsMutation,
  });
  const mutationReinitialiser = useMutation({
    mutationFn: () => reinitialiserMotDePasse(idUtilisateur),
    onSuccess: (donnees) => {
      // Q-23 : affiché une seule fois, jamais conservé en cache.
      setDialogue(null);
      setMotDePasseTemporaire(donnees.mot_de_passe_temporaire);
      fraichir();
    },
    onError: () => afficherToast(MESSAGES.erreurReseau, 'erreur'),
  });

  const ouvrirJustificatif = async (fichierId: string) => {
    const contenu = await chargerContenuFichier(fichierId);
    if (!contenu) {
      afficherToast('Fichier illisible ou accès refusé.', 'erreur');
      return;
    }
    const url = URL.createObjectURL(contenu);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  if (requete.isLoading) return <EtatChargement message="Chargement du dossier…" />;
  if (requete.isError) {
    return <EtatErreur message={MESSAGES.erreurReseau} surReessayer={() => requete.refetch()} />;
  }

  const utilisateur = requete.data!;
  const dossier: ProfilIngenieurAdminApi | null =
    (utilisateur.profil_ingenieur as unknown as ProfilIngenieurAdminApi | null) ?? null;
  const enAttente = dossier?.statut_validation === 'en_attente';

  return (
    <aside
      className="fixed inset-0 z-50 md:z-40 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label={`Dossier de ${utilisateur.nom}`}
      onClick={(evement) => {
        if (evement.target === evement.currentTarget) onFermer();
      }}
      data-testid="panneau-detail-utilisateur"
    >
      <div className="absolute inset-y-0 right-0 w-full max-w-lg bg-surface border-l border-bordure shadow-xl overflow-y-auto p-5 flex flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-texte">{utilisateur.nom}</h2>
            <p className="text-sm text-texte-secondaire" data-testid="detail-telephone">
              {utilisateur.telephone}
            </p>
          </div>
          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer le dossier"
            className="p-2 rounded-md text-texte-secondaire hover:bg-surface-survol"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <BadgeStatut statut={utilisateur.role} registre={STATUTS_ROLE} taille="sm" />
          <BadgeStatut
            statut={utilisateur.statut_compte}
            registre={STATUTS_UTILISATEUR}
            taille="sm"
          />
          {dossier && (
            <BadgeStatut
              statut={dossier.statut_validation}
              registre={STATUTS_VALIDATION_INGENIEUR}
              taille="sm"
            />
          )}
        </div>

        <dl className="text-sm grid grid-cols-2 gap-y-2 border-t border-bordure pt-4">
          <dt className="text-texte-muet">Région</dt>
          <dd className="text-texte">{utilisateur.region ?? '—'}</dd>
          <dt className="text-texte-muet">Inscrit le</dt>
          <dd className="text-texte">
            {new Date(utilisateur.cree_le).toLocaleDateString('fr-FR')}
          </dd>
          <dt className="text-texte-muet">Dernière connexion</dt>
          <dd className="text-texte">
            {utilisateur.derniere_connexion_le
              ? new Date(utilisateur.derniere_connexion_le).toLocaleDateString('fr-FR')
              : 'Jamais'}
          </dd>
          <dt className="text-texte-muet">Réinitialisation demandée</dt>
          <dd className="text-texte">
            {utilisateur.reinitialisation_demandee_le
              ? new Date(utilisateur.reinitialisation_demandee_le).toLocaleDateString('fr-FR')
              : '—'}
          </dd>
        </dl>

        {/* Dossier ingénieur : spécialités, tarif, justificatifs (D-13) */}
        {dossier && (
          <section className="border-t border-bordure pt-4 flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-texte">Dossier de candidature</h3>
            <p className="text-xs text-texte-secondaire">
              Spécialités : {dossier.specialites.join(', ') || '—'} · Tarif :{' '}
              {dossier.tarif_consultation_fcfa ?? '—'} FCFA
            </p>
            {dossier.statut_validation === 'refuse' && dossier.motif_refus && (
              <p className="text-sm text-erreur" data-testid="detail-motif-refus">
                Motif du refus : {dossier.motif_refus}
              </p>
            )}
            <ul className="flex flex-col gap-2" data-testid="detail-justificatifs">
              {dossier.justificatifs.length === 0 && (
                <li className="text-xs text-texte-muet">Aucun justificatif déposé.</li>
              )}
              {dossier.justificatifs.map((piece) => (
                <li
                  key={piece.id}
                  className="flex items-center gap-2 p-2 rounded-md border border-bordure bg-fond text-sm"
                  data-testid={`justificatif-admin-${piece.type}`}
                >
                  <span className="flex-1 min-w-0 truncate">
                    {LIBELLES_JUSTIFICATIF[piece.type] ?? piece.type} — {piece.nom_original}
                  </span>
                  <BadgeStatut statut={piece.statut} registre={STATUTS_JUSTIFICATIF} taille="sm" />
                  <Bouton
                    type="button"
                    taille="sm"
                    variante="discret"
                    onClick={() => void ouvrirJustificatif(piece.fichier_id)}
                    iconeGauche={<Eye size={16} aria-hidden="true" />}
                    data-testid={`bouton-voir-justificatif-${piece.type}`}
                  >
                    Voir
                  </Bouton>
                </li>
              ))}
            </ul>

            {enAttente && (
              <div className="flex flex-col gap-3 pt-1">
                <div className="flex gap-2">
                  <Bouton
                    type="button"
                    onClick={() => mutationValider.mutate()}
                    disabled={mutationValider.isPending}
                    iconeGauche={<CheckCircle2 size={18} aria-hidden="true" />}
                    data-testid="bouton-valider-ingenieur"
                  >
                    {mutationValider.isPending ? 'Validation…' : 'Valider'}
                  </Bouton>
                </div>
                <Champ
                  label="Motif du refus (obligatoire)"
                  value={motifRefus}
                  onChange={(evement) => setMotifRefus(evement.target.value)}
                  placeholder="Ex. : diplôme illisible."
                  data-testid="champ-motif-refus"
                />
                <Bouton
                  type="button"
                  variante="danger"
                  // PW-F03-03 : bouton refus désactivé sans motif.
                  disabled={motifRefus.trim().length === 0 || mutationRefuser.isPending}
                  onClick={() => mutationRefuser.mutate(motifRefus.trim())}
                  data-testid="bouton-refuser-ingenieur"
                >
                  Refuser
                </Bouton>
              </div>
            )}
          </section>
        )}

        {/* Actions sur le compte */}
        <section className="border-t border-bordure pt-4 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-texte">Actions sur le compte</h3>
          <div className="flex gap-2 flex-wrap">
            {utilisateur.statut_compte === 'suspendu' ? (
              <Bouton
                type="button"
                onClick={() => mutationReactiver.mutate()}
                disabled={mutationReactiver.isPending}
                iconeGauche={<ShieldCheck size={18} aria-hidden="true" />}
                data-testid="bouton-reactiver"
              >
                Réactiver
              </Bouton>
            ) : (
              <Bouton
                type="button"
                variante="danger"
                onClick={() => setDialogue('suspendre')}
                disabled={utilisateur.role === 'super_admin'}
                iconeGauche={<ShieldAlert size={18} aria-hidden="true" />}
                data-testid="bouton-suspendre"
              >
                Suspendre
              </Bouton>
            )}
            <Bouton
              type="button"
              variante="secondaire"
              onClick={() => setDialogue('reinitialiser')}
              iconeGauche={<KeyRound size={18} aria-hidden="true" />}
              data-testid="bouton-reinitialiser-mdp"
            >
              Mot de passe temporaire
            </Bouton>
          </div>

          {/* Q-23 : le mot de passe temporaire n'est affiché qu'une seule fois. */}
          {motDePasseTemporaire && (
            <div
              role="alert"
              className="p-3 rounded-md border border-avertissement/50 bg-avertissement-fond text-sm"
              data-testid="mot-de-passe-temporaire"
            >
              <p className="font-medium text-texte">
                Mot de passe temporaire (à communiquer une seule fois) :
              </p>
              <p
                className="font-mono text-lg tracking-wide mt-1 select-all"
                data-testid="valeur-mdp-temporaire"
              >
                {motDePasseTemporaire}
              </p>
              <Bouton
                type="button"
                taille="sm"
                variante="discret"
                className="mt-2"
                onClick={() => setMotDePasseTemporaire(null)}
              >
                J’ai communiqué ce mot de passe
              </Bouton>
            </div>
          )}
        </section>
      </div>

      {/* Suspension : motif obligatoire (saisie libre dans le dialogue désactivé ici,
          on passe par un bloc inline pour avoir le champ). */}
      {dialogue === 'suspendre' && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50"
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titre-suspension"
            className="w-full max-w-md p-6 bg-surface rounded-lg border border-bordure shadow-lg flex flex-col gap-3"
          >
            <h3 id="titre-suspension" className="text-lg font-bold text-texte">
              Suspendre ce compte ?
            </h3>
            <p className="text-sm text-texte-secondaire">
              L’utilisateur sera déconnecté immédiatement (sessions révoquées) et ne pourra plus se
              connecter. Le motif lui sera affiché.
            </p>
            <Champ
              label="Motif de suspension (obligatoire)"
              value={motifSuspension}
              onChange={(evement) => setMotifSuspension(evement.target.value)}
              data-testid="champ-motif-suspension"
            />
            <div className="flex justify-end gap-3">
              <Bouton type="button" variante="secondaire" onClick={() => setDialogue(null)}>
                {MESSAGES.annuler}
              </Bouton>
              <Bouton
                type="button"
                variante="danger"
                chargement={mutationSuspendre.isPending}
                disabled={motifSuspension.trim().length === 0}
                onClick={() => mutationSuspendre.mutate()}
                data-testid="bouton-confirmer-suspension"
              >
                Suspendre
              </Bouton>
            </div>
          </div>
        </div>
      )}

      <DialogueConfirmation
        ouvert={dialogue === 'reinitialiser'}
        titre="Réinitialiser le mot de passe ?"
        message="Un mot de passe temporaire sera généré et affiché une seule fois. L'utilisateur devra le changer à sa prochaine connexion (Q-23)."
        texteConfirmer="Générer"
        chargement={mutationReinitialiser.isPending}
        surConfirmer={() => mutationReinitialiser.mutate()}
        surAnnuler={() => setDialogue(null)}
      />
    </aside>
  );
};

/** ADM-02 — page liste + recherche + filtres. */
export const PageUtilisateursAdmin: React.FC = () => {
  const [paramsUrl] = useSearchParams();
  const [recherche, setRecherche] = useState('');
  const [role, setRole] = useState(paramsUrl.get('role') ?? '');
  const [statut, setStatut] = useState(paramsUrl.get('statut') ?? '');
  const [page, setPage] = useState(1);
  const [selectionne, setSelectionne] = useState<string | null>(null);
  const taillePage = 20;

  const requete = useQuery({
    queryKey: ['admin', 'utilisateurs', recherche, role, statut, page],
    queryFn: () =>
      listerUtilisateursAdmin({
        recherche: recherche || undefined,
        role: role || undefined,
        statut: statut || undefined,
        page,
      }),
  });

  const colonnes: Colonne<UtilisateurAdminListeApi>[] = [
    {
      cle: 'nom',
      enTete: 'Nom',
      rendu: (u) => (
        <button
          type="button"
          className="text-left font-medium text-primaire hover:underline"
          onClick={() => setSelectionne(u.id)}
          data-testid={`lien-detail-utilisateur-${u.id}`}
        >
          {u.nom}
        </button>
      ),
    },
    {
      cle: 'telephone',
      enTete: 'Téléphone',
      rendu: (u) => <span className="text-sm">{u.telephone}</span>,
    },
    {
      cle: 'role',
      enTete: 'Rôle',
      rendu: (u) => <BadgeStatut statut={u.role} registre={STATUTS_ROLE} taille="sm" />,
    },
    {
      cle: 'statut',
      enTete: 'Statut',
      rendu: (u) => (
        <BadgeStatut statut={u.statut_compte} registre={STATUTS_UTILISATEUR} taille="sm" />
      ),
    },
    {
      cle: 'region',
      enTete: 'Région',
      rendu: (u) => <span className="text-sm">{u.region ?? '—'}</span>,
    },
  ];

  const elements = requete.data?.elements ?? [];

  return (
    <div className="py-6 flex flex-col gap-4" data-testid="page-utilisateurs-admin">
      <div>
        <h1 className="text-xl font-bold text-texte">Gestion des utilisateurs</h1>
        <p className="text-sm text-texte-secondaire mt-1">
          Recherchez, consultez les dossiers et décidez des validations (D-13).
        </p>
      </div>

      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <ChampRecherche
            label="Rechercher un nom ou un téléphone"
            value={recherche}
            onChange={(evement) => {
              setRecherche(evement.target.value);
              setPage(1);
            }}
            surEffacer={() => {
              setRecherche('');
              setPage(1);
            }}
          />
        </div>
        <div className="w-full sm:w-48">
          <Select
            label="Rôle"
            value={role}
            options={ROLE_OPTIONS}
            onChange={(evement) => {
              setRole(evement.target.value);
              setPage(1);
            }}
            data-testid="filtre-role"
          />
        </div>
        <div className="w-full sm:w-56">
          <Select
            label="Statut"
            value={statut}
            options={STATUT_OPTIONS}
            onChange={(evement) => {
              setStatut(evement.target.value);
              setPage(1);
            }}
            data-testid="filtre-statut"
          />
        </div>
      </div>

      {requete.isLoading && <EtatChargement message="Chargement des utilisateurs…" />}
      {requete.isError && (
        <EtatErreur message={MESSAGES.erreurReseau} surReessayer={() => requete.refetch()} />
      )}
      {!requete.isLoading && !requete.isError && elements.length === 0 && (
        <EtatVide
          titre={MESSAGES.aucunResultat}
          message="Aucun compte ne correspond à ces critères."
        />
      )}

      {elements.length > 0 && (
        <TableauResponsive
          colonnes={colonnes}
          donnees={elements}
          cleId={(u) => u.id}
          titreMobile={(u) => u.nom}
          messageVide={MESSAGES.aucunResultat}
        />
      )}

      <Pagination
        pageCourante={page}
        totalElements={requete.data?.total ?? 0}
        taillePage={taillePage}
        surChangementPage={setPage}
      />

      {selectionne && (
        <DetailUtilisateur idUtilisateur={selectionne} onFermer={() => setSelectionne(null)} />
      )}
    </div>
  );
};
