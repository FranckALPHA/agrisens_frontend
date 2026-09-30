import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, Save, Trash2, Pencil, User } from 'lucide-react';
import { Champ } from '@/components/Champ';
import { Bouton } from '@/components/Bouton';
import { EtatChargement } from '@/components/EtatChargement';
import { EtatErreur } from '@/components/EtatErreur';
import { EtatVide } from '@/components/EtatVide';
import { DialogueConfirmation } from '@/components/DialogueConfirmation';
import { SelecteurPosition, type PositionGeographique } from '@/components/SelecteurPosition';
import { useToast } from '@/components/Toast';
import {
  normaliserErreur,
  modifierMoi,
  listerAdresses,
  creerAdresse,
  modifierAdresse,
  supprimerAdresse,
  CODE_ERREUR_RESEAU,
  type Adresse,
} from '@/services/api/auth';
import { mapperUtilisateur, useSessionStore } from '@/stores/session';
import {
  normaliserTelephone,
  schemaProfil,
  schemaAdresse,
  type DonneesAdresse,
} from '@/pages/auth/validations';
import { FormulaireChangementMotDePasse } from '@/pages/compte/FormulaireMotDePasse';
import { MESSAGES } from '@/theme/messages';

interface ProfilForm {
  nom: string;
  email?: string;
  region?: string;
  telephone: string;
}

/** FE-04 — Profil : données personnelles, mot de passe, adresses (F-02). */
export const PageProfil: React.FC = () => {
  const utilisateur = useSessionStore((s) => s.utilisateur);
  const appliquerUtilisateur = useSessionStore((s) => s.definirUtilisateur);
  const { afficherToast } = useToast();

  return (
    <div className="py-4 flex flex-col gap-10 max-w-3xl">
      <h1 className="text-2xl font-bold text-texte">Mon profil</h1>

      {/* 1. Données personnelles */}
      <section aria-labelledby="titre-donnees" className="flex flex-col gap-4">
        <h2 id="titre-donnees" className="text-lg font-semibold text-texte flex items-center gap-2">
          <User size={18} aria-hidden="true" /> Données personnelles
        </h2>
        {utilisateur ? (
          <FormulaireProfil
            utilisateur={utilisateur}
            onEnregistre={(u) => {
              appliquerUtilisateur(mapperUtilisateur(u));
              afficherToast('Profil mis à jour.', 'succes');
            }}
            onReseauHorsLigne={() => afficherToast(MESSAGES.erreurReseau, 'erreur')}
          />
        ) : null}
      </section>

      {/* 2. Mot de passe */}
      <section
        aria-labelledby="titre-mdp"
        className="flex flex-col gap-4 border-t border-bordure pt-8"
      >
        <h2 id="titre-mdp" className="text-lg font-semibold text-texte">
          Mot de passe
        </h2>
        <FormulaireChangementMotDePasse
          onSucces={() => afficherToast('Mot de passe changé.', 'succes')}
        />
      </section>

      {/* 3. Adresses */}
      <section
        aria-labelledby="titre-adresses"
        className="flex flex-col gap-4 border-t border-bordure pt-8"
      >
        <h2
          id="titre-adresses"
          className="text-lg font-semibold text-texte flex items-center gap-2"
        >
          <MapPin size={18} aria-hidden="true" /> Mes adresses
        </h2>
        <GestionAdresses />
      </section>
    </div>
  );
};

