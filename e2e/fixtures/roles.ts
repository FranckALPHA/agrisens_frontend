/**
 * Profils des personnages pour les tests E2E AgriSens (docs/06-scenarios-interactions.md).
 */
export const PERSONNAGES = {
  paul: {
    telephone: '+237690000001',
    motDePasse: 'Motdepasse123!',
    role: 'agriculteur',
    nom: 'Paul Mbianda',
    region: 'Ouest',
  },
  amina: {
    telephone: '+237690000002',
    motDePasse: 'Motdepasse123!',
    role: 'acheteur',
    nom: 'Amina Oumarou',
    region: 'Centre',
  },
  nadia: {
    telephone: '+237690000003',
    motDePasse: 'Motdepasse123!',
    role: 'ingenieur_agronome',
    nom: 'Nadia Kamga',
    region: 'Littoral',
  },
  jean: {
    telephone: '+237690000004',
    motDePasse: 'Motdepasse123!',
    role: 'livreur',
    nom: 'Jean Tchinda',
    region: 'Centre',
  },
  mireille: {
    telephone: '+237690000005',
    motDePasse: 'Motdepasse123!',
    role: 'admin',
    nom: 'Mireille Ngo',
    region: 'Centre',
  },
  superadmin: {
    telephone: '+237690000000',
    motDePasse: 'Motdepasse123!',
    role: 'super_admin',
    nom: 'Super Administrateur',
    region: 'Centre',
  },
} as const;
