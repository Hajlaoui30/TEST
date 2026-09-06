/**
 * Server functions FluxProd (exécutées uniquement côté serveur via
 * createServerFn). Toute la logique métier passe par ici : les règles
 * (somme 100 %, types d'affectation, unicité…) bloquent même si on
 * contourne le front.
 */
import { createServerFn } from "@tanstack/react-start";

import {
  RegleMetierError,
  createAffectation,
  createEmplacement,
  createMp,
  createNomenclature,
  createPf,
  deleteAffectation,
  deleteEmplacement,
  deleteMp,
  deleteNomenclature,
  deletePf,
  detailNomenclature,
  getEmplacement,
  getMp,
  getPf,
  getStats,
  listAffectations,
  listEmplacements,
  listMp,
  listNomenclatures,
  listPf,
  updateEmplacement,
  updateMp,
  updatePf,
} from "./sqlite";

export interface Resultat<T = null> {
  ok: boolean;
  message?: string;
  data?: T;
}

function emballer<T>(fn: () => T): Resultat<T> {
  try {
    return { ok: true, data: fn() };
  } catch (e) {
    if (e instanceof RegleMetierError) return { ok: false, message: e.message };
    throw e;
  }
}

// --- Lecture -------------------------------------------------------------

export const chargerStats = createServerFn().handler(async () => getStats());
export const chargerMp = createServerFn().handler(async () => listMp());
export const chargerPf = createServerFn().handler(async () => listPf());
export const chargerEmplacements = createServerFn().handler(async () => listEmplacements());
export const chargerNomenclatures = createServerFn().handler(async () => listNomenclatures());
export const chargerAffectations = createServerFn().handler(async () => listAffectations());
export const chargerMpParId = createServerFn()
  .validator((id: number) => Number(id))
  .handler(async ({ data }) => getMp(data) ?? null);
export const chargerPfParId = createServerFn()
  .validator((id: number) => Number(id))
  .handler(async ({ data }) => getPf(data) ?? null);
export const chargerEmplacementParId = createServerFn()
  .validator((id: number) => Number(id))
  .handler(async ({ data }) => getEmplacement(data) ?? null);
export const chargerNomenclature = createServerFn()
  .validator((id: number) => Number(id))
  .handler(async ({ data }) => detailNomenclature(data) ?? null);

// --- Matières premières --------------------------------------------------

const donneesMp = (d: {
  code: string;
  nom: string;
  tolerance: unknown;
  barcodeAuto: boolean;
  ajoutManuel: boolean;
}) => ({
  code: String(d.code ?? ""),
  nom: String(d.nom ?? ""),
  tolerance_pct: Number(d.tolerance ?? 0),
  barcode_auto: Boolean(d.barcodeAuto),
  ajout_manuel: Boolean(d.ajoutManuel),
});

export const creerMp = createServerFn()
  .validator((d: Parameters<typeof donneesMp>[0]) => d)
  .handler(async ({ data }) => emballer(() => createMp(donneesMp(data))));

export const modifierMp = createServerFn()
  .validator((d: { id: number } & Parameters<typeof donneesMp>[0]) => d)
  .handler(async ({ data }) => emballer(() => updateMp(Number(data.id), donneesMp(data))));

export const supprimerMp = createServerFn()
  .validator((id: number) => Number(id))
  .handler(async ({ data }) => emballer(() => deleteMp(data)));

// --- Emplacements --------------------------------------------------------

const donneesEmp = (d: {
  numero: string;
  nom: string;
  type: string;
  capacite: unknown;
  unite: string;
}) => ({
  numero: String(d.numero ?? ""),
  nom: String(d.nom ?? ""),
  type: String(d.type ?? ""),
  capacite: Number(d.capacite ?? 0),
  unite: String(d.unite ?? "m³"),
});

export const creerEmplacement = createServerFn()
  .validator((d: Parameters<typeof donneesEmp>[0]) => d)
  .handler(async ({ data }) => emballer(() => createEmplacement(donneesEmp(data))));

export const modifierEmplacement = createServerFn()
  .validator((d: { id: number } & Parameters<typeof donneesEmp>[0]) => d)
  .handler(async ({ data }) => emballer(() => updateEmplacement(Number(data.id), donneesEmp(data))));

export const supprimerEmplacement = createServerFn()
  .validator((id: number) => Number(id))
  .handler(async ({ data }) => emballer(() => deleteEmplacement(data)));

// --- Produits finis ------------------------------------------------------

const donneesPf = (d: {
  code: string;
  nom: string;
  type: string;
  sousType: string | null;
  vitesse1: unknown;
  vitesse2: unknown;
  densite: unknown;
  tempsCycle: unknown;
  recyclage: boolean;
}) => ({
  code: String(d.code ?? ""),
  nom: String(d.nom ?? ""),
  type: String(d.type ?? ""),
  sous_type: d.sousType ? String(d.sousType) : null,
  vitesse1: d.vitesse1,
  vitesse2: d.vitesse2,
  densite: d.densite,
  tempsCycle: d.tempsCycle,
  recyclage: Boolean(d.recyclage),
});

export const creerPf = createServerFn()
  .validator((d: Parameters<typeof donneesPf>[0]) => d)
  .handler(async ({ data }) => emballer(() => createPf(donneesPf(data))));

export const modifierPf = createServerFn()
  .validator((d: { id: number } & Parameters<typeof donneesPf>[0]) => d)
  .handler(async ({ data }) => emballer(() => updatePf(Number(data.id), donneesPf(data))));

export const supprimerPf = createServerFn()
  .validator((id: number) => Number(id))
  .handler(async ({ data }) => emballer(() => deletePf(data)));

// --- Nomenclatures -------------------------------------------------------

export const enregistrerNomenclature = createServerFn()
  .validator((d: { pfId: number | null; lignes: Array<{ mpId: number; pct: number }> }) => d)
  .handler(async ({ data }) =>
    emballer(() =>
      createNomenclature(Number(data.pfId), data.lignes),
    ),
  );

export const supprimerNomenclature = createServerFn()
  .validator((id: number) => Number(id))
  .handler(async ({ data }) => emballer(() => deleteNomenclature(data)));

// --- Affectations --------------------------------------------------------

export const creerAffectation = createServerFn()
  .validator((d: { articleType: "MP" | "PF"; articleId: number; emplacementId: number }) => d)
  .handler(async ({ data }) =>
    emballer(() =>
      createAffectation({
        articleType: data.articleType,
        articleId: Number(data.articleId),
        emplacementId: Number(data.emplacementId),
      }),
    ),
  );

export const supprimerAffectation = createServerFn()
  .validator((id: number) => Number(id))
  .handler(async ({ data }) => emballer(() => deleteAffectation(data)));
