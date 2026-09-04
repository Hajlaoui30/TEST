/**
 * Couche d'accès données FluxProd — SQLite via `bun:sqlite`.
 *
 * IMPORTANT : ce module est SERVEUR-ONLY. Il ne doit être importé que depuis
 * des `createServerFn().handler(...)` ou des routes `src/routes/api/*`.
 * Ne jamais l'importer dans un composant client.
 *
 * La base vit dans data/fluxprod.db (ignoré par git). Les tables sont créées
 * au premier appel serveur (CREATE TABLE IF NOT EXISTS). `src/db.ts` (Neon)
 * reste inchangé pour une future migration Postgres.
 */
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { LABELS_EMP } from "./labels";

export const TYPE_RECEPTION = "RECEPTION";
export const TYPE_STOCKAGE_MP = "STOCKAGE_MP";
export const TYPE_DOSAGE_PREPARATION = "DOSAGE_PREPARATION";
export const TYPE_SOUS_ENSEMBLE = "SOUS_ENSEMBLE";
export const TYPE_AJOUT_MANUEL = "AJOUT_MANUEL";
export const TYPE_TRAITEMENT_FINITION = "TRAITEMENT_FINITION";
export const TYPE_STOCKAGE_PF = "STOCKAGE_PF";

export const TYPES_AUTORISES_MP = [
  TYPE_STOCKAGE_MP,
  TYPE_DOSAGE_PREPARATION,
  TYPE_SOUS_ENSEMBLE,
];
export const TYPES_AUTORISES_PF = [TYPE_STOCKAGE_PF, TYPE_TRAITEMENT_FINITION];

const LABELS_EMP: Record<string, string> = {
  RECEPTION: "Zone de Réception",
  STOCKAGE_MP: "Stockage MP",
  DOSAGE_PREPARATION: "Dosage/Préparation MP",
  SOUS_ENSEMBLE: "Sous-ensemble/Prémix",
  AJOUT_MANUEL: "Zone d'Ajout Manuel",
  TRAITEMENT_FINITION: "Traitement/Finition",
  STOCKAGE_PF: "Stockage PF",
};

let db: Database | null = null;

function getDb(): Database {
  if (!db) {
    // process.cwd() = racine du site au démarrage du serveur (serve.ts) ;
    // le fichier survit ainsi aux rebuilds (dist/ est effacé à chaque publish).
    const dataDir = join(process.cwd(), "data");
    mkdirSync(dataDir, { recursive: true });
    db = new Database(join(dataDir, "fluxprod.db"));
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA foreign_keys = ON;");
    init();
  }
  return db;
}

function init() {
  db!.exec(`
    CREATE TABLE IF NOT EXISTS matieres_premieres (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      code          TEXT NOT NULL UNIQUE COLLATE NOCASE,
      nom           TEXT NOT NULL,
      tolerance_pct REAL NOT NULL DEFAULT 0,
      code_barres   TEXT,
      barcode_auto  INTEGER NOT NULL DEFAULT 0,
      ajout_manuel  INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS emplacements (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      numero     TEXT NOT NULL UNIQUE COLLATE NOCASE,
      nom        TEXT NOT NULL,
      type       TEXT NOT NULL,
      capacite   REAL NOT NULL DEFAULT 0,
      unite      TEXT NOT NULL DEFAULT 'm³',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS produits_finis (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      code           TEXT NOT NULL UNIQUE COLLATE NOCASE,
      nom            TEXT NOT NULL,
      type           TEXT NOT NULL,
      sous_type      TEXT,
      vitesse1_kg_h  REAL,
      vitesse2_kg_h  REAL,
      densite        REAL,
      temps_cycle_min REAL,
      recyclage      INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS nomenclatures (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      pf_id         INTEGER NOT NULL UNIQUE REFERENCES produits_finis(id) ON DELETE CASCADE,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS nomenclature_lignes (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      nomenclature_id  INTEGER NOT NULL REFERENCES nomenclatures(id) ON DELETE CASCADE,
      mp_id            INTEGER NOT NULL REFERENCES matieres_premieres(id),
      pourcentage      REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS affectations (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      article_type    TEXT NOT NULL CHECK (article_type IN ('MP','PF')),
      article_id      INTEGER NOT NULL,
      emplacement_id  INTEGER NOT NULL REFERENCES emplacements(id) ON DELETE CASCADE,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (article_type, article_id, emplacement_id)
    );
  `);
}

