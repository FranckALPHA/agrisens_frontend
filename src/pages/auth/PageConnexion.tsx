import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, User as UserIcon, Lock } from 'lucide-react';
import { Champ } from '@/components/Champ';
import { Bouton } from '@/components/Bouton';
import { normaliserErreur, CODE_ERREUR_RESEAU } from '@/services/api/auth';
import { seConnecter } from '@/services/sessionService';
import { schemaConnexion, normaliserTelephone, type DonneesConnexion } from './validations';
import { cheminTableauDeBord, type RoleUtilisateur } from '@/app/menus';
import { MESSAGES } from '@/theme/messages';

interface EtatLocation {
  depuis?: { pathname?: string };
}

/** FE-03 — Connexion : téléphone ou email + mot de passe (anti-énumération). */
export const PageConnexion: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [erreurGlobale, setErreurGlobale] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [suspendu, setSuspendu] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DonneesConnexion>({
    resolver: zodResolver(schemaConnexion),
    mode: 'onBlur',
  });

  const surSoumission = async (donnees: DonneesConnexion) => {
    setErreurGlobale(null);
    setSuspendu(false);
    try {
      // Le champ accepte téléphone ou email : normalise le téléphone seulement.
      const identifiantNormalise = normaliserTelephone(donnees.identifiant);
      const session = await seConnecter({
        identifiant: identifiantNormalise ?? donnees.identifiant,
        mot_de_passe: donnees.motDePasse,
      });
      const depuis = (location.state as EtatLocation | null)?.depuis?.pathname;
      navigate(
        depuis && depuis !== '/connexion'
          ? depuis
          : cheminTableauDeBord(session.role as RoleUtilisateur),
        {
          replace: true,
        }
      );
    } catch (err) {
      const erreur = normaliserErreur(err);
      if (erreur.code === CODE_ERREUR_RESEAU) {
        setErreurGlobale(MESSAGES.erreurReseau);
        return;
      }
      if (erreur.code === 'compte_suspendu') {
        // Message compréhensible dédié (PW-F02-06).
        setSuspendu(true);
        setErreurGlobale(erreur.message);
        return;
      }
      if (erreur.code === 'limite_debit_atteinte') {
        setErreurGlobale(
          'Trop de tentatives récentes. Réessayez dans une minute, ou demandez une réinitialisation.'
        );
        return;
      }
      if (erreur.code === 'validation_invalide' && erreur.details) {
        // Erreur champ par champ renvoyée par le sérialiseur DRF.
        const details = erreur.details as Record<string, string[]>;
        for (const [champ, messages] of Object.entries(details)) {
          if (messages.length > 0) {
            setError(champ as keyof DonneesConnexion, { message: messages[0] });
          }
        }
        return;
      }
      // identifiants_invalides : message volontairement identique que le
      // compte existe ou non (anti-énumération, PW-F02-05).
      setErreurGlobale(erreur.message || 'Téléphone ou email et mot de passe incorrects.');
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8 sm:mt-16">
      <div className="rounded-xl border border-bordure bg-surface p-6 sm:p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-texte mb-1">Connexion à AgriSens</h1>
        <p className="text-sm text-texte-secondaire mb-6">
          Utilisez votre téléphone (+237…) ou votre email, et votre mot de passe.
        </p>

        {erreurGlobale && (
          <div
            role="alert"
            className={`mb-4 p-3 rounded-md text-sm border ${
              suspendu
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-erreur-fond border-red-200 text-erreur-texte'
            }`}
          >
            {suspendu
              ? 'Votre compte est suspendu par l’administration AgriSens. Ce message s’affiche à chaque tentative : contactez le support pour le réactiver.'
              : erreurGlobale}
          </div>
        )}

        <form onSubmit={handleSubmit(surSoumission)} noValidate className="flex flex-col gap-4">
          <Champ
            label="Téléphone ou email"
            autoComplete="username"
            required
            iconeGauche={<UserIcon size={16} aria-hidden="true" />}
            erreur={errors.identifiant?.message}
            {...register('identifiant')}
          />

          <div className="relative">
            <Champ
              label="Mot de passe"
              type={visible ? 'text' : 'password'}
              autoComplete="current-password"
              required
              iconeGauche={<Lock size={16} aria-hidden="true" />}
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

          <Bouton
            type="submit"
            pleineLargeur
            chargement={isSubmitting}
            iconeGauche={<LogIn size={18} aria-hidden="true" />}
          >
            {MESSAGES.connexion}
          </Bouton>
        </form>

        <div className="mt-5 flex items-center justify-between text-sm">
          <Link to="/mot-de-passe-oublie" className="text-primaire hover:underline">
            Mot de passe oublié ?
          </Link>
          <Link to="/inscription" className="text-primaire hover:underline">
            {MESSAGES.inscription}
          </Link>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-texte-muet">
        Compte professionnel ? La validation d’un ingénieur agronome se fait après inscription.
      </p>
    </div>
  );
};
