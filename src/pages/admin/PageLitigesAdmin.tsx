import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Eye, X } from 'lucide-react';
import { BadgeStatut } from '@/components/BadgeStatut';
import { Bouton } from '@/components/Bouton';
import { Champ } from '@/components/Champ';
import { EtatChargement } from '@/components/EtatChargement';
import { EtatErreur } from '@/components/EtatErreur';
import { EtatVide } from '@/components/EtatVide';
import { Select } from '@/components/Select';
import { TableauResponsive, type Colonne } from '@/components/TableauResponsive';
import { useToast } from '@/components/Toast';
import { chargerContenuFichier } from '@/services/api/fichiers';
import { ErreurApi } from '@/services/api/client';
import { formaterPrix } from '@/services/api/produits';
import {
  approuverRemboursement,
  examinerRemboursement,
  executerRemboursement,
  listerRemboursementsAdmin,
  listerSignalementsAdmin,
  messageErreurLitige,
  refuserRemboursement,
  traiterSignalement,
  type RemboursementApi,
  type SignalementApi,
} from '@/services/api/litiges';
import { STATUTS_REMBOURSEMENT, STATUTS_SIGNALEMENT } from '@/theme/statuts';
import { MESSAGES } from '@/theme/messages';

/** Libellés des motifs de remboursement. */
const LIBELLE_MOTIF: Record<string, string> = {
  produit_endommage: 'Produit endommagé',
  produit_incorrect: 'Produit incorrect',
  non_recu: 'Non reçu',
  annulation: 'Annulation',
  autre: 'Autre',
};

const LIBELLE_CIBLE: Record<string, string> = {
  utilisateur: 'Utilisateur',
  message: 'Message',
  produit: 'Produit',
  commande: 'Commande',
  livraison: 'Livraison',
  accompagnement: 'Accompagnement',
};

/** File des remboursements + panneau de décision (ADM-03). */
const FileRemboursements: React.FC = () => {
  const clientRequete = useQueryClient();
  const { afficherToast } = useToast();
  const [filtre, setFiltre] = useState('');
  const [selectionne, setSelectionne] = useState<string | null>(null);

  const requete = useQuery({
    queryKey: ['admin', 'remboursements', filtre],
    queryFn: () => listerRemboursementsAdmin(filtre || undefined),
  });

  const colonnes: Colonne<RemboursementApi>[] = [
    {
      cle: 'commande',
      enTete: 'Commande',
      rendu: (r) => (
        <button
          type="button"
          className="text-left font-medium text-primaire hover:underline"
          onClick={() => setSelectionne(r.id)}
          data-testid={`lien-remboursement-${r.id}`}
        >
          {r.commande_reference}
        </button>
      ),
    },
    {
      cle: 'demandeur',
      enTete: 'Demandeur',
      rendu: (r) => <span className="text-sm">{r.demandeur_nom}</span>,
    },
    {
      cle: 'motif',
      enTete: 'Motif',
      rendu: (r) => <span className="text-sm">{LIBELLE_MOTIF[r.motif] ?? r.motif}</span>,
    },
    {
      cle: 'montant',
      enTete: 'Demandé',
      rendu: (r) => <span className="text-sm">{formaterPrix(r.montant_demande_fcfa)}</span>,
    },
    {
      cle: 'statut',
      enTete: 'Statut',
      rendu: (r) => <BadgeStatut statut={r.statut} registre={STATUTS_REMBOURSEMENT} taille="sm" />,
    },
  ];

  const elements = requete.data ?? [];

  return (
    <div className="flex flex-col gap-4" data-testid="file-remboursements">
      <div className="w-full sm:w-64">
        <Select
          label="Filtrer par statut"
          value={filtre}
          onChange={(e) => setFiltre(e.target.value)}
          options={[
            { valeur: '', libelle: 'Tous les dossiers' },
            { valeur: 'demande', libelle: 'À examiner (demande)' },
            { valeur: 'en_examen', libelle: 'En examen' },
            { valeur: 'approuve', libelle: 'Approuvés (à exécuter)' },
            { valeur: 'effectue', libelle: 'Effectués' },
            { valeur: 'refuse', libelle: 'Refusés' },
          ]}
          data-testid="filtre-statut-remboursement"
        />
      </div>

      {requete.isLoading && <EtatChargement message="Chargement des remboursements…" />}
      {requete.isError && (
        <EtatErreur message={MESSAGES.erreurReseau} surReessayer={() => requete.refetch()} />
      )}
      {!requete.isLoading && !requete.isError && elements.length === 0 && (
        <EtatVide titre={MESSAGES.aucunResultat} message="Aucun dossier de remboursement." />
      )}
      {elements.length > 0 && (
        <TableauResponsive
          colonnes={colonnes}
          donnees={elements}
          cleId={(r) => r.id}
          titreMobile={(r) => r.commande_reference}
          messageVide={MESSAGES.aucunResultat}
        />
      )}

      {selectionne && (
        <PanneauRemboursement
          idRemboursement={selectionne}
          onFermer={() => setSelectionne(null)}
          surAction={() => {
            clientRequete.invalidateQueries({ queryKey: ['admin', 'remboursements'] });
            clientRequete.invalidateQueries({ queryKey: ['admin', 'remboursement'] });
            clientRequete.invalidateQueries({ queryKey: ['admin', 'compteurs'] });
            afficherToast('Dossier mis à jour ; parties notifiées.', 'succes');
          }}
        />
      )}
    </div>
  );
};

