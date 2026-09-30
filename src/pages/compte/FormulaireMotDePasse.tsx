import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { Champ } from '@/components/Champ';
import { Bouton } from '@/components/Bouton';
import { normaliserErreur, changerMotDePasse, CODE_ERREUR_RESEAU } from '@/services/api/auth';
import { mapperUtilisateur, useSessionStore } from '@/stores/session';
import { schemaChangementMotDePasse } from '@/pages/auth/validations';
import { MESSAGES } from '@/theme/messages';

interface MotDePasseForm {
  motDePasseActuel: string;
  nouveauMotDePasse: string;
  confirmation: string;
}

/**
 * Formulaire de changement de mot de passe (PUT /utilisateurs/moi/mot-de-passe).
 * Utilisé par FE-04 Profil et par l'écran de changement obligatoire
 * (mot de passe temporaire remis par un administrateur, PW-F02-11).
 */
export const FormulaireChangementMotDePasse: React.FC<{
  /** Masque le champ « actuel » quand le mot de passe courant est temporaire. */
  obligatoire?: boolean;
  onSucces?: () => void;
}> = ({ obligatoire = false, onSucces }) => {
  const [erreurGlobale, setErreurGlobale] = useState<string | null>(null);
  const [succes, setSucces] = useState(false);
  const [visible, setVisible] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<MotDePasseForm>({
    resolver: zodResolver(schemaChangementMotDePasse),
    mode: 'onBlur',
  });

  const surSoumission = async (donnees: MotDePasseForm) => {
    setErreurGlobale(null);
    setSucces(false);
    try {
      const utilisateur = await changerMotDePasse({
        mot_de_passe_actuel: donnees.motDePasseActuel,
        nouveau_mot_de_passe: donnees.nouveauMotDePasse,
      });
      // Le drapeau doit_changer_mot_de_passe est remis à false côté service.
      useSessionStore.getState().definirUtilisateur(mapperUtilisateur(utilisateur));
      setSucces(true);
      onSucces?.();
    } catch (err) {
      const erreur = normaliserErreur(err);
      if (erreur.code === CODE_ERREUR_RESEAU) {
        setErreurGlobale(MESSAGES.erreurReseau);
        return;
      }
      if (erreur.code === 'mot_de_passe_incorrect') {
        setError('motDePasseActuel', { message: 'Le mot de passe actuel est incorrect.' });
        return;
      }
      if (erreur.code === 'validation_invalide' && erreur.details) {
        const details = erreur.details as Record<string, string[]>;
        if (details.nouveau_mot_de_passe?.length) {
          setError('nouveauMotDePasse', { message: details.nouveau_mot_de_passe[0] });
        } else {
          setErreurGlobale(erreur.message);
        }
        return;
      }
      setErreurGlobale(erreur.message || MESSAGES.erreurInconnue);
    }
  };

  return (
    <form onSubmit={handleSubmit(surSoumission)} noValidate className="flex flex-col gap-4">
      {erreurGlobale && (
        <div role="alert" className="p-3 rounded-md text-sm bg-erreur-fond text-erreur-texte">
          {erreurGlobale}
        </div>
      )}
      {succes && (
        <div role="status" className="p-3 rounded-md text-sm bg-primaire-douce text-primaire">
          Mot de passe changé avec succès.
        </div>
      )}

      <div className="relative">
        <Champ
          label="Mot de passe actuel"
          type={visible ? 'text' : 'password'}
          autoComplete="current-password"
          required={!obligatoire}
          aide={
            obligatoire
              ? 'Saisissez le mot de passe temporaire remis par l’administrateur.'
              : undefined
          }
          erreur={errors.motDePasseActuel?.message}
          {...register('motDePasseActuel')}
        />
      </div>

      <div className="relative">
        <Champ
          label="Nouveau mot de passe"
          type={visible ? 'text' : 'password'}
          autoComplete="new-password"
          required
          aide="8 caractères minimum."
          erreur={errors.nouveauMotDePasse?.message}
          {...register('nouveauMotDePasse')}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Masquer les mots de passe' : 'Afficher les mots de passe'}
          className="absolute right-2 top-[34px] p-1.5 text-texte-muet hover:text-texte rounded-md"
        >
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>

      <Champ
        label="Confirmation"
        type={visible ? 'text' : 'password'}
        autoComplete="new-password"
        required
        erreur={errors.confirmation?.message}
        {...register('confirmation')}
      />

      <Bouton
        type="submit"
        variante={obligatoire ? 'primaire' : 'secondaire'}
        chargement={isSubmitting}
        iconeGauche={<KeyRound size={18} aria-hidden="true" />}
      >
        Changer le mot de passe
      </Bouton>
    </form>
  );
};

/**
 * Écran plein « changement de mot de passe obligatoire » : affiché par
 * RouteProtegee quand doit_changer_mot_de_passe est vrai (mot de passe
 * temporaire généré par un admin, Q-23 / PW-F02-11).
 */
export const EcranChangementMotDePasseObligatoire: React.FC = () => (
  <div className="min-h-[50vh] flex items-center justify-center py-12">
    <div
      data-testid="ecran-changement-mot-de-passe"
      className="max-w-md w-full mx-auto p-6 sm:p-8 rounded-2xl border border-bordure bg-surface shadow-sm"
    >
      <h1 className="text-xl font-bold text-texte mb-2">Choisissez un nouveau mot de passe</h1>
      <p className="text-sm text-texte-secondaire mb-6">
        Votre mot de passe actuel a été généré par un administrateur AgriSens. Pour la sécurité de
        votre compte, vous devez le remplacer par un mot de passe personnel avant de continuer.
      </p>
      <FormulaireChangementMotDePasse obligatoire />
    </div>
  </div>
);
