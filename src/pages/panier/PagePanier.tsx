import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { Bouton } from '@/components/Bouton';
import { DialogueConfirmation } from '@/components/DialogueConfirmation';
import { EtatChargement } from '@/components/EtatChargement';
import { EtatVide } from '@/components/EtatVide';
import { Select } from '@/components/Select';
import { listerAdresses, type Adresse } from '@/services/api/auth';
import { demanderDevis, messageErreurCommande, type DevisApi } from '@/services/api/commandes';
import { formaterPrix } from '@/services/api/produits';
import { resumerPanier, usePanierStore } from '@/stores/panier';

/**
 * ACH-04 — panier : quantités modifiables, avertissement si le stock a
 * changé (vérifié via le devis de l'API), choix de l'adresse, frais et
 * total JAMAIS calculés côté client (toujours le devis de l'API).
 */
export const PagePanier: React.FC = () => {
  const navigation = useNavigate();
  const lignes = usePanierStore((s) => s.lignes);
  const changerQuantite = usePanierStore((s) => s.changerQuantite);
  const retirer = usePanierStore((s) => s.retirer);
  const vider = usePanierStore((s) => s.vider);
  const adresseId = usePanierStore((s) => s.adresseId);
  const choisirAdresse = usePanierStore((s) => s.choisirAdresse);
  const conflit = usePanierStore((s) => s.conflitAgricuiteur);
  const abandonnerRemplacement = usePanierStore((s) => s.abandonnerRemplacement);
  const [aVider, setAVider] = useState(false);

  const requeteAdresses = useQuery({
    queryKey: ['mes-adresses'],
    queryFn: listerAdresses,
  });

  useEffect(() => {
    const adresses = requeteAdresses.data ?? [];
    if (adresses.length > 0 && !adresseId) {
      choisirAdresse(adresses[0]!.id);
    }
  }, [requeteAdresses.data, adresseId, choisirAdresse]);

  const requeteDevis = useQuery({
    queryKey: [
      'devis-panier',
      lignes.map((l) => `${l.produitId}:${l.quantite}`).join(','),
      adresseId,
    ],
    queryFn: () =>
      demanderDevis({
        lignes: lignes.map((l) => ({ produit_id: l.produitId, quantite: String(l.quantite) })),
        adresse_id: adresseId ?? '',
      }),
    enabled: lignes.length > 0 && (adresseId ?? '') !== '',
    retry: false,
  });

  const resume = resumerPanier(lignes);

  if (lignes.length === 0) {
    return (
      <div className="py-6" data-testid="page-panier">
        <h1 className="text-2xl font-bold text-texte mb-4">Mon panier</h1>
        <EtatVide
          titre="Panier vide"
          message="Parcourez le catalogue et ajoutez des produits."
          action={<Bouton to="/catalogue">Voir le catalogue</Bouton>}
        />
      </div>
    );
  }

  const devis: DevisApi | undefined = requeteDevis.data;
  const erreurDevis = requeteDevis.error;

  return (
    <div className="py-6 max-w-2xl flex flex-col gap-5" data-testid="page-panier">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-texte">Mon panier</h1>
          <p className="text-sm text-texte-secondaire mt-1">
            {resume.articles} article(s) · {resume.agriculteurNom}
          </p>
        </div>
        <Bouton taille="sm" variante="discret" onClick={() => setAVider(true)}>
          Vider le panier
        </Bouton>
      </header>

      <ul className="flex flex-col gap-3">
        {lignes.map((ligne) => (
          <li
            key={ligne.produitId}
            className="rounded-lg border border-bordure bg-surface p-4 flex flex-wrap items-center gap-3"
            data-testid={`ligne-panier-${ligne.produitId}`}
          >
            <div className="flex-1 min-w-[10rem]">
              <p className="font-medium text-texte">{ligne.nom}</p>
              <p className="text-xs text-texte-secondaire">
                {formaterPrix(ligne.prixUnitaireFcfa)} / {ligne.unite}
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              Qté
              <input
                type="number"
                min="0"
                step="0.001"
                value={ligne.quantite}
                aria-label={`Quantité pour ${ligne.nom}`}
                onChange={(e) => changerQuantite(ligne.produitId, Number(e.target.value))}
                className="w-24 min-h-tactile px-2 py-1 rounded-md border border-bordure bg-surface text-texte"
              />
              <span className="text-texte-muet">{ligne.unite}</span>
            </label>
            <button
              type="button"
              aria-label={`Retirer ${ligne.nom} du panier`}
              onClick={() => retirer(ligne.produitId)}
              className="p-2 rounded-md text-erreur hover:bg-surface-survol"
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      <div className="rounded-lg border border-bordure bg-surface p-4 flex flex-col gap-3">
        <h2 className="font-bold text-texte">Adresse de livraison</h2>
        {requeteAdresses.isLoading && <EtatChargement message="Chargement des adresses…" />}
        {requeteAdresses.data && requeteAdresses.data.length > 0 ? (
          <Select
            label="Choisir une adresse"
            value={adresseId ?? ''}
            onChange={(e) => choisirAdresse(e.target.value)}
            options={requeteAdresses.data.map((a: Adresse) => ({
              valeur: a.id,
              libelle: `${a.libelle} — ${a.ville}`,
            }))}
            data-testid="selecteur-adresse"
          />
        ) : (
          <p className="text-sm text-texte-secondaire">
            Ajoutez d’abord une adresse depuis{' '}
            <Link to="/profil" className="text-primaire underline">
              votre profil
            </Link>
            .
          </p>
        )}
      </div>

      <div
        className="rounded-lg border border-bordure bg-surface p-4"
        aria-live="polite"
        data-testid="recapitulatif-panier"
      >
        <h2 className="font-bold text-texte mb-2">Récapitulatif</h2>
        {requeteDevis.isLoading && <EtatChargement message="Calcul des frais en cours…" />}
        {erreurDevis ? (
          <div role="alert" className="text-sm text-erreur">
            {messageErreurCommande(erreurDevis)}
          </div>
        ) : null}
        {devis ? (
          <dl className="text-sm flex flex-col gap-1">
            <div className="flex justify-between">
              <dt className="text-texte-secondaire">Sous-total</dt>
              <dd className="font-medium" data-testid="panier-sous-total">
                {formaterPrix(devis.sous_total_fcfa)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-texte-secondaire">Livraison ({devis.distance_km} km)</dt>
              <dd className="font-medium" data-testid="panier-frais">
                {formaterPrix(devis.frais_livraison_fcfa)}
              </dd>
            </div>
            <div className="flex justify-between text-base">
              <dt className="font-bold">Total</dt>
              <dd className="font-bold" data-testid="panier-total">
                {formaterPrix(devis.total_fcfa)}
              </dd>
            </div>
          </dl>
        ) : null}
      </div>

      <Bouton
        pleineLargeur
        taille="lg"
        disabled={!devis}
        onClick={() => navigation('/commandes/confirmation')}
      >
        Continuer vers la confirmation
      </Bouton>

      <DialogueConfirmation
        ouvert={aVider}
        titre="Vider le panier ?"
        message="Toutes les lignes seront supprimées."
        texteConfirmer="Vider"
        danger
        surConfirmer={() => {
          vider();
          setAVider(false);
        }}
        surAnnuler={() => setAVider(false)}
      />
      <DialogueConfirmation
        ouvert={conflit !== null}
        titre="Panier d’un autre agriculteur"
        message={
          conflit
            ? `Une commande concerne un seul agriculteur : vider le panier pour ajouter « ${conflit.nom} » ?`
            : ''
        }
        texteConfirmer="Vider et ajouter"
        texteAnnuler="Garder mon panier"
        surConfirmer={() => usePanierStore.getState().confirmerRemplacement()}
        surAnnuler={abandonnerRemplacement}
      />
    </div>
  );
};
