import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSessionStore } from '@/stores/session';
import { RoleUtilisateur } from '@/app/menus';

export interface RouteProtegeeProps {
  rolesAutorises?: RoleUtilisateur[];
  children?: React.ReactNode;
}

export const RouteProtegee: React.FC<RouteProtegeeProps> = ({ rolesAutorises, children }) => {
  const location = useLocation();
  const { estConnecte, utilisateur } = useSessionStore();

  // 1. Si non connecté : redirection vers /connexion en mémorisant l'URL demandée
  if (!estConnecte) {
    return <Navigate to="/connexion" state={{ depuis: location }} replace />;
  }

  // 2. Si un rôle spécifique est requis et que l'utilisateur n'a pas ce rôle : 403
  if (rolesAutorises && rolesAutorises.length > 0) {
    const roleUtilisateur = utilisateur?.role as RoleUtilisateur | undefined;

    if (!roleUtilisateur || !rolesAutorises.includes(roleUtilisateur)) {
      return <Navigate to="/acces-interdit" replace />;
    }
  }

  return children ? <>{children}</> : <Outlet />;
};
