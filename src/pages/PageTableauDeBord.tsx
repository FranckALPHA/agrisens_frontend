import React from 'react';
import { Link } from 'react-router-dom';
import { useSessionStore } from '@/stores/session';
import { obtenirMenuRole, type RoleUtilisateur } from '@/app/menus';
import { CompteursAdmin } from '@/pages/admin/CompteursAdmin';

const TITRES_PAR_ROLE: Record<RoleUtilisateur, string> = {
  agriculteur: 'Espace Agriculteur',
  acheteur: 'Espace Acheteur',
  ingenieur_agronome: 'Espace Ingénieur Agronome',
  livreur: 'Espace Livreur',
  admin: 'Espace Administration',
  super_admin: 'Espace Super Administration',
};

const ATTENTE_PAR_ROLE: Record<RoleUtilisateur, string> = {
  agriculteur:
    'Gérez vos parcelles depuis « Mes parcelles » ; produits et ventes arriveront avec F-05 et F-06.',
  acheteur: 'Le catalogue, le panier et les commandes arriveront avec les features F-05 et F-06.',
  ingenieur_agronome:
    'Complétez votre profil professionnel et déposez vos justificatifs : un administrateur valide votre dossier (ING-02).',
  livreur:
    'Basculez votre disponibilité depuis la page Disponibilité (LIV-01) ; les courses arriveront avec F-08.',
  admin: 'Validez les ingénieurs et gérez les comptes depuis la page Utilisateurs (ADM-02).',
  super_admin: 'Validez les ingénieurs et gérez les comptes depuis la page Utilisateurs (ADM-02).',
};

/**
 * Tableau de bord provisoire par rôle (prompt F-02 frontend point 6) :
 * bienvenue + accès au menu ; complété par les features suivantes.
 */
export const PageTableauDeBord: React.FC<{ role?: RoleUtilisateur }> = ({ role }) => {
  const utilisateur = useSessionStore((s) => s.utilisateur);
  const roleEffectif = (utilisateur?.role ?? role ?? 'acheteur') as RoleUtilisateur;
  const menu = obtenirMenuRole(roleEffectif);

  return (
    <div className="py-6 flex flex-col gap-8" data-testid="tableau-de-bord">
      <section>
        <h1 className="text-2xl font-bold text-texte">
          {TITRES_PAR_ROLE[roleEffectif] || 'Bienvenue'}
        </h1>
        <p className="text-sm text-texte-secondaire mt-1">
          Bienvenue{utilisateur?.nom ? `, ${utilisateur.nom}` : ''} — votre session est ouverte.
        </p>
        <p className="text-xs text-texte-muet mt-2">
          {ATTENTE_PAR_ROLE[roleEffectif] ??
            'Les fonctionnalités arriveront avec les prochaines features.'}
        </p>
      </section>

      {/* ADM-01 (base) : compteurs d'ingénieurs en attente et de réinitialisations (F-03). */}
      {(roleEffectif === 'admin' || roleEffectif === 'super_admin') && <CompteursAdmin />}

      <nav aria-label="Accès rapide" className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-xl">
        {menu.map((item) => (
          <Link
            key={item.id}
            to={item.chemin}
            className="p-4 rounded-lg border border-bordure bg-surface text-sm font-medium text-texte hover:border-primaire hover:text-primaire transition-colors min-h-tactile flex items-center"
          >
            {item.libelle}
          </Link>
        ))}
      </nav>
    </div>
  );
};
