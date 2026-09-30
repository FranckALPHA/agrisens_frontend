import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { EtatChargement } from '@/components/EtatChargement';
import { useSessionStore } from '@/stores/session';
import { RoleUtilisateur } from '@/app/menus';
import {
  EcranCompteEnAttente,
  EcranCompteSuspendu,
  EcranCompteAnonymise,
} from '@/pages/compte/EcransEtatCompte';
import { EcranChangementMotDePasseObligatoire } from '@/pages/compte/FormulaireMotDePasse';

export interface RouteProtegeeProps {
  rolesAutorises?: RoleUtilisateur[];
  children?: React.ReactNode;
}

export const RouteProtegee: React.FC<RouteProtegeeProps> = ({ rolesAutorises, children }) => {
  const location = useLocation();
  const { estInitialise, estConnecte, utilisateur } = useSessionStore();

  // 1. Session pas encore rétablie depuis le cookie : on attend (le bootstrap
  //    App lance le rafraîchissement silencieux, prompt F-02 frontend point 4).
  if (!estInitialise) {
    return <EtatChargement pleinePage message="Vérification de votre session…" />;
  }

  // 2. Si non connecté : redirection vers /connexion en mémorisant l'URL demandée
  if (!estConnecte || !utilisateur) {
    return <Navigate to="/connexion" state={{ depuis: location }} replace />;
  }

  // 3. États de compte bloquants : écrans explicatifs plutôt qu'un simple 403.
  switch (utilisateur.statutCompte) {
    case 'suspendu':
      return <EcranCompteSuspendu />;
    case 'en_attente_validation':
      return <EcranCompteEnAttente />;
    case 'anonymise':
      return <EcranCompteAnonymise />;
    default:
      break;
  }

  // 4. Mot de passe temporaire remis par un administrateur : changement forcé
  //    avant toute utilisation (PW-F02-11).
  if (utilisateur.doitChangerMotDePasse) {
    return <EcranChangementMotDePasseObligatoire />;
  }

  // 5. Si un rôle spécifique est requis et que l'utilisateur n'a pas ce rôle : accès interdit
  if (rolesAutorises && rolesAutorises.length > 0) {
    if (!rolesAutorises.includes(utilisateur.role)) {
      return <Navigate to="/acces-interdit" replace />;
    }
  }

  return children ? <>{children}</> : <Outlet />;
};