const FormulaireProfil: React.FC<{
  utilisateur: ReturnType<typeof mapperUtilisateur>;
  onEnregistre: (u: Awaited<ReturnType<typeof modifierMoi>>) => void;
  onReseauHorsLigne: () => void;
}> = ({ utilisateur, onEnregistre, onReseauHorsLigne }) => {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProfilForm>({
    resolver: zodResolver(schemaProfil),
    mode: 'onBlur',
    defaultValues: {
      nom: utilisateur.nom,
      email: utilisateur.email ?? '',
      region: utilisateur.region ?? '',
      telephone: utilisateur.telephone,
    },
  });

  const surSoumission = async (donnees: ProfilForm) => {
    try {
      const maj = await modifierMoi({
        nom: donnees.nom,
        email: donnees.email || null,
        region: donnees.region || undefined,
        // Hypothèse Q-33 : le titulaire peut changer son téléphone, utilisé
        // comme identifiant de connexion ; unicité contrôlée par le service.
        telephone: normaliserTelephone(donnees.telephone) ?? donnees.telephone,
      });
      onEnregistre(maj);
    } catch (err) {
      const erreur = normaliserErreur(err);
      if (erreur.code === CODE_ERREUR_RESEAU) {
        onReseauHorsLigne();
        return;
      }
      if (erreur.code === 'compte_existant') {
        const champ = (erreur.details as { champ?: string } | undefined)?.champ;
        setError(champ === 'email' ? 'email' : 'telephone', {
          message:
            champ === 'email'
              ? 'Un compte utilise déjà cette adresse email.'
              : 'Un compte utilise déjà ce numéro de téléphone.',
        });
        return;
      }
      setError('nom', { message: erreur.message || MESSAGES.erreurInconnue });
    }
  };

  return (
    <form
      onSubmit={handleSubmit(surSoumission)}
      noValidate
      className="grid grid-cols-1 sm:grid-cols-2 gap-4"
    >
      <Champ label="Nom complet" required erreur={errors.nom?.message} {...register('nom')} />
      <Champ
        label="Téléphone (identifiant de connexion)"
        type="tel"
        required
        aide="Ce numéro sert aussi à se connecter ; le modifier change votre identifiant."
        erreur={errors.telephone?.message}
        {...register('telephone')}
      />
      <Champ
        label="Email (facultatif)"
        type="email"
        erreur={errors.email?.message}
        {...register('email')}
      />
      <Champ
        label="Région"
        placeholder="Ex : Littoral"
        erreur={errors.region?.message}
        {...register('region')}
      />
      <div className="sm:col-span-2">
        <Bouton
          type="submit"
          chargement={isSubmitting}
          iconeGauche={<Save size={18} aria-hidden="true" />}
        >
          {MESSAGES.enregistrer}
        </Bouton>
      </div>
    </form>
  );
};

/** Liste + création + modification + suppression des adresses du compte. */
const GestionAdresses: React.FC = () => {
  const queryClient = useQueryClient();
  const { afficherToast } = useToast();
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [adresseEnEdition, setAdresseEnEdition] = useState<Adresse | null>(null);
  const [adresseASupprimer, setAdresseASupprimer] = useState<Adresse | null>(null);

  const requeteAdresses = useQuery({
    queryKey: ['moi', 'adresses'],
    queryFn: listerAdresses,
  });

  const aprèsMutation = () => {
    queryClient.invalidateQueries({ queryKey: ['moi', 'adresses'] });
    setFormulaireOuvert(false);
    setAdresseEnEdition(null);
  };

  const mutationSuppression = useMutation({
    mutationFn: (id: string) => supprimerAdresse(id),
    onSuccess: () => {
      aprèsMutation();
      afficherToast('Adresse supprimée.', 'succes');
    },
    onError: (err) => afficherToast(normaliserErreur(err).message, 'erreur'),
  });

  return (
    <div className="flex flex-col gap-4">
      {requeteAdresses.isLoading && <EtatChargement message="Récupération de vos adresses…" />}
      {requeteAdresses.isError && (
        <EtatErreur
          message="Impossible de charger vos adresses."
          surReessayer={() => requeteAdresses.refetch()}
          chargement={requeteAdresses.isFetching}
        />
      )}
      {requeteAdresses.data && requeteAdresses.data.length === 0 && !formulaireOuvert && (
        <EtatVide
          titre="Aucune adresse"
          message="Ajoutez vos lieux de retrait ou de livraison (champ, domicile, boutique)."
        />
      )}

      {requeteAdresses.data?.map((adresse) => {
        const [longitude = 0, latitude = 0] = adresse.position.coordinates;
        return (
          <div
            key={adresse.id}
            className="flex items-start justify-between gap-3 p-4 rounded-lg border border-bordure bg-surface"
          >
            <div className="min-w-0">
              <p className="font-semibold text-texte text-sm">{adresse.libelle}</p>
              <p className="text-xs text-texte-secondaire">
                {adresse.ville}, {adresse.region}
                {adresse.description ? ` — ${adresse.description}` : ''}
              </p>
              <p className="text-xs text-texte-muet mt-1">
                Position : {latitude.toFixed(5)}, {longitude.toFixed(5)}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                aria-label={`Modifier l'adresse ${adresse.libelle}`}
                onClick={() => {
                  setAdresseEnEdition(adresse);
                  setFormulaireOuvert(true);
                }}
                className="p-2 rounded-md text-texte-secondaire hover:bg-surface-survol"
              >
                <Pencil size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={`Supprimer l'adresse ${adresse.libelle}`}
                onClick={() => setAdresseASupprimer(adresse)}
                className="p-2 rounded-md text-erreur hover:bg-erreur-fond"
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        );
      })}

      {!formulaireOuvert && (
        <Bouton
          type="button"
          variante="secondaire"
          onClick={() => setFormulaireOuvert(true)}
          iconeGauche={<Plus size={18} aria-hidden="true" />}
          className="self-start"
        >
          Ajouter une adresse
        </Bouton>
      )}

      {formulaireOuvert && (
        <FormulaireAdresse
          adresse={adresseEnEdition}
          onAnnule={() => {
            setFormulaireOuvert(false);
            setAdresseEnEdition(null);
          }}
          onEnregistre={(message) => {
            aprèsMutation();
            afficherToast(message, 'succes');
          }}
        />
      )}

      <DialogueConfirmation
        ouvert={adresseASupprimer !== null}
        titre="Supprimer cette adresse ?"
        message={
          adresseASupprimer ? `« ${adresseASupprimer.libelle} » sera définitivement supprimée.` : ''
        }
        danger
        chargement={mutationSuppression.isPending}
        surAnnuler={() => setAdresseASupprimer(null)}
        surConfirmer={() => {
          if (adresseASupprimer) mutationSuppression.mutate(adresseASupprimer.id);
        }}
      />
    </div>
  );
};

