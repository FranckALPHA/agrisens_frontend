import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Ban, Clock, Save } from 'lucide-react';
import { Champ } from '@/components/Champ';
import { Bouton } from '@/components/Bouton';
import { Select } from '@/components/Select';
import { BadgeStatut } from '@/components/BadgeStatut';
import { EtatChargement } from '@/components/EtatChargement';
import { EtatErreur } from '@/components/EtatErreur';
import { SelecteurPosition, type PositionGeographique } from '@/components/SelecteurPosition';
import { TeleversementFichier } from '@/components/TeleversementFichier';
import { useToast } from '@/components/Toast';
import {
  creerSchemaProfilIngenieur,
  type DonneesProfilIngenieur,
} from '@/pages/ingenieur/validationsProfil';
import {
  obtenirMonProfilIngenieur,
  modifierMonProfilIngenieur,
  deposerJustificatif,
  pointGeoJSON,
  type IngenieurProfilApi,
  type JustificatifApi,
  type TypeJustificatifApi,
} from '@/services/api/profils';
import {
  obtenirParametresPublics,
  listerReferentiel,
  lirePointGeoJSON,
} from '@/services/api/communs';
import { STATUTS_JUSTIFICATIF, STATUTS_VALIDATION_INGENIEUR } from '@/theme/statuts';
import { MESSAGES } from '@/theme/messages';

/**
 * ING-02 — Profil professionnel de l'ingénieur (prompt F-03 frontend point 3,
 * 09 §ING-02) : spécialités (référentiel), zone (position + rayon), tarif,
 * modalités, disponibilité, biographie, justificatifs et statut de validation
 * clairement affiché. Accessible pendant l'attente de validation (D-13).
 */

const TYPES_JUSTIFICATIF: { valeur: TypeJustificatifApi; libelle: string }[] = [
  { valeur: 'diplome', libelle: 'Diplôme' },
  { valeur: 'piece_identite', libelle: 'Pièce d’identité' },
  { valeur: 'autre', libelle: 'Autre document' },
];

/** Bandeau de statut de validation (D-13) : vert validé, ambre attente, rouge refus + motif. */
const BandeauStatut: React.FC<{ profil: IngenieurProfilApi }> = ({ profil }) => {
  return (
    <div
      className="p-4 rounded-lg border border-bordure bg-surface flex items-start gap-3"
      data-testid="bandeau-statut-validation"
    >
      {profil.statut_validation === 'valide' ? (
        <BadgeCheck className="text-succes shrink-0 mt-0.5" aria-hidden="true" />
      ) : profil.statut_validation === 'refuse' ? (
        <Ban className="text-erreur shrink-0 mt-0.5" aria-hidden="true" />
      ) : (
        <Clock className="text-avertissement shrink-0 mt-0.5" aria-hidden="true" />
      )}
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-texte">Statut du profil :</p>
          <BadgeStatut
            statut={profil.statut_validation}
            registre={STATUTS_VALIDATION_INGENIEUR}
            taille="sm"
          />
        </div>
        {profil.statut_validation === 'en_attente' && (
          <p className="text-sm text-texte-secondaire mt-1">
            Un administrateur examine votre dossier. Vous pouvez continuer à compléter votre profil
            ; il sera visible des agriculteurs dès la validation.
          </p>
        )}
        {profil.statut_validation === 'refuse' && profil.motif_refus && (
          <p className="text-sm text-erreur mt-1" data-testid="motif-refus">
            Motif du refus : {profil.motif_refus}
          </p>
        )}
        {profil.statut_validation === 'valide' && profil.valide_le && (
          <p className="text-sm text-texte-secondaire mt-1">
            Validé le {new Date(profil.valide_le).toLocaleDateString('fr-FR')}.
          </p>
        )}
      </div>
    </div>
  );
};

