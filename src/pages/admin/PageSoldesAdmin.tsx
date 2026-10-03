import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EtatChargement } from '@/components/EtatChargement';
import { EtatErreur } from '@/components/EtatErreur';
import { EtatVide } from '@/components/EtatVide';
import { Bouton } from '@/components/Bouton';
import { Champ } from '@/components/Champ';
import { Select } from '@/components/Select';
import { Pagination } from '@/components/Pagination';
import { TableauResponsive, type Colonne } from '@/components/TableauResponsive';
import { useToast } from '@/components/Toast';
import { ErreurApi } from '@/services/api/client';
import { formaterPrix } from '@/services/api/produits';
import {
  enregistrerReversement,
  listerReversements,
  listerSoldesAdmin,
  type SoldeLigneApi,
} from '@/services/api/soldes';
import { MESSAGES } from '@/theme/messages';

const LIBELLE_OPERATEUR: Record<string, string> = {
  mtn_momo: 'MTN Mobile Money',
  orange_money: 'Orange Money',
};

/**
 * Page admin « Soldes et reversements » (prompt F-10 frontend point 3, Q-11) :
 * file des soldes positifs, enregistrement d'un reversement manuel
 * (montant ≤ solde, référence obligatoire) et historique.
 */
export const PageSoldesAdmin: React.FC = () => {
  const clientRequete = useQueryClient();
  const { afficherToast } = useToast();
  const [selection, setSelection] = useState<string | null>(null);
  const [montant, setMontant] = useState('');
  const [operateur, setOperateur] = useState<'mtn_momo' | 'orange_money'>('mtn_momo');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const requeteSoldes = useQuery({
    queryKey: ['admin', 'soldes'],
    queryFn: listerSoldesAdmin,
  });
  const requeteHistorique = useQuery({
    queryKey: ['admin', 'reversements', page],
    queryFn: () => listerReversements({ page }),
  });

  const soldes = requeteSoldes.data ?? [];
  const beneficiaire = soldes.find((s) => s.beneficiaire_id === selection);

  const mutation = useMutation({
    mutationFn: () =>
      enregistrerReversement({
        beneficiaire_id: selection as string,
        montant_fcfa: Number(montant),
        operateur,
        reference_operateur: reference.trim(),
        note: note.trim() || undefined,
      }),
    onSuccess: (reversement) => {
      afficherToast(
        `Reversement de ${formaterPrix(reversement.montant_fcfa)} enregistré (réf. ${reversement.reference_operateur}).`,
        'succes'
      );
      setSelection(null);
      setMontant('');
      setReference('');
      setNote('');
      setErreur(null);
      void clientRequete.invalidateQueries({ queryKey: ['admin', 'soldes'] });
      void clientRequete.invalidateQueries({ queryKey: ['admin', 'reversements'] });
    },
    onError: (e: unknown) => setErreur(e instanceof ErreurApi ? e.message : MESSAGES.erreurReseau),
  });

  const colonnes: Colonne<SoldeLigneApi>[] = [
    {
      cle: 'nom',
      enTete: 'Bénéficiaire',
      rendu: (s) => (
        <button
          type="button"
          className="text-left font-medium text-primaire hover:underline"
          onClick={() => {
            setSelection(s.beneficiaire_id);
            setMontant(String(s.solde));
            setErreur(null);
          }}
          data-testid={`choisir-beneficiaire-${s.beneficiaire_id}`}
        >
          {s.nom}
        </button>
      ),
    },
    { cle: 'role', enTete: 'Rôle', rendu: (s) => <span className="text-sm">{s.role}</span> },
    {
      cle: 'gains_acquis',
      enTete: 'Gains acquis',
      alignement: 'droite',
      rendu: (s) => <span className="text-sm">{formaterPrix(s.gains_acquis)}</span>,
    },
    {
      cle: 'remboursements_imputes',
      enTete: 'Remboursements',
      alignement: 'droite',
      rendu: (s) => <span className="text-sm">{formaterPrix(s.remboursements_imputes)}</span>,
    },
    {
      cle: 'deja_reverse',
      enTete: 'Déjà reversé',
      alignement: 'droite',
      rendu: (s) => <span className="text-sm">{formaterPrix(s.deja_reverse)}</span>,
    },
    {
      cle: 'solde',
      enTete: 'Solde',
      alignement: 'droite',
      rendu: (s) => (
        <strong className="text-sm text-texte" data-testid={`solde-${s.beneficiaire_id}`}>
          {formaterPrix(s.solde)}
        </strong>
      ),
    },
  ];

  const lignesHistorique = requeteHistorique.data?.elements ?? [];

  return (
    <div className="py-6 flex flex-col gap-6" data-testid="page-soldes-admin">
      <header>
        <h1 className="text-xl md:text-2xl font-bold text-texte">Soldes et reversements</h1>
        <p className="text-sm text-texte-secondaire mt-1">
          Le solde est recalculé à la consultation (Q-11) : gains acquis − remboursements imputés −
          déjà reversé. Un reversement est manuel (Mobile Money hors circuit NotchPay) et audité.
        </p>
      </header>

      <section aria-label="Soldes positifs à reverser" data-testid="file-soldes">
        <h2 className="text-base font-bold text-texte mb-3">À reverser</h2>
        {requeteSoldes.isLoading && <EtatChargement message="Calcul des soldes…" />}
        {requeteSoldes.isError && (
          <EtatErreur
            message={MESSAGES.erreurReseau}
            surReessayer={() => requeteSoldes.refetch()}
          />
        )}
        {!requeteSoldes.isLoading && !requeteSoldes.isError && soldes.length === 0 && (
          <EtatVide
            titre="Aucun solde à reverser"
            message="Tous les gains acquis ont été reversés ou aucun n'est encore disponible."
          />
        )}
        {soldes.length > 0 && (
          <TableauResponsive
            colonnes={colonnes}
            donnees={soldes}
            cleId={(s) => s.beneficiaire_id}
            titreMobile={(s) => s.nom}
          />
        )}
      </section>

      {selection && beneficiaire && (
        <form
          noValidate
          aria-label="Enregistrer un reversement"
          className="flex flex-col gap-3 p-4 rounded-lg border border-bordure bg-surface-survol"
          onSubmit={(e) => {
            e.preventDefault();
            setErreur(null);
            mutation.mutate();
          }}
          data-testid="form-reversement"
        >
          <h2 className="text-sm font-bold text-texte">
            Reversement à {beneficiaire.nom} — solde {formaterPrix(beneficiaire.solde)}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Champ
              label="Montant (FCFA)"
              type="number"
              min={1}
              max={beneficiaire.solde}
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              aide={`Maximum ${beneficiaire.solde.toLocaleString('fr-FR')} FCFA (solde disponible)`}
              required
              data-testid="champ-montant-reversement"
            />
            <Select
              label="Opérateur"
              value={operateur}
              onChange={(e) => setOperateur(e.target.value as 'mtn_momo' | 'orange_money')}
              options={Object.entries(LIBELLE_OPERATEUR).map(([valeur, libelle]) => ({
                valeur,
                libelle,
              }))}
              data-testid="champ-operateur-reversement"
            />
            <Champ
              label="Référence de l’opérateur"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ex. : MTN-738211"
              required
              data-testid="champ-reference-reversement"
            />
            <Champ
              label="Note (optionnelle)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              data-testid="champ-note-reversement"
            />
          </div>
          {erreur && (
            <p
              className="text-sm text-erreur font-medium"
              role="alert"
              data-testid="erreur-reversement"
            >
              {erreur}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Bouton
              variante="discret"
              onClick={() => setSelection(null)}
              data-testid="bouton-annuler-reversement"
            >
              {MESSAGES.annuler}
            </Bouton>
            <Bouton
              type="submit"
              variante="primaire"
              chargement={mutation.isPending}
              disabled={!(Number(montant) > 0) || !reference.trim()}
              data-testid="bouton-confirmer-reversement"
            >
              Confirmer le reversement
            </Bouton>
          </div>
        </form>
      )}

      <section aria-label="Historique des reversements" data-testid="historique-reversements">
        <h2 className="text-base font-bold text-texte mb-3">Historique</h2>
        {requeteHistorique.isLoading && <EtatChargement message="Chargement de l’historique…" />}
        {requeteHistorique.isError && (
          <EtatErreur
            message={MESSAGES.erreurReseau}
            surReessayer={() => requeteHistorique.refetch()}
          />
        )}
        {!requeteHistorique.isLoading &&
          !requeteHistorique.isError &&
          lignesHistorique.length === 0 && (
            <EtatVide titre={MESSAGES.aucunResultat} message="Aucun reversement enregistré." />
          )}
        {lignesHistorique.length > 0 && (
          <>
            <TableauResponsive
              colonnes={[
                {
                  cle: 'effectue_le',
                  enTete: 'Date',
                  rendu: (r) => (
                    <span className="text-sm">
                      {new Date(r.effectue_le).toLocaleString('fr-FR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </span>
                  ),
                },
                { cle: 'beneficiaire_nom', enTete: 'Bénéficiaire' },
                {
                  cle: 'montant',
                  enTete: 'Montant',
                  alignement: 'droite',
                  rendu: (r) => <span className="text-sm">{formaterPrix(r.montant_fcfa)}</span>,
                },
                {
                  cle: 'operateur',
                  enTete: 'Opérateur',
                  rendu: (r) => (
                    <span className="text-sm">{LIBELLE_OPERATEUR[r.operateur] ?? r.operateur}</span>
                  ),
                },
                {
                  cle: 'reference_operateur',
                  enTete: 'Référence',
                  rendu: (r) => <span className="font-mono text-xs">{r.reference_operateur}</span>,
                },
                {
                  cle: 'effectue_par_nom',
                  enTete: 'Enregistré par',
                  rendu: (r) => <span className="text-sm">{r.effectue_par_nom ?? '—'}</span>,
                },
              ]}
              donnees={lignesHistorique}
              cleId={(r) => String(r.id)}
              titreMobile={(r) => `${r.beneficiaire_nom} — ${formaterPrix(r.montant_fcfa)}`}
            />
            <Pagination
              pageCourante={page}
              totalElements={requeteHistorique.data?.total ?? 0}
              taillePage={requeteHistorique.data?.taille ?? 20}
              surChangementPage={setPage}
            />
          </>
        )}
      </section>
    </div>
  );
};

export default PageSoldesAdmin;
