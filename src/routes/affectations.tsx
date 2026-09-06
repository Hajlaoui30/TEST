import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { chargerAffectations, chargerEmplacements, chargerMp, chargerPf, creerAffectation, supprimerAffectation } from "~/serveur";
import type { AffectationRow, EmplacementRow, MpRow, PfRow } from "~/sqlite";
import { BADGE_EMP, TYPES_AUTORISES_MP, TYPES_AUTORISES_PF } from "~/catalog";
import { LIBELLES_EMPLACEMENT, LIBELLES_PF, LIBELLES_SOUS_TYPE } from "~/labels";
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

export const Route = createFileRoute("/affectations")({
  component: PageAffectations,
});

function PageAffectations() {
  const [affectations, setAffectations] = useState<AffectationRow[] | null>(null);
  const [mps, setMps] = useState<MpRow[] | null>(null);
  const [pfs, setPfs] = useState<PfRow[] | null>(null);
  const [emps, setEmps] = useState<EmplacementRow[] | null>(null);
  const [articleType, setArticleType] = useState<"MP" | "PF">("MP");
  const [articleId, setArticleId] = useState<string>("");
  const [emplacementId, setEmplacementId] = useState<string>("");
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<{ type: "erreur" | "succes" | "info"; texte: string } | null>(null);

  const recharger = useCallback(() => {
    chargerAffectations().then(setAffectations).catch(() => {});
    chargerMp().then(setMps).catch(() => {});
    chargerPf().then(setPfs).catch(() => {});
    chargerEmplacements().then(setEmps).catch(() => {});
  }, []);
  useEffect(recharger, [recharger]);

  const typesAutorises = articleType === "MP" ? TYPES_AUTORISES_MP : TYPES_AUTORISES_PF;
  const emplacementsFiltres = useMemo(
    () => (emps ?? []).filter((e) => typesAutorises.includes(e.type)),
    [emps, typesAutorises],
  );

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setEnCours(true);
    setMessage(null);
    const res = await creerAffectation({
      data: { articleType, articleId: Number(articleId), emplacementId: Number(emplacementId) },
    });
    setEnCours(false);
    if (res.ok) {
      setMessage({ type: "succes", texte: "Affectation créée." });
      setArticleId("");
      setEmplacementId("");
      recharger();
    } else {
      setMessage({ type: "erreur", texte: res.message ?? "Erreur inconnue." });
    }
  }

  async function supprimer(a: AffectationRow) {
    setMessage(null);
    const nomArticle = `${a.article_code} — ${a.article_nom}`;
    if (!window.confirm(`Supprimer l'affectation de « ${nomArticle} » sur « ${a.emp_numero} » ?`)) return;
    const res = await supprimerAffectation({ data: a.id });
    if (res.ok) {
      setMessage({ type: "succes", texte: "Affectation supprimée." });
      recharger();
    } else {
      setMessage({ type: "erreur", texte: res.message ?? "Erreur inconnue." });
    }
  }

  const libelleArticle = (a: AffectationRow) =>
    `${a.article_code} — ${a.article_nom}${a.article_type === "PF" ? "" : ""}`;

  return (
    <div>
      <EntetePage
        titre="Affectations articles ↔ emplacements"
        sousTitre="Règles de flux strictes, contrôlées côté serveur"
      />
      {message ? (
        <Alerte type={message.type} onFermer={() => setMessage(null)}>
          {message.texte}
        </Alerte>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        <Carte className="h-fit p-5">
          <h2 className="mb-4 text-base font-semibold text-slate-800">Nouvelle affectation</h2>
          <form onSubmit={soumettre} className="space-y-4">
            <Champ label="Type d'article *">
              <div className="grid grid-cols-2 gap-2">
                {(["MP", "PF"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setArticleType(t);
                      setArticleId("");
                      setEmplacementId("");
                    }}
                    className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                      articleType === t
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {t === "MP" ? "Matière première" : "Produit fini"}
                  </button>
                ))}
              </div>
            </Champ>
            <Champ label="Article *">
              <select
                className={inputCls}
                value={articleId}
                onChange={(e) => setArticleId(e.target.value)}
                required
              >
                <option value="">
                  {articleType === "MP" ? "— Sélectionner une MP —" : "— Sélectionner un PF —"}
                </option>
                {articleType === "MP"
                  ? (mps ?? []).map((mp) => (
                      <option key={mp.id} value={mp.id}>
                        {mp.code} — {mp.nom}
                      </option>
                    ))
                  : (pfs ?? []).map((pf) => (
                      <option key={pf.id} value={pf.id}>
                        {pf.code} — {pf.nom}
                      </option>
                    ))}
              </select>
            </Champ>
            <Champ
              label="Emplacement *"
              aide={
                articleType === "MP"
                  ? "Autorisés : Stockage MP, Dosage/Préparation MP, Sous-ensemble/Prémix"
                  : "Autorisés : Stockage PF, Traitement/Finition"
              }
            >
              <select
                className={inputCls}
                value={emplacementId}
                onChange={(e) => setEmplacementId(e.target.value)}
                required
              >
                <option value="">— Sélectionner un emplacement —</option>
                {emplacementsFiltres.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.numero} — {e.nom} ({LIBELLES_EMPLACEMENT[e.type] ?? e.type})
                  </option>
                ))}
              </select>
            </Champ>
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
              ⚠ Rappel : la Zone de Réception est un transit dynamique — aucune affectation fixe
              n'y est possible. Le serveur refuse toute affectation non conforme, même si le
              filtre du formulaire est contourné.
            </p>
            <Bouton type="submit" disabled={enCours || !articleId || !emplacementId}>
              {enCours ? "Enregistrement…" : "Affecter l'article"}
            </Bouton>
          </form>
        </Carte>

        <Carte>
          <div className="border-b border-slate-200 px-5 py-3.5">
            <h2 className="text-base font-semibold text-slate-800">
              Affectations enregistrées{" "}
              {affectations ? (
                <span className="font-normal text-slate-400">({affectations.length})</span>
              ) : null}
            </h2>
          </div>
          {affectations === null ? (
            <p className="px-5 py-8 text-sm text-slate-400">Chargement…</p>
          ) : affectations.length === 0 ? (
            <div className="p-5">
              <Vide message="Aucune affectation pour le moment." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <Th>Type</Th>
                    <Th>Article</Th>
                    <Th>Emplacement</Th>
                    <Th>Type d'emplacement</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {affectations.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <Td>
                        <Badge cls={a.article_type === "MP" ? "bg-sky-100 text-sky-800" : "bg-emerald-100 text-emerald-800"}>
                          {a.article_type}
                        </Badge>
                      </Td>
                      <Td className="font-medium text-slate-900">{libelleArticle(a)}</Td>
                      <Td>
                        {a.emp_numero} — {a.emp_nom}
                      </Td>
                      <Td>
                        <Badge cls={BADGE_EMP[a.emp_type] ?? ""}>
                          {LIBELLES_EMPLACEMENT[a.emp_type] ?? a.emp_type}
                        </Badge>
                      </Td>
                      <Td className="text-right">
                        <button
                          type="button"
                          onClick={() => supprimer(a)}
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
