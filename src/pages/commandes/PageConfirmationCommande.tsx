import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bouton } from '@/components/Bouton';
import { EtatChargement } from '@/components/EtatChargement';
import { EtatVide } from '@/components/EtatVide';
import { listerAdresses } from '@/services/api/auth';
import { creerCommande, demanderDevis, messageErreurCommande } from '@/services/api/commandes';
import { formaterPrix } from '@/services/api/produits';
import { ErreurApi } from '@/services/api/client';
import { resumerPanier, usePanierStore } from '@/stores/panier';

/**
 * ACH-05 (confirmation, F-06) : récapitulatif (lignes, adresse, devis API)
 * puis création — la commande reste « en attente d'acceptation ».
 * Le paiement arrive en F-07.
 */
export const PageConfirmationCommande: React.FC = () => {
  const navigation = useNavigate();
  const lignes = usePanierStore((s) => s.lignes);
  const vider = usePanierStore((s) => s.vider);
  const adresseId = usePanierStore((s) => s.adresseId);
  const choisirAdresse = usePanierStore((s) => s.choisirAdresse);
  const [erreur, setErreur] = useState<unknown>(null);
  const [envoi, setEnvoi] = useState(false);

  const requeteAdresses = useQuery({
    queryKey: ['mes-adresses'],
    queryFn: listerAdresses,
  });

  const adresses = requeteAdresses.data ?? [];
  const adresseChoisie = adresses.find((a) => a.id === adresseId) ?? adresses[0];

  const requeteDevis = useQuery({
    queryKey: [
      'devis-confirmation',
      lignes.map((l) => `${l.produitId}:${l.quantite}`).join(','),
      adresseChoisie?.id ?? '',
    ],
    queryFn: () =>
      demanderDevis({
        lignes: lignes.map((l) => ({ produit_id: l.produitId, quantite: String(l.quantite) })),
        adresse_id: adresseChoisie!.id,
      }),
    enabled: lignes.length > 0 && Boolean(adresseChoisie),
    retry: false,
  });

  if (lignes.length === 0) {
    return (
      <div className="py-6" data-testid="page-confirmation">
        <h1 className="text-2xl font-bold text-texte mb-4">Confirmation de commande</h1>
        <EtatVide
          titre="Panier vide"
          message="Ajoutez des produits avant de confirmer."
          action={<Bouton to="/catalogue">Voir le catalogue</Bouton>}
        />
      </div>
    );
  }

  const commander = async () => {
    if (!adresseChoisie) return;
    setErreur(null);
    setEnvoi(true);
    try {
      const commande = await creerCommande({
        lignes: lignes.map((l) => ({ produit_id: l.produitId, quantite: String(l.quantite) })),
        adresse_id: adresseChoisie.id,
      });
      vider();
      navigation(`/commandes/${(commande as { id: string }).id}`);
    } catch (cause) {
      setErreur(cause);
    } finally {
      setEnvoi(false);
    }
  };

  const resume = resumerPanier(lignes);
  const devis = requeteDevis.data;

  return (
    <div className="py-6 max-w-2xl flex flex-col gap-5" data-testid="page-confirmation">
      <h1 className="text-2xl font-bold text-texte">Confirmation de commande</h1>
      <p className="text-sm text-texte-secondaire -mt-3">
        {resume.articles} article(s) · {resume.agriculteurNom}
      </p>

      {erreur ? (
        <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-erreur">
          {erreur instanceof ErreurApi ? messageErreurCommande(erreur) : 'Commande impossible.'}
        </p>
      ) : null}

      <section
        aria-label="Produits commandés"
        className="rounded-lg border border-bordure bg-surface p-4"
      >
        <h2 className="font-bold text-texte mb-2">Produits</h2>
        <ul className="text-sm flex flex-col gap-1">
          {lignes.map((ligne) => (
            <li key={ligne.produitId} className="flex justify-between gap-2">
              <span>
                {ligne.nom} — {ligne.quantite} {ligne.unite}
              </span>
              <span className="font-medium">
                {formaterPrix(ligne.prixUnitaireFcfa * ligne.quantite)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-label="Adresse de livraison"
        className="rounded-lg border border-bordure bg-surface p-4"
      >
        <h2 className="font-bold text-texte mb-2">Adresse de livraison</h2>
        {adresses.length > 0 ? (
          <div className="flex flex-col gap-1">
            {adresses.map((adresse) => (
              <label key={adresse.id} className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="adresse-commande"
                  value={adresse.id}
                  checked={(adresseChoisie?.id ?? '') === adresse.id}
                  onChange={() => choisirAdresse(adresse.id)}
                  className="mt-1"
                />
                <span>
                  <strong>{adresse.libelle}</strong> — {adresse.description}, {adresse.ville} (
                  {adresse.region})
                </span>
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-texte-secondaire">
            Ajoutez une adresse depuis{' '}
            <Link to="/profil" className="text-primaire underline">
              votre profil
            </Link>
            .
          </p>
        )}
      </section>

      <section
        aria-label="Montants"
        aria-live="polite"
        className="rounded-lg border border-bordure bg-surface p-4"
        data-testid="recapitulatif-confirmation"
      >
        <h2 className="font-bold text-texte mb-2">Montants (calculés par AgriSens)</h2>
        {requeteDevis.isLoading && <EtatChargement message="Calcul en cours…" />}
        {requeteDevis.error ? (
          <p role="alert" className="text-sm text-erreur">
            {messageErreurCommande(requeteDevis.error)}
          </p>
        ) : null}
        {devis ? (
          <dl className="text-sm flex flex-col gap-1">
            <div className="flex justify-between">
              <dt className="text-texte-secondaire">Sous-total</dt>
              <dd data-testid="confirmation-sous-total">{formaterPrix(devis.sous_total_fcfa)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-texte-secondaire">Livraison ({devis.distance_km} km)</dt>
              <dd data-testid="confirmation-frais">{formaterPrix(devis.frais_livraison_fcfa)}</dd>
            </div>
            <div className="flex justify-between text-base">
              <dt className="font-bold">Total à payer</dt>
              <dd className="font-bold" data-testid="confirmation-total">
                {formaterPrix(devis.total_fcfa)}
              </dd>
            </div>
          </dl>
        ) : null}
      </section>

      <Bouton
        taille="lg"
        pleineLargeur
        chargement={envoi}
        disabled={!devis}
        onClick={() => void commander()}
      >
        Créer la commande
      </Bouton>
      <p className="text-xs text-texte-secondaire">
        La commande restera « en attente d’acceptation » par l’agriculteur. Le paiement en ligne
        arrivera avec la feature F-07.
      </p>
    </div>
  );
};