/** Section justificatifs : téléversement par type + liste des pièces déposées. */
const SectionJustificatifs: React.FC<{
  justificatifs: JustificatifApi[];
  limiteDocumentMo: number;
  limiteImageMo: number;
}> = ({ justificatifs, limiteDocumentMo, limiteImageMo }) => {
  const queryClient = useQueryClient();
  const { afficherToast } = useToast();
  const [typeChoisi, setTypeChoisi] = useState<TypeJustificatifApi>('diplome');

  const mutationDepot = useMutation({
    mutationFn: (fichierId: string) => deposerJustificatif(fichierId, typeChoisi),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profil-ingenieur'] });
      afficherToast('Justificatif déposé.', 'succes');
    },
    onError: () => afficherToast(MESSAGES.erreurReseau, 'erreur'),
  });

  return (
    <section
      className="flex flex-col gap-4 border-t border-bordure pt-8"
      aria-labelledby="titre-justificatifs"
    >
      <h2 id="titre-justificatifs" className="text-lg font-semibold text-texte">
        Justificatifs
      </h2>
      <p className="text-sm text-texte-secondaire">
        Diplôme et pièce d’identité obligatoires pour la validation du profil (D-13).
      </p>

      <div className="max-w-xs">
        <Select
          label="Nature du document"
          value={typeChoisi}
          options={TYPES_JUSTIFICATIF.map((t) => ({ valeur: t.valeur, libelle: t.libelle }))}
          onChange={(evement) => setTypeChoisi(evement.target.value as TypeJustificatifApi)}
          data-testid="selecteur-type-justificatif"
        />
      </div>

      <TeleversementFichier
        contexte="justificatif"
        limiteImageMo={limiteImageMo}
        limiteDocumentMo={limiteDocumentMo}
        onTeleverse={(fichier) => mutationDepot.mutate(fichier.id)}
        accept="image/jpeg,image/png,application/pdf"
        libelle="Choisir un justificatif"
      />

      {justificatifs.length > 0 && (
        <ul className="flex flex-col gap-2" data-testid="liste-justificatifs">
          {justificatifs.map((piece) => (
            <li
              key={piece.id}
              className="p-3 rounded-md border border-bordure bg-surface flex items-center gap-3 flex-wrap"
              data-testid={`justificatif-${piece.type}`}
            >
              <div className="flex-1 min-w-[12rem]">
                <p className="text-sm font-medium text-texte">{piece.fichier.nom_original}</p>
                <p className="text-xs text-texte-muet">
                  {TYPES_JUSTIFICATIF.find((t) => t.valeur === piece.type)?.libelle ?? piece.type}
                  {' · '}
                  {Math.round(piece.fichier.taille_octets / 1024)} Ko
                </p>
              </div>
              <BadgeStatut statut={piece.statut} registre={STATUTS_JUSTIFICATIF} taille="sm" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

/** ING-02 — page complète. */
export const PageProfilPro: React.FC = () => {
  const queryClient = useQueryClient();
  const { afficherToast } = useToast();
  const [position, setPosition] = useState<PositionGeographique | null>(null);

  const requeteProfil = useQuery({
    queryKey: ['profil-ingenieur'],
    queryFn: obtenirMonProfilIngenieur,
  });
  const requeteParametres = useQuery({
    queryKey: ['parametres-publics'],
    queryFn: obtenirParametresPublics,
  });
  const requeteSpecialites = useQuery({
    queryKey: ['referentiel', 'specialite'],
    queryFn: () => listerReferentiel('specialite'),
  });
  const requeteRegions = useQuery({
    queryKey: ['referentiel', 'region'],
    queryFn: () => listerReferentiel('region'),
  });

  const parametres = useMemo(() => requeteParametres.data ?? {}, [requeteParametres.data]);
  const bornes = useMemo(
    () => ({
      tarifMinFcfa: Number(parametres['consultation.prix_min_fcfa'] ?? 0),
      tarifMaxFcfa: Number(parametres['consultation.prix_max_fcfa'] ?? 1_000_000),
      rayonMaxKm: Number(parametres['consultation.zone_rayon_km_max'] ?? 500),
    }),
    [parametres]
  );
  const schema = useMemo(() => creerSchemaProfilIngenieur(bornes), [bornes]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<DonneesProfilIngenieur>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: {
      specialites: [],
      region: '',
      zoneRayonKm: 50,
      tarifConsultationFcfa: bornes.tarifMinFcfa,
      biographie: '',
      modalites: '',
      disponible: false,
    },
  });

  // Pré-remplir le formulaire quand le profil arrive.
  const profil = requeteProfil.data;
  useEffect(() => {
    if (!profil) return;
    setValue(
      'specialites',
      Array.isArray(profil.specialites) ? (profil.specialites as string[]) : []
    );
    setValue('region', profil.region ?? '');
    setValue('zoneRayonKm', profil.zone_rayon_km ?? 50);
    setValue('tarifConsultationFcfa', profil.tarif_consultation_fcfa ?? bornes.tarifMinFcfa);
    setValue('biographie', profil.biographie ?? '');
    setValue('modalites', profil.modalites ?? '');
    setValue('disponible', Boolean(profil.disponible));
    const centre = profil.zone_centre ? lirePointGeoJSON(profil.zone_centre) : null;
    if (centre) {
      setPosition(centre);
    }
  }, [profil, setValue, bornes.tarifMinFcfa]);

  const mutation = useMutation({
    mutationFn: (donnees: DonneesProfilIngenieur) =>
      modifierMonProfilIngenieur({
        specialites: donnees.specialites,
        region: donnees.region,
        zone_centre: position ? pointGeoJSON(position.longitude, position.latitude) : null,
        zone_rayon_km: donnees.zoneRayonKm,
        tarif_consultation_fcfa: donnees.tarifConsultationFcfa,
        disponible: donnees.disponible,
        biographie: donnees.biographie || null,
        modalites: donnees.modalites || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profil-ingenieur'] });
      afficherToast('Profil professionnel enregistré.', 'succes');
    },
    onError: () => afficherToast(MESSAGES.erreurReseau, 'erreur'),
  });

  if (requeteProfil.isLoading || requeteParametres.isLoading) {
    return <EtatChargement message="Chargement de votre profil…" />;
  }
  if (requeteProfil.isError) {
    return (
      <EtatErreur message={MESSAGES.erreurReseau} surReessayer={() => requeteProfil.refetch()} />
    );
  }

  const specialites = requeteSpecialites.data ?? [];
  const regions = requeteRegions.data ?? [];
  const specialitesChoisies = watch('specialites') ?? [];

  return (
    <div className="py-4 flex flex-col gap-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-texte">Profil professionnel</h1>
        <p className="text-sm text-texte-secondaire mt-1">
          Ces informations déterminent comment les agriculteurs vous trouvent et vous contactent.
        </p>
      </div>

      {profil && <BandeauStatut profil={profil} />}

      <form
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((donnees) => mutation.mutate(donnees))}
        noValidate
        data-testid="formulaire-profil-pro"
      >
        {/* Spécialités (référentiel) */}
        <fieldset className="flex flex-col gap-2" data-testid="champ-specialites">
          <legend className="text-sm font-medium text-texte">Spécialités *</legend>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {specialites.map((option) => (
              <label
                key={option.code}
                className="flex items-center gap-2 p-2 rounded-md border border-bordure bg-surface text-sm text-texte cursor-pointer hover:border-primaire"
              >
                <input
                  type="checkbox"
                  className="accent-[var(--couleur-primaire,#16a34a)]"
                  value={option.code}
                  checked={specialitesChoisies.includes(option.code)}
                  onChange={(evement) => {
                    const suivant = evement.target.checked
                      ? [...specialitesChoisies, option.code]
                      : specialitesChoisies.filter((c) => c !== option.code);
                    setValue('specialites', suivant, { shouldValidate: true });
                  }}
                />
                <span className="truncate">{option.libelle}</span>
              </label>
            ))}
          </div>
          {errors.specialites && (
            <p className="text-xs text-erreur" role="alert">
              {errors.specialites.message}
            </p>
          )}
        </fieldset>

        {/* Région */}
        <Select
          label="Région d’intervention *"
          options={[
            { valeur: '', libelle: 'Choisir une région', desactive: true },
            ...regions.map((r) => ({ valeur: r.code, libelle: r.libelle })),
          ]}
          erreur={errors.region?.message}
          data-testid="champ-region"
          {...register('region')}
        />

        {/* Zone : position + rayon */}
        <div className="flex flex-col gap-2" data-testid="champ-zone">
          <p className="text-sm font-medium text-texte">Zone d’intervention *</p>
          <SelecteurPosition value={position} onChange={setPosition} />
          {position === null && (
            <p className="text-xs text-texte-secondaire">
              Placez votre point d’intervention sur la carte ou utilisez le GPS.
            </p>
          )}
        </div>
        <div className="max-w-[200px]">
          <Champ
            label="Rayon (km)"
            type="number"
            min={1}
            max={bornes.rayonMaxKm}
            aide={`Maximum ${bornes.rayonMaxKm} km.`}
            erreur={errors.zoneRayonKm?.message}
            data-testid="champ-rayon"
            {...register('zoneRayonKm', { valueAsNumber: true })}
          />
        </div>

        {/* Tarif */}
        <Champ
          label="Tarif de consultation (FCFA)"
          type="number"
          min={bornes.tarifMinFcfa}
          max={bornes.tarifMaxFcfa}
          aide={`Entre ${bornes.tarifMinFcfa} et ${bornes.tarifMaxFcfa} FCFA, hors déplacement.`}
          erreur={errors.tarifConsultationFcfa?.message}
          data-testid="champ-tarif"
          {...register('tarifConsultationFcfa', { valueAsNumber: true })}
        />

        {/* Disponibilité */}
        <label
          className="flex items-center gap-3 text-sm text-texte"
          data-testid="champ-disponible"
        >
          <input
            type="checkbox"
            className="w-5 h-5 accent-[var(--couleur-primaire,#16a34a)]"
            {...register('disponible')}
          />
          Je suis disponible pour de nouvelles consultations
        </label>

        {/* Biographie + modalités */}
        <div className="flex flex-col gap-1">
          <label htmlFor="biographie" className="text-sm font-medium text-texte">
            Biographie
          </label>
          <textarea
            id="biographie"
            rows={4}
            maxLength={2000}
            className="w-full px-3 py-2 rounded-md border border-bordure bg-surface text-texte text-base focus:outline-none focus:ring-2 focus:ring-primaire"
            data-testid="champ-biographie"
            {...register('biographie')}
          />
          {errors.biographie && (
            <p className="text-xs text-erreur" role="alert">
              {errors.biographie.message}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="modalites" className="text-sm font-medium text-texte">
            Modalités d’intervention
          </label>
          <textarea
            id="modalites"
            rows={3}
            maxLength={1000}
            placeholder="Déplacements, visioconférence, créneaux…"
            className="w-full px-3 py-2 rounded-md border border-bordure bg-surface text-texte text-base focus:outline-none focus:ring-2 focus:ring-primaire"
            data-testid="champ-modalites"
            {...register('modalites')}
          />
          {errors.modalites && (
            <p className="text-xs text-erreur" role="alert">
              {errors.modalites.message}
            </p>
          )}
        </div>

        <div className="flex justify-end">
          <Bouton
            type="submit"
            disabled={isSubmitting}
            iconeGauche={<Save size={18} aria-hidden="true" />}
            data-testid="bouton-enregistrer-profil-pro"
          >
            {isSubmitting ? 'Enregistrement…' : 'Enregistrer mon profil'}
          </Bouton>
        </div>
      </form>

      {profil && (
        <SectionJustificatifs
          justificatifs={(profil.justificatifs ?? []) as unknown as JustificatifApi[]}
          limiteDocumentMo={Number(parametres['fichiers.document_max_mo'] ?? 10)}
          limiteImageMo={Number(parametres['fichiers.image_max_mo'] ?? 5)}
        />
      )}
    </div>
  );
};