interface FormAdresse {
  libelle: string;
  description?: string;
  ville: string;
  region: string;
}

const FormulaireAdresse: React.FC<{
  adresse: Adresse | null;
  onAnnule: () => void;
  onEnregistre: (message: string) => void;
}> = ({ adresse, onAnnule, onEnregistre }) => {
  const [position, setPosition] = useState<PositionGeographique | null>(() => {
    if (!adresse) return null;
    const [longitude = 0, latitude = 0] = adresse.position.coordinates;
    return { latitude, longitude };
  });
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormAdresse>({
    mode: 'onBlur',
    defaultValues: {
      libelle: adresse?.libelle ?? '',
      description: adresse?.description ?? '',
      ville: adresse?.ville ?? '',
      region: adresse?.region ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: (donnees: { corps: DonneesAdresse }) => {
      const corps = {
        libelle: donnees.corps.libelle,
        description: donnees.corps.description || undefined,
        ville: donnees.corps.ville,
        region: donnees.corps.region,
        position: {
          type: 'Point',
          coordinates: [donnees.corps.longitude, donnees.corps.latitude],
        },
      };
      return adresse ? modifierAdresse(adresse.id, corps) : creerAdresse(corps);
    },
    onSuccess: () => onEnregistre(adresse ? 'Adresse modifiée.' : 'Adresse ajoutée.'),
    onError: (err) => {
      const erreur = normaliserErreur(err);
      if (erreur.code === CODE_ERREUR_RESEAU) {
        setError('libelle', { message: MESSAGES.erreurReseau });
        return;
      }
      setError('libelle', { message: erreur.message || MESSAGES.erreurInconnue });
    },
  });

  const surSoumission = (donnees: FormAdresse) => {
    if (!position) {
      setError('ville', {
        message: 'Choisissez une position sur la carte ou saisissez les coordonnées.',
      });
      return;
    }
    const valides = schemaAdresse.safeParse({ ...donnees, ...position });
    if (!valides.success) {
      const premiere = valides.error.errors[0];
      if (premiere) {
        setError(premiere.path[0] as keyof FormAdresse, { message: premiere.message });
      }
      return;
    }
    mutation.mutate({ corps: valides.data });
  };

  return (
    <form
      onSubmit={handleSubmit(surSoumission)}
      noValidate
      className="p-4 rounded-lg border border-primaire/40 bg-slate-50 flex flex-col gap-4"
    >
      <h3 className="font-semibold text-texte">
        {adresse ? 'Modifier l’adresse' : 'Nouvelle adresse'}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Champ
          label="Libellé"
          placeholder="Ex : Domicile, Champ Nord…"
          required
          erreur={errors.libelle?.message}
          {...register('libelle')}
        />
        <Champ
          label="Ville"
          placeholder="Ex : Douala"
          required
          erreur={errors.ville?.message}
          {...register('ville')}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Champ
          label="Région"
          placeholder="Ex : Littoral"
          required
          erreur={errors.region?.message}
          {...register('region')}
        />
        <Champ
          label="Repères (facultatif)"
          placeholder="Ex : après le carrefour…"
          {...register('description')}
        />
      </div>

      <SelecteurPosition value={position} onChange={setPosition} />

      <div className="flex gap-2">
        <Bouton type="submit" chargement={mutation.isPending || isSubmitting}>
          {adresse ? 'Enregistrer les modifications' : 'Ajouter'}
        </Bouton>
        <Bouton type="button" variante="discret" onClick={onAnnule}>
          {MESSAGES.annuler}
        </Bouton>
      </div>
    </form>
  );
};
