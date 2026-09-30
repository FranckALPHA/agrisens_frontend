import React from 'react';

/**
 * Gabarit des pages légales (FE-01). Le texte définitif doit être fourni par
 * le client ; en attendant chaque paragraphe est clairement marqué
 * « provisoire » pour ne jamais présenter un engagement juridique comme acquis.
 */
const EncartProvisoire: React.FC = () => (
  <p
    role="note"
    className="p-3 rounded-md border border-amber-300 bg-amber-50 text-amber-900 text-sm font-medium"
  >
    Texte provisoire — en attente de validation juridique par AgriSens Cameroun. Cette page ne
    constitue pas les conditions définitives applicables à la plateforme.
  </p>
);

const Section: React.FC<{ titre: string; children: React.ReactNode }> = ({ titre, children }) => (
  <section className="flex flex-col gap-2">
    <h2 className="text-lg font-semibold text-texte">{titre}</h2>
    <div className="text-sm text-texte-secondaire leading-relaxed space-y-2">{children}</div>
  </section>
);

export const PageConditions: React.FC = () => (
  <article className="max-w-3xl mx-auto flex flex-col gap-8 py-6">
    <h1 className="text-2xl sm:text-3xl font-bold text-texte">Conditions d’utilisation</h1>
    <EncartProvisoire />
    <Section titre="Objet">
      <p>
        AgriSens est une plateforme numérique mise en relation d’agriculteurs, acheteurs, ingénieurs
        agronomes et livreurs au Cameroun. Ces conditions décrivent, dans une version provisoire,
        les règles d’utilisation du service.
      </p>
    </Section>
    <Section titre="Comptes et responsabilités">
      <p>
        Chaque utilisateur est responsable de la véracité de ses informations (identité, téléphone,
        produits proposés). Le partage de ses identifiants de connexion est interdit ;
        l’administration peut suspendre un compte qui enfreint les règles de la plateforme.
      </p>
    </Section>
    <Section titre="Transactions et paiements">
      <p>
        Les paiements entre utilisateurs transite par des prestataires Mobile Money agréés au
        Cameroun. Les tarifs, frais et modalités de remboursement sont définis dans le barème publié
        sur la plateforme et susceptible d’évoluer.
      </p>
    </Section>
    <Section titre="Responsabilité">
      <p>
        AgriSens facilite la mise en relation ; la qualité des produits et l’exécution des
        livraisons relèvent des parties au contrat de vente.
      </p>
    </Section>
  </article>
);

export const PageConfidentialite: React.FC = () => (
  <article className="max-w-3xl mx-auto flex flex-col gap-8 py-6">
    <h1 className="text-2xl sm:text-3xl font-bold text-texte">Politique de confidentialité</h1>
    <EncartProvisoire />
    <Section titre="Données collectées">
      <p>
        Téléphone (identifiant principal), nom, email facultatif, région, position géographique des
        adresses enregistrées et historique d’utilisation. Aucune donnée bancaire n’est stockée :
        les paiements sont traités par le prestataire Mobile Money.
      </p>
    </Section>
    <Section titre="Finalité et partage">
      <p>
        La position n’est jamais affichée en clair à un autre utilisateur sans votre accord : elle
        sert au calcul des distances, à la logistique et aux recommandations agronomiques. Les
        données ne sont pas vendues à des tiers.
      </p>
    </Section>
    <Section titre="Durée de conservation et droits">
      <p>
        Conformément à la réglementation camerounaise sur la protection des données à caractère
        personnel, vous pouvez demander la consultation, la rectification ou l’anonymisation de
        votre compte depuis votre profil ou auprès du support.
      </p>
    </Section>
    <Section titre="Sécurité">
      <p>
        Mots de passe chiffrés (argon2id), sessions courtes avec jeton de rafraîchissement,
        journalisation des actions sensibles et vérification des permissions à chaque appel
        d’interface.
      </p>
    </Section>
  </article>
);