/** Panneau de traitement d'un remboursement : preuves + décision Q-26. */
const PanneauRemboursement: React.FC<{
  idRemboursement: string;
  onFermer: () => void;
  surAction: () => void;
}> = ({ idRemboursement, onFermer, surAction }) => {
  const { afficherToast } = useToast();
  const [montant, setMontant] = useState('');
  const [motifRefus, setMotifRefus] = useState('');
  const [reference, setReference] = useState('');
  const [erreur, setErreur] = useState<unknown>(null);

  const requete = useQuery({
    queryKey: ['admin', 'remboursement', idRemboursement],
    queryFn: async () => {
      const file = await listerRemboursementsAdmin();
      return file.find((r) => r.id === idRemboursement) ?? null;
    },
  });

  const executer = async (action: () => Promise<unknown>) => {
    setErreur(null);
    try {
      await action();
      surAction();
    } catch (cause) {
      setErreur(cause);
      afficherToast(
        cause instanceof ErreurApi ? messageErreurLitige(cause) : MESSAGES.erreurReseau,
        'erreur'
      );
    }
  };

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
  const dossier = requete.data;
  if (!dossier) return null;

  const montantNum = Number.parseInt(montant, 10);
  const peutApprouver = Number.isFinite(montantNum) && montantNum > 0;

  return (
    <aside
      className="fixed inset-0 z-50 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label={`Dossier de remboursement ${dossier.commande_reference}`}
      onClick={(e) => e.target === e.currentTarget && onFermer()}
      data-testid="panneau-remboursement"
    >
      <div className="absolute inset-y-0 right-0 w-full max-w-lg bg-surface border-l border-bordure shadow-xl overflow-y-auto p-5 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-texte">{dossier.commande_reference}</h2>
            <BadgeStatut statut={dossier.statut} registre={STATUTS_REMBOURSEMENT} taille="sm" />
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

        <dl className="text-sm grid grid-cols-2 gap-y-2 border-t border-bordure pt-3">
          <dt className="text-texte-muet">Demandeur</dt>
          <dd className="text-texte">{dossier.demandeur_nom}</dd>
          <dt className="text-texte-muet">Motif</dt>
          <dd className="text-texte">{LIBELLE_MOTIF[dossier.motif] ?? dossier.motif}</dd>
          <dt className="text-texte-muet">Montant demandé</dt>
          <dd className="text-texte">{formaterPrix(dossier.montant_demande_fcfa)}</dd>
          {dossier.montant_accorde_fcfa !== null && (
            <>
              <dt className="text-texte-muet">Montant accordé</dt>
              <dd className="text-texte">{formaterPrix(dossier.montant_accorde_fcfa)}</dd>
            </>
          )}
          <dt className="text-texte-muet">Statut initial commande</dt>
          <dd className="text-texte">{dossier.statut_commande_origine}</dd>
        </dl>

        {dossier.motif_decision && (
          <p className="text-sm text-texte-secondaire" data-testid="dossier-motif-decision">
            Décision : {dossier.motif_decision}
          </p>
        )}
        {dossier.reference_operateur && (
          <p className="text-sm text-texte" data-testid="dossier-reference">
            Référence du renvoi : {dossier.reference_operateur}
          </p>
        )}

        <section className="border-t border-bordure pt-3 flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-texte">Preuves</h3>
          {dossier.justificatifs.length === 0 ? (
            <p className="text-xs text-texte-muet">Aucun justificatif fourni.</p>
          ) : (
            <ul className="flex flex-col gap-2" data-testid="dossier-justificatifs">
              {dossier.justificatifs.map((fid) => (
                <li key={fid} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 font-mono text-xs truncate">{fid}</span>
                  <Bouton
                    type="button"
                    taille="sm"
                    variante="discret"
                    onClick={() => void ouvrirJustificatif(fid)}
                    iconeGauche={<Eye size={16} aria-hidden="true" />}
                  >
                    Voir
                  </Bouton>
                </li>
              ))}
            </ul>
          )}
        </section>

        {erreur ? (
          <p role="alert" className="text-sm text-erreur">
            {erreur instanceof ErreurApi ? messageErreurLitige(erreur) : 'Action impossible.'}
          </p>
        ) : null}

        <section className="border-t border-bordure pt-3 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-texte">Décision</h3>

          {dossier.statut === 'demande' && (
            <Bouton
              type="button"
              variante="secondaire"
              onClick={() => void executer(() => examinerRemboursement(dossier.id))}
              data-testid="bouton-examiner"
            >
              Marquer en examen
            </Bouton>
          )}

          {(dossier.statut === 'demande' || dossier.statut === 'en_examen') && (
            <>
              <Champ
                label="Montant accordé (FCFA, total ou partiel)"
                type="number"
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                aide={`Maximum ${dossier.montant_demande_fcfa} FCFA.`}
                data-testid="champ-montant-accorde"
              />
              <Bouton
                type="button"
                disabled={!peutApprouver}
                onClick={() => void executer(() => approuverRemboursement(dossier.id, montantNum))}
                data-testid="bouton-approuver"
              >
                Approuver
              </Bouton>
              <Champ
                label="Motif du refus (obligatoire)"
                value={motifRefus}
                onChange={(e) => setMotifRefus(e.target.value)}
                data-testid="champ-motif-refus-remboursement"
              />
              <Bouton
                type="button"
                variante="danger"
                disabled={motifRefus.trim().length === 0}
                onClick={() =>
                  void executer(() => refuserRemboursement(dossier.id, motifRefus.trim()))
                }
                data-testid="bouton-refuser-remboursement"
              >
                Refuser
              </Bouton>
            </>
          )}

          {dossier.statut === 'approuve' && (
            <>
              <p className="text-xs text-texte-secondaire">
                Renvoi effectué hors plateforme (Q-26) : enregistrez la référence opérateur.
              </p>
              <Champ
                label="Référence du renvoi (obligatoire)"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                data-testid="champ-reference"
              />
              <Bouton
                type="button"
                disabled={reference.trim().length === 0}
                onClick={() =>
                  void executer(() => executerRemboursement(dossier.id, reference.trim()))
                }
                data-testid="bouton-executer"
              >
                Enregistrer l’exécution
              </Bouton>
            </>
          )}

          {(dossier.statut === 'effectue' || dossier.statut === 'refuse') && (
            <p className="text-sm text-texte-muet">Dossier clôturé.</p>
          )}
        </section>
      </div>
    </aside>
  );
};

