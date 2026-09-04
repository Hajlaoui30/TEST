import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { chargerMp, chargerNomenclatures, enregistrerNomenclature, supprimerNomenclature } from "~/serveur";
import type { MpRow, NomenclatureDetail, PfRow } from "~/sqlite";
import { chargerPf } from "~/serveur";
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
import { fmtFr } from "~/catalog";

export const Route = createFileRoute("/nomenclatures")({
  component: PageNomenclatures,
});

interface Ligne {
  mpId: number | null;
  pct: string;
}

function PageNomenclatures() {
  const [nomenclatures, setNomenclatures] = useState<NomenclatureDetail[] | null>(null);
  const [mps, setMps] = useState<MpRow[] | null>(null);
  const [pfs, setPfs] = useState<PfRow[] | null>(null);
  const [pfId, setPfId] = useState<string>("");
  const [lignes, setLignes] = useState<Ligne[]>([{ mpId: null, pct: "" }]);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<{ type: "erreur" | "succes"; texte: string } | null>(null);

  const recharger = useCallback(() => {
    chargerNomenclatures()
      .then(setNomenclatures)
      .catch(() => setMessage({ type: "erreur", texte: "Erreur de chargement." }));
    chargerMp().then(setMps).catch(() => {});
    chargerPf().then(setPfs).catch(() => {});
  }, []);
  useEffect(recharger, [recharger]);

  const total = useMemo(() => {
    return lignes.reduce((somme, l) => {
      const n = Number(String(l.pct).replace(",", "."));
      return somme + (Number.isFinite(n) && String(l.pct).trim() !== "" ? n : 0);
    }, 0);
  }, [lignes]);
  const totalArrondi = Math.round(total * 100) / 100;
  const ecart = Math.round((totalArrondi - 100) * 100) / 100;
  const formulaireValide =
    pfId !== "" &&
    lignes.length > 0 &&
    lignes.every((l) => l.mpId !== null && String(l.pct).trim() !== "");

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setEnCours(true);
    setMessage(null);
    const res = await enregistrerNomenclature({
      data: {
        pfId: Number(pfId),
        lignes: lignes.map((l) => ({
          mpId: Number(l.mpId),
          pct: Number(String(l.pct).replace(",", ".")),
        })),
      },
    });
    setEnCours(false);
    if (res.ok) {
      setMessage({
        type: "succes",
        texte: `Nomenclature enregistrée pour « ${res.data?.pf_code} » (somme : 100 %).`,
      });
      setPfId("");
      setLignes([{ mpId: null, pct: "" }]);
      recharger();
    } else {
      setMessage({ type: "erreur", texte: res.message ?? "Erreur inconnue." });
    }
  }

  async function supprimer(n: NomenclatureDetail) {
    setMessage(null);
    if (
      !window.confirm(
        `Supprimer la nomenclature de « ${n.pf_code} — ${n.pf_nom} » ? Les lignes de MP seront supprimées avec elle.`,
      )
    )
      return;
    const res = await supprimerNomenclature({ data: n.id });
    if (res.ok) {
      setMessage({ type: "succes", texte: `Nomenclature de « ${n.pf_code} » supprimée.` });
      recharger();
    } else {
      setMessage({ type: "erreur", texte: res.message ?? "Erreur inconnue." });
    }
  }

  function modifier(n: NomenclatureDetail) {
    setMessage(null);
    setPfId(String(n.pf_id));
    setLignes(n.lignes.map((l) => ({ mpId: l.mp_id, pct: String(l.pourcentage) })));
  }

  return (
    <div>
      <EntetePage
        titre="Nomenclatures (recettes)"
        sousTitre="Une recette par produit fini — la somme des MP doit être exactement 100 %"
      />
      {message ? (
        <Alerte type={message.type} onFermer={() => setMessage(null)}>
          {message.texte}
        </Alerte>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[440px_1fr]">
        <Carte className="h-fit p-5">
          <h2 className="mb-4 text-base font-semibold text-slate-800">
            {pfId ? "Modifier la nomenclature" : "Nouvelle nomenclature"}
          </h2>
          {mps !== null && mps.length === 0 ? (
            <Vide message="Créez d'abord des matières premières, puis revenez ici." />
          ) : pfs !== null && pfs.length === 0 ? (
            <Vide message="Créez d'abord un produit fini, puis revenez ici." />
          ) : (
            <form onSubmit={soumettre} className="space-y-4">
              <Champ label="Article PF *" aide="Une seule nomenclature par PF">
                <select
                  className={inputCls}
                  value={pfId}
                  onChange={(e) => setPfId(e.target.value)}
                  required
                >
                  <option value="">— Sélectionner un produit fini —</option>
                  {(pfs ?? []).map((pf) => (
                    <option key={pf.id} value={pf.id}>
                      {pf.code} — {pf.nom}
                    </option>
                  ))}
                </select>
              </Champ>

              <div className="rounded-md border border-slate-200">
                <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
                  <span className="text-sm font-medium text-slate-700">Matières premières</span>
                  <button
                    type="button"
                    onClick={() => setLignes([...lignes, { mpId: null, pct: "" }])}
                    className="text-sm font-medium text-sky-700 hover:underline"
                  >
                    + Ajouter une ligne
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setLignes(lignes.map((l) => ({ ...l, pct: (100 / lignes.length).toFixed(2) })))
                    }
                    className="text-sm font-medium text-slate-500 hover:underline"
                    title="Répartit 100 % entre les lignes"
                  >
                    Répartir
                  </button>
                </div>
                {lignes.map((l, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 last:border-b-0"
                  >
                    <select
                      className={inputCls + " flex-1"}
                      value={l.mpId ?? ""}
                      onChange={(e) =>
                        setLignes(
                          lignes.map((x, j) =>
                            j === i ? { ...x, mpId: Number(e.target.value) || null } : x,
                          ),
                        )
                      }
                      required
                    >
                      <option value="">— MP —</option>
                      {(mps ?? []).map((mp) => (
                        <option key={mp.id} value={mp.id}>
                          {mp.code} — {mp.nom}
                        </option>
                      ))}
                    </select>
                    <input
                      className={inputCls + " w-24 text-right"}
                      type="text"
                      inputMode="decimal"
                      value={l.pct}
                      onChange={(e) =>
                        setLignes(lignes.map((x, j) => (j === i ? { ...x, pct: e.target.value } : x)))
                      }
                      placeholder="%"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setLignes(lignes.filter((_, j) => j !== i))}
                      aria-label="Supprimer la ligne"
                      className="px-1 text-slate-300 hover:text-red-600"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <div
                className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm font-medium ${
                  totalArrondi === 100
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-red-200 bg-red-50 text-red-800"
                }`}
              >
                <span>Somme des %</span>
                <span className="tabular-nums">
                  {fmtFr(totalArrondi)} %{" "}
                  {totalArrondi === 100 ? "✓" : `— écart de ${fmtFr(Math.abs(ecart))} pt`}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                La somme doit être exactement 100 % — le serveur refuse sinon, même si le
                navigateur est contourné.
              </p>

              <div className="flex gap-2 pt-1">
                <Bouton type="submit" disabled={enCours || !formulaireValide}>
                  {enCours ? "Enregistrement…" : "Enregistrer la nomenclature"}
                </Bouton>
                {pfId ? (
                  <Bouton
                    type="button"
                    variante="secondaire"
                    onClick={() => {
                      setPfId("");
                      setLignes([{ mpId: null, pct: "" }]);
                    }}
                  >
                    Annuler
                  </Bouton>
                ) : null}
              </div>
            </form>
          )}
        </Carte>

        <Carte>
          <div className="border-b border-slate-200 px-5 py-3.5">
            <h2 className="text-base font-semibold text-slate-800">
              Nomenclatures enregistrées{" "}
              {nomenclatures ? (
                <span className="font-normal text-slate-400">({nomenclatures.length})</span>
              ) : null}
            </h2>
          </div>
          {nomenclatures === null ? (
            <p className="px-5 py-8 text-sm text-slate-400">Chargement…</p>
          ) : nomenclatures.length === 0 ? (
            <div className="p-5">
              <Vide message="Aucune nomenclature pour le moment." />
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {nomenclatures.map((n) => (
                <div key={n.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">
                        {n.pf_code} — {n.pf_nom}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {n.lignes.length} matière(s) première(s) · somme {fmtFr(n.total_pct)} %
                      </p>
                    </div>
                    <div className="shrink-0">
                      <button
                        type="button"
                        onClick={() => modifier(n)}
                        className="mr-3 text-sm font-medium text-sky-700 hover:underline"
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => supprimer(n)}
                        className="text-sm font-medium text-red-600 hover:underline"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                  <table className="mt-3 min-w-full">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <Th>Matière première</Th>
                        <Th className="text-right">Pourcentage</Th>
                        <Th>Option</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {n.lignes.map((l) => (
                        <tr key={l.mp_id}>
                          <Td>
                            {l.mp_code} — {l.mp_nom}
                          </Td>
                          <Td className="text-right tabular-nums">{fmtFr(l.pourcentage, " %")}</Td>
                          <Td>
                            {l.ajout_manuel ? (
                              <Badge cls="bg-orange-100 text-orange-800">Ajout manuel</Badge>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </Carte>
      </div>
    </div>
  );
}
