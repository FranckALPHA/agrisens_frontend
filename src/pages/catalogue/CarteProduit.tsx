import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, User } from 'lucide-react';
import type { ProduitCatalogueApi } from '@/services/api/produits';
import { formaterPrix, formaterQuantite } from '@/services/api/produits';
import { PhotoProduit } from './PhotoProduit';

/**
 * ACH-02 — carte produit du catalogue : photo, nom, prix, unité, région,
 * disponibilité, producteur. Aucune donnée privée (D-21).
 */
export const CarteProduit: React.FC<{ produit: ProduitCatalogueApi }> = ({ produit }) => {
  const premierePhoto = [...(produit.photos ?? [])].sort((a, b) => a.ordre - b.ordre)[0];

  return (
    <article
      aria-label={`Produit ${produit.nom}`}
      className="rounded-lg border border-bordure bg-surface shadow-sm overflow-hidden flex flex-col"
    >
      <Link to={`/catalogue/${produit.id}`} aria-label={`Voir ${produit.nom}`}>
        {premierePhoto ? (
          <PhotoProduit fichierId={premierePhoto.fichier_id} alt={produit.nom} />
        ) : (
          <div
            className="h-40 w-full flex items-center justify-center bg-surface-survol text-texte-muet text-sm"
            role="img"
            aria-label="Aucune photo"
          >
            Sans photo
          </div>
        )}
      </Link>
      <div className="p-4 flex flex-col gap-1 flex-1">
        <h2 className="font-bold text-texte">
          <Link to={`/catalogue/${produit.id}`} className="hover:text-primaire">
            {produit.nom}
          </Link>
        </h2>
        <p className="text-sm text-texte-secondaire">
          {produit.categorie} · {produit.region}
        </p>
        <p className="mt-1 text-lg font-bold text-primaire">
          {formaterPrix(produit.prix_unitaire_fcfa)}{' '}
          <span className="text-sm font-normal text-texte-secondaire">/ {produit.unite}</span>
        </p>
        <p className="text-sm text-texte">
          Disponible : {formaterQuantite(produit.quantite_disponible, produit.unite)}
        </p>
        <p className="mt-auto pt-2 text-xs text-texte-muet flex flex-col gap-1">
          <span className="inline-flex items-center gap-1">
            <User size={13} aria-hidden="true" /> {produit.producteur_nom}
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin size={13} aria-hidden="true" /> {produit.region}
          </span>
        </p>
      </div>
    </article>
  );
};
