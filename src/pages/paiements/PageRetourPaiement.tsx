import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bouton } from '@/components/Bouton';
import { EtatChargement } from '@/components/EtatChargement';
import { messageErreurPaiement, obtenirPaiement, type PaiementApi } from '@/services/api/paiements';
import { ErreurApi } from '@/services/api/client';

const DELAI_INTERROGATION_MS = 2000;
const TENTATIVES_MAX = 45;

type PhaseRetour = 'verification' | 'reussi' | 'echoue' | 'expire' | 'erreur';

/**
 * Page de retour après paiement (ACH-05) : interroge `GET /paiements/{id}`
 * jusqu'au statut final. N'affiche JAMAIS « payé » avant la confirmation
 * du backend (le retour navigateur ne fait pas foi).
 */
export const PageRetourPaiement: React.FC = () => {
  const [params] = useSearchParams();
  const paiementId = params.get('paiement') ?? '';
  const [phase, setPhase] = useState<PhaseRetour>('verification');
  const [paiement, setPaiement] = useState<PaiementApi | null>(null);
  const [erreur, setErreur] = useState<unknown>(null);

  useEffect(() => {
    if (!paiementId) {
      setPhase('erreur');
      return;
    }
    let actif = true;
    let tentatives = 0;
    const interroger = async () => {
      tentatives += 1;
      try {
        const etat = await obtenirPaiement(paiementId);
        if (!actif) return;
        setPaiement(etat);
        if (etat.statut === 'reussi') {
          setPhase('reussi');
          return;
        }
        if (etat.statut === 'echoue') {
          setPhase('echoue');
          return;
        }
        if (etat.statut === 'expire') {
          setPhase('expire');
          return;
        }
      } catch (cause) {
        if (!actif) return;
        if (cause instanceof ErreurApi && cause.code === 'ressource_introuvable') {
          setPhase('erreur');
          setErreur(cause);
          return;
        }
        // Erreur réseau transitoire : on réessaie jusqu'au délai max.
      }
      if (actif) {
        if (tentatives >= TENTATIVES_MAX) {
          setPhase('erreur');
          setErreur(new Error('Vérification trop longue, rechargez la page.'));
          return;
        }
        window.setTimeout(() => void interroger(), DELAI_INTERROGATION_MS);
      }
    };
    void interroger();
    return () => {
      actif = false;
    };
  }, [paiementId]);

  return (
    <div
      className="py-12 max-w-xl mx-auto text-center flex flex-col gap-4"
      data-testid="page-retour-paiement"
    >
      {phase === 'verification' && (
        <>
          <h1 className="text-2xl font-bold text-texte">Paiement en cours de vérification</h1>
          <EtatChargement message="Nous attendons la confirmation de l’opérateur Mobile Money…" />
          <p className="text-sm text-texte-secondaire" data-testid="retour-reference">
            {paiement ? `Référence ${paiement.reference_interne ?? ''}` : 'Connexion sécurisée…'}
          </p>
        </>
      )}
      {phase === 'reussi' && (
        <>
          <h1 className="text-2xl font-bold text-succes-texte">Paiement réussi</h1>
          <p className="text-sm text-texte-secondaire">
            Votre commande est payée. L’agriculteur va la préparer.
          </p>
          <p>
            <Link to={`/commandes/${paiement?.commande ?? ''}`} className="text-primaire underline">
              Voir ma commande
            </Link>
          </p>
        </>
      )}
      {phase === 'echoue' && (
        <>
          <h1 className="text-2xl font-bold text-erreur">Paiement échoué</h1>
          <p className="text-sm text-texte-secondaire">
            Le paiement n’a pas abouti. Vous pouvez réessayer depuis votre commande.
          </p>
          <p>
            <Bouton to={`/commandes/${paiement?.commande ?? ''}`}>
              Réessayer depuis la commande
            </Bouton>
          </p>
        </>
      )}
      {phase === 'expire' && (
        <>
          <h1 className="text-2xl font-bold text-texte">Délai de paiement dépassé</h1>
          <p className="text-sm text-texte-secondaire">
            Le délai est dépassé. Retournez à votre commande pour tenter un nouveau paiement si elle
            est encore valable.
          </p>
          <p>
            <Bouton variante="secondaire" to={`/commandes/${paiement?.commande ?? ''}`}>
              Retour à la commande
            </Bouton>
          </p>
        </>
      )}
      {phase === 'erreur' && (
        <>
          <h1 className="text-2xl font-bold text-texte">Vérification impossible</h1>
          <p className="text-sm text-texte-secondaire" role="alert">
            {erreur instanceof ErreurApi
              ? messageErreurPaiement(erreur)
              : 'Rechargez la page pour relancer la vérification.'}
          </p>
          <p>
            <Bouton variante="secondaire" to="/commandes">
              Mes commandes
            </Bouton>
          </p>
        </>
      )}
    </div>
  );
};
