import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ToggleLeft, ToggleRight } from 'lucide-react';
import { Bouton } from '@/components/Bouton';
import { Champ } from '@/components/Champ';
import { EtatChargement } from '@/components/EtatChargement';
import { EtatErreur } from '@/components/EtatErreur';
import { SelecteurPosition, type PositionGeographique } from '@/components/SelecteurPosition';
import { useToast } from '@/components/Toast';
import {
  obtenirMaDisponibilite,
  definirMaDisponibilite,
  pointGeoJSON,
} from '@/services/api/profils';
import { MESSAGES } from '@/theme/messages';

/**
 * LIV-01 (partie disponibilité, prompt F-03 frontend point 4) : bouton
 * disponible / indisponible avec position. L'état est lu depuis l'API et
 * conservé après rechargement (PW-F03-09).
 */

function coordsDepuis(g: { coordinates?: number[] } | null): PositionGeographique | null {
  if (!g || !Array.isArray(g.coordinates) || g.coordinates.length < 2) return null;
  return { longitude: g.coordinates[0]!, latitude: g.coordinates[1]! };
}

export const PageDisponibilite: React.FC = () => {
  const queryClient = useQueryClient();
  const { afficherToast } = useToast();
  const [position, setPosition] = useState<PositionGeographique | null>(null);
  const [zone, setZone] = useState('');

  const requete = useQuery({
    queryKey: ['ma-disponibilite'],
    queryFn: obtenirMaDisponibilite,
  });

  useEffect(() => {
    if (!requete.data) return;
    setPosition(coordsDepuis(requete.data.position as { coordinates?: number[] } | null));
    setZone(requete.data.zone ?? '');
  }, [requete.data]);

  const mutation = useMutation({
    mutationFn: (disponible: boolean) =>
      definirMaDisponibilite({
        disponible,
        position: position ? pointGeoJSON(position.longitude, position.latitude) : null,
        zone: zone || null,
      }),
    onSuccess: (profil) => {
      queryClient.setQueryData(['ma-disponibilite'], profil);
      afficherToast(
        profil.disponible ? 'Vous êtes disponible.' : 'Vous êtes indisponible.',
        'succes'
      );
    },
    onError: () => afficherToast(MESSAGES.erreurReseau, 'erreur'),
  });

  if (requete.isLoading) {
    return <EtatChargement message="Chargement de votre disponibilité…" />;
  }
  if (requete.isError) {
    return <EtatErreur message={MESSAGES.erreurReseau} surReessayer={() => requete.refetch()} />;
  }

  const disponible = Boolean(requete.data?.disponible);
  const peutBasculer = !disponible || position !== null;

  return (
    <div className="py-6 flex flex-col gap-6 max-w-2xl" data-testid="page-disponibilite">
      <div>
        <h1 className="text-xl font-bold text-texte">Ma disponibilité</h1>
        <p className="text-sm text-texte-secondaire mt-1">
          Les demandes de livraison ne vous sont envoyées que si vous êtes disponible à proximité.
        </p>
      </div>

      {/* État courant (PW-F03-09 : conservé après rechargement) */}
      <div
        className={`p-4 rounded-lg border flex items-center gap-3 ${
          disponible ? 'border-succes/40 bg-succes-fond' : 'border-bordure bg-surface'
        }`}
        data-testid="etat-disponibilite"
        data-disponible={disponible ? 'true' : 'false'}
      >
        {disponible ? (
          <ToggleRight className="text-succes" size={28} aria-hidden="true" />
        ) : (
          <ToggleLeft className="text-texte-muet" size={28} aria-hidden="true" />
        )}
        <div>
          <p className="text-sm font-semibold text-texte">
            {disponible ? 'Disponible' : 'Indisponible'}
          </p>
          {requete.data?.position_maj_le && (
            <p className="text-xs text-texte-muet">
              Mis à jour{' '}
              {new Date(requete.data.position_maj_le).toLocaleString('fr-FR', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-texte">Votre position *</p>
        <SelecteurPosition value={position} onChange={setPosition} />
      </div>

      <div className="max-w-xs">
        <Champ
          label="Zone d’intervention (facultatif)"
          placeholder="ex. Douala, Bonabéri"
          value={zone}
          onChange={(evement) => setZone(evement.target.value)}
          data-testid="champ-zone-livreur"
        />
      </div>

      <div className="flex gap-3">
        <Bouton
          type="button"
          variante={disponible ? 'secondaire' : 'primaire'}
          disabled={mutation.isPending || !peutBasculer}
          onClick={() => mutation.mutate(!disponible)}
          data-testid="bouton-basculer-disponibilite"
        >
          {mutation.isPending
            ? 'Enregistrement…'
            : disponible
              ? 'Me rendre indisponible'
              : 'Me rendre disponible'}
        </Bouton>
      </div>
      {!peutBasculer && (
        <p className="text-xs text-erreur -mt-4" role="alert">
          Choisissez votre position avant de vous rendre disponible.
        </p>
      )}
    </div>
  );
};