/** Singleton de base, à appeler au début de chaque handler serveur. */
export function getDbSingleton(): Database {
  return getDb();
}

function codeBarresDepuisCode(code: string): string {
  const racine = code.toUpperCase().replace(/[^A-Z0-9]/g, "").padEnd(7, "X").slice(0, 7);
  const alphabet = "0123456789BCDFGHJKLMNPQRSTVWXZ";
  let h = 7;
  for (const ch of racine) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const car = alphabet[h % 27];
  const chiffres = String((h >>> 5) % 100000).padStart(5, "0");
  const corps = (racine + car + chiffres).padStart(12, "0").slice(0, 12);
  const sommes = [1, 3];
  let total = 0;
  for (let i = 0; i < 12; i++) total += Number(corps[i]) * sommes[i % 2];
  const cle = (10 - (total % 10)) % 10;
  return corps + String(cle);
}

export class RegleMetierError extends Error {}

function fail(message: string): never {
  throw new RegleMetierError(message);
}

// ---------------------------------------------------------------------------
// Matières premières
// ---------------------------------------------------------------------------

export interface MpRow {
  id: number;
  code: string;
  nom: string;
  tolerance_pct: number;
  code_barres: string | null;
  barcode_auto: number;
  ajout_manuel: number;
}

export function listMp(): MpRow[] {
  return getDb().prepare("SELECT * FROM matieres_premieres ORDER BY code").all() as MpRow[];
}

export function getMp(id: number): MpRow | undefined {
  return getDb().prepare("SELECT * FROM matieres_premieres WHERE id = ?").get(id) as
    | MpRow
    | undefined;
}

export function createMp(data: {
  code: string;
  nom: string;
  tolerance_pct: number;
  barcode_auto: boolean;
  ajout_manuel: boolean;
}): MpRow {
  const code = data.code.trim();
  if (!code) fail("Le code article est obligatoire.");
  if (!data.nom || !data.nom.trim()) fail("Le nom est obligatoire.");
  if (!Number.isFinite(data.tolerance_pct) || data.tolerance_pct < 0 || data.tolerance_pct > 100)
    fail("La tolérance doit être un nombre entre 0 et 100.");
  const db = getDb();
  const existe = db.prepare("SELECT id FROM matieres_premieres WHERE code = ? COLLATE NOCASE").get(code);
  if (existe) fail(`Le code article « ${code} » existe déjà.`);
  const cb = data.barcode_auto ? codeBarresDepuisCode(code) : null;
  const res = db
    .prepare(
      `INSERT INTO matieres_premieres (code, nom, tolerance_pct, code_barres, barcode_auto, ajout_manuel)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(code, data.nom.trim(), data.tolerance_pct, cb, data.barcode_auto ? 1 : 0, data.ajout_manuel ? 1 : 0);
  return getMp(Number(res.lastInsertRowid))!;
}

export function updateMp(
  id: number,
  data: {
    code: string;
    nom: string;
    tolerance_pct: number;
    barcode_auto: boolean;
    ajout_manuel: boolean;
  },
): MpRow {
  const existante = getMp(id);
  if (!existante) fail("Matière première introuvable.");
  const code = data.code.trim();
  if (!code) fail("Le code article est obligatoire.");
  if (!data.nom || !data.nom.trim()) fail("Le nom est obligatoire.");
  if (!Number.isFinite(data.tolerance_pct) || data.tolerance_pct < 0 || data.tolerance_pct > 100)
    fail("La tolérance doit être un nombre entre 0 et 100.");
  const db = getDb();
  const doublon = db
    .prepare("SELECT id FROM matieres_premieres WHERE code = ? COLLATE NOCASE AND id != ?")
    .get(code, id);
  if (doublon) fail(`Le code article « ${code} » existe déjà.`);
  const cb = data.barcode_auto ? codeBarresDepuisCode(code) : null;
  db.prepare(
    `UPDATE matieres_premieres
     SET code = ?, nom = ?, tolerance_pct = ?, code_barres = ?, barcode_auto = ?, ajout_manuel = ?,
         updated_at = datetime('now')
     WHERE id = ?`,
  ).run(code, data.nom.trim(), data.tolerance_pct, cb, data.barcode_auto ? 1 : 0, data.ajout_manuel ? 1 : 0, id);
  return getMp(id)!;
}

export function deleteMp(id: number): void {
  const db = getDb();
  const mp = getMp(id);
  if (!mp) fail("Matière première introuvable.");
  const n = db
    .prepare("SELECT COUNT(*) AS n FROM nomenclature_lignes WHERE mp_id = ?")
    .get(id) as { n: number };
  if (n.n > 0)
    fail(
      `Impossible de supprimer « ${mp.code} » : elle est utilisée dans ${n.n} ligne(s) de nomenclature.`,
    );
  const a = db
    .prepare("SELECT COUNT(*) AS n FROM affectations WHERE article_type = 'MP' AND article_id = ?")
    .get(id) as { n: number };
  if (a.n > 0)
    fail(
      `Impossible de supprimer « ${mp.code} » : ${a.n} affectation(s) y sont encore rattachées — supprimez-les d'abord.`,
    );
  db.prepare("DELETE FROM matieres_premieres WHERE id = ?").run(id);
}

