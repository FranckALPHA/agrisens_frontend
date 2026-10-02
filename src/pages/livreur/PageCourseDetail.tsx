import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation } from 'lucide-react';
import { Bouton } from '@/components/Bouton';
import { DialogueConfirmation } from '@/components/DialogueConfirmation';
import { EtatChargement } from '@/components/EtatChargement';
import { Select } from '@/components/Select';
import { TeleversementFichier } from '@/components/TeleversementFichier';
import {
  confirmerRemise,
  declarerIncident,
  demarrerLivraison,
  desisterLivraison,
  formaterDuree,
  messageErreurLivraison,
  obtenirItineraire,
  obtenirLivraison,
  publierPositionLivreur,
} from '@/services/api/livraisons';
import { definirMaDisponibilite, obtenirMaDisponibilite } from '@/services/api/profils';
import { ErreurApi } from '@/services/api/client';

const TYPES_INCIDENT = [
  { valeur: 'client_absent', libelle: 'Client absent' },
  { valeur: 'echec_livraison', libelle: 'Échec de livraison' },
  { valeur: 'produit_endommage', libelle: 'Produit endommagé' },
  { valeur: 'autre', libelle: 'Autre' },
];

/**
 * LIV-03 — course du livreur : carte départ/arrivée/ligne droite, lien
 * navigation externe, démarrer, saisie du code, incidents avec photo,
 * désistement, mise à jour de position. Utilisable d'une main (PW-F08-09).
 */
