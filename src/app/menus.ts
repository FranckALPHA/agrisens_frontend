/**
 * Configuration unique des menus de navigation par rôle (09 §10 et F-01 point 5).
 * Ce fichier est enrichi au fil du développement de chaque feature.
 */

export interface ElementMenu {
  id: string;
  libelle: string;
  chemin: string;
  icone: string; // Nom de l'icône Lucide
  pourNavigationBasse?: boolean; // Visible sur la barre de navigation mobile (4-5 items max)
}

export type RoleUtilisateur =
  'acheteur' | 'agriculteur' | 'ingenieur_agronome' | 'livreur' | 'admin' | 'super_admin';

export const MENUS_PAR_ROLE: Record<RoleUtilisateur, ElementMenu[]> = {
  acheteur: [
    {
      id: 'tableau_de_bord',
      libelle: 'Tableau de bord',
      chemin: '/acheteur',
      icone: 'LayoutDashboard',
      pourNavigationBasse: true,
    },
    {
      id: 'catalogue',
      libelle: 'Catalogue',
      chemin: '/catalogue',
      icone: 'Store',
      pourNavigationBasse: true,
    },
    {
      id: 'panier',
      libelle: 'Panier',
      chemin: '/panier',
      icone: 'ShoppingCart',
      pourNavigationBasse: true,
    },
    {
      id: 'commandes',
      libelle: 'Mes commandes',
      chemin: '/commandes',
      icone: 'Package',
      pourNavigationBasse: true,
    },
    {
      id: 'messages',
      libelle: 'Messages',
      chemin: '/messages',
      icone: 'MessageCircle',
      pourNavigationBasse: true,
    },
    {
      id: 'profil',
      libelle: 'Mon profil',
      chemin: '/profil',
      icone: 'User',
    },
  ],
  agriculteur: [
    {
      id: 'tableau_de_bord',
      libelle: 'Tableau de bord',
      chemin: '/agriculteur',
      icone: 'LayoutDashboard',
      pourNavigationBasse: true,
    },
    {
      id: 'exploitations',
      libelle: 'Mes parcelles',
      chemin: '/agriculteur/exploitations',
      icone: 'MapPin',
      pourNavigationBasse: true,
    },
    {
      id: 'produits',
      libelle: 'Mes produits',
      chemin: '/agriculteur/produits',
      icone: 'Sprout',
      pourNavigationBasse: true,
    },
    {
      id: 'commandes',
      libelle: 'Ventes',
      chemin: '/agriculteur/commandes',
      icone: 'ShoppingBag',
      pourNavigationBasse: true,
    },
    { id: 'gains', libelle: 'Mes gains', chemin: '/mes-gains', icone: 'Wallet' },
    {
      // AGR-09 (F-14) — statistiques de ventes.
      id: 'statistiques',
      libelle: 'Statistiques',
      chemin: '/agriculteur/statistiques',
      icone: 'BarChart3',
    },
    { id: 'messages', libelle: 'Messages', chemin: '/messages', icone: 'MessageCircle' },
    { id: 'planning', libelle: 'Planning IA', chemin: '/agriculteur/planning', icone: 'Calendar' },
    {
      id: 'accompagnement',
      libelle: 'Conseil',
      chemin: '/agriculteur/accompagnement',
      icone: 'HelpCircle',
    },
    { id: 'profil', libelle: 'Profil', chemin: '/profil', icone: 'User' },
  ],
  ingenieur_agronome: [
    {
      id: 'tableau_de_bord',
      libelle: 'Tableau de bord',
      chemin: '/ingenieur',
      icone: 'LayoutDashboard',
      pourNavigationBasse: true,
    },
    {
      id: 'rendez_vous',
      libelle: 'Rendez-vous',
      chemin: '/ingenieur/rendez-vous',
      icone: 'Calendar',
      pourNavigationBasse: true,
    },
    {
      id: 'accompagnements',
      libelle: 'Missions',
      chemin: '/ingenieur/accompagnements',
      icone: 'BookOpen',
      pourNavigationBasse: true,
    },
    { id: 'gains', libelle: 'Mes gains', chemin: '/mes-gains', icone: 'Wallet' },
    { id: 'messages', libelle: 'Messages', chemin: '/messages', icone: 'MessageCircle' },
    {
      id: 'profil',
      libelle: 'Profil pro',
      chemin: '/ingenieur/profil-pro',
      icone: 'User',
      pourNavigationBasse: true,
    },
  ],
  livreur: [
    {
      id: 'tableau_de_bord',
      libelle: 'Tableau de bord',
      chemin: '/livreur',
      icone: 'LayoutDashboard',
      pourNavigationBasse: true,
    },
    {
      id: 'livraisons',
      libelle: 'Mes courses',
      chemin: '/livreur/courses',
      icone: 'Truck',
      pourNavigationBasse: true,
    },
    {
      id: 'disponibilite',
      libelle: 'Disponibilité',
      chemin: '/livreur/disponibilite',
      icone: 'ToggleRight',
      pourNavigationBasse: true,
    },
    { id: 'gains', libelle: 'Mes gains', chemin: '/mes-gains', icone: 'Wallet' },
    {
      id: 'profil',
      libelle: 'Profil',
      chemin: '/profil',
      icone: 'User',
      pourNavigationBasse: true,
    },
  ],
  admin: [
    {
      id: 'tableau_de_bord',
      libelle: 'Tableau de bord',
      chemin: '/admin',
      icone: 'LayoutDashboard',
      pourNavigationBasse: true,
    },
    {
      id: 'utilisateurs',
      libelle: 'Utilisateurs',
      chemin: '/admin/utilisateurs',
      icone: 'Users',
      pourNavigationBasse: true,
    },
    {
      id: 'litiges',
      libelle: 'Litiges',
      chemin: '/admin/litiges',
      icone: 'AlertTriangle',
      pourNavigationBasse: true,
    },
    {
      // ADM-04 : l'admin consulte les paramètres en lecture seule (F-10).
      id: 'parametres',
      libelle: 'Paramètres',
      chemin: '/admin/parametres',
      icone: 'Sliders',
    },
    {
      id: 'soldes',
      libelle: 'Soldes et reversements',
      chemin: '/admin/soldes',
      icone: 'Wallet',
      pourNavigationBasse: true,
    },
    {
      id: 'statistiques',
      libelle: 'Statistiques',
      chemin: '/admin/statistiques',
      icone: 'BarChart3',
      pourNavigationBasse: true,
    },
  ],
  super_admin: [
    {
      id: 'tableau_de_bord',
      libelle: 'Tableau de bord',
      chemin: '/admin',
      icone: 'LayoutDashboard',
      pourNavigationBasse: true,
    },
    {
      id: 'utilisateurs',
      libelle: 'Utilisateurs',
      chemin: '/admin/utilisateurs',
      icone: 'Users',
      pourNavigationBasse: true,
    },
    {
      id: 'parametres',
      libelle: 'Paramètres plateforme',
      chemin: '/admin/parametres',
      icone: 'Sliders',
      pourNavigationBasse: true,
    },
    {
      id: 'litiges',
      libelle: 'Litiges',
      chemin: '/admin/litiges',
      icone: 'AlertTriangle',
      pourNavigationBasse: true,
    },
    {
      id: 'soldes',
      libelle: 'Soldes et reversements',
      chemin: '/admin/soldes',
      icone: 'Wallet',
      pourNavigationBasse: true,
    },
    {
      id: 'statistiques',
      libelle: 'Statistiques',
      chemin: '/admin/statistiques',
      icone: 'BarChart3',
    },
    // ADM-05 : l'audit (liste et export) est réservé au super-admin (docs/03).
    { id: 'audit', libelle: 'Audit', chemin: '/admin/audit', icone: 'FileText' },
  ],
};

export function obtenirMenuRole(role?: RoleUtilisateur | null): ElementMenu[] {
  if (!role || !(role in MENUS_PAR_ROLE)) {
    return MENUS_PAR_ROLE.acheteur;
  }
  return MENUS_PAR_ROLE[role];
}

/**
 * Chemin du tableau de bord provisoire d'un rôle (prompt F-02 frontend
 * point 3 : « redirection vers le tableau de bord du rôle »).
 */
export function cheminTableauDeBord(role?: RoleUtilisateur | null): string {
  switch (role) {
    case 'agriculteur':
      return '/agriculteur';
    case 'ingenieur_agronome':
      return '/ingenieur';
    case 'livreur':
      return '/livreur';
    case 'admin':
    case 'super_admin':
      return '/admin';
    default:
      return '/acheteur';
  }
}
