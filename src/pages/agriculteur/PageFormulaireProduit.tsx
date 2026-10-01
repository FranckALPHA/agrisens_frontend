import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Eye, Trash2 } from 'lucide-react';
import { Bouton } from '@/components/Bouton';
import { Champ } from '@/components/Champ';
import { Select } from '@/components/Select';
import { EtatChargement } from '@/components/EtatChargement';
import { TeleversementFichier } from '@/components/TeleversementFichier';
import {
  ajouterPhotoProduit,
  creerProduit,
  estProprietaire,
  messageErreurProduit,
  modifierProduit,
  obtenirProduit,
  ordonnerPhotosProduit,
  retirerPhotoProduit,
  type PhotoProduitApi,
  type ProduitApi,
} from '@/services/api/produits';
import { listerExploitations, type ExploitationApi } from '@/services/api/exploitations';
import { listerReferentiel, obtenirParametresPublics } from '@/services/api/communs';
import { ErreurApi } from '@/services/api/client';
import { CarteProduit } from '@/pages/catalogue/CarteProduit';

const CATEGORIES_REPLI = [
  { valeur: 'legumes', libelle: 'Légumes' },
  { valeur: 'fruits', libelle: 'Fruits' },
  { valeur: 'cereales', libelle: 'Céréales' },
  { valeur: 'tubercules', libelle: 'Tubercules' },
  { valeur: 'legumineuses', libelle: 'Légumineuses' },
  { valeur: 'cultures_de_rente', libelle: 'Cultures de rente' },
  { valeur: 'elevage', libelle: 'Élevage' },
  { valeur: 'autre', libelle: 'Autre' },
];

const UNITES_REPLI = [
  { valeur: 'kg', libelle: 'Kilogramme (kg)' },
  { valeur: 'tonne', libelle: 'Tonne' },
  { valeur: 'sac', libelle: 'Sac' },
  { valeur: 'regime', libelle: 'Régime' },
  { valeur: 'piece', libelle: 'Pièce' },
  { valeur: 'litre', libelle: 'Litre' },
];

/**
 * AGR-05 — création et modification d'un produit, avec aperçu avant
 * publication : exploitation, catégorie, unité, prix, quantité,
 * description, photos (ordre modifiable).
 */
