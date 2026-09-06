/**
 * Libellés français des codes de type — utilisable côté serveur (messages
 * d'erreur métier) et côté client (affichage). Sans dépendance à bun:sqlite
 * pour rester importable partout.
 */

export const LIBELLES_EMPLACEMENT: Record<string, string> = {
  RECEPTION: "Zone de Réception",
  STOCKAGE_MP: "Stockage MP",
  DOSAGE_PREPARATION: "Dosage/Préparation MP",
  SOUS_ENSEMBLE: "Sous-ensemble/Prémix",
  AJOUT_MANUEL: "Zone d'Ajout Manuel",
  TRAITEMENT_FINITION: "Traitement/Finition",
  STOCKAGE_PF: "Stockage PF",
};

export const LIBELLES_PF: Record<string, string> = {
  STANDARD: "Standard",
  MATIERE_PREMIERE: "Matière Première",
  TRAITE: "Traité/Finition",
};

export const LIBELLES_SOUS_TYPE: Record<string, string> = {
  ENROBE: "Enrobé",
  PEINT: "Peint",
  CUIT: "Cuit",
  AUTRE: "Autre",
};
