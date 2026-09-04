import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { chargerMp, creerMp, modifierMp, supprimerMp } from "~/serveur";
import type { MpRow } from "~/sqlite";
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
import { fmtFr } from "~/catalog";

export const Route = createFileRoute("/matieres-premieres")({
  component: PageMatieresPremieres,
});

interface FormMp {
  code: string;
  nom: string;
  tolerance: string;
  barcodeAuto: boolean;
  ajoutManuel: boolean;
}

const formulaireVide: FormMp = {
  code: "",
  nom: "",
  tolerance: "0",
  barcodeAuto: false,
  ajoutManuel: false,
};

function PageMatieresPremieres() {
  const [lignes, setLignes] = useState<MpRow[] | null>(null);
  const [form, setForm] = useState<FormMp>(formulaireVide);
  const [idEnCours, setIdEnCours] = useState<number | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<{ type: "erreur" | "succes"; texte: string } | null>(null);

  const recharger = useCallback(() => {
    chargerMp().then(setLignes).catch(() => setMessage({ type: "erreur", texte: "Erreur de chargement." }));
  }, []);
  useEffect(recharger, [recharger]);

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setEnCours(true);
    setMessage(null);
    const payload = {
      code: form.code,
      nom: form.nom,
      tolerance: form.tolerance,
      barcodeAuto: form.barcodeAuto,
      ajoutManuel: form.ajoutManuel,
    };
    const res = idEnCours
      ? await modifierMp({ data: { id: idEnCours, ...payload } })
      : await creerMp({ data: payload });
    setEnCours(false);
    if (res.ok) {
      setMessage({
        type: "succes",
        texte: idEnCours
          ? `Matière première « ${form.code.toUpperCase()} » modifiée.`
          : `Matière première « ${form.code.toUpperCase()} » créée.`,
      });
      setForm(formulaireVide);
      setIdEnCours(null);
      recharger();
    } else {
      setMessage({ type: "erreur", texte: res.message ?? "Erreur inconnue." });
    }
  }

  async function supprimer(l: MpRow) {
    setMessage(null);
    if (!window.confirm(`Supprimer la matière première « ${l.code} — ${l.nom} » ?`)) return;
    const res = await supprimerMp({ data: l.id });
    if (res.ok) {
      setMessage({ type: "succes", texte: `Matière première « ${l.code} » supprimée.` });
      if (idEnCours === l.id) {
        setForm(formulaireVide);
        setIdEnCours(null);
      }
      recharger();
    } else {
      setMessage({ type: "erreur", texte: res.message ?? "Erreur inconnue." });
    }
  }

  function modifier(l: MpRow) {
    setMessage(null);
    setIdEnCours(l.id);
    setForm({
      code: l.code,
      nom: l.nom,
      tolerance: String(l.tolerance_pct),
      barcodeAuto: !!l.barcode_auto,
      ajoutManuel: !!l.ajout_manuel,
    });
  }

  return (
    <div>
      <EntetePage
        titre="Matières premières"
        sousTitre="Catalogue des MP : code, tolérance, code-barres, ajout manuel"
      />
      {message ? (
        <Alerte type={message.type} onFermer={() => setMessage(null)}>
          {message.texte}
        </Alerte>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Carte className="h-fit p-5">
          <h2 className="mb-4 text-base font-semibold text-slate-800">
            {idEnCours ? "Modifier la matière première" : "Nouvelle matière première"}
          </h2>
          <form onSubmit={soumettre} className="space-y-4">
            <Champ label="Code article *">
              <input
                className={inputCls}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="ex. MP-001"
                required
              />
            </Champ>
            <Champ label="Nom *">
              <input
                className={inputCls}
                value={form.nom}
                onChange={(e) => setForm({ ...form, nom: e.target.value })}
                placeholder="ex. Farine de blé"
                required
              />
            </Champ>
            <Champ label="Tolérance (%)" aide="Nombre entre 0 et 100">
              <input
                className={inputCls}
                type="text"
                inputMode="decimal"
                value={form.tolerance}
                onChange={(e) => setForm({ ...form, tolerance: e.target.value })}
              />
            </Champ>
            <CaseACocher
              label="Code-barres auto"
              aide="Génère un code-barres à partir du code article"
              checked={form.barcodeAuto}
              onChange={(v) => setForm({ ...form, barcodeAuto: v })}
            />
            <CaseACocher
              label="Ajout manuel"
              aide="Nécessite une intervention humaine directe en production (validée via la Zone d'Ajout Manuel)"
              checked={form.ajoutManuel}
              onChange={(v) => setForm({ ...form, ajoutManuel: v })}
            />
            <div className="flex gap-2 pt-1">
              <Bouton type="submit" disabled={enCours}>
                {enCours ? "Enregistrement…" : idEnCours ? "Enregistrer les modifications" : "Créer la matière première"}
              </Bouton>
              {idEnCours ? (
                <Bouton type="button" variante="secondaire" onClick={() => setForm(formulaireVide)}>
                  Annuler
                </Bouton>
              ) : null}
            </div>
          </form>
        </Carte>

        <Carte>
          <div className="border-b border-slate-200 px-5 py-3.5">
            <h2 className="text-base font-semibold text-slate-800">
              Liste des matières premières{" "}
              {lignes ? <span className="font-normal text-slate-400">({lignes.length})</span> : null}
            </h2>
          </div>
          {lignes === null ? (
            <p className="px-5 py-8 text-sm text-slate-400">Chargement…</p>
          ) : lignes.length === 0 ? (
            <div className="p-5">
              <Vide message="Aucune matière première pour le moment." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <Th>Code</Th>
                    <Th>Nom</Th>
                    <Th className="text-right">Tolérance</Th>
                    <Th>Code-barres</Th>
                    <Th>Options</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lignes.map((l) => (
                    <tr key={l.id} className={idEnCours === l.id ? "bg-amber-50/60" : "hover:bg-slate-50"}>
                      <Td className="font-medium text-slate-900">{l.code}</Td>
                      <Td>{l.nom}</Td>
                      <Td className="text-right tabular-nums">± {fmtFr(l.tolerance_pct, " %")}</Td>
                      <Td>
                        {l.code_barres ? (
                          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs tracking-wider">
                            {l.code_barres}
                          </code>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-1">
                          {l.barcode_auto ? <Badge cls="bg-sky-100 text-sky-800">CB auto</Badge> : null}
                          {l.ajout_manuel ? <Badge cls="bg-orange-100 text-orange-800">Ajout manuel</Badge> : null}
                          {!l.barcode_auto && !l.ajout_manuel ? <span className="text-slate-300">—</span> : null}
                        </div>
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
