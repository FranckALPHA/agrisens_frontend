import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Server, Database } from 'lucide-react';
import { apiClient } from '@/services/api/client';
import { EtatChargement } from '@/components/EtatChargement';
import { EtatErreur } from '@/components/EtatErreur';
import { Bouton } from '@/components/Bouton';
import { MESSAGES } from '@/theme/messages';

export const PageEtat: React.FC = () => {
  const { data, error, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['sante-api'],
    queryFn: async () => {
      // 1. Appel du point de santé liveness
      const reponseLiveness = await apiClient.GET('/api/v1/sante');
      if (!reponseLiveness.data) {
        throw new Error(MESSAGES.erreurReseau);
      }

      // 2. Appel du point de préparation readiness
      const reponseReadiness = await apiClient.GET('/api/v1/sante/pret');
      if (!reponseReadiness.data) {
        throw new Error(MESSAGES.erreurReseau);
      }

      return {
        liveness: reponseLiveness.data,
        readiness: reponseReadiness.data,
      };
    },
  });

  if (isLoading) {
    return <EtatChargement message="Vérification de l'état de l'API…" pleinePage />;
  }

  if (isError) {
    const messageErreur =
      error instanceof Error ? error.message : "Le serveur API n'est pas accessible actuellement.";

    return (
      <div className="py-12">
        <EtatErreur
          titre="Connexion à l'API impossible"
          message={messageErreur}
          chargement={isFetching}
          surReessayer={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="p-8 rounded-xl border border-bordure bg-surface shadow-sm flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle2 size={32} aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-texte">État de la plateforme</h1>
            <p className="text-sm font-semibold text-succes mt-0.5">API disponible</p>
          </div>
        </div>

        <div className="border-t border-bordure pt-6 flex flex-col gap-4">
          <div className="flex items-center justify-between p-3.5 rounded-lg bg-slate-50 border border-bordure text-sm">
            <span className="flex items-center gap-2 text-texte-secondaire font-medium">
              <Server size={18} aria-hidden="true" />
              Service API (Liveness)
            </span>
            <span className="font-semibold text-succes px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200">
              Opérationnel
            </span>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-lg bg-slate-50 border border-bordure text-sm">
            <span className="flex items-center gap-2 text-texte-secondaire font-medium">
              <Database size={18} aria-hidden="true" />
              Base de données MySQL (Readiness)
            </span>
            <span className="font-semibold text-succes px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200">
              {data?.readiness?.base === 'accessible' ? 'Connectée' : 'Accessible'}
            </span>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <Bouton
            type="button"
            variante="secondaire"
            chargement={isFetching}
            onClick={() => refetch()}
          >
            Actualiser l'état
          </Bouton>
        </div>
      </div>
    </div>
  );
};
