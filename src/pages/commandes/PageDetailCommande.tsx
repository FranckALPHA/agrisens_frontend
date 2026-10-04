import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeStatut } from '@/components/BadgeStatut';
import { Bouton } from '@/components/Bouton';
import { Champ } from '@/components/Champ';
import { DialogueConfirmation } from '@/components/DialogueConfirmation';
import { EtatChargement } from '@/components/EtatChargement';
import { BoutonContacter } from '@/components/messages/BoutonContacter';
import { STATUTS_COMMANDE } from '@/theme/statuts';
import { useSessionStore } from '@/stores/session';
import {
  accepterCommande,
  annulerCommande,
  messageErreurCommande,
  obtenirCommande,
  obtenirHistoriqueCommande,
  preparerCommande,
  rejeterCommande,
} from '@/services/api/commandes';
import { formaterPrix, formaterQuantite } from '@/services/api/produits';
import {
  initierPaiement,
  messageErreurPaiement,
  nouvelleCleIdempotence,
  OPERATEURS_PAIEMENT,
  type OperateurPaiement,
} from '@/services/api/paiements';
import { ErreurApi } from '@/services/api/client';
import { useConnexion } from '@/hooks/useConnexion';
import { MESSAGES } from '@/theme/messages';
import { obtenirLivraisonParCommande } from '@/services/api/livraisons';
import { Select } from '@/components/Select';
import { TimelineCommande } from './TimelineCommande';
import { SuiviLivraison } from './SuiviLivraison';
import { SuiviRemboursement } from './SuiviRemboursement';
import { DemandeRemboursement } from './DemandeRemboursement';
import { SignalementProbleme } from './SignalementProbleme';
import { FormulaireEvaluation } from './FormulaireEvaluation';

const ANNULATION_ACHETEUR = ['en_attente', 'acceptee'];
// États où une demande de remboursement est recevable (02 §3.5, service backend).
const REMBOURSABLE = ['livree', 'client_absent', 'echec_livraison'];

/**
 * ACH-07 + AGR-06 (détail) — lignes, frais, total, timeline, actions selon
 * le rôle : l'acheteur annule (avant paiement), l'agriculteur accepte /
 * rejette (motif) / prépare. Adresse exacte masquée avant paiement (D-21).
 */
