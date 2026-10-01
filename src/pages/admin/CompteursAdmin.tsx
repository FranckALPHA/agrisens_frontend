import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Clock, UserX, KeyRound } from 'lucide-react';
import { EtatChargement } from '@/components/EtatChargement';
import { EtatErreur } from '@/components/EtatErreur';
import { obtenirCompteursAdmin } from '@/services/api/administration';
import { MESSAGES } from '@/theme/messages';

/**
 * ADM-01 (base, prompt F-03 frontend point 5) : bandeau de compteurs de
 * l'espace administration — ingénieurs en attente de validation, demandes de
 * réinitialisation de mot de passe (Q-23) et comptes suspendus.
 */
export const CompteursAdmin: React.FC = () => {
  const requete = useQuery({
    queryKey: ['admin', 'compteurs'],
    queryFn: obtenirCompteursAdmin,
    refetchInterval: 60_000,
  });

  if (requete.isLoading) return <EtatChargement message="Chargement des compteurs…" />;
  if (requete.isError) {
    return <EtatErreur message={MESSAGES.erreurReseau} surReessayer={() => requete.refetch()} />;
  }

  const donnees = requete.data!;
  const cartes = [
    {
      id: 'ingenieurs_en_attente',
      libelle: 'Ingénieurs en attente',
      valeur: donnees.ingenieurs_en_attente,
      icone: <Clock size={20} aria-hidden="true" />,
      chemin: '/admin/utilisateurs?statut=en_attente_validation&role=ingenieur_agronome',
      testid: 'compteur-ingenieurs-attente',
    },
    {
      id: 'reinitialisations',
      libelle: 'Demandes de réinitialisation',
      valeur: donnees.reinitialisations_en_attente,
      icone: <KeyRound size={20} aria-hidden="true" />,
      chemin: '/admin/utilisateurs?demandes=reinitialisation',
      testid: 'compteur-demandes-reinitialisation',
    },
    {
      id: 'suspendus',
      libelle: 'Comptes suspendus',
      valeur: donnees.comptes_suspendus,
      icone: <UserX size={20} aria-hidden="true" />,
      chemin: '/admin/utilisateurs?statut=suspendu',
      testid: 'compteur-comptes-suspendus',
    },
  ];

  return (
    <section
      aria-label="Compteurs d’administration"
      className="grid grid-cols-1 sm:grid-cols-3 gap-3"
      data-testid="compteurs-admin"
    >
      {cartes.map((carte) => (
        <Link
          key={carte.id}
          to={carte.chemin}
          className="p-4 rounded-lg border border-bordure bg-surface hover:border-primaire transition-colors flex items-center gap-3"
          data-testid={carte.testid}
        >
          <span className="w-10 h-10 rounded-full bg-primaire-claire text-primaire flex items-center justify-center shrink-0">
            {carte.icone}
          </span>
          <span>
            <span className="block text-2xl font-bold text-texte leading-none">{carte.valeur}</span>
            <span className="block text-xs text-texte-secondaire mt-1">{carte.libelle}</span>
          </span>
        </Link>
      ))}
    </section>
  );
};
