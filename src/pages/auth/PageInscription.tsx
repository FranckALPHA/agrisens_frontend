import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Sprout, ShoppingBag, GraduationCap, Truck, UserPlus } from 'lucide-react';
import { Champ } from '@/components/Champ';
import { Bouton } from '@/components/Bouton';
import { normaliserErreur, CODE_ERREUR_RESEAU } from '@/services/api/auth';
import { sInscrire } from '@/services/sessionService';
import {
  LIBELLES_ROLES,
  ROLES_INSCRIVABLES,
  normaliserTelephone,
  schemaInscription,
  type DonneesInscription,
} from './validations';
import { cheminTableauDeBord, type RoleUtilisateur } from '@/app/menus';
import { MESSAGES } from '@/theme/messages';

const ICONES_ROLE: Record<(typeof ROLES_INSCRIVABLES)[number], React.ReactNode> = {
  agriculteur: <Sprout size={22} aria-hidden="true" />,
  acheteur: <ShoppingBag size={22} aria-hidden="true" />,
  ingenieur_agronome: <GraduationCap size={22} aria-hidden="true" />,
  livreur: <Truck size={22} aria-hidden="true" />,
};

/** FE-02 — Inscription : choix du rôle en cartes, champs 09 FE-02, erreurs champ par champ. */
export const PageInscription: React.FC = () => {
  const navigate = useNavigate();
  const [erreurGlobale, setErreurGlobale] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DonneesInscription>({
    resolver: zodResolver(schemaInscription),
    mode: 'onBlur',
    defaultValues: { role: 'agriculteur' },
  });
  const roleChoisi = watch('role');

  const surSoumission = async (donnees: DonneesInscription) => {
    setErreurGlobale(null);
    try {
      const session = await sInscrire({
        nom: donnees.nom,
        telephone: normaliserTelephone(donnees.telephone) ?? donnees.telephone,
        email: donnees.email || undefined,
        region: donnees.region || undefined,
        mot_de_passe: donnees.motDePasse,
        role: donnees.role,
      });
      // L'ingénieur tombe sur l'écran « compte en attente » (RouteProtegee).
      navigate(cheminTableauDeBord(session.role as RoleUtilisateur), { replace: true });
    } catch (err) {
      const erreur = normaliserErreur(err);
      if (erreur.code === CODE_ERREUR_RESEAU) {
        // PW-F02-13 : message, champs conservés (le formulaire RHF n'est pas vidé).
        setErreurGlobale(`${MESSAGES.erreurReseau} ${MESSAGES.connexionFaible}`);
        return;
      }
      if (erreur.code === 'compte_existant') {
        // PW-F02-02 : erreur sous le champ concerné, les autres conservés.
        const champ = (erreur.details as { champ?: 'telephone' | 'email' } | undefined)?.champ;
        if (champ === 'email') {
          setError('email', { message: 'Un compte utilise déjà cette adresse email.' });
        } else {
          setError('telephone', {
            message: 'Un compte existe déjà avec ce numéro de téléphone.',
          });
        }
        return;
      }
      if (erreur.code === 'limite_debit_atteinte') {
        setErreurGlobale(
          'Trop d’inscriptions récentes depuis cet appareil. Réessayez dans une minute.'
        );
        return;
      }
      if (erreur.details && typeof erreur.details === 'object') {
        const details = erreur.details as Record<string, string[]>;
        const correspondances: Record<string, keyof DonneesInscription> = {
          mot_de_passe: 'motDePasse',
          telephone: 'telephone',
          email: 'email',
          nom: 'nom',
        };
        let champTrouve = false;
        for (const [champ, messages] of Object.entries(details)) {
          const cle = correspondances[champ];
          if (cle && messages.length > 0) {
            setError(cle, { message: messages[0] });
            champTrouve = true;
          }
        }
        if (champTrouve) return;
      }
      setErreurGlobale(erreur.message || MESSAGES.erreurInconnue);
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-8 sm:mt-12">
      <div className="rounded-xl border border-bordure bg-surface p-6 sm:p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-texte mb-1">Créer un compte AgriSens</h1>
        <p className="text-sm text-texte-secondaire mb-6">
          Gratuit au Cameroun — uniquement avec votre téléphone.
        </p>

        {erreurGlobale && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-md text-sm bg-erreur-fond border border-red-200 text-erreur-texte"
          >
            {erreurGlobale}
          </div>
        )}

        <form onSubmit={handleSubmit(surSoumission)} noValidate className="flex flex-col gap-5">
          {/* Choix du rôle en cartes (radiogroup accessible) */}
          <fieldset>
            <legend className="text-sm font-medium text-texte mb-2">
              Je suis…
              <span className="text-erreur ml-1" aria-hidden="true">
                *
              </span>
            </legend>
            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
              role="radiogroup"
              aria-label="Rôle du compte"
            >
              {ROLES_INSCRIVABLES.map((role) => (
                <label
                  key={role}
                  className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors min-h-tactile ${
                    roleChoisi === role
                      ? 'border-primaire bg-primaire-douce text-primaire'
                      : 'border-bordure bg-surface text-texte-secondaire hover:border-primaire'
                  }`}
                >
                  <input
                    type="radio"
                    value={role}
                    className="sr-only"
                    aria-checked={roleChoisi === role}
                    {...register('role')}
                  />
                  {ICONES_ROLE[role]}
                  <span className="text-sm font-semibold">{LIBELLES_ROLES[role]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <Champ
            label="Nom complet"
            autoComplete="name"
            required
            erreur={errors.nom?.message}
            {...register('nom')}
          />

          <Champ
            label="Téléphone"
            type="tel"
            inputMode="tel"
            placeholder="+237 6 XX XX XX XX"
            autoComplete="tel"
            required
            aide="Numéro camerounais ; il servira d’identifiant de connexion."
            erreur={errors.telephone?.message}
            {...register('telephone')}
          />

          <Champ
            label="Email (facultatif)"
            type="email"
            autoComplete="email"
            aide="Permet aussi de se connecter ; jamais partagé publiquement."
            erreur={errors.email?.message}
            {...register('email')}
          />

          <Champ
            label="Région (facultatif)"
            placeholder="Ex : Littoral, Ouest, Centre…"
            erreur={errors.region?.message}
            {...register('region')}
          />

          <div className="relative">
            <Champ
              label="Mot de passe"
              type={visible ? 'text' : 'password'}
              autoComplete="new-password"
              required
              aide="8 caractères minimum."
              erreur={errors.motDePasse?.message}
              {...register('motDePasse')}
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              className="absolute right-2 top-[34px] p-1.5 text-texte-muet hover:text-texte rounded-md"
            >
              {visible ? (
                <EyeOff size={18} aria-hidden="true" />
              ) : (
                <Eye size={18} aria-hidden="true" />
              )}
            </button>
          </div>

          <Champ
            label="Confirmation du mot de passe"
            type={visible ? 'text' : 'password'}
            autoComplete="new-password"
            required
            erreur={errors.confirmation?.message}
            {...register('confirmation')}
          />

          {roleChoisi === 'ingenieur_agronome' && (
            <p className="text-xs text-texte-secondaire bg-slate-50 border border-bordure rounded-md p-3">
              Votre compte sera créé « en attente de validation ». Un administrateur vérifiera vos
              diplômes et pièces (étape suivante de l’inscription) avant d’activer votre accès
              complet.
            </p>
          )}

          <Bouton
            type="submit"
            pleineLargeur
            taille="lg"
            chargement={isSubmitting}
            iconeGauche={<UserPlus size={20} aria-hidden="true" />}
          >
            {MESSAGES.inscription}
          </Bouton>
        </form>

        <p className="mt-5 text-sm text-texte-secondaire text-center">
          Déjà inscrit ?{' '}
          <Link to="/connexion" className="text-primaire font-medium hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
};
