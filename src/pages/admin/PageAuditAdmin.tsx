import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { Bouton } from '@/components/Bouton';
import { Champ } from '@/components/Champ';
import { EtatChargement } from '@/components/EtatChargement';
import { EtatErreur } from '@/components/EtatErreur';
import { EtatVide } from '@/components/EtatVide';
import { Pagination } from '@/components/Pagination';
import { Select } from '@/components/Select';
import { TableauResponsive, type Colonne } from '@/components/TableauResponsive';
import { useToast } from '@/components/Toast';
import {
  TYPES_ENTITE_AUDIT,
  declencherTelechargement,
  listerAudit,
  telechargerAuditCsv,
  type AuditEntreeApi,
  type FiltresAudit,
} from '@/services/api/audit';
import { ErreurApi } from '@/services/api/client';
import { MESSAGES } from '@/theme/messages';

const TAILLE_PAGE = 20;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

/** Valeur journalisée (dict JSON) rendue en texte lisible. */
function decrireValeur(valeur: unknown): string {
  if (valeur === null || valeur === undefined) return '—';
  if (typeof valeur === 'string') return valeur;
  if (typeof valeur === 'object') {
    return Object.entries(valeur as Record<string, unknown>)
      .map(([cle, v]) => `${cle}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
      .join(' · ');
  }
  return String(valeur);
}

/**
 * ADM-05 — Journal d'audit (prompt F-10 frontend point 2) : liste filtrable
 * (acteur, entité, action, période), détail ancienne/nouvelle valeur et
 * export CSV. Route réservée au super-admin côté API (docs/03 SPEC-11).
 */
export const PageAuditAdmin: React.FC = () => {
  const { afficherToast } = useToast();
  const [filtres, setFiltres] = useState<FiltresAudit>({});
  const [page, setPage] = useState(1);
  const [selectionnee, setSelectionnee] = useState<AuditEntreeApi | null>(null);
  const [exportEnCours, setExportEnCours] = useState(false);

  const requete = useQuery({
    queryKey: ['admin', 'audit', filtres, page],
    queryFn: () => listerAudit({ ...filtres, page }),
  });

  const colonnes: Colonne<AuditEntreeApi>[] = [
    {
      cle: 'cree_le',
      enTete: 'Date',
      rendu: (a) => (
        <button
          type="button"
          className="text-left text-sm text-primaire hover:underline"
          onClick={() => setSelectionnee(a)}
          data-testid={`lien-audit-${a.id}`}
        >
          {formatDate(a.cree_le)}
        </button>
      ),
    },
    { cle: 'acteur', enTete: 'Auteur', rendu: (a) => <span>{a.acteur_nom ?? '—'}</span> },
    {
      cle: 'action',
      enTete: 'Action',
      rendu: (a) => <span className="font-mono text-xs">{a.action}</span>,
    },
    {
      cle: 'entite',
      enTete: 'Objet',
      rendu: (a) => (
        <span className="text-sm">
          {TYPES_ENTITE_AUDIT.find((t) => t.valeur === a.entite_type)?.libelle ?? a.entite_type}
        </span>
      ),
    },
    {
      cle: 'changement',
      enTete: 'Changement',
      rendu: (a) => (
        <span className="text-xs text-texte-secondaire">
          {a.ancienne_valeur !== null ? `${decrireValeur(a.ancienne_valeur)} → ` : ''}
          {decrireValeur(a.nouvelle_valeur)}
        </span>
      ),
    },
  ];

  const elements = requete.data?.elements ?? [];

  async function surExport(): Promise<void> {
    setExportEnCours(true);
    try {
      const blob = await telechargerAuditCsv(filtres);
      declencherTelechargement(blob, 'audit-agrisens.csv');
      afficherToast('Export CSV téléchargé.', 'succes');
    } catch (erreur) {
      afficherToast(erreur instanceof ErreurApi ? erreur.message : MESSAGES.erreurReseau, 'erreur');
    } finally {
      setExportEnCours(false);
    }
  }

  function majFiltre(partiel: Partial<FiltresAudit>): void {
    setFiltres((precedents) => ({ ...precedents, ...partiel }));
    setPage(1);
  }

  return (
    <div className="py-6 flex flex-col gap-4" data-testid="page-audit">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-texte">Journal d’audit</h1>
          <p className="text-sm text-texte-secondaire mt-1">
            Qui a changé quoi, quand et pourquoi — réservé au super-admin.
          </p>
        </div>
        <Bouton
          variante="secondaire"
          iconeGauche={<Download size={16} aria-hidden="true" />}
          chargement={exportEnCours}
          onClick={() => void surExport()}
          data-testid="bouton-export-audit"
        >
          Exporter en CSV
        </Bouton>
      </header>

      <section
        aria-label="Filtres d’audit"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-4 rounded-lg border border-bordure bg-surface"
        data-testid="filtres-audit"
      >
        <Select
          label="Type d’entité"
          value={filtres.entiteType ?? ''}
          onChange={(e) => majFiltre({ entiteType: e.target.value || undefined })}
          options={[
            { valeur: '', libelle: 'Toutes les entités' },
            ...TYPES_ENTITE_AUDIT.map(({ valeur, libelle }) => ({ valeur, libelle })),
          ]}
          data-testid="filtre-entite"
        />
        <Champ
          label="Action"
          value={filtres.action ?? ''}
          onChange={(e) => majFiltre({ action: e.target.value || undefined })}
          placeholder="Ex. : modifier_parametre"
          data-testid="filtre-action"
        />
        <Champ
          label="Acteur (identifiant)"
          value={filtres.acteur ?? ''}
          onChange={(e) => majFiltre({ acteur: e.target.value || undefined })}
          placeholder="id utilisateur"
          data-testid="filtre-acteur"
        />
        <Champ
          label="À partir du"
          type="date"
          value={filtres.debut ?? ''}
          onChange={(e) =>
            majFiltre({
              debut: e.target.value ? new Date(e.target.value).toISOString() : undefined,
            })
          }
          data-testid="filtre-debut"
        />
        <Champ
          label="Jusqu’au"
          type="date"
          value={filtres.fin ?? ''}
          onChange={(e) =>
            majFiltre({ fin: e.target.value ? new Date(e.target.value).toISOString() : undefined })
          }
          data-testid="filtre-fin"
        />
      </section>

      {requete.isLoading && <EtatChargement message="Chargement du journal…" />}
      {requete.isError && (
        <EtatErreur message={MESSAGES.erreurReseau} surReessayer={() => requete.refetch()} />
      )}
      {!requete.isLoading && !requete.isError && elements.length === 0 && (
        <EtatVide
          titre={MESSAGES.aucunResultat}
          message="Aucune entrée d’audit pour ces filtres."
        />
      )}
      {elements.length > 0 && (
        <>
          <TableauResponsive
            colonnes={colonnes}
            donnees={elements}
            cleId={(a) => a.id}
            titreMobile={(a) => `${formatDate(a.cree_le)} — ${a.action}`}
            messageVide={MESSAGES.aucunResultat}
          />
          <Pagination
            pageCourante={page}
            totalElements={requete.data?.total ?? 0}
            taillePage={requete.data?.taille ?? TAILLE_PAGE}
            surChangementPage={setPage}
          />
        </>
      )}

      {selectionnee && (
        <section
          aria-label="Détail de l’entrée d’audit"
          className="p-4 rounded-lg border border-bordure bg-surface flex flex-col gap-2"
          data-testid="detail-audit"
        >
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-sm font-bold text-texte">
              {selectionnee.action} — {formatDate(selectionnee.cree_le)}
            </h2>
            <Bouton variante="discret" taille="sm" onClick={() => setSelectionnee(null)}>
              Fermer
            </Bouton>
          </div>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-texte-secondaire">Auteur</dt>
              <dd className="text-texte">{selectionnee.acteur_nom ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-texte-secondaire">Objet</dt>
              <dd className="text-texte">
                {selectionnee.entite_type}{' '}
                <span className="font-mono text-xs">({selectionnee.entite_id || '—'})</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-texte-secondaire">Ancienne valeur</dt>
              <dd
                className="font-mono text-xs text-texte whitespace-pre-wrap"
                data-testid="audit-ancienne-valeur"
              >
                {selectionnee.ancienne_valeur === null
                  ? '—'
                  : JSON.stringify(selectionnee.ancienne_valeur, null, 2)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-texte-secondaire">Nouvelle valeur</dt>
              <dd
                className="font-mono text-xs text-texte whitespace-pre-wrap"
                data-testid="audit-nouvelle-valeur"
              >
                {selectionnee.nouvelle_valeur === null
                  ? '—'
                  : JSON.stringify(selectionnee.nouvelle_valeur, null, 2)}
              </dd>
            </div>
          </dl>
        </section>
      )}
    </div>
  );
};

export default PageAuditAdmin;