/** File des signalements + panneau de traitement (ADM-03). */
const FileSignalements: React.FC = () => {
  const clientRequete = useQueryClient();
  const { afficherToast } = useToast();
  const [filtre, setFiltre] = useState('');
  const [selectionne, setSelectionne] = useState<string | null>(null);

  const requete = useQuery({
    queryKey: ['admin', 'signalements', filtre],
    queryFn: () => listerSignalementsAdmin(filtre || undefined),
  });

  const colonnes: Colonne<SignalementApi>[] = [
    {
      cle: 'cible',
      enTete: 'Cible',
      rendu: (s) => (
        <button
          type="button"
          className="text-left font-medium text-primaire hover:underline"
          onClick={() => setSelectionne(s.id)}
          data-testid={`lien-signalement-${s.id}`}
        >
          {LIBELLE_CIBLE[s.cible_type] ?? s.cible_type}
        </button>
      ),
    },
    {
      cle: 'auteur',
      enTete: 'Auteur',
      rendu: (s) => <span className="text-sm">{s.auteur_nom}</span>,
    },
    { cle: 'motif', enTete: 'Motif', rendu: (s) => <span className="text-sm">{s.motif}</span> },
    {
      cle: 'statut',
      enTete: 'Statut',
      rendu: (s) => <BadgeStatut statut={s.statut} registre={STATUTS_SIGNALEMENT} taille="sm" />,
    },
  ];

  const elements = requete.data ?? [];

  return (
    <div className="flex flex-col gap-4" data-testid="file-signalements">
      <div className="w-full sm:w-64">
        <Select
          label="Filtrer par statut"
          value={filtre}
          onChange={(e) => setFiltre(e.target.value)}
          options={[
            { valeur: '', libelle: 'Tous les signalements' },
            { valeur: 'ouvert', libelle: 'Ouverts' },
            { valeur: 'en_examen', libelle: 'En examen' },
            { valeur: 'clos_fonde', libelle: 'Closés — fondés' },
            { valeur: 'clos_non_fonde', libelle: 'Closés — non fondés' },
          ]}
          data-testid="filtre-statut-signalement"
        />
      </div>

      {requete.isLoading && <EtatChargement message="Chargement des signalements…" />}
      {requete.isError && (
        <EtatErreur message={MESSAGES.erreurReseau} surReessayer={() => requete.refetch()} />
      )}
      {!requete.isLoading && !requete.isError && elements.length === 0 && (
        <EtatVide titre={MESSAGES.aucunResultat} message="Aucun signalement." />
      )}
      {elements.length > 0 && (
        <TableauResponsive
          colonnes={colonnes}
          donnees={elements}
          cleId={(s) => s.id}
          titreMobile={(s) => `${LIBELLE_CIBLE[s.cible_type] ?? s.cible_type} — ${s.auteur_nom}`}
          messageVide={MESSAGES.aucunResultat}
        />
      )}

      {selectionne && (
        <PanneauSignalement
          idSignalement={selectionne}
          onFermer={() => setSelectionne(null)}
          surAction={() => {
            clientRequete.invalidateQueries({ queryKey: ['admin', 'signalements'] });
            clientRequete.invalidateQueries({ queryKey: ['admin', 'signalement'] });
            clientRequete.invalidateQueries({ queryKey: ['admin', 'compteurs'] });
            afficherToast('Signalement traité ; auteur notifié.', 'succes');
          }}
        />
      )}
    </div>
  );
};

