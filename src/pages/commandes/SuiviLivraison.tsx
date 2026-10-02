import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeStatut } from '@/components/BadgeStatut';
import { Bouton } from '@/components/Bouton';
import { Champ } from '@/components/Champ';
import { Select } from '@/components/Select';
import { STATUTS_LIVRAISON } from '@/theme/statuts';
import { ErreurApi } from '@/services/api/client';
import {
  messageErreurLivraison,
  obtenirCodeRemise,
  obtenirLivraisonParCommande,
  reprogrammerLivraison,
} from '@/services/api/livraisons';
import {
  messageErreurPaiement,
  nouvelleCleIdempotence,
  OPERATEURS_PAIEMENT,
  type OperateurPaiement,
} from '@/services/api/paiements';
import { formaterDuree } from '@/services/api/livraisons';

/**
 * ACH-08 (suivi acheteur) : statut et livreur de la livraison, code de
 * remise bien visible, reprogrammation après incident (avec paiement des
 * nouveaux frais si client absent). Le livreur et l'agriculteur voient le
 * statut via leurs propres écrans.
 */
export const SuiviLivraison: React.FC<{ commandeId: string }> = ({ commandeId }) => {
  const clientRequete = useQueryClient();
  const [operateur, setOperateur] = useState<OperateurPaiement>('mtn_momo');
  const [telephone, setTelephone] = useState('');
  const [erreur, setErreur] = useState<unknown>(null);
  const [travail, setTravail] = useState(false);

  const requete = useQuery({
    queryKey: ['livraison-commande', commandeId],
    queryFn: () => obtenirLivraisonParCommande(commandeId),
    retry: false,
  });

  if (requete.isLoading) {
    return <p className="text-sm text-texte-muet">Chargement de la livraison…</p>;
  }
  const livraison = requete.data ?? null;
  if (!livraison) return null;

  const reprogrammer = async () => {
    setErreur(null);
    setTravail(true);
    try {
      const resultat = await reprogrammerLivraison(
        livraison.id,
        {
          ...(livraison.statut === 'client_absent'
            ? {
                operateur,
                ...(telephone.trim() ? { telephone: telephone.trim() } : {}),
              }
            : {}),
        },
        nouvelleCleIdempotence()
      );
      if (resultat.url_paiement) {
        window.location.href = resultat.url_paiement;
        return;
      }
      await clientRequete.invalidateQueries({ queryKey: ['livraison-commande', commandeId] });
      await clientRequete.invalidateQueries({ queryKey: ['commande', commandeId] });
    } catch (cause) {
      setErreur(cause);
    } finally {
      setTravail(false);
    }
  };

  return (
    <section
      aria-label="Suivi de la livraison"
      data-testid="suivi-livraison"
      className="rounded-lg border border-bordure bg-surface p-4 flex flex-col gap-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold text-texte">Livraison</h2>
        <BadgeStatut statut={livraison.statut ?? ''} registre={STATUTS_LIVRAISON} taille="sm" />
      </div>

      {livraison.livreur_nom && (
        <p className="text-sm text-texte">
          Livreur : <strong>{livraison.livreur_nom}</strong>
          {livraison.telephone_livreur ? (
            <>
              {' · '}
              <a href={`tel:${livraison.telephone_livreur}`} className="text-primaire underline">
                {livraison.telephone_livreur}
              </a>
            </>
          ) : null}
        </p>
      )}
      <p className="text-sm text-texte-secondaire">
        Distance {livraison.distance_km} km · durée estimée{' '}
        {formaterDuree(livraison.duree_estimee_min)}
      </p>

      {livraison.statut === 'en_cours' && <CodeRemiseVisible commandeId={commandeId} />}

      {(livraison.statut === 'client_absent' || livraison.statut === 'echec_livraison') && (
        <div className="flex flex-col gap-2 rounded-md border border-avertissement/40 bg-avertissement-fond p-3">
          <p className="text-sm text-texte">
            {livraison.statut === 'client_absent'
              ? 'Le livreur ne vous a pas trouvé(e). Reprogrammez : les nouveaux frais de livraison seront à payer.'
              : 'La livraison a échoué. Reprogrammez sans frais.'}
          </p>
          {erreur ? (
            <p role="alert" className="text-sm text-erreur">
              {erreur instanceof ErreurApi
                ? messageErreurLivraison(erreur)
                : messageErreurPaiement(erreur)}
            </p>
          ) : null}
          {livraison.statut === 'client_absent' && (
            <div className="grid sm:grid-cols-2 gap-2">
              <Select
                label="Opérateur des nouveaux frais"
                value={operateur}
                onChange={(e) => setOperateur(e.target.value as OperateurPaiement)}
                options={OPERATEURS_PAIEMENT.map((o) => ({ valeur: o.valeur, libelle: o.libelle }))}
              />
              <Champ
                label="Numéro à débiter"
                type="tel"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
              />
            </div>
          )}
          <div>
            <Bouton chargement={travail} onClick={() => void reprogrammer()}>
              {livraison.statut === 'client_absent'
                ? 'Reprogrammer et payer les frais'
                : 'Reprogrammer sans frais'}
            </Bouton>
          </div>
        </div>
      )}
    </section>
  );
};

/** Code de remise de l'acheteur, affiché en grand pendant la course. */
const CodeRemiseVisible: React.FC<{ commandeId: string }> = ({ commandeId }) => {
  const requete = useQuery({
    queryKey: ['code-remise', commandeId],
    queryFn: () => obtenirCodeRemise(commandeId),
    retry: false,
  });
  if (!requete.data) return null;
  return (
    <div className="rounded-md border border-primaire bg-primaire-douce p-3 text-center">
      <p className="text-xs text-texte-secondaire">Votre code de remise à communiquer au livreur</p>
      <p
        className="text-3xl font-mono font-bold tracking-[0.4em] text-texte"
        data-testid="code-remise"
      >
        {requete.data}
      </p>
    </div>
  );
};