// ---------------------------------------------------------------------------
// Emplacements
// ---------------------------------------------------------------------------

export interface EmplacementRow {
  id: number;
  numero: string;
  nom: string;
  type: string;
  capacite: number;
  unite: string;
}

export function listEmplacements(): EmplacementRow[] {
  return getDb().prepare("SELECT * FROM emplacements ORDER BY numero").all() as EmplacementRow[];
}

export function getEmplacement(id: number): EmplacementRow | undefined {
  return getDb().prepare("SELECT * FROM emplacements WHERE id = ?").get(id) as
    | EmplacementRow
    | undefined;
}

export function createEmplacement(data: {
  numero: string;
  nom: string;
  type: string;
  capacite: number;
  unite: string;
}): EmplacementRow {
  const numero = data.numero.trim();
  if (!numero) fail("Le numéro d'emplacement est obligatoire.");
  if (!data.nom || !data.nom.trim()) fail("Le nom est obligatoire.");
  if (!data.type) fail("Le type d'emplacement est obligatoire.");
  if (!Number.isFinite(data.capacite) || data.capacite < 0)
    fail("La capacité/volume doit être un nombre positif.");
  const db = getDb();
  const existe = db.prepare("SELECT id FROM emplacements WHERE numero = ? COLLATE NOCASE").get(numero);
  if (existe) fail(`Le numéro d'emplacement « ${numero} » existe déjà.`);
  const res = db
    .prepare(
      `INSERT INTO emplacements (numero, nom, type, capacite, unite) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(numero, data.nom.trim(), data.type, data.capacite, data.unite || "m³");
  return getEmplacement(Number(res.lastInsertRowid))!;
}

export function updateEmplacement(
  id: number,
  data: { numero: string; nom: string; type: string; capacite: number; unite: string },
): EmplacementRow {
  const existant = getEmplacement(id);
  if (!existant) fail("Emplacement introuvable.");
  const numero = data.numero.trim();
  if (!numero) fail("Le numéro d'emplacement est obligatoire.");
  if (!data.nom || !data.nom.trim()) fail("Le nom est obligatoire.");
  if (!data.type) fail("Le type d'emplacement est obligatoire.");
  if (!Number.isFinite(data.capacite) || data.capacite < 0)
    fail("La capacité/volume doit être un nombre positif.");
  const db = getDb();
  const doublon = db
    .prepare("SELECT id FROM emplacements WHERE numero = ? COLLATE NOCASE AND id != ?")
    .get(numero, id);
  if (doublon) fail(`Le numéro d'emplacement « ${numero} » existe déjà.`);
  db.prepare(
    `UPDATE emplacements SET numero = ?, nom = ?, type = ?, capacite = ?, unite = ?, updated_at = datetime('now') WHERE id = ?`,
  ).run(numero, data.nom.trim(), data.type, data.capacite, data.unite || "m³", id);
  return getEmplacement(id)!;
}

export function deleteEmplacement(id: number): void {
  const db = getDb();
  const emp = getEmplacement(id);
  if (!emp) fail("Emplacement introuvable.");
  const a = db
    .prepare("SELECT COUNT(*) AS n FROM affectations WHERE emplacement_id = ?")
    .get(id) as { n: number };
  if (a.n > 0)
    fail(
      `Impossible de supprimer « ${emp.numero} » : ${a.n} affectation(s) y sont encore rattachées — supprimez-les d'abord.`,
    );
  db.prepare("DELETE FROM emplacements WHERE id = ?").run(id);
}

// ---------------------------------------------------------------------------
// Produits finis
// ---------------------------------------------------------------------------

export interface PfRow {
  id: number;
  code: string;
  nom: string;
  type: string;
  sous_type: string | null;
  vitesse1_kg_h: number | null;
  vitesse2_kg_h: number | null;
  densite: number | null;
  temps_cycle_min: number | null;
  recyclage: number;
}

export function listPf(): PfRow[] {
  return getDb().prepare("SELECT * FROM produits_finis ORDER BY code").all() as PfRow[];
}

export function getPf(id: number): PfRow | undefined {
  return getDb().prepare("SELECT * FROM produits_finis WHERE id = ?").get(id) as
    | PfRow
    | undefined;
}

const TYPES_PF_VALIDES = ["STANDARD", "MATIERE_PREMIERE", "TRAITE"];
const SOUS_TYPES_VALIDES = ["ENROBE", "PEINT", "CUIT", "AUTRE"];

function validerPfCommun(data: {
  code: string;
  nom: string;
  type: string;
  sous_type: string | null;
}): void {
  if (!data.code || !data.code.trim()) fail("Le code est obligatoire.");
  if (!data.nom || !data.nom.trim()) fail("Le nom est obligatoire.");
  if (!TYPES_PF_VALIDES.includes(data.type)) fail("Le type de produit fini est invalide.");
  if (data.type === "TRAITE") {
    if (!data.sous_type || !SOUS_TYPES_VALIDES.includes(data.sous_type))
      fail("Pour un produit « Traité », la sous-option est obligatoire (Enrobé, Peint, Cuit…).");
  }
}

function numOpt(v: unknown, champ: string): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) fail(`Le champ « ${champ} » doit être un nombre positif.`);
  return n;
}