/** Panneau de traitement d'un signalement. */
const PanneauSignalement: React.FC<{
  idSignalement: string;
  onFermer: () => void;
  surAction: () => void;
}> = ({ idSignalement, onFermer, surAction }) => {
  const { afficherToast } = useToast();
  const [statut, setStatut] = useState<'en_examen' | 'clos_fonde' | 'clos_non_fonde'>('en_examen');
  const [decision, setDecision] = useState('');
  const [erreur, setErreur] = useState<unknown>(null);

  const requete = useQuery({
    queryKey: ['admin', 'signalement', idSignalement],
    queryFn: async () => {
      const file = await listerSignalementsAdmin();
      return file.find((s) => s.id === idSignalement) ?? null;
    },
  });

  const cloture = statut === 'clos_fonde' || statut === 'clos_non_fonde';
  const peutTraiter = !cloture || decision.trim().length > 0;

  const traiter = async () => {
    setErreur(null);
    try {
      await traiterSignalement(idSignalement, { statut, decision: decision.trim() });
      surAction();
      onFermer();
    } catch (cause) {
      setErreur(cause);
      afficherToast(
        cause instanceof ErreurApi ? messageErreurLitige(cause) : MESSAGES.erreurReseau,
        'erreur'
      );
    }
  };

  if (requete.isLoading) return <EtatChargement message="Chargement du signalement…" />;
  const dossier = requete.data;
  if (!dossier) return null;

  return (
    <aside
      className="fixed inset-0 z-50 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label="Signalement"
      onClick={(e) => e.target === e.currentTarget && onFermer()}
      data-testid="panneau-signalement"
    >
      <div className="absolute inset-y-0 right-0 w-full max-w-lg bg-surface border-l border-bordure shadow-xl overflow-y-auto p-5 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-texte">
              {LIBELLE_CIBLE[dossier.cible_type] ?? dossier.cible_type}
            </h2>
            <BadgeStatut statut={dossier.statut} registre={STATUTS_SIGNALEMENT} taille="sm" />
          </div>
          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer"
            className="p-2 rounded-md text-texte-secondaire hover:bg-surface-survol"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <dl className="text-sm grid grid-cols-2 gap-y-2 border-t border-bordure pt-3">
          <dt className="text-texte-muet">Auteur</dt>
          <dd className="text-texte">{dossier.auteur_nom}</dd>
          <dt className="text-texte-muet">Motif</dt>
          <dd className="text-texte">{dossier.motif}</dd>
        </dl>
        <p className="text-sm text-texte rounded-md border border-bordure bg-fond p-3">
          {dossier.description}
        </p>
        {dossier.decision && (
          <p className="text-sm text-texte-secondaire" data-testid="signalement-decision">
            Décision : {dossier.decision}
          </p>
        )}

        <section className="border-t border-bordure pt-3 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-texte">Traitement</h3>
          <Select
            label="Nouveau statut"
            value={statut}
            onChange={(e) =>
              setStatut(e.target.value as 'en_examen' | 'clos_fonde' | 'clos_non_fonde')
            }
            options={[
              { valeur: 'en_examen', libelle: 'Mettre en examen' },
              { valeur: 'clos_fonde', libelle: 'Clore — fondé' },
              { valeur: 'clos_non_fonde', libelle: 'Clore — non fondé' },
            ]}
            data-testid="selecteur-statut-signalement"
          />
          {cloture && (
            <Champ
              label="Décision écrite (obligatoire pour clore)"
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
              data-testid="champ-decision-signalement"
            />
          )}
          {erreur ? (
            <p role="alert" className="text-sm text-erreur">
              {erreur instanceof ErreurApi ? messageErreurLitige(erreur) : 'Traitement impossible.'}
            </p>
          ) : null}
          <Bouton
            type="button"
            disabled={!peutTraiter}
            onClick={() => void traiter()}
            data-testid="bouton-traiter-signalement"
          >
            Enregistrer la décision
          </Bouton>
        </section>
      </div>
    </aside>
  );
};

