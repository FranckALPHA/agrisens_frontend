import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { BandeauConnexion } from '@/components/BandeauConnexion';
import { BandeauMiseAJour } from '@/pwa/BandeauMiseAJour';
import { Bouton } from '@/components/Bouton';
import { MESSAGES } from '@/theme/messages';

export const MiseEnPagePublique: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-fond text-texte">
      <BandeauConnexion />
      <BandeauMiseAJour />

      {/* En-tête public */}
      <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur-sm border-b border-bordure">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link
            to="/"
            className="focus:outline-none focus:ring-2 focus:ring-primaire rounded-md p-1"
          >
            <Logo taille="md" avecSousTitre />
          </Link>

          <nav
            aria-label="Navigation principale"
            className="hidden sm:flex items-center gap-6 text-sm font-medium"
          >
            <Link to="/" className="text-texte hover:text-primaire transition-colors">
              Accueil
            </Link>
            <Link
              to="/catalogue"
              className="text-texte-secondaire hover:text-primaire transition-colors"
            >
              Catalogue
            </Link>
            <Link
              to="/etat"
              className="text-texte-secondaire hover:text-primaire transition-colors"
            >
              État API
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Bouton to="/connexion" variante="discret" taille="sm">
              {MESSAGES.connexion}
            </Bouton>
            <Bouton to="/inscription" variante="primaire" taille="sm">
              {MESSAGES.inscription}
            </Bouton>
          </div>
        </div>
      </header>

      {/* Contenu de la page */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Pied de page public avec liens légaux */}
      <footer className="bg-surface border-t border-bordure py-10 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6 text-sm text-texte-secondaire">
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6 text-center sm:text-left">
            <Logo taille="sm" />
            <span>&copy; {new Date().getFullYear()} AgriSens Cameroun. Tous droits réservés.</span>
          </div>

          <nav
            aria-label="Liens légaux"
            className="flex flex-wrap items-center justify-center gap-6"
          >
            <Link to="/conditions" className="hover:text-primaire transition-colors">
              Conditions d'utilisation
            </Link>
            <Link to="/confidentialite" className="hover:text-primaire transition-colors">
              Politique de confidentialité
            </Link>
            <Link to="/contact" className="hover:text-primaire transition-colors">
              Contact & Support
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
};
