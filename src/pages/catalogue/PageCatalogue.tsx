import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bouton } from '@/components/Bouton';
import { Champ } from '@/components/Champ';
import { ChampRecherche } from '@/components/ChampRecherche';
import { EtatChargement } from '@/components/EtatChargement';
import { EtatErreur } from '@/components/EtatErreur';
import { EtatVide } from '@/components/EtatVide';
import { Pagination } from '@/components/Pagination';
import { Select } from '@/components/Select';
import { listerCatalogue, type FiltresCatalogue } from '@/services/api/produits';
import { listerReferentiel } from '@/services/api/communs';
import { CarteProduit } from './CarteProduit';

const TRIS = [
  { valeur: 'recent', libelle: 'Plus récents' },
  { valeur: 'prix_asc', libelle: 'Prix croissant' },
  { valeur: 'prix_desc', libelle: 'Prix décroissant' },
];

const CATEGORIES_REPLI = [
  { valeur: '', libelle: 'Toutes catégories' },
  { valeur: 'fruits', libelle: 'Fruits' },
  { valeur: 'legumes', libelle: 'Légumes' },
  { valeur: 'cereales', libelle: 'Céréales' },
  { valeur: 'tubercules', libelle: 'Tubercules' },
  { valeur: 'legumineuses', libelle: 'Légumineuses' },
  { valeur: 'cultures_de_rente', libelle: 'Cultures de rente' },
  { valeur: 'elevage', libelle: 'Élevage' },
  { valeur: 'autre', libelle: 'Autre' },
];

/**
 * ACH-02 — catalogue public : recherche, filtres (catégorie, région, prix),
 * tri, pagination, cartes produit. Tous les états : chargement, vide, erreur.
 */
export const PageCatalogue: React.FC = () => {
  const [recherche, setRecherche] = useState('');
  const [categorie, setCategorie] = useState('');
  const [region, setRegion] = useState('');
  const [prixMin, setPrixMin] = useState('');
  const [prixMax, setPrixMax] = useState('');
  const [tri, setTri] = useState<FiltresCatalogue['tri']>('recent');
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState(CATEGORIES_REPLI);
  const [regions, setRegions] = useState([{ valeur: '', libelle: 'Toutes régions' }]);

  useEffect(() => {
    void listerReferentiel('categorie_produit')
      .then((entrees) => {
        if (entrees.length > 0) {
          setCategories([
            { valeur: '', libelle: 'Toutes catégories' },
            ...entrees.map((e) => ({ valeur: e.code, libelle: e.libelle })),
          ]);
        }
      })
      .catch(() => {});
    void listerReferentiel('region')
      .then((entrees) => {
        if (entrees.length > 0) {
          setRegions([
            { valeur: '', libelle: 'Toutes régions' },
            ...entrees.map((e) => ({ valeur: e.code, libelle: e.libelle })),
          ]);
        }
      })
      .catch(() => {});
  }, []);

  const requete = useQuery({
    queryKey: ['catalogue', recherche, categorie, region, prixMin, prixMax, tri, page],
    queryFn: () =>
      listerCatalogue({
        q: recherche || undefined,
        categorie: categorie || undefined,
        region: region || undefined,
        prixMin: prixMin === '' ? undefined : Number(prixMin),
        prixMax: prixMax === '' ? undefined : Number(prixMax),
        tri,
        page,
        taille: 12,
      }),
  });

  const reinitialiserFiltres = () => {
    setRecherche('');
    setCategorie('');
    setRegion('');
    setPrixMin('');
    setPrixMax('');
    setTri('recent');
    setPage(1);
  };

  return (
    <div className="py-6 flex flex-col gap-6" data-testid="page-catalogue">
      <header>
        <h1 className="text-2xl font-bold text-texte">Catalogue des produits</h1>
        <p className="text-sm text-texte-secondaire mt-1">
          Les récoltes des agriculteurs du Cameroun, en direct de leurs champs.
        </p>
      </header>

      <form
        className="flex flex-col gap-3 rounded-lg border border-bordure bg-surface p-4"
        aria-label="Recherche et filtres du catalogue"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          void requete.refetch();
        }}
      >
        <ChampRecherche
          label="Rechercher un produit"
          value={recherche}
          onChange={(e) => {
            setRecherche(e.target.value);
            setPage(1);
          }}
          surEffacer={() => {
            setRecherche('');
            setPage(1);
          }}
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Select
            label="Catégorie"
            value={categorie}
            onChange={(e) => {
              setCategorie(e.target.value);
              setPage(1);
            }}
            options={categories}
            data-testid="filtre-categorie"
          />
          <Select
            label="Région"
            value={region}
            onChange={(e) => {
              setRegion(e.target.value);
              setPage(1);
            }}
            options={regions}
            data-testid="filtre-region"
          />
          <Champ
            label="Prix min (FCFA)"
            type="number"
            min="0"
            value={prixMin}
            onChange={(e) => {
              setPrixMin(e.target.value);
              setPage(1);
            }}
          />
          <Champ
            label="Prix max (FCFA)"
            type="number"
            min="0"
            value={prixMax}
            onChange={(e) => {
              setPrixMax(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-full sm:w-56">
            <Select
              label="Trier par"
              value={tri ?? 'recent'}
              onChange={(e) => {
                setTri(e.target.value as FiltresCatalogue['tri']);
                setPage(1);
              }}
              options={TRIS}
              data-testid="tri-catalogue"
            />
          </div>
          <Bouton
            type="button"
            variante="secondaire"
            taille="sm"
            className="self-end"
            onClick={reinitialiserFiltres}
          >
            Effacer les filtres
          </Bouton>
        </div>
      </form>

      {requete.isLoading && <EtatChargement message="Chargement du catalogue…" />}
      {requete.isError && (
        <EtatErreur
          message="Impossible de charger le catalogue."
          surReessayer={() => requete.refetch()}
          chargement={requete.isFetching}
        />
      )}
      {requete.data && requete.data.elements.length === 0 && (
        <EtatVide
          titre="Aucun produit trouvé"
          message="Essayez d’autres mots-clés ou élargissez les filtres."
          action={<Bouton onClick={reinitialiserFiltres}>Voir tout le catalogue</Bouton>}
        />
      )}
      {requete.data && requete.data.elements.length > 0 && (
        <>
          <p className="text-sm text-texte-secondaire" aria-live="polite">
            {requete.data.total} produit(s) au catalogue.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {requete.data.elements.map((produit) => (
              <CarteProduit key={produit.id} produit={produit} />
            ))}
          </div>
          <Pagination
            pageCourante={requete.data.page}
            totalElements={requete.data.total}
            taillePage={requete.data.taille}
            surChangementPage={(nouvellePage) => {
              setPage(nouvellePage);
              window.scrollTo({ top: 0 });
            }}
          />
        </>
      )}
    </div>
  );
};