export const PageFormulaireProduit: React.FC = () => {
  const { identifiant } = useParams();
  const navigation = useNavigate();
  const modification = Boolean(identifiant);

  const [exploitations, setExploitations] = useState<ExploitationApi[] | null>(null);
  const [produitCharge, setProduitCharge] = useState<ProduitApi | null>(null);
  const [nom, setNom] = useState('');
  const [categorie, setCategorie] = useState('legumes');
  const [unite, setUnite] = useState('kg');
  const [exploitationId, setExploitationId] = useState('');
  const [prix, setPrix] = useState('');
  const [quantite, setQuantite] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<PhotoProduitApi[]>([]);
  const [photosInitiales, setPhotosInitiales] = useState<string[]>([]);
  const [categories, setCategories] = useState(CATEGORIES_REPLI);
  const [unites, setUnites] = useState(UNITES_REPLI);
  const [photosMax, setPhotosMax] = useState(5);
  const [apercu, setApercu] = useState(false);
  const [erreur, setErreur] = useState<unknown>(null);
  const [introuvable, setIntrouvable] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    void listerReferentiel('categorie_produit')
      .then((e) => {
        if (e.length > 0) setCategories(e.map((x) => ({ valeur: x.code, libelle: x.libelle })));
      })
      .catch(() => {});
    void listerReferentiel('unite')
      .then((e) => {
        if (e.length > 0) setUnites(e.map((x) => ({ valeur: x.code, libelle: x.libelle })));
      })
      .catch(() => {});
    void obtenirParametresPublics()
      .then((p) => {
        const max = p['fichiers.photos_produit_max'];
        if (typeof max === 'number' && max > 0) setPhotosMax(max);
      })
      .catch(() => {});
    void listerExploitations()
      .then((liste) => {
        setExploitations(liste);
        if (liste.length === 1 && liste[0] && !identifiant) {
          setExploitationId(liste[0].id);
        }
      })
      .catch((cause: unknown) => setErreur(cause))
      .finally(() => {
        if (!identifiant) setChargement(false);
      });
    if (identifiant) {
      void obtenirProduit(identifiant)
        .then((item) => {
          if (!estProprietaire(item)) {
            setIntrouvable(true);
            return;
          }
          setProduitCharge(item);
          setNom(item.nom);
          setCategorie(item.categorie);
          setUnite(item.unite);
          setExploitationId(item.exploitation);
          setPrix(String(item.prix_unitaire_fcfa));
          setQuantite(String(item.quantite_stock ?? '0'));
          setDescription(item.description ?? '');
          const triees = [...(item.photos ?? [])].sort((a, b) => a.ordre - b.ordre);
          setPhotos(triees);
          setPhotosInitiales(triees.map((p) => p.fichier_id));
        })
        .catch((cause: unknown) => {
          if (cause instanceof ErreurApi && cause.code === 'ressource_introuvable') {
            setIntrouvable(true);
          } else {
            setErreur(cause);
          }
        })
        .finally(() => setChargement(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apercuProduit = useMemo(
    () => ({
      id: identifiant ?? 'apercu',
      nom: nom || 'Nom du produit',
      categorie,
      description,
      unite,
      prix_unitaire_fcfa: Number(prix) || 0,
      quantite_disponible: quantite || '0',
      producteur_nom: 'Vous',
      agriculteur_id: '',
      region: exploitations?.find((e) => e.id === exploitationId)?.region ?? '…',
      localite: '',
      photos: photos.map((p, i) => ({ fichier_id: p.fichier_id, ordre: i })),
      cree_le: new Date().toISOString(),
    }),
    [
      identifiant,
      nom,
      categorie,
      description,
      unite,
      prix,
      quantite,
      exploitations,
      exploitationId,
      photos,
    ]
  );

  if (chargement) return <EtatChargement pleinePage message="Chargement du produit…" />;
  if (introuvable) {
    return (
      <div className="py-12 text-center" data-testid="produit-introuvable">
        <h1 className="text-2xl font-bold text-texte">Produit introuvable</h1>
        <p className="mt-2 text-sm text-texte-secondaire">
          Ce produit n’existe pas ou vous n’avez pas le droit de le modifier.
        </p>
        <p className="mt-4">
          <Link to="/agriculteur/produits" className="text-primaire underline">
            Retour à mes produits
          </Link>
        </p>
      </div>
    );
  }

  const deplacerPhoto = (index: number, direction: -1 | 1) => {
    setPhotos((liste) => {
      const copie = [...liste];
      const cible = index + direction;
      if (cible < 0 || cible >= copie.length) return liste;
      const [photo] = copie.splice(index, 1);
      if (photo) copie.splice(cible, 0, photo);
      return copie;
    });
  };

  const validerChamps = (): string | null => {
    if (!nom.trim()) return 'Le nom du produit est obligatoire.';
    if (!exploitationId) return 'Choisissez l’exploitation de ce produit.';
    const prixNombre = Number(prix);
    if (!Number.isInteger(prixNombre) || prixNombre < 0)
      return 'Le prix doit être un montant FCFA entier, positif ou nul.';
    const quantiteNombre = Number(quantite);
    if (quantite === '' || !Number.isFinite(quantiteNombre) || quantiteNombre < 0)
      return 'La quantité doit être positive.';
    return null;
  };

  const soumettre = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setErreur(null);
    const alerte = validerChamps();
    if (alerte) {
      setErreur(new Error(alerte));
      return;
    }
    setEnvoi(true);
    try {
      if (identifiant && produitCharge) {
        await modifierProduit(identifiant, {
          nom: nom.trim(),
          categorie,
          description: description.trim(),
          unite,
          prix_unitaire_fcfa: Number(prix),
        });
        const initiales = new Set(photosInitiales);
        const actuels = new Set(photos.map((p) => p.fichier_id));
        for (const supprimee of photosInitiales.filter((id) => !actuels.has(id))) {
          await retirerPhotoProduit(identifiant, supprimee);
        }
        for (const photo of photos.filter((p) => !initiales.has(p.fichier_id))) {
          await ajouterPhotoProduit(identifiant, photo.fichier_id);
        }
        await ordonnerPhotosProduit(
          identifiant,
          photos.map((p) => p.fichier_id)
        );
      } else {
        await creerProduit({
          nom: nom.trim(),
          categorie,
          description: description.trim(),
          unite,
          prix_unitaire_fcfa: Number(prix),
          quantite_stock: quantite === '' ? '0' : quantite,
          exploitation_id: exploitationId,
          photo_ids: photos.map((p) => p.fichier_id),
        });
      }
      navigation('/agriculteur/produits');
    } catch (cause) {
      setErreur(cause);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="py-6 max-w-2xl" data-testid="page-formulaire-produit">
      <h1 className="text-2xl font-bold text-texte">
        {modification ? 'Modifier le produit' : 'Nouveau produit'}
      </h1>
      <p className="text-sm text-texte-secondaire mt-1 mb-6">
        Renseignez le produit, ajoutez ses photos, vérifiez l’aperçu puis publiez.
      </p>

      {erreur ? (
        <p
          role="alert"
          className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-erreur"
        >
          {erreur instanceof ErreurApi
            ? messageErreurProduit(erreur)
            : erreur instanceof Error
              ? erreur.message
              : 'Impossible de joindre AgriSens.'}
        </p>
      ) : null}

      {apercu ? (
        <div className="flex flex-col gap-4">
          <h2 className="font-bold text-texte">Aperçu avant publication</h2>
          <p className="text-sm text-texte-secondaire">
            Voici comment les acheteurs verront votre produit au catalogue.
          </p>
          <CarteProduit produit={apercuProduit} />
          <div className="flex gap-2">
            <Bouton type="button" variante="secondaire" onClick={() => setApercu(false)}>
              Retour au formulaire
            </Bouton>
            <Bouton type="button" chargement={envoi} onClick={() => void soumettre()}>
              {modification ? 'Enregistrer' : 'Publier le produit'}
            </Bouton>
          </div>
        </div>
      ) : (
        <form onSubmit={soumettre} noValidate className="flex flex-col gap-4">
          <Champ
            label="Nom du produit"
            required
            value={nom}
            onChange={(e) => setNom(e.target.value)}
          />
          <div className="grid sm:grid-cols-2 gap-4">
            <Select
              label="Exploitation"
              required
              value={exploitationId}
              onChange={(e) => setExploitationId(e.target.value)}
              options={(exploitations ?? []).map((e) => ({ valeur: e.id, libelle: e.nom }))}
              placeholder={exploitations === null ? 'Chargement…' : 'Choisir une exploitation'}
            />
            <Select
              label="Catégorie"
              required
              value={categorie}
              onChange={(e) => setCategorie(e.target.value)}
              options={categories.map((c) => ({ valeur: c.valeur, libelle: c.libelle }))}
            />
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <Select
              label="Unité"
              required
              value={unite}
              onChange={(e) => setUnite(e.target.value)}
              options={unites.map((u) => ({ valeur: u.valeur, libelle: u.libelle }))}
            />
            <Champ
              label="Prix (FCFA)"
              required
              type="number"
              min="0"
              step="1"
              value={prix}
              onChange={(e) => setPrix(e.target.value)}
            />
            {!modification && (
              <Champ
                label="Quantité"
                required
                type="number"
                min="0"
                step="0.001"
                value={quantite}
                onChange={(e) => setQuantite(e.target.value)}
                aide="Le stock se modifie ensuite depuis « Mes produits »."
              />
            )}
          </div>
          <label className="text-sm font-medium text-texte">
            Description
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-md border border-bordure p-3 text-sm bg-surface text-texte"
              aria-label="Description du produit"
            />
          </label>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-texte">
              Photos ({photos.length}/{photosMax})
            </legend>
            <TeleversementFichier
              contexte="produit"
              limiteImageMo={5}
              limiteDocumentMo={10}
              accept="image/jpeg,image/png,image/webp"
              libelle="Ajouter une photo"
              onTeleverse={(fichier) =>
                setPhotos((liste) =>
                  liste.length >= photosMax
                    ? liste
                    : [...liste, { fichier_id: fichier.id, ordre: liste.length }]
                )
              }
            />
            {photos.length > 0 && (
              <ul className="flex flex-col gap-2" data-testid="liste-photos-produit">
                {photos.map((photo, index) => (
                  <li
                    key={photo.fichier_id}
                    className="flex items-center gap-2 rounded-md border border-bordure p-2 text-sm"
                    data-testid={`photo-produit-${index}`}
                  >
                    <span className="font-medium text-texte">Photo {index + 1}</span>
                    <span className="flex gap-1 ml-auto">
                      <button
                        type="button"
                        aria-label={`Avancer la photo ${index + 1}`}
                        disabled={index === 0}
                        onClick={() => deplacerPhoto(index, -1)}
                        className="p-2 rounded-md border border-bordure disabled:opacity-40"
                      >
                        <ArrowUp size={14} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Reculer la photo ${index + 1}`}
                        disabled={index === photos.length - 1}
                        onClick={() => deplacerPhoto(index, 1)}
                        className="p-2 rounded-md border border-bordure disabled:opacity-40"
                      >
                        <ArrowDown size={14} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Retirer la photo ${index + 1}`}
                        onClick={() =>
                          setPhotos((l) => l.filter((p) => p.fichier_id !== photo.fichier_id))
                        }
                        className="p-2 rounded-md border border-bordure text-erreur"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>

          <div className="flex gap-2">
            <Bouton
              type="button"
              variante="secondaire"
              onClick={() => setApercu(true)}
              iconeGauche={<Eye size={16} />}
            >
              Aperçu avant publication
            </Bouton>
            <Bouton type="submit" chargement={envoi}>
              {modification ? 'Enregistrer' : 'Publier le produit'}
            </Bouton>
          </div>
        </form>
      )}
      <p className="mt-2 text-xs text-texte-secondaire">
        Prix affichés en FCFA au catalogue. Le panier sera branché en F-06.
      </p>
    </div>
  );
};
