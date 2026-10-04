/**
 * Textes et messages communs en français pour l'application AgriSens.
 * Centralisés pour garantir l'uniformité et préparer l'internationalisation future.
 */

export const MESSAGES = {
  // Erreurs réseau et système
  erreurReseau: 'Impossible de contacter le serveur. Veuillez vérifier votre connexion Internet.',
  connexionFaible: 'Votre connexion Internet est instable. Vos données sont conservées.',
  horsLigne: 'Vous êtes actuellement hors ligne. Certaines fonctionnalités sont limitées.',
  erreurInconnue: 'Une erreur inattendue est survenue. Veuillez réessayer.',
  erreurServeur: 'Le service est temporairement indisponible. Nos équipes sont informées.',

  // Actions génériques
  reessayer: 'Réessayer',
  annuler: 'Annuler',
  confirmer: 'Confirmer',
  enregistrer: 'Enregistrer',
  supprimer: 'Supprimer',
  fermer: 'Fermer',
  continuer: 'Continuer',
  retourAccueil: "Retour à l'accueil",
  connexion: 'Connexion',
  deconnexion: 'Déconnexion',
  inscription: 'Créer un compte',
  voirCatalogue: 'Voir le catalogue',

  // États de page
  chargement: 'Chargement en cours…',
  chargementDonnees: 'Récupération des données…',
  aucunResultat: 'Aucun résultat trouvé.',
  listePlate: 'Aucun élément à afficher pour le moment.',
  accesInterditTitre: 'Accès non autorisé',
  accesInterditDescription: "Vous n'avez pas les droits nécessaires pour accéder à cette page.",
  pageIntrouvableTitre: 'Page introuvable',
  pageIntrouvableDescription: "La page que vous recherchez n'existe pas ou a été déplacée.",

  // Validation formulaire
  champRequis: 'Ce champ est obligatoire.',
  telephoneInvalide: 'Numéro de téléphone camerounais invalide (ex: +2376XXXXXXXX).',
  emailInvalide: 'Adresse email invalide.',
  motDePasseTropCourt: 'Le mot de passe doit comporter au moins 8 caractères.',
  motsDePasseDifferents: 'Les mots de passe ne correspondent pas.',

  // PWA
  nouvelleVersion: "Une nouvelle version d'AgriSens est disponible.",
  mettreAJour: 'Mettre à jour',
} as const;

/**
 * Textes du chat temps réel (F-13). Centralisés comme le reste pour préparer
 * l'internationalisation ; les erreurs métier propres au chat sont traduites
 * par `messageErreurConversations` côté service.
 */
export const TEXTES_CHAT = {
  titreMessages: 'Messages',
  sousTitreMessages: 'Échangez avec vos acheteurs, agriculteurs et ingénieurs.',
  aucuneConversation: 'Aucune conversation',
  aucuneConversationMessage: 'Ouvrez une commande ou un accompagnement pour écrire.',
  ecrireMessage: 'Écrire un message…',
  envoyer: 'Envoyer',
  joindre: 'Joindre un fichier',
  enAttente: 'En attente d’envoi',
  envoye: 'Envoyé',
  recu: 'Reçu',
  lu: 'Lu',
  connecte: 'En ligne',
  reconnexion: 'Reconnexion…',
  horsLigne: 'Hors ligne — vos messages sont en file',
  bloquer: 'Bloquer',
  debloquer: 'Débloquer',
  signaler: 'Signaler',
  retourListe: 'Retour aux conversations',
  chargerPlus: 'Charger les messages plus anciens',
  pieceJointe: 'Pièce jointe',
  motifSignalement: 'Contenu abusif ou inapproprié',
  descriptionSignalement: 'Message signalé depuis une conversation pour contenu inapproprié.',
} as const;
