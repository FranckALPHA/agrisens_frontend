import React from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Bouton } from './Bouton';
import { MESSAGES } from '@/theme/messages';
import { useSessionStore } from '@/stores/session';
import { cheminTableauDeBord } from '@/app/menus';

export interface AccesInterditProps {
  titre?: string;
  message?: string;
  actionAlternative?: React.ReactNode;
  className?: string;
}

export const AccesInterdit: React.FC<AccesInterditProps> = ({
  titre = MESSAGES.accesInterditTitre,
  message = MESSAGES.accesInterditDescription,
  actionAlternative,
  className = '',
}) => {
  const navigate = useNavigate();
  const { estConnecte, utilisateur } = useSessionStore();
  // Un connecté redirigé ici doit revenir dans son espace (dashboard du rôle),
  // pas sur la landing marketing publique : sinon il perd sa sidebar et son
  // badge de notifications.
  const cheminRetour = estConnecte ? cheminTableauDeBord(utilisateur?.role) : '/';
  const libelleRetour = estConnecte ? 'Retour à mon espace' : MESSAGES.retourAccueil;

  return (
    <div
      role="alert"
      data-testid="acces-interdit"
      className={`min-h-[50vh] flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto ${className}`}
    >
      <div className="w-16 h-16 rounded-full bg-amber-100 text-avertissement flex items-center justify-center mb-4">
        <ShieldAlert size={32} aria-hidden="true" />
      </div>
      <h2 className="text-2xl font-bold text-texte mb-2">{titre}</h2>
      <p className="text-sm text-texte-secondaire leading-relaxed mb-6">{message}</p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Bouton
          type="button"
          variante="primaire"
          onClick={() => navigate(cheminRetour)}
          iconeGauche={<ArrowLeft size={16} aria-hidden="true" />}
          data-testid="bouton-retour-acces-interdit"
        >
          {libelleRetour}
        </Bouton>
        {actionAlternative}
      </div>
    </div>
  );
};
