import React, { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut, User as UserIcon } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { BandeauConnexion } from '@/components/BandeauConnexion';
import { BandeauMiseAJour } from '@/pwa/BandeauMiseAJour';
import { useSessionStore } from '@/stores/session';
import { seDeconnecter } from '@/services/sessionService';
import { obtenirMenuRole, RoleUtilisateur } from '@/app/menus';
import { MESSAGES } from '@/theme/messages';

export const MiseEnPageConnectee: React.FC = () => {
  const navigate = useNavigate();
  const { utilisateur } = useSessionStore();
  const [deconnexionEnCours, setDeconnexionEnCours] = useState(false);
  const roleActuel = (utilisateur?.role || 'acheteur') as RoleUtilisateur;
  const menuElements = obtenirMenuRole(roleActuel);

  // Déconnexion complète : révocation côté API (rotation du jeton, Q-25)
  // puis purge du store mémoire, avant redirection publique.
  const gererDeconnexion = async () => {
    setDeconnexionEnCours(true);
    await seDeconnecter();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-fond text-texte">
      <BandeauConnexion />
      <BandeauMiseAJour />

      {/* 1. Menu latéral pour Ordinateur & Tablette */}
      <aside
        data-testid="menu-lateral"
        aria-label="Navigation latérale"
        className="hidden md:flex flex-col w-64 border-r border-bordure bg-surface shrink-0 min-h-screen sticky top-0"
      >
        <div className="p-5 border-b border-bordure">
          <Link to="/" className="focus:outline-none focus:ring-2 focus:ring-primaire rounded-md">
            <Logo taille="md" avecSousTitre />
          </Link>
        </div>

        {/* Profil connecté */}
        <div className="px-5 py-4 border-b border-bordure bg-slate-50 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primaire-claire text-white flex items-center justify-center font-bold">
            {utilisateur?.nom?.charAt(0) || <UserIcon size={20} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-texte truncate">
              {utilisateur?.nom || 'Utilisateur'}
            </p>
            <p className="text-xs text-texte-secondaire capitalize">
              {roleActuel.replace('_', ' ')}
            </p>
          </div>
        </div>

        {/* Liens de navigation */}
        <nav aria-label="Menu principal" className="flex-1 px-3 py-4 space-y-1">
          {menuElements.map((item) => (
            <NavLink
              key={item.id}
              to={item.chemin}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors min-h-tactile ${
                  isActive
                    ? 'bg-primaire text-white shadow-sm'
                    : 'text-texte-secondaire hover:bg-surface-survol hover:text-texte'
                }`
              }
            >
              <span>{item.libelle}</span>
            </NavLink>
          ))}
        </nav>

        {/* Bouton de déconnexion */}
        <div className="p-4 border-t border-bordure mt-auto">
          <button
            type="button"
            onClick={gererDeconnexion}
            disabled={deconnexionEnCours}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm font-medium text-erreur rounded-md hover:bg-erreur-fond transition-colors min-h-tactile disabled:opacity-50"
          >
            <LogOut size={18} aria-hidden="true" />
            <span>{MESSAGES.deconnexion}</span>
          </button>
        </div>
      </aside>

      {/* Contenu principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* En-tête mobile */}
        <header className="md:hidden flex items-center justify-between px-4 h-16 border-b border-bordure bg-surface sticky top-0 z-30">
          <Link to="/">
            <Logo taille="sm" />
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-1 bg-primaire-douce text-primaire rounded-full capitalize">
              {roleActuel.replace('_', ' ')}
            </span>
            <button
              type="button"
              onClick={gererDeconnexion}
              aria-label={MESSAGES.deconnexion}
              disabled={deconnexionEnCours}
              className="p-2 text-texte-secondaire hover:text-erreur rounded-md disabled:opacity-50"
            >
              <LogOut size={20} aria-hidden="true" />
            </button>
          </div>
        </header>

        {/* Contenu de la vue */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-20 md:pb-8">
          <Outlet />
        </main>
      </div>

      {/* 2. Navigation basse pour Mobile */}
      <nav
        data-testid="navigation-basse"
        aria-label="Navigation mobile"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-bordure flex items-center justify-around px-2 py-1 shadow-lg"
      >
        {menuElements
          .filter((item) => item.pourNavigationBasse)
          .map((item) => (
            <NavLink
              key={item.id}
              to={item.chemin}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 py-1.5 min-h-tactile text-xs font-medium transition-colors ${
                  isActive ? 'text-primaire font-bold' : 'text-texte-secondaire'
                }`
              }
            >
              <span className="truncate max-w-[80px]">{item.libelle}</span>
            </NavLink>
          ))}
      </nav>
    </div>
  );
};