export function createPf(data: {
  code: string;
  nom: string;
  type: string;
  sous_type: string | null;
  vitesse1: unknown;
  vitesse2: unknown;
  densite: unknown;
  tempsCycle: unknown;
  recyclage: boolean;
}): PfRow {
  validerPfCommun(data);
  const db = getDb();
  const existe = db.prepare("SELECT id FROM produits_finis WHERE code = ? COLLATE NOCASE").get(data.code.trim());
  if (existe) fail(`Le code « ${data.code.trim()} » existe déjà.`);
  const res = db
    .prepare(
      `INSERT INTO produits_finis
         (code, nom, type, sous_type, vitesse1_kg_h, vitesse2_kg_h, densite, temps_cycle_min, recyclage)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      data.code.trim(),
      data.nom.trim(),
      data.type,
      data.type === "TRAITE" ? data.sous_type : null,
      numOpt(data.vitesse1, "vitesse processus 1"),
      numOpt(data.vitesse2, "vitesse processus 2"),
      numOpt(data.densite, "densité/poids"),
      numOpt(data.tempsCycle, "temps de cycle"),
      data.recyclage ? 1 : 0,
    );
  return getPf(Number(res.lastInsertRowid))!;
}

export function updatePf(
  id: number,
  data: {
    code: string;
    nom: string;
    type: string;
    sous_type: string | null;
    vitesse1: unknown;
    vitesse2: unknown;
    densite: unknown;
    tempsCycle: unknown;
    recyclage: boolean;
  },
): PfRow {
  const existant = getPf(id);
  if (!existant) fail("Produit fini introuvable.");
  validerPfCommun(data);
  const db = getDb();
  const doublon = db
    .prepare("SELECT id FROM produits_finis WHERE code = ? COLLATE NOCASE AND id != ?")
    .get(data.code.trim(), id);
  if (doublon) fail(`Le code « ${data.code.trim()} » existe déjà.`);
  db.prepare(
    `UPDATE produits_finis
     SET code = ?, nom = ?, type = ?, sous_type = ?, vitesse1_kg_h = ?, vitesse2_kg_h = ?,
         densite = ?, temps_cycle_min = ?, recyclage = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(
    data.code.trim(),
    data.nom.trim(),
    data.type,
    data.type === "TRAITE" ? data.sous_type : null,
    numOpt(data.vitesse1, "vitesse processus 1"),
    numOpt(data.vitesse2, "vitesse processus 2"),
    numOpt(data.densite, "densité/poids"),
    numOpt(data.tempsCycle, "temps de cycle"),
    data.recyclage ? 1 : 0,
    id,
  );
  return getPf(id)!;
}

export function deletePf(id: number): void {
  const db = getDb();
  const pf = getPf(id);
  if (!pf) fail("Produit fini introuvable.");
  const nom = db.prepare("SELECT COUNT(*) AS n FROM nomenclatures WHERE pf_id = ?").get(id) as {
    n: number;
  };
  if (nom.n > 0)
    fail(
      `Impossible de supprimer « ${pf.code} » : une nomenclature lui est rattachée — supprimez d'abord la nomenclature.`,
    );
  const a = db
    .prepare("SELECT COUNT(*) AS n FROM affectations WHERE article_type = 'PF' AND article_id = ?")
    .get(id) as { n: number };
  if (a.n > 0)
    fail(
      `Impossible de supprimer « ${pf.code} » : ${a.n} affectation(s) y sont encore rattachées — supprimez-les d'abord.`,
    );
  db.prepare("DELETE FROM produits_finis WHERE id = ?").run(id);
}

// ---------------------------------------------------------------------------
// Nomenclatures
// ---------------------------------------------------------------------------

export interface LigneNomenclature {
  mp_id: number;
  mp_code: string;
  mp_nom: string;
  ajout_manuel: number;
  pourcentage: number;
}

export interface NomenclatureDetail {
  id: number;
  pf_id: number;
  pf_code: string;
  pf_nom: string;
  lignes: LigneNomenclature[];
  total_pct: number;
  created_at: string;
  updated_at: string;
}

export function listNomenclatures(): NomenclatureDetail[] {
  const db = getDb();
  const tetes = db
    .prepare(
      `SELECT n.id, n.pf_id, n.created_at, n.updated_at, pf.code AS pf_code, pf.nom AS pf_nom
       FROM nomenclatures n JOIN produits_finis pf ON pf.id = n.pf_id
       ORDER BY pf.code`,
    )
    .all() as Array<{
    id: number;
    pf_id: number;
    pf_code: string;
    pf_nom: string;
    created_at: string;
    updated_at: string;
  }>;
  return tetes.map((t) => detailNomenclature(t.id)!);
}

export function getNomenclatureByPf(pfId: number): NomenclatureDetail | undefined {
  const row = getDb().prepare("SELECT id FROM nomenclatures WHERE pf_id = ?").get(pfId) as
    | { id: number }
    | undefined;
  return row ? detailNomenclature(row.id) : undefined;
}

export function detailNomenclature(id: number): NomenclatureDetail | undefined {
  const db = getDb();
  const tete = db
    .prepare(
      `SELECT n.id, n.pf_id, n.created_at, n.updated_at, pf.code AS pf_code, pf.nom AS pf_nom
       FROM nomenclatures n JOIN produits_finis pf ON pf.id = n.pf_id WHERE n.id = ?`,
    )
    .get(id) as
    | (Omit<NomenclatureDetail, "lignes" | "total_pct">)
    | undefined;
  if (!tete) return undefined;
  const lignes = db
    .prepare(
      `SELECT l.mp_id, mp.code AS mp_code, mp.nom AS mp_nom, mp.ajout_manuel, l.pourcentage
       FROM nomenclature_lignes l JOIN matieres_premieres mp ON mp.id = l.mp_id
       WHERE l.nomenclature_id = ? ORDER BY mp.code`,
    )
    .all(id) as LigneNomenclature[];
  const total = lignes.reduce((s, l) => s + l.pourcentage, 0);
  return { ...tete, lignes, total_pct: total };
}

export function createNomenclature(pfId: number, lignes: Array<{ mpId: number; pct: number }>): NomenclatureDetail {
  return upsertNomenclature(null, pfId, lignes);
}

export function updateNomenclature(
  id: number,
  _pfId: number | null,
  lignes: Array<{ mpId: number; pct: number }>,
): NomenclatureDetail {
  const existe = getDb().prepare("SELECT pf_id FROM nomenclatures WHERE id = ?").get(id) as
    | { pf_id: number }
    | undefined;
  if (!existe) fail("Nomenclature introuvable.");
  return upsertNomenclature(existe.pf_id, null, lignes);
}

function upsertNomenclature(
  pfIdFixe: number | null,
  pfIdNouveau: number | null,
  lignes: Array<{ mpId: number; pct: number }>,
): NomenclatureDetail {
  const db = getDb();
  const pfId = pfIdFixe ?? pfIdNouveau;
  if (!pfId) fail("Sélectionnez un article PF.");
  if (!lignes.length) fail("Ajoutez au moins une matière première à la nomenclature.");

  const pf = getPf(pfId);
  if (!pf) fail("Article PF introuvable.");

  // Dédoublonnage des MP (chaque MP au maximum une fois par nomenclature)
  const parMp = new Map<number, number>();
  for (const l of lignes) {
    const mpId = Number(l.mpId);
    const pct = Number(l.pct);
    if (!Number.isFinite(mpId)) fail("Ligne de nomenclature invalide.");
    if (!Number.isFinite(pct) || pct <= 0)
      fail("Chaque pourcentage doit être un nombre strictement positif.");
    if (parMp.has(mpId)) fail("Chaque matière première ne peut apparaître qu'une seule fois.");
    parMp.set(mpId, pct);
  }

  // BLOCAGE MÉTIER : somme exactement 100 %
  const total = [...parMp.values()].reduce((s, p) => s + p, 0);
  const totalArrondi = Math.round(total * 100) / 100;
  if (totalArrondi !== 100) {
    fail(
      `La somme des matières premières est de ${totalArrondi.toLocaleString("fr-FR")} % — elle doit être exactement 100 %.`,
    );
  }

  // Toutes les MP doivent exister
  const mpRows = db.prepare("SELECT id FROM matieres_premieres").all() as Array<{ id: number }>;
  const idsMp = new Set(mpRows.map((r) => r.id));
  for (const mpId of parMp.keys()) {
    if (!idsMp.has(mpId)) fail("Une des matières premières sélectionnées n'existe plus.");
  }

  // Une nomenclature par PF
  const existante = db.prepare("SELECT id FROM nomenclatures WHERE pf_id = ?").get(pfId) as
    | { id: number }
    | undefined;

  db.exec("BEGIN");
  try {
    let nomenId: number;
    if (existante) {
      if (pfIdFixe !== null && pfIdFixe !== existante.id) {
        // mise à jour d'une autre nomenclature que celle du PF : incohérence
        db.exec("ROLLBACK");
        fail("Incohérence : cette nomenclature ne correspond pas à ce PF.");
      }
      nomenId = existante.id;
      db.prepare("DELETE FROM nomenclature_lignes WHERE nomenclature_id = ?").run(nomenId);
      db.prepare("UPDATE nomenclatures SET updated_at = datetime('now') WHERE id = ?").run(nomenId);
    } else {
      const res = db.prepare("INSERT INTO nomenclatures (pf_id) VALUES (?)").run(pfId);
      nomenId = Number(res.lastInsertRowid);
    }
    const ins = db.prepare(
      "INSERT INTO nomenclature_lignes (nomenclature_id, mp_id, pourcentage) VALUES (?, ?, ?)",
    );
    for (const [mpId, pct] of parMp) ins.run(nomenId, mpId, pct);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return detailNomenclature(nomenId)!;
}

export function deleteNomenclature(id: number): void {
  const db = getDb();
  const existe = db.prepare("SELECT id FROM nomenclatures WHERE id = ?").get(id);
  if (!existe) fail("Nomenclature introuvable.");
  db.prepare("DELETE FROM nomenclatures WHERE id = ?").run(id);
}

// ---------------------------------------------------------------------------
// Affectations
// ---------------------------------------------------------------------------

export interface AffectationRow {
  id: number;
  article_type: string;
  article_id: number;
  article_code: string;
  article_nom: string;
  emplacement_id: number;
  emp_numero: string;
  emp_nom: string;
  emp_type: string;
  created_at: string;
}

export function listAffectations(): AffectationRow[] {
  return getDb()
    .prepare(
      `SELECT a.id, a.article_type, a.article_id, a.emplacement_id, a.created_at,
              CASE WHEN a.article_type = 'MP' THEN mp.code ELSE pf.code END AS article_code,
              CASE WHEN a.article_type = 'MP' THEN mp.nom ELSE pf.nom END AS article_nom,
              e.numero AS emp_numero, e.nom AS emp_nom, e.type AS emp_type
       FROM affectations a
       LEFT JOIN matieres_premieres mp ON a.article_type = 'MP' AND mp.id = a.article_id
       LEFT JOIN produits_finis pf ON a.article_type = 'PF' AND pf.id = a.article_id
       JOIN emplacements e ON e.id = a.emplacement_id
       ORDER BY a.article_type, article_code, e.numero`,
    )
    .all() as AffectationRow[];
}

export function createAffectation(data: {
  articleType: "MP" | "PF";
  articleId: number;
  emplacementId: number;
}): AffectationRow {
  const db = getDb();
  if (data.articleType !== "MP" && data.articleType !== "PF")
    fail("Type d'article invalide (MP ou PF attendu).");
  const article =
    data.articleType === "MP" ? getMp(data.articleId) : getPf(data.articleId);
  if (!article) fail("Article introuvable.");
  const emp = getEmplacement(data.emplacementId);
  if (!emp) fail("Emplacement introuvable.");

  // RÈGLE DE FLUX (blocage serveur) — Zone de Réception : jamais affectable.
  if (emp.type === TYPE_RECEPTION)
    fail(
      `La Zone de Réception est un transit dynamique : aucune affectation fixe d'article n'est autorisée sur « ${emp.numero} ».`,
    );
  if (data.articleType === "MP" && !TYPES_AUTORISES_MP.includes(emp.type))
    fail(
      `Affectation refusée : une matière première (MP) ne peut être affectée qu'aux emplacements Stockage MP, Dosage/Préparation MP ou Sous-ensemble/Prémix — pas à « ${emp.numero} » (${LABELS_EMP[emp.type] ?? emp.type}).`,
    );
  if (data.articleType === "PF" && !TYPES_AUTORISES_PF.includes(emp.type))
    fail(
      `Affectation refusée : un produit fini (PF) ne peut être affecté qu'aux emplacements Stockage PF ou Traitement/Finition — pas à « ${emp.numero} » (${LABELS_EMP[emp.type] ?? emp.type}).`,
    );

  const doublon = db
    .prepare(
      "SELECT id FROM affectations WHERE article_type = ? AND article_id = ? AND emplacement_id = ?",
    )
    .get(data.articleType, data.articleId, data.emplacementId);
  if (doublon) fail("Cette affectation existe déjà.");

  const res = db
    .prepare(
      "INSERT INTO affectations (article_type, article_id, emplacement_id) VALUES (?, ?, ?)",
    )
    .run(data.articleType, data.articleId, data.emplacementId);
  return listAffectations().find((a) => a.id === Number(res.lastInsertRowid))!;
}

export function deleteAffectation(id: number): void {
  const db = getDb();
  const existe = db.prepare("SELECT id FROM affectations WHERE id = ?").get(id);
  if (!existe) fail("Affectation introuvable.");
  db.prepare("DELETE FROM affectations WHERE id = ?").run(id);
}

// ---------------------------------------------------------------------------
// Compteurs tableau de bord
// ---------------------------------------------------------------------------

export interface Stats {
  nbMp: number;
  nbPf: number;
  nbEmplacements: number;
  nbNomenclatures: number;
  nbAffectations: number;
}

export function getStats(): Stats {
  const db = getDb();
  const c = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  return {
    nbMp: c("SELECT COUNT(*) AS n FROM matieres_premieres"),
    nbPf: c("SELECT COUNT(*) AS n FROM produits_finis"),
    nbEmplacements: c("SELECT COUNT(*) AS n FROM emplacements"),
    nbNomenclatures: c("SELECT COUNT(*) AS n FROM nomenclatures"),
    nbAffectations: c("SELECT COUNT(*) AS n FROM affectations"),
  };
}