export const PageDetailCommande: React.FC<{ vue: 'achats' | 'ventes' }> = ({ vue }) => {
  const { identifiant } = useParams();
  const clientRequete = useQueryClient();
  const role = useSessionStore((s) => s.utilisateur?.role);
  const [motif, setMotif] = useState('');
  const [demande, setDemande] = useState<'annuler' | 'rejeter' | null>(null);
  const [operateur, setOperateur] = useState<OperateurPaiement>('mtn_momo');
  const [telephonePaiement, setTelephonePaiement] = useState('');
  const [erreurPaiement, setErreurPaiement] = useState<unknown>(null);
  const [travail, setTravail] = useState(false);
  const [erreur, setErreur] = useState<unknown>(null);
  // F-15 : le paiement reste une action en ligne — jamais mise en file hors connexion.
  const enLigne = useConnexion();

  const requete = useQuery({
    queryKey: ['commande', identifiant],
    queryFn: () => obtenirCommande(identifiant ?? ''),
    enabled: Boolean(identifiant),
    retry: false,
  });
  const requeteHistorique = useQuery({
    queryKey: ['commande-historique', identifiant],
    queryFn: () => obtenirHistoriqueCommande(identifiant ?? ''),
    enabled: Boolean(identifiant) && requete.isSuccess,
    retry: false,
  });
  // Livraison de la commande (F-09 : sert à savoir si un livreur est impliqué pour l'évaluation).
  const requeteLivraison = useQuery({
    queryKey: ['livraison-commande', identifiant],
    queryFn: () => obtenirLivraisonParCommande(identifiant ?? ''),
    enabled: Boolean(identifiant) && requete.isSuccess && role === 'acheteur',
    retry: false,
  });

  if (requete.isLoading) return <EtatChargement pleinePage message="Chargement de la commande…" />;
  if (requete.isError || !requete.data) {
    return (
      <div className="py-12 text-center" data-testid="commande-introuvable">
        <h1 className="text-2xl font-bold text-texte">Commande introuvable</h1>
        <p className="mt-2 text-sm text-texte-secondaire">
          {requete.error instanceof ErreurApi
            ? messageErreurCommande(requete.error)
            : 'Cette commande n’existe pas ou vous n’avez pas le droit de la voir.'}
        </p>
        <p className="mt-4">
          <Link
            to={vue === 'achats' ? '/commandes' : '/agriculteur/commandes'}
            className="text-primaire underline"
          >
            Retour aux commandes
          </Link>
        </p>
      </div>
    );
  }

  const commande = requete.data;
  const estAcheteur = role === 'acheteur';
  const estAgriculteur = role === 'agriculteur' || role === 'super_admin';

  const executer = async (action: () => Promise<unknown>) => {
    setErreur(null);
    setTravail(true);
    try {
      await action();
      setDemande(null);
      setMotif('');
      await clientRequete.invalidateQueries({ queryKey: ['commande', identifiant] });
      await clientRequete.invalidateQueries({ queryKey: ['commande-historique', identifiant] });
    } catch (cause) {
      setErreur(cause);
    } finally {
      setTravail(false);
    }
  };

  const aUnLivreur = Boolean(requeteLivraison.data?.livreur_nom);
  const remboursementEnAttente = commande.statut === 'remboursement_en_attente';

  return (
    <div className="py-6 max-w-2xl flex flex-col gap-5" data-testid="page-detail-commande">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-texte">{commande.reference}</h1>
        <BadgeStatut statut={commande.statut ?? ''} registre={STATUTS_COMMANDE} />
      </div>

      {commande.statut === 'en_attente' && (
        <p
          className="text-sm text-texte-secondaire rounded-md border border-bordure bg-surface p-3"
          role="status"
        >
          {estAcheteur
            ? 'En attente d’acceptation par l’agriculteur.'
            : 'En attente de votre décision : acceptez pour réserver le stock, ou rejetez avec un motif.'}
        </p>
      )}

      {erreur ? (
        <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-erreur">
          {erreur instanceof ErreurApi ? messageErreurCommande(erreur) : 'Action impossible.'}
        </p>
      ) : null}

      <section
        aria-label="Lignes de commande"
        className="rounded-lg border border-bordure bg-surface p-4"
      >
        <h2 className="font-bold text-texte mb-2">Produits</h2>
        <ul className="text-sm flex flex-col gap-1">
          {commande.lignes.map((ligne, index) => (
            <li key={index} className="flex justify-between gap-2">
              <span>
                {ligne.nom_produit} — {formaterQuantite(ligne.quantite ?? '0', ligne.unite ?? '')}
              </span>
              <span className="font-medium">{formaterPrix(ligne.total_ligne_fcfa ?? 0)}</span>
            </li>
          ))}
        </ul>
        <dl className="text-sm mt-3 pt-3 border-t border-bordure flex flex-col gap-1">
          <div className="flex justify-between">
            <dt className="text-texte-secondaire">Sous-total</dt>
            <dd data-testid="commande-sous-total">{formaterPrix(commande.sous_total_fcfa)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-texte-secondaire">Livraison ({commande.distance_km} km)</dt>
            <dd data-testid="commande-frais">{formaterPrix(commande.frais_livraison_fcfa)}</dd>
          </div>
          <div className="flex justify-between text-base">
            <dt className="font-bold">Total</dt>
            <dd className="font-bold" data-testid="commande-total">
              {formaterPrix(commande.total_fcfa)}
            </dd>
          </div>
        </dl>
      </section>

      <section
        aria-label="Livraison"
        className="rounded-lg border border-bordure bg-surface p-4 text-sm"
        data-testid="commande-adresse"
      >
        <h2 className="font-bold text-texte mb-2">Livraison</h2>
        <p>
          {commande.adresse_exacte_visible ? (
            <>{commande.adresse_livraison}</>
          ) : (
            <>Zone : {commande.adresse_livraison} (adresse exacte visible après paiement)</>
          )}
        </p>
        <p className="text-texte-secondaire mt-1">
          {estAcheteur
            ? `Vendeur : ${commande.agriculteur_nom}`
            : `Client : ${commande.acheteur_nom}`}
        </p>
        {/* F-13 ACH-07 / AGR-06 : contacter la contrepartie de la commande. */}
        <div className="mt-3">
          <BoutonContacter commandeId={commande.id} />
        </div>
      </section>

      <section aria-label="Historique">
        <h2 className="font-bold text-texte mb-2">Suivi</h2>
        {requeteHistorique.data ? (
          <TimelineCommande lignes={requeteHistorique.data} />
        ) : (
          <p className="text-sm text-texte-muet">Chargement du suivi…</p>
        )}
      </section>

      {estAcheteur && <SuiviLivraison commandeId={commande.id} />}

      {estAcheteur && (
        <section
          aria-label="Litige et remboursement"
          className="flex flex-col gap-4"
          data-testid="section-litige"
        >
          <SuiviRemboursement commandeId={commande.id} />
          {(REMBOURSABLE.includes(commande.statut ?? '') || remboursementEnAttente) && (
            <DemandeRemboursement
              commandeId={commande.id}
              montantPayeFcfa={commande.total_fcfa}
              onDemande={() => void requete.refetch()}
            />
          )}
          <SignalementProbleme cibleId={commande.id} />
        </section>
      )}

      {estAcheteur && commande.statut === 'livree' && (
        <FormulaireEvaluation commandeId={commande.id} aUnLivreur={aUnLivreur} />
      )}

      {estAcheteur && commande.statut === 'acceptee' && (
        <section
          aria-label="Paiement de la commande"
          className="rounded-lg border border-primaire bg-surface p-4 flex flex-col gap-3"
          data-testid="section-paiement"
        >
          <h2 className="font-bold text-texte">Payer cette commande</h2>
          <p className="text-sm text-texte-secondaire" data-testid="paiement-montant">
            Total à payer : <strong>{formaterPrix(commande.total_fcfa)}</strong>
          </p>
          {erreurPaiement ? (
            <p role="alert" className="text-sm text-erreur">
              {erreurPaiement instanceof ErreurApi
                ? messageErreurPaiement(erreurPaiement)
                : 'Paiement impossible.'}
            </p>
          ) : null}
          <div className="grid sm:grid-cols-2 gap-3">
            <Select
              label="Opérateur Mobile Money"
              value={operateur}
              onChange={(e) => setOperateur(e.target.value as OperateurPaiement)}
              options={OPERATEURS_PAIEMENT.map((o) => ({ valeur: o.valeur, libelle: o.libelle }))}
              data-testid="selecteur-operateur"
            />
            <Champ
              label="Numéro à débiter"
              type="tel"
              placeholder="+2376XXXXXXXX"
              value={telephonePaiement}
              onChange={(e) => setTelephonePaiement(e.target.value)}
              aide="Le compte Mobile Money qui paie."
            />
          </div>
          <div>
            <Bouton
              taille="lg"
              chargement={travail}
              disabled={!enLigne}
              data-testid="bouton-payer"
              onClick={() =>
                void (async () => {
                  setErreurPaiement(null);
                  setTravail(true);
                  try {
                    const paiement = await initierPaiement(
                      commande.id,
                      {
                        operateur,
                        ...(telephonePaiement.trim()
                          ? { telephone: telephonePaiement.trim() }
                          : {}),
                      },
                      nouvelleCleIdempotence()
                    );
                    window.location.href = paiement.url_paiement;
                  } catch (cause) {
                    setErreurPaiement(cause);
                  } finally {
                    setTravail(false);
                  }
                })()
              }
            >
              Payer {formaterPrix(commande.total_fcfa)}
            </Bouton>
            {!enLigne && (
              <p
                role="status"
                className="text-sm text-erreur mt-2"
                data-testid="explication-paiement-hors-ligne"
              >
                {MESSAGES.paiementHorsLigne}
              </p>
            )}
          </div>
          <p className="text-xs text-texte-secondaire">
            Redirection vers l’opérateur (ou le simulateur en local). La commande ne sera marquée
            payée qu’après confirmation.
          </p>
        </section>
      )}

      {estAcheteur && commande.statut === 'paiement_en_attente' && (
        <p
          className="text-sm text-texte-secondaire rounded-md border border-bordure bg-surface p-3"
          role="status"
        >
          Paiement en cours de vérification : la commande sera marquée payée dès la confirmation de
          l’opérateur.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {estAcheteur && ANNULATION_ACHETEUR.includes(commande.statut ?? '') && (
          <Bouton variante="danger" onClick={() => setDemande('annuler')}>
            Annuler la commande
          </Bouton>
        )}
        {estAgriculteur && commande.statut === 'en_attente' && (
          <>
            <Bouton
              onClick={() => void executer(() => accepterCommande(commande.id))}
              chargement={travail}
            >
              Accepter (réserve le stock)
            </Bouton>
            <Bouton variante="secondaire" onClick={() => setDemande('rejeter')}>
              Rejeter
            </Bouton>
          </>
        )}
        {estAgriculteur && commande.statut === 'payee' && (
          <Bouton
            onClick={() => void executer(() => preparerCommande(commande.id))}
            chargement={travail}
          >
            Marquer en préparation
          </Bouton>
        )}
      </div>

      {demande === 'rejeter' && (
        <div className="rounded-lg border border-bordure bg-surface p-4 flex flex-col gap-3">
          <Champ
            label="Motif du rejet (obligatoire, visible par l’acheteur)"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
          />
          <div className="flex gap-2">
            <Bouton
              variante="danger"
              chargement={travail}
              disabled={!motif.trim()}
              onClick={() => void executer(() => rejeterCommande(commande.id, motif.trim()))}
            >
              Confirmer le rejet
            </Bouton>
            <Bouton variante="secondaire" onClick={() => setDemande(null)}>
              Retour
            </Bouton>
          </div>
        </div>
      )}

      <DialogueConfirmation
        ouvert={demande === 'annuler'}
        titre="Annuler cette commande ?"
        message={
          commande.statut === 'acceptee'
            ? 'Le stock réservé sera libéré.'
            : 'La commande sera annulée.'
        }
        texteConfirmer="Annuler la commande"
        danger
        chargement={travail}
        surConfirmer={() => void executer(() => annulerCommande(commande.id))}
        surAnnuler={() => setDemande(null)}
      />
    </div>
  );
};
