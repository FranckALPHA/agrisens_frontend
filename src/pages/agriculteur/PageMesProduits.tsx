import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Archive, Check } from 'lucide-react';
import { Bouton } from '@/components/Bouton';
import { Champ } from '@/components/Champ';
import { ChampRecherche } from '@/components/ChampRecherche';
import { DialogueConfirmation } from '@/components/DialogueConfirmation';
import { EtatChargement } from '@/components/EtatChargement';
import { EtatErreur } from '@/components/EtatErreur';
import { EtatVide } from '@/components/EtatVide';
import { Select } from '@/components/Select';
import {
  definirStock,
  formaterPrix,
  formaterQuantite,
  listerMesProduits,
  messageErreurProduit,
  retirerProduit,
  type ProduitApi,
} from '@/services/api/produits';

const STATUTS = [
  { valeur: '', libelle: 'Tous statuts' },
  { valeur: 'disponible', libelle: 'Disponible' },
  { valeur: 'epuise', libelle: 'Épuisé' },
  { valeur: 'retire', libelle: 'Retiré' },
];

/** Ligne produit avec modification rapide du stock. */
const LigneProduit: React.FC<{
  produit: ProduitApi;
  surRetirer: (produit: ProduitApi) => void;
}> = ({ produit, surRetirer }) => {
  const clientRequete = useQueryClient();
  const [stockSaisi, setStockSaisi] = useState<string | null>(null);
  const [action, setAction] = useState<'enregistre' | 'erreur' | null>(null);
  const [messageAction, setMessageAction] = useState('');

  const rafraichir = () => {
    void clientRequete.invalidateQueries({ queryKey: ['mes-produits'] });
  };

  const enregistrerStock = async () => {
    if (stockSaisi === null || stockSaisi === '') return;
    setAction(null);
    try {
      await definirStock(produit.id, stockSaisi);
      setAction('enregistre');
      setMessageAction('Stock mis à jour.');
      setStockSaisi(null);
      rafraichir();
    } catch (cause) {
      setAction('erreur');
      setMessageAction(messageErreurProduit(cause));
    }
  };

  return (
    <article
      aria-label={`Produit ${produit.nom}`}
      className="rounded-lg border border-bordure bg-surface p-4 shadow-sm flex flex-col gap-2"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-bold text-texte">{produit.nom}</h2>
          <p className="text-xs text-texte-secondaire">
            {produit.categorie} · {produit.exploitation_nom} · {produit.unite}
          </p>
        </div>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
            produit.statut === 'disponible'
              ? 'bg-succes-fond text-succes-texte border-succes/30'
              : produit.statut === 'epuise'
                ? 'bg-avertissement-fond text-avertissement-texte border-avertissement/30'
                : 'bg-surface-survol text-texte-muet border-bordure'
          }`}
        >
          {produit.statut === 'disponible'
            ? 'Disponible'
            : produit.statut === 'epuise'
              ? 'Épuisé'
              : 'Retiré'}
        </span>
      </div>
      <p className="text-sm">
        <strong>{formaterPrix(produit.prix_unitaire_fcfa)}</strong> / {produit.unite} · Stock :{' '}
        {formaterQuantite(produit.quantite_stock ?? '0', produit.unite)} · Réservé :{' '}
        {formaterQuantite(produit.quantite_reservee, produit.unite)}
      </p>
      {produit.statut !== 'retire' && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-36">
            <Champ
              label="Nouveau stock"
              type="number"
              min="0"
              step="0.001"
              value={stockSaisi ?? ''}
              onChange={(e) => setStockSaisi(e.target.value)}
              aria-label={`Nouveau stock pour ${produit.nom}`}
            />
          </div>
          <Bouton
            taille="sm"
            variante="secondaire"
            onClick={() => void enregistrerStock()}
            disabled={stockSaisi === null || stockSaisi === ''}
            iconeGauche={<Check size={15} />}
          >
            Mettre à jour
          </Bouton>
          {action && (
            <p
              role={action === 'erreur' ? 'alert' : 'status'}
              className="text-xs text-texte-secondaire w-full"
            >
              {messageAction}
            </p>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2 mt-1">
        <Bouton
          taille="sm"
          variante="secondaire"
          to={`/agriculteur/produits/${produit.id}`}
          iconeGauche={<Pencil size={14} />}
        >
          Modifier
        </Bouton>
        {produit.statut !== 'retire' && (
          <Bouton
            taille="sm"
            variante="danger"
            onClick={() => surRetirer(produit)}
            iconeGauche={<Archive size={14} />}
          >
            Retirer
          </Bouton>
        )}
      </div>
    </article>
  );
};

/**
 * AGR-04 — produits de l'agriculteur : recherche, filtre statut, stock et
 * réservé visibles, modification rapide du stock, retrait avec confirmation.
 */
export const PageMesProduits: React.FC = () => {
  const [recherche, setRecherche] = useState('');
  const [statut, setStatut] = useState('');
  const [aRetirer, setARetirer] = useState<ProduitApi | null>(null);
  const [retraitEnCours, setRetraitEnCours] = useState(false);
  const [erreurRetrait, setErreurRetrait] = useState<unknown>(null);
  const clientRequete = useQueryClient();

  const requete = useQuery({
    queryKey: ['mes-produits'],
    queryFn: () => listerMesProduits(1),
  });

  const filtres = useMemo(() => {
    const elements = requete.data?.elements ?? [];
    const terme = recherche.trim().toLowerCase();
    return elements.filter(
      (p) =>
        (statut === '' || p.statut === statut) &&
        (terme === '' ||
          p.nom.toLowerCase().includes(terme) ||
          (p.description ?? '').toLowerCase().includes(terme))
    );
  }, [requete.data, recherche, statut]);

  const confirmerRetrait = async () => {
    if (!aRetirer) return;
    setRetraitEnCours(true);
    setErreurRetrait(null);
    try {
      await retirerProduit(aRetirer.id);
      setARetirer(null);
      await clientRequete.invalidateQueries({ queryKey: ['mes-produits'] });
    } catch (cause) {
      setErreurRetrait(cause);
      setARetirer(null);
    } finally {
      setRetraitEnCours(false);
    }
  };

  if (requete.isLoading) return <EtatChargement pleinePage message="Chargement de vos produits…" />;
  if (requete.isError || !requete.data) {
    return (
      <EtatErreur
        pleinePage
        message={messageErreurProduit(requete.error)}
        surReessayer={() => requete.refetch()}
      />
    );
  }

  return (
    <div className="py-6 flex flex-col gap-4" data-testid="page-mes-produits">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-texte">Mes produits</h1>
          <p className="text-sm text-texte-secondaire">Stock, prix et visibilité au catalogue.</p>
        </div>
        <Bouton to="/agriculteur/produits/nouveau" iconeGauche={<Plus size={18} />}>
          Ajouter un produit
        </Bouton>
      </header>

      {erreurRetrait ? (
        <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-erreur">
          {messageErreurProduit(erreurRetrait)}
        </p>
      ) : null}

      {requete.data.elements.length === 0 ? (
        <EtatVide
          titre="Aucun produit"
          message="Publiez votre premier produit pour apparaître au catalogue."
          action={<Bouton to="/agriculteur/produits/nouveau">Publier un produit</Bouton>}
        />
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <ChampRecherche
                label="Rechercher un produit"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                surEffacer={() => setRecherche('')}
              />
            </div>
            <div className="w-full sm:w-48">
              <Select
                label="Statut"
                value={statut}
                onChange={(e) => setStatut(e.target.value)}
                options={STATUTS}
                data-testid="filtre-statut-produit"
              />
            </div>
          </div>
          {filtres.length === 0 ? (
            <EtatVide
              titre="Aucun résultat"
              message="Modifiez la recherche ou le filtre de statut."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filtres.map((produit) => (
                <LigneProduit key={produit.id} produit={produit} surRetirer={setARetirer} />
              ))}
            </div>
          )}
          <p className="text-sm text-texte-secondaire">
            Voir aussi :{' '}
            <Link to="/catalogue" className="text-primaire underline">
              le catalogue public
            </Link>
            .
          </p>
        </>
      )}

      <DialogueConfirmation
        ouvert={aRetirer !== null}
        titre={aRetirer ? `Retirer « ${aRetirer.nom} » de la vente ?` : 'Retirer ?'}
        message="Le produit disparaîtra du catalogue public, mais son historique est conservé."
        texteConfirmer="Retirer"
        danger
        chargement={retraitEnCours}
        surConfirmer={() => void confirmerRetrait()}
        surAnnuler={() => setARetirer(null)}
      />
    </div>
  );
};
