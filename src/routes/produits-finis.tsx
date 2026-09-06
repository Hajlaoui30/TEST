import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { chargerPf, creerPf, modifierPf, supprimerPf } from "~/serveur";
import type { PfRow } from "~/sqlite";
import { TYPES_PF, SOUS_TYPES_TRAITE, BADGE_EMP } from "~/catalog";
import { LIBELLES_PF, LIBELLES_SOUS_TYPE } from "~/labels";
import {
  Alerte,
  Badge,
  Bouton,
  CaseACocher,
  Champ,
  Carte,
  EntetePage,
  Td,
  Th,
  Vide,
  inputCls,
} from "~/composants/ui";
import { fmtFr, parseNombreFr } from "~/catalog";

export const Route = createFileRoute("/produits-finis")({
  component: PageProduitsFinis,
});

interface FormPf {
  code: string;
  nom: string;
  type: string;
  sousType: string;
  vitesse1: string;
  vitesse2: string;
  densite: string;
  tempsCycle: string;
  recyclage: boolean;
}

const formulaireVide: FormPf = {
  code: "",
  nom: "",
  type: "",
  sousType: "",
  vitesse1: "",
  vitesse2: "",
  densite: "",
  tempsCycle: "",
  recyclage: false,
};

function PageProduitsFinis() {
  const [lignes, setLignes] = useState<PfRow[] | null>(null);
  const [form, setForm] = useState<FormPf>(formulaireVide);
  const [idEnCours, setIdEnCours] = useState<number | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<{ type: "erreur" | "succes"; texte: string } | null>(null);

  const recharger = useCallback(() => {
    chargerPf().then(setLignes).catch(() => setMessage({ type: "erreur", texte: "Erreur de chargement." }));
  }, []);
  useEffect(recharger, [recharger]);

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setEnCours(true);
    setMessage(null);
    const payload = {
      code: form.code,
      nom: form.nom,
      type: form.type,
      sousType: form.type === "TRAITE" ? form.sousType || null : null,
      vitesse1: parseNombreFr(form.vitesse1),
      vitesse2: parseNombreFr(form.vitesse2),
      densite: parseNombreFr(form.densite),
      tempsCycle: parseNombreFr(form.tempsCycle),
      recyclage: form.recyclage,
    };
    const res = idEnCours
      ? await modifierPf({ data: { id: idEnCours, ...payload } })
      : await creerPf({ data: payload });
    setEnCours(false);
    if (res.ok) {
      setMessage({
        type: "succes",
        texte: idEnCours
          ? `Produit fini « ${form.code.toUpperCase()} » modifié.`
          : `Produit fini « ${form.code.toUpperCase()} » créé.`,
      });
      setForm(formulaireVide);
      setIdEnCours(null);
      recharger();
    } else {
      setMessage({ type: "erreur", texte: res.message ?? "Erreur inconnue." });
    }
  }

  async function supprimer(l: PfRow) {
    setMessage(null);
    if (!window.confirm(`Supprimer le produit fini « ${l.code} — ${l.nom} » ?`)) return;
    const res = await supprimerPf({ data: l.id });
    if (res.ok) {
      setMessage({ type: "succes", texte: `Produit fini « ${l.code} » supprimé.` });
      if (idEnCours === l.id) {
        setForm(formulaireVide);
        setIdEnCours(null);
      }
      recharger();
    } else {
      setMessage({ type: "erreur", texte: res.message ?? "Erreur inconnue." });
    }
  }

  function modifier(l: PfRow) {
    setMessage(null);
    setIdEnCours(l.id);
    setForm({
      code: l.code,
      nom: l.nom,
      type: l.type,
      sousType: l.sous_type ?? "",
      vitesse1: l.vitesse1_kg_h === null ? "" : String(l.vitesse1_kg_h),
      vitesse2: l.vitesse2_kg_h === null ? "" : String(l.vitesse2_kg_h),
      densite: l.densite === null ? "" : String(l.densite),
      tempsCycle: l.temps_cycle_min === null ? "" : String(l.temps_cycle_min),
      recyclage: !!l.recyclage,
    });
  }

  return (
    <div>
      <EntetePage
        titre="Produits finis"
        sousTitre="Catalogue des PF : type, paramètres de production, recyclage"
      />
      {message ? (
        <Alerte type={message.type} onFermer={() => setMessage(null)}>
          {message.texte}
        </Alerte>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        <Carte className="h-fit p-5">
          <h2 className="mb-4 text-base font-semibold text-slate-800">
            {idEnCours ? "Modifier le produit fini" : "Nouveau produit fini"}
          </h2>
          <form onSubmit={soumettre} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Champ label="Code *">
                <input
                  className={inputCls}
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="ex. PF-001"
                  required
                />
              </Champ>
              <Champ label="Type *">
                <select
                  className={inputCls}
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value, sousType: "" })}
                  required
                >
                  <option value="">— Sélectionner —</option>
                  {TYPES_PF.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Champ>
            </div>
            <Champ label="Nom *">
              <input
                className={inputCls}
                value={form.nom}
                onChange={(e) => setForm({ ...form, nom: e.target.value })}
                placeholder="ex. Croquettes Premium 20 kg"
                required
              />
            </Champ>
            {form.type === "TRAITE" ? (
              <Champ label="Sous-option (traitement) *" aide="Obligatoire pour un produit Traité">
                <select
                  className={inputCls}
                  value={form.sousType}
                  onChange={(e) => setForm({ ...form, sousType: e.target.value })}
                  required
                >
                  <option value="">— Sélectionner —</option>
                  {SOUS_TYPES_TRAITE.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Champ>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <Champ label="Vitesse processus 1" aide="mélange/assemblage (kg/h)">
                <input
                  className={inputCls}
                  type="text"
                  inputMode="decimal"
                  value={form.vitesse1}
                  onChange={(e) => setForm({ ...form, vitesse1: e.target.value })}
                  placeholder="ex. 500"
                />
              </Champ>
              <Champ label="Vitesse processus 2" aide="machine/broyeur (kg/h)">
                <input
                  className={inputCls}
                  type="text"
                  inputMode="decimal"
                  value={form.vitesse2}
                  onChange={(e) => setForm({ ...form, vitesse2: e.target.value })}
                  placeholder="ex. 800"
                />
              </Champ>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Champ label="Densité / poids">
                <input
                  className={inputCls}
                  type="text"
                  inputMode="decimal"
                  value={form.densite}
                  onChange={(e) => setForm({ ...form, densite: e.target.value })}
                  placeholder="ex. 0,65"
                />
              </Champ>
              <Champ label="Temps de cycle (min)" aide="mélange">
                <input
                  className={inputCls}
                  type="text"
                  inputMode="decimal"
                  value={form.tempsCycle}
                  onChange={(e) => setForm({ ...form, tempsCycle: e.target.value })}
                  placeholder="ex. 45"
                />
              </Champ>
            </div>
            <CaseACocher
              label="Autoriser recyclage / retravail"
              checked={form.recyclage}
              onChange={(v) => setForm({ ...form, recyclage: v })}
            />
            <div className="flex gap-2 pt-1">
              <Bouton type="submit" disabled={enCours}>
                {enCours ? "Enregistrement…" : idEnCours ? "Enregistrer les modifications" : "Créer le produit fini"}
              </Bouton>
              {idEnCours ? (
                <Bouton
                  type="button"
                  variante="secondaire"
                  onClick={() => {
                    setForm(formulaireVide);
                    setIdEnCours(null);
                  }}
                >
                  Annuler
                </Bouton>
              ) : null}
            </div>
          </form>
        </Carte>

        <Carte>
          <div className="border-b border-slate-200 px-5 py-3.5">
            <h2 className="text-base font-semibold text-slate-800">
              Liste des produits finis{" "}
              {lignes ? <span className="font-normal text-slate-400">({lignes.length})</span> : null}
            </h2>
          </div>
          {lignes === null ? (
            <p className="px-5 py-8 text-sm text-slate-400">Chargement…</p>
          ) : lignes.length === 0 ? (
            <div className="p-5">
              <Vide message="Aucun produit fini pour le moment." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <Th>Code</Th>
                    <Th>Nom</Th>
                    <Th>Type</Th>
                    <Th className="text-right">Vitesses (kg/h)</Th>
                    <Th className="text-right">Densité</Th>
                    <Th className="text-right">Cycle</Th>
                    <Th>Recyclage</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lignes.map((l) => (
                    <tr key={l.id} className={idEnCours === l.id ? "bg-amber-50/60" : "hover:bg-slate-50"}>
                      <Td className="font-medium text-slate-900">{l.code}</Td>
                      <Td>{l.nom}</Td>
                      <Td>
                        <Badge cls={l.type === "TRAITE" ? BADGE_EMP["TRAITEMENT_FINITION"] : ""}>
                          {LIBELLES_PF[l.type] ?? l.type}
                          {l.sous_type ? ` · ${LIBELLES_SOUS_TYPE[l.sous_type] ?? l.sous_type}` : ""}
                        </Badge>
                      </Td>
                      <Td className="text-right tabular-nums">
                        {l.vitesse1_kg_h === null ? "—" : fmtFr(l.vitesse1_kg_h)}
                        {" / "}
                        {l.vitesse2_kg_h === null ? "—" : fmtFr(l.vitesse2_kg_h)}
                      </Td>
                      <Td className="text-right tabular-nums">
                        {l.densite === null ? "—" : fmtFr(l.densite)}
                      </Td>
                      <Td className="text-right tabular-nums">
                        {l.temps_cycle_min === null ? "—" : fmtFr(l.temps_cycle_min, " min")}
                      </Td>
                      <Td>
                        {l.recyclage ? (
                          <Badge cls="bg-emerald-100 text-emerald-800">Oui</Badge>
                        ) : (
                          <Badge cls="bg-slate-100 text-slate-500">Non</Badge>
                        )}
                      </Td>
                      <Td className="text-right">
                        <button
                          type="button"
                          onClick={() => modifier(l)}
                          className="mr-3 text-sm font-medium text-sky-700 hover:underline"
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          onClick={() => supprimer(l)}
                          className="text-sm font-medium text-red-600 hover:underline"
                        >
                          Supprimer
                        </button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-400">
                V1 : vitesse processus 1 (mélange/assemblage) / vitesse processus 2 (machine/broyeur) ·
                cycle en minutes · densité/poids à titre indicatif.
              </p>
            </div>
          )}
        </Carte>
      </div>
    </div>
  );
}