export const PageCourseDetail: React.FC = () => {
  const { identifiant } = useParams();
  const clientRequete = useQueryClient();
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState<unknown>(null);
  const [travail, setTravail] = useState(false);
  const [aDesister, setADesister] = useState(false);
  const [typeIncident, setTypeIncident] = useState('client_absent');
  const [descriptionIncident, setDescriptionIncident] = useState('');
  const [photoIncident, setPhotoIncident] = useState<string | null>(null);
  const [incidentEnvoye, setIncidentEnvoye] = useState(false);

  const requete = useQuery({
    queryKey: ['livraison', identifiant],
    queryFn: () => obtenirLivraison(identifiant ?? ''),
    enabled: Boolean(identifiant),
    retry: false,
  });
  const requeteItineraire = useQuery({
    queryKey: ['itineraire', identifiant],
    queryFn: () => obtenirItineraire(identifiant ?? ''),
    enabled: Boolean(identifiant) && requete.isSuccess,
    retry: false,
  });

  useEffect(() => {
    setIncidentEnvoye(false);
    setPhotoIncident(null);
  }, [identifiant]);

  if (requete.isLoading) return <EtatChargement pleinePage message="Chargement de la course…" />;
  if (requete.isError || !requete.data) {
    return (
      <div className="py-12 text-center" data-testid="course-introuvable">
        <h1 className="text-2xl font-bold text-texte">Course introuvable</h1>
        <p className="mt-4">
          <Link to="/livreur/courses" className="text-primaire underline">
            Retour aux courses
          </Link>
        </p>
      </div>
    );
  }

  const livraison = requete.data;
  const itineraire = requeteItineraire.data;
  const depart = itineraire?.point_depart.coordinates;
  const arrivee = itineraire?.point_arrivee.coordinates;
  const lienNavigation = arrivee
    ? `https://www.google.com/maps/dir/?api=1&destination=${arrivee[1]},${arrivee[0]}`
    : null;

  const rafraichir = async () => {
    await clientRequete.invalidateQueries({ queryKey: ['livraison', identifiant] });
    await clientRequete.invalidateQueries({ queryKey: ['mes-livraisons'] });
  };

  const executer = async (action: () => Promise<unknown>) => {
    setErreur(null);
    setTravail(true);
    try {
      await action();
      await rafraichir();
    } catch (cause) {
      setErreur(cause);
    } finally {
      setTravail(false);
    }
  };

  const mettreAJourPosition = async () => {
    setErreur(null);
    if (!('geolocation' in navigator)) {
      setErreur(new Error('Positionnement indisponible sur cet appareil.'));
      return;
    }
    setTravail(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
      );
      const positionGeo: { type: 'Point'; coordinates: [number, number] } = {
        type: 'Point',
        coordinates: [position.coords.longitude, position.coords.latitude],
      };
      if (livraison.statut === 'en_cours') {
        // END-31 : publication de position dédiée pendant la course (D-20).
        await publierPositionLivreur(livraison.id, positionGeo);
      } else {
        const actuelle = await obtenirMaDisponibilite().catch(() => null);
        await definirMaDisponibilite({
          disponible: actuelle?.disponible ?? true,
          position: positionGeo,
          zone: actuelle?.zone ?? null,
        });
      }
      await rafraichir();
    } catch {
      setErreur(new Error('Position indisponible (signal faible ou refus).'));
    } finally {
      setTravail(false);
    }
  };

  const envoyerIncident = async () => {
    await executer(() =>
      declarerIncident(livraison.id, {
        type: typeIncident,
        description: descriptionIncident.trim(),
        fichier_id: photoIncident,
      }).then(() => setIncidentEnvoye(true))
    );
  };

  return (
    <div className="py-6 max-w-2xl flex flex-col gap-5" data-testid="page-course-livreur">
      <h1 className="text-2xl font-bold text-texte">Course {livraison.commande_reference}</h1>
      <p className="text-sm text-texte-secondaire -mt-3">
        Statut : {livraison.statut} · {livraison.zone_livraison} · {livraison.distance_km} km ·{' '}
        {formaterDuree(livraison.duree_estimee_min)}
      </p>

      {erreur ? (
        <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-erreur">
          {erreur instanceof ErreurApi ? messageErreurLivraison(erreur) : 'Action impossible.'}
        </p>
      ) : null}

      {depart && arrivee ? (
        <div
          className="rounded-lg overflow-hidden border border-bordure"
          data-testid="carte-course"
        >
          <MapContainer
            bounds={[
              [depart[1]!, depart[0]!],
              [arrivee[1]!, arrivee[0]!],
            ]}
            style={{ height: '260px', width: '100%' }}
            scrollWheelZoom={false}
            aria-label="Carte de la course : départ, arrivée et ligne droite"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributeurs'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={[depart[1]!, depart[0]!]}>
              <Popup>Point de récupération</Popup>
            </Marker>
            <Marker position={[arrivee[1]!, arrivee[0]!]}>
              <Popup>Zone de livraison</Popup>
            </Marker>
            <Polyline
              positions={[
                [depart[1]!, depart[0]!],
                [arrivee[1]!, arrivee[0]!],
              ]}
              pathOptions={{ color: '#1b5e20', weight: 4 }}
            />
          </MapContainer>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {lienNavigation && (
          <Bouton
            variante="secondaire"
            to={lienNavigation}
            iconeGauche={<Navigation size={16} aria-hidden="true" />}
          >
            <span>Ouvrir dans la navigation</span>
          </Bouton>
        )}
        <Bouton
          taille="sm"
          variante="discret"
          chargement={travail}
          onClick={() => void mettreAJourPosition()}
        >
          Actualiser ma position
        </Bouton>
      </div>

      {(livraison.statut === 'acceptee' || livraison.statut === 'en_cours') && (
        <div className="grid grid-cols-2 gap-2">
          {livraison.statut === 'acceptee' && (
            <Bouton
              taille="lg"
              pleineLargeur
              chargement={travail}
              onClick={() => void executer(() => demarrerLivraison(livraison.id))}
            >
              Démarrer (produit récupéré)
            </Bouton>
          )}
          {livraison.statut === 'en_cours' && (
            <div className="col-span-2 flex flex-col gap-2 rounded-lg border border-primaire bg-surface p-4">
              <label className="text-sm font-medium text-texte" htmlFor="champ-code-remise">
                Code de remise du client (6 chiffres)
              </label>
              <div className="flex gap-2">
                <input
                  id="champ-code-remise"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                  className="flex-1 min-h-tactile px-3 py-2 text-center text-xl tracking-[0.5em] rounded-md border border-bordure bg-surface text-texte font-mono"
                  aria-describedby="aide-code-remise"
                />
                <Bouton
                  chargement={travail}
                  disabled={code.length !== 6}
                  onClick={() => void executer(() => confirmerRemise(livraison.id, code))}
                >
                  Valider
                </Bouton>
              </div>
              <p id="aide-code-remise" className="text-xs text-texte-secondaire">
                Demandez à l’acheteur le code affiché sur son écran. Après 5 erreurs, la saisie est
                bloquée.
              </p>
            </div>
          )}
          {livraison.statut === 'acceptee' && (
            <Bouton taille="sm" variante="discret" onClick={() => setADesister(true)}>
              Me désister
            </Bouton>
          )}
        </div>
      )}

      {livraison.statut === 'en_cours' && (
        <fieldset className="rounded-lg border border-bordure bg-surface p-4 flex flex-col gap-3">
          <legend className="text-sm font-bold text-texte px-1">Déclarer un incident</legend>
          <Select
            label="Type d’incident"
            value={typeIncident}
            onChange={(e) => setTypeIncident(e.target.value)}
            options={TYPES_INCIDENT.map((t) => ({ valeur: t.valeur, libelle: t.libelle }))}
            data-testid="selecteur-type-incident"
          />
          <label className="text-sm font-medium text-texte">
            Description
            <textarea
              rows={2}
              value={descriptionIncident}
              onChange={(e) => setDescriptionIncident(e.target.value)}
              className="mt-1 w-full rounded-md border border-bordure p-3 text-sm bg-surface text-texte"
              aria-label="Description de l’incident"
            />
          </label>
          <TeleversementFichier
            contexte="incident"
            limiteImageMo={5}
            limiteDocumentMo={10}
            accept="image/jpeg,image/png,image/webp"
            libelle="Joindre une photo (facultatif)"
            onTeleverse={(fichier) => setPhotoIncident(fichier.id)}
          />
          <div>
            <Bouton
              variante="secondaire"
              chargement={travail}
              onClick={() => void envoyerIncident()}
            >
              Signaler l’incident
            </Bouton>
          </div>
          {incidentEnvoye && (
            <p role="status" className="text-sm text-succes-texte">
              Incident déclaré. L’acheteur a été notifié.
            </p>
          )}
        </fieldset>
      )}

      {(livraison.adresse_exacte_visible || livraison.telephone_acheteur) && (
        <section
          aria-label="Coordonnées de livraison"
          className="rounded-lg border border-bordure bg-surface p-4 text-sm"
        >
          <h2 className="font-bold text-texte mb-2">Livraison</h2>
          {livraison.adresse_exacte_visible && (
            <p data-testid="course-adresse">{livraison.adresse_exacte}</p>
          )}
          {livraison.telephone_acheteur && (
            <p className="mt-1">
              Téléphone client :{' '}
              <a href={`tel:${livraison.telephone_acheteur}`} className="text-primaire underline">
                {livraison.telephone_acheteur}
              </a>
            </p>
          )}
        </section>
      )}

      <DialogueConfirmation
        ouvert={aDesister}
        titre="Se désister de cette course ?"
        message="La livraison sera de nouveau proposée aux autres livreurs."
        texteConfirmer="Se désister"
        chargement={travail}
        surConfirmer={() =>
          void executer(() => desisterLivraison(livraison.id)).then(() => setADesister(false))
        }
        surAnnuler={() => setADesister(false)}
      />
    </div>
  );
};
