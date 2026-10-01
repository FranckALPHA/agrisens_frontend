import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapPin, ShoppingCart, User } from 'lucide-react';
import { Bouton } from '@/components/Bouton';
import { EtatChargement } from '@/components/EtatChargement';
import {
  estProprietaire,
  formaterPrix,
  formaterQuantite,
  messageErreurProduit,
  obtenirProduit,
  type ProduitCatalogueApi,
} from '@/services/api/produits';
import { PhotoProduit } from './PhotoProduit';

/**
 * ACH-03 — détail produit : galerie, informations, producteur.
 * Produit retiré/épuisé/inconnu → état « indisponible ».
 * Le panier sera branché en F-06 : bouton désactivé avec explication.
 */
export const PageDetailProduit: React.FC = () => {
  const { identifiant } = useParams();
  const [photoChoisie, setPhotoChoisie] = useState(0);

  const requete = useQuery({
    queryKey: ['produit', identifiant],
    queryFn: () => obtenirProduit(identifiant ?? ''),
    enabled: Boolean(identifiant),
    retry: false,
  });

  if (requete.isLoading) {
    return <EtatChargement pleinePage message="Chargement du produit…" />;
  }

  if (requete.isError || !requete.data) {
    return (
      <div className="py-12 text-center" data-testid="produit-indisponible">
        <h1 className="text-2xl font-bold text-texte">Produit indisponible</h1>
        <p className="mt-2 text-sm text-texte-secondaire">
          {requete.error
            ? messageErreurProduit(requete.error)
            : 'Ce produit n’est plus au catalogue.'}
        </p>
        <p className="mt-4">
          <Link to="/catalogue" className="text-primaire underline">
            Retour au catalogue
          </Link>
        </p>
      </div>
    );
  }

  const produit = requete.data;
  const complete = estProprietaire(produit) ? produit : null;
  const catalogue = produit as ProduitCatalogueApi;
  // Vue mixte (03 SPEC-03) : le propriétaire reçoit tous les champs, les
  // visiteurs la vue publique. Champs publics absents côté propriétaire
  // (pas de région exposée) : repli sur l'exploitation.
  const nomProducteur = complete ? 'Vous (propriétaire)' : catalogue.producteur_nom;
  const region = catalogue.region ?? complete?.exploitation_nom ?? '';
  const localite = catalogue.localite ?? '';
  const photos = [...(produit.photos ?? [])].sort((a, b) => a.ordre - b.ordre);

  return (
    <div className="py-6 max-w-3xl flex flex-col gap-6" data-testid="page-detail-produit">
      <nav aria-label="Fil d’Ariane" className="text-sm">
        <Link to="/catalogue" className="text-primaire underline">
          Catalogue
        </Link>
        <span aria-hidden="true"> / </span>
        <span>{produit.nom}</span>
      </nav>

      {photos.length > 0 ? (
        <div className="flex flex-col gap-2">
          <PhotoProduit
            fichierId={photos[Math.min(photoChoisie, photos.length - 1)]!.fichier_id}
            alt={`${produit.nom} — photo ${photoChoisie + 1}`}
            className="h-72 w-full object-cover rounded-lg border border-bordure"
          />
          {photos.length > 1 && (
            <div className="flex gap-2 flex-wrap" role="group" aria-label="Galerie photos">
              {photos.map((photo, index) => (
                <button
                  key={photo.fichier_id}
                  type="button"
                  onClick={() => setPhotoChoisie(index)}
                  aria-label={`Voir la photo ${index + 1}`}
                  aria-pressed={index === photoChoisie}
                  className={`rounded-md overflow-hidden border-2 ${index === photoChoisie ? 'border-primaire' : 'border-transparent'}`}
                >
                  <PhotoProduit
                    fichierId={photo.fichier_id}
                    alt=""
                    className="h-16 w-16 object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div
          className="h-48 rounded-lg bg-surface-survol flex items-center justify-center text-texte-muet text-sm"
          role="img"
          aria-label="Aucune photo pour ce produit"
        >
          Aucune photo
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-texte">{produit.nom}</h1>
        <p className="text-sm text-texte-secondaire mt-1">
          {produit.categorie}
          {region ? ` · ${region}` : ''}
          {localite ? ` · ${localite}` : ''}
        </p>
        <p className="mt-3 text-2xl font-bold text-primaire">
          {formaterPrix(produit.prix_unitaire_fcfa)}{' '}
          <span className="text-base font-normal text-texte-secondaire">/ {produit.unite}</span>
        </p>
        <p className="mt-1 text-sm text-texte">
          Disponible : {formaterQuantite(produit.quantite_disponible, produit.unite)}
        </p>
        {complete && (
          <p className="mt-1 text-xs text-texte-muet">
            Stock total : {formaterQuantite(complete.quantite_stock ?? '0', produit.unite)} ·
            Réservé : {formaterQuantite(complete.quantite_reservee, produit.unite)} · Statut :{' '}
            {complete.statut}
          </p>
        )}
      </div>

      {produit.description && (
        <section aria-label="Description">
          <h2 className="font-bold text-texte mb-1">Description</h2>
          <p className="text-sm text-texte whitespace-pre-line">{produit.description}</p>
        </section>
      )}

      <section
        aria-label="Producteur"
        className="rounded-lg border border-bordure bg-surface p-4 text-sm"
      >
        <h2 className="font-bold text-texte mb-2">Producteur</h2>
        <p className="flex items-center gap-2 text-texte">
          <User size={16} aria-hidden="true" /> {nomProducteur}
        </p>
        <p className="flex items-center gap-2 text-texte-secondaire mt-1">
          <MapPin size={16} aria-hidden="true" /> Région {region}
        </p>
      </section>

      <div className="flex flex-col gap-2">
        <Bouton disabled iconeGauche={<ShoppingCart size={18} />}>
          Ajouter au panier
        </Bouton>
        <p className="text-xs text-texte-secondaire">
          Le panier et la commande arrivent avec la feature F-06.
        </p>
      </div>
    </div>
  );
};
