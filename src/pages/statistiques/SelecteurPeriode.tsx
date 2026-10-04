import React from 'react';
import { Select } from '@/components/Select';
import type { FiltreStatistique } from '@/services/api/statistiques';

interface SelecteurPeriodeProps {
  valeur: FiltreStatistique;
  onChange: (filtre: FiltreStatistique) => void;
  testid?: string;
}

const OPTIONS_GRANULARITE = [
  { valeur: 'jour', libelle: 'Par jour' },
  { valeur: 'semaine', libelle: 'Par semaine' },
  { valeur: 'mois', libelle: 'Par mois' },
];

/** Filtre de période commun aux pages statistiques (F-14) : du / au / granularité. */
export const SelecteurPeriode: React.FC<SelecteurPeriodeProps> = ({
  valeur,
  onChange,
  testid = 'selecteur-periode',
}) => {
  const classeChamp =
    'min-h-tactile px-3 py-2 rounded-md border border-bordure bg-surface text-texte focus:border-primaire focus:outline-none';

  return (
    <section
      aria-label="Filtre de période"
      className="flex flex-wrap items-end gap-3"
      data-testid={testid}
    >
      <label className="flex flex-col gap-1 text-sm font-medium text-texte">
        Du
        <input
          type="date"
          value={valeur.du ?? ''}
          className={classeChamp}
          onChange={(e) => onChange({ ...valeur, du: e.target.value || undefined })}
          data-testid="selecteur-periode-du"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-texte">
        Au
        <input
          type="date"
          value={valeur.au ?? ''}
          className={classeChamp}
          onChange={(e) => onChange({ ...valeur, au: e.target.value || undefined })}
          data-testid="selecteur-periode-au"
        />
      </label>
      <div className="w-40" data-testid="filtre-granularite">
        <Select
          label="Granularité"
          value={valeur.granularite ?? 'mois'}
          options={OPTIONS_GRANULARITE}
          onChange={(e) =>
            onChange({ ...valeur, granularite: e.target.value as FiltreStatistique['granularite'] })
          }
        />
      </div>
      {(valeur.du || valeur.au || (valeur.granularite && valeur.granularite !== 'mois')) && (
        <button
          type="button"
          className="min-h-tactile px-3 py-2 text-sm rounded-md border border-bordure text-texte-secondaire hover:border-primaire hover:text-primaire"
          onClick={() => onChange({ granularite: 'mois' })}
          data-testid="filtre-reinitialiser"
        >
          Réinitialiser
        </button>
      )}
    </section>
  );
};

export default SelecteurPeriode;
