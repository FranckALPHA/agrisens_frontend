import React, { useState } from 'react';
import { Clock, UserX, ShieldAlert } from 'lucide-react';
import { Bouton } from '@/components/Bouton';
import { seDeconnecter } from '@/services/sessionService';
import { MESSAGES } from '@/theme/messages';

/** Écran commun pour les comptes qui ne peuvent pas encore tout utiliser. */
const EcranEtatCompte: React.FC<{
  titre: string;
  description: React.ReactNode;
  icone: React.ReactNode;
  couleur: string;
  testId?: string;
}> = ({ titre, description, icone, couleur, testId }) => {
  const [deconnexionEnCours, setDeconnexionEnCours] = useState(false);

  const surDeconnexion = async () => {
    setDeconnexionEnCours(true);
    await seDeconnecter();
  };

  return (
    <div data-testid={testId} className="min-h-[50vh] flex items-center justify-center py-12">
      <div className="max-w-md mx-auto text-center p-8 rounded-2xl border border-bordure bg-surface shadow-sm">
        <div
          className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-5 ${couleur}`}
          aria-hidden="true"
        >
          {icone}
        </div>
        <h1 className="text-xl font-bold text-texte mb-3">{titre}</h1>
        <div className="text-sm text-texte-secondaire leading-relaxed mb-6">{description}</div>
        <Bouton
          type="button"
          variante="secondaire"
          onClick={surDeconnexion}
          chargement={deconnexionEnCours}
        >
          {MESSAGES.deconnexion}
        </Bouton>
      </div>
    </div>
  );
};

/**
 * Compte en attente de validation (ingénieur agronome, D-13) : accès limité à
 * son profil ; l'écran explique la démarche en cours (FE-02).
 */
export const EcranCompteEnAttente: React.FC = () => (
  <EcranEtatCompte
    testId="ecran-attente"
    titre="Compte en attente de validation"
    icone={<Clock size={30} aria-hidden="true" />}
    couleur="bg-amber-100 text-amber-800"
    description={
      <>
        <p>
          Votre compte d’ingénieur agronome est créé et <strong>en attente de validation</strong>{' '}
          par l’équipe AgriSens.
        </p>
        <p className="mt-3">
          Un administrateur vérifiera votre dossier (diplômes, pièce d’identité, zone
          d’intervention) dès que le dépôt de ces documents sera ouvert. Vous recevrez une
          notification dès l’activation de votre compte.
        </p>
      </>
    }
  />
);

/** Compte suspendu par l'administration : message compréhensible (PW-F02-06). */
export const EcranCompteSuspendu: React.FC = () => (
  <EcranEtatCompte
    testId="ecran-suspendu"
    titre="Compte suspendu"
    icone={<UserX size={30} aria-hidden="true" />}
    couleur="bg-red-100 text-red-800"
    description={
      <p>
        Votre compte a été suspendu par l’administration AgriSens. Vous ne pouvez plus utiliser la
        plateforme pour le moment. Contactez le support via la page « Contact & Assistance » pour
        comprendre la décision et demander une réactivation.
      </p>
    }
  />
);

/** Compte anonymisé (droit à l'oubli) : plus aucun accès. */
export const EcranCompteAnonymise: React.FC = () => (
  <EcranEtatCompte
    titre="Compte anonymisé"
    icone={<ShieldAlert size={30} aria-hidden="true" />}
    couleur="bg-slate-100 text-slate-700"
    description={
      <p>
        Votre compte a été anonymisé suite à votre demande ou à la décision de l’administration. Vos
        données personnelles ne sont plus accessibles.
      </p>
    }
  />
);