/**
 * ADM-03 — Litiges et remboursements (prompt F-09 frontend point 2) : deux
 * files de traitement (remboursements, signalements), décisions total/partiel
 * avec motif, enregistrement de la référence du renvoi (Q-26).
 */
export const PageLitigesAdmin: React.FC = () => {
  const [paramsUrl, setParamsUrl] = useSearchParams();
  const onglet = paramsUrl.get('tab') === 'signalements' ? 'signalements' : 'remboursements';

  const choisir = (prochain: 'remboursements' | 'signalements') => {
    const suivants = new URLSearchParams(paramsUrl);
    suivants.set('tab', prochain);
    setParamsUrl(suivants);
  };

  return (
    <div className="py-6 flex flex-col gap-4" data-testid="page-litiges-admin">
      <div>
        <h1 className="text-xl font-bold text-texte">Litiges et remboursements</h1>
        <p className="text-sm text-texte-secondaire mt-1">
          Traitez les demandes de remboursement et les signalements des utilisateurs.
        </p>
      </div>

      <div className="flex gap-2 border-b border-bordure" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={onglet === 'remboursements'}
          onClick={() => choisir('remboursements')}
          className={
            onglet === 'remboursements'
              ? 'px-4 py-2 text-sm font-medium border-b-2 border-primaire text-primaire'
              : 'px-4 py-2 text-sm text-texte-secondaire'
          }
          data-testid="onglet-remboursements"
        >
          Remboursements
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={onglet === 'signalements'}
          onClick={() => choisir('signalements')}
          className={
            onglet === 'signalements'
              ? 'px-4 py-2 text-sm font-medium border-b-2 border-primaire text-primaire'
              : 'px-4 py-2 text-sm text-texte-secondaire'
          }
          data-testid="onglet-signalements"
        >
          Signalements
        </button>
      </div>

      {onglet === 'remboursements' ? <FileRemboursements /> : <FileSignalements />}
    </div>
  );
};
