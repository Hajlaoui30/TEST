import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { chargerEmplacements, creerEmplacement, modifierEmplacement, supprimerEmplacement } from "~/serveur";
import type { EmplacementRow } from "~/sqlite";
import { TYPES_EMPLACEMENT, BADGE_EMP } from "~/catalog";
import { LIBELLES_EMPLACEMENT } from "~/labels";
import {
  Alerte,
  Badge,
  Bouton,
  Champ,
  Carte,
  EntetePage,
  Td,
  Th,
  Vide,
  inputCls,
} from "~/composants/ui";
import { fmtFr, parseNombreFr } from "~/catalog";

export const Route = createFileRoute("/emplacements")({
  component: PageEmplacements,
});

interface FormEmp {
  numero: string;
  nom: string;
  type: string;
  capacite: string;
  unite: string;
}

const formulaireVide: FormEmp = {
  numero: "",
  nom: "",
  type: "",
  capacite: "0",
  unite: "m³",
};

function PageEmplacements() {
  const [lignes, setLignes] = useState<EmplacementRow[] | null>(null);
  const [form, setForm] = useState<FormEmp>(formulaireVide);
  const [idEnCours, setIdEnCours] = useState<number | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<{ type: "erreur" | "succes"; texte: string } | null>(null);

  const recharger = useCallback(() => {
    chargerEmplacements()
      .then(setLignes)
      .catch(() => setMessage({ type: "erreur", texte: "Erreur de chargement." }));
  }, []);
  useEffect(recharger, [recharger]);

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setEnCours(true);
    setMessage(null);
    const payload = { ...form };
    const res = idEnCours
      ? await modifierEmplacement({ data: { id: idEnCours, ...payload } })
      : await creerEmplacement({ data: payload });
    setEnCours(false);
    if (res.ok) {
      setMessage({
        type: "succes",
        texte: idEnCours
          ? `Emplacement « ${form.numero} » modifié.`
          : `Emplacement « ${form.numero} » créé.`,
      });
      setForm(formulaireVide);
      setIdEnCours(null);
      recharger();
    } else {
      setMessage({ type: "erreur", texte: res.message ?? "Erreur inconnue." });
    }
  }

  async function supprimer(l: EmplacementRow) {
    setMessage(null);
    if (!window.confirm(`Supprimer l'emplacement « ${l.numero} — ${l.nom} » ?`)) return;
    const res = await supprimerEmplacement({ data: l.id });
    if (res.ok) {
      setMessage({ type: "succes", texte: `Emplacement « ${l.numero} » supprimé.` });
      if (idEnCours === l.id) {
        setForm(formulaireVide);
        setIdEnCours(null);
      }
      recharger();
    } else {
      setMessage({ type: "erreur", texte: res.message ?? "Erreur inconnue." });
    }
  }

  function modifier(l: EmplacementRow) {
    setMessage(null);
    setIdEnCours(l.id);
    setForm({ numero: l.numero, nom: l.nom, type: l.type, capacite: String(l.capacite), unite: l.unite });
  }

  return (
    <div>
      <EntetePage
        titre="Emplacements"
        sousTitre="Zones de stockage et de travail (7 types) — numéro unique obligatoire"
      />
      {message ? (
        <Alerte type={message.type} onFermer={() => setMessage(null)}>
          {message.texte}
        </Alerte>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Carte className="h-fit p-5">
          <h2 className="mb-4 text-base font-semibold text-slate-800">
            {idEnCours ? "Modifier l'emplacement" : "Nouvel emplacement"}
          </h2>
          <form onSubmit={soumettre} className="space-y-4">
            <Champ label="Numéro *" aide="Identifiant unique de l'emplacement">
              <input
                className={inputCls}
                value={form.numero}
                onChange={(e) => setForm({ ...form, numero: e.target.value })}
                placeholder="ex. E-001"
                required
              />
            </Champ>
            <Champ label="Nom *">
              <input
                className={inputCls}
                value={form.nom}
                onChange={(e) => setForm({ ...form, nom: e.target.value })}
                placeholder="ex. Rack MP A"
                required
              />
            </Champ>
            <Champ label="Type *" aide="Détermine les règles de flux (affectations, ordres)">
              <select
                className={inputCls}
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                required
              >
                <option value="">— Sélectionner —</option>
                {TYPES_EMPLACEMENT.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Champ>
            <div className="grid grid-cols-2 gap-3">
              <Champ label="Capacité / volume">
                <input
                  className={inputCls}
                  type="text"
                  inputMode="decimal"
                  value={form.capacite}
                  onChange={(e) => setForm({ ...form, capacite: e.target.value })}
                />
              </Champ>
              <Champ label="Unité">
                <select
                  className={inputCls}
                  value={form.unite}
                  onChange={(e) => setForm({ ...form, unite: e.target.value })}
                >
                  <option value="m³">m³</option>
                  <option value="L">L</option>
                  <option value="kg">kg</option>
                  <option value="t">t</option>
                  <option value="unités">unités</option>
                </select>
              </Champ>
            </div>
            <div className="flex gap-2 pt-1">
              <Bouton type="submit" disabled={enCours}>
                {enCours ? "Enregistrement…" : idEnCours ? "Enregistrer les modifications" : "Créer l'emplacement"}
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
              Liste des emplacements{" "}
              {lignes ? <span className="font-normal text-slate-400">({lignes.length})</span> : null}
            </h2>
          </div>
          {lignes === null ? (
            <p className="px-5 py-8 text-sm text-slate-400">Chargement…</p>
          ) : lignes.length === 0 ? (
            <div className="p-5">
              <Vide message="Aucun emplacement pour le moment." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <Th>Numéro</Th>
                    <Th>Nom</Th>
                    <Th>Type</Th>
                    <Th className="text-right">Capacité</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lignes.map((l) => (
                    <tr key={l.id} className={idEnCours === l.id ? "bg-amber-50/60" : "hover:bg-slate-50"}>
                      <Td className="font-medium text-slate-900">{l.numero}</Td>
                      <Td>{l.nom}</Td>
                      <Td>
                        <Badge cls={BADGE_EMP[l.type] ?? ""}>{LIBELLES_EMPLACEMENT[l.type] ?? l.type}</Badge>
                      </Td>
                      <Td className="text-right tabular-nums">
                        {fmtFr(l.capacite)} {l.unite}
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
            </div>
          )}
        </Carte>
      </div>
    </div>
  );
}
