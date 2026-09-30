import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { KeyRound, Phone } from 'lucide-react';
import { Champ } from '@/components/Champ';
import { Bouton } from '@/components/Bouton';
import {
  normaliserErreur,
  demanderReinitialisation,
  CODE_ERREUR_RESEAU,
} from '@/services/api/auth';
import { schemaDemandeReinitialisation, normaliserTelephone } from './validations';
import { MESSAGES } from '@/theme/messages';

interface DemandeDonnees {
  telephone: string;
}

/**
 * FE-03 « mot de passe oublié » (journal Q-23) : aucune réinitialisation
 * automatique — l'administrateur contacte l'utilisateur ; la réponse est
 * volontairement neutre que le compte existe ou non.
 */
export const PageMotDePasseOublie: React.FC = () => {
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [erreurGlobale, setErreurGlobale] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DemandeDonnees>({
    resolver: zodResolver(schemaDemandeReinitialisation),
    mode: 'onBlur',
  });

  const surSoumission = async (donnees: DemandeDonnees) => {
    setErreurGlobale(null);
    try {
      const message = await demanderReinitialisation(
        normaliserTelephone(donnees.telephone) ?? donnees.telephone
      );
      setConfirmation(message);
    } catch (err) {
      const erreur = normaliserErreur(err);
      setErreurGlobale(erreur.code === CODE_ERREUR_RESEAU ? MESSAGES.erreurReseau : erreur.message);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8 sm:mt-16">
      <div className="rounded-xl border border-bordure bg-surface p-6 sm:p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-texte mb-1">Mot de passe oublié</h1>
        <p className="text-sm text-texte-secondaire mb-6">
          AgriSens ne réinitialise pas les mots de passe par email ou SMS : un administrateur
          vérifie votre identité par téléphone, puis vous remet un mot de passe temporaire en
          personne ou par appel.
        </p>

        {confirmation ? (
          <div
            role="status"
            className="p-4 rounded-md bg-primaire-douce border border-primaire/30 text-primaire text-sm font-medium"
          >
            {confirmation}
            <Link to="/connexion" className="block mt-3 underline">
              Retour à la connexion
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(surSoumission)} noValidate className="flex flex-col gap-4">
            {erreurGlobale && (
              <div role="alert" className="p-3 rounded-md text-sm bg-erreur-fond text-erreur-texte">
                {erreurGlobale}
              </div>
            )}
            <Champ
              label="Votre téléphone"
              type="tel"
              inputMode="tel"
              placeholder="+237 6 XX XX XX XX"
              required
              iconeGauche={<Phone size={16} aria-hidden="true" />}
              erreur={errors.telephone?.message}
              {...register('telephone')}
            />
            <Bouton
              type="submit"
              pleineLargeur
              chargement={isSubmitting}
              iconeGauche={<KeyRound size={18} aria-hidden="true" />}
            >
              Envoyer la demande
            </Bouton>
          </form>
        )}

        <p className="mt-5 text-sm text-center">
          <Link to="/connexion" className="text-primaire hover:underline">
            Retour à la connexion
          </Link>
        </p>
      </div>
    </div>
  );
};
