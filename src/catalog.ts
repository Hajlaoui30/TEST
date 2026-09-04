/**
 * Constantes métier partagées (client + serveur) : types d'emplacements,
 * types de produits finis et sous-options de traitement.
 */

export const TYPES_EMPLACEMENT = [
  { code: "RECEPTION", label: "Zone de Réception" },
  { code: "STOCKAGE_MP", label: "Stockage MP" },
  { code: "DOSAGE_PREPARATION", label: "Dosage/Préparation MP" },
  { code: "SOUS_ENSEMBLE", label: "Sous-ensemble/Prémix" },
  { code: "AJOUT_MANUEL", label: "Zone d'Ajout Manuel" },
  { code: "TRAITEMENT_FINITION", label: "Traitement/Finition" },
  { code: "STOCKAGE_PF", label: "Stockage PF" },
] as const;

export type TypeEmplacement = (typeof TYPES_EMPLACEMENT)[number]["code"];

export const LABELS_EMPLACEMENT: Record<string, string> = Object.fromEntries(
  TYPES_EMPLACEMENT.map((t) => [t.code, t.label]),
);

/** Types d'emplacements autorisés pour une matière première. */
export const TYPES_AUTORISES_MP: string[] = [
  "STOCKAGE_MP",
  "DOSAGE_PREPARATION",
  "SOUS_ENSEMBLE",
];

/** Types d'emplacements autorisés pour un produit fini. */
export const TYPES_AUTORISES_PF: string[] = ["STOCKAGE_PF", "TRAITEMENT_FINITION"];

export const TYPES_PF = [
  { code: "STANDARD", label: "Standard" },
  { code: "MATIERE_PREMIERE", label: "Matière Première" },
  { code: "TRAITE", label: "Traité/Finition" },
] as const;

export const LABELS_PF: Record<string, string> = Object.fromEntries(
  TYPES_PF.map((t) => [t.code, t.label]),
);

export const SOUS_TYPES_TRAITE = [
  { code: "ENROBE", label: "Enrobé" },
  { code: "PEINT", label: "Peint" },
  { code: "CUIT", label: "Cuit" },
  { code: "AUTRE", label: "Autre" },
] as const;

export const LABELS_SOUS_TYPE: Record<string, string> = Object.fromEntries(
  SOUS_TYPES_TRAITE.map((t) => [t.code, t.label]),
);

/** Couleurs de badges par type d'emplacement (Tailwind). */
export const BADGE_EMP: Record<string, string> = {
  RECEPTION: "bg-amber-100 text-amber-800",
  STOCKAGE_MP: "bg-sky-100 text-sky-800",
  DOSAGE_PREPARATION: "bg-violet-100 text-violet-800",
  SOUS_ENSEMBLE: "bg-teal-100 text-teal-800",
  AJOUT_MANUEL: "bg-orange-100 text-orange-800",
  TRAITEMENT_FINITION: "bg-rose-100 text-rose-800",
  STOCKAGE_PF: "bg-emerald-100 text-emerald-800",
};

/** Formate un nombre à la française (virgule décimale, max 2 décimales). */
export function fmtFr(n: number, suffix = ""): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + suffix;
}

/** Analyse une saisie numérique française (« 33,5 » → 33.5). null si invalide/vide. */
export function parseNombreFr(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(/\s/g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
