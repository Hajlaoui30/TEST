import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { chargerStats } from "~/serveur";
import { Carte, EntetePage, Vide } from "~/composants/ui";

export const Route = createFileRoute("/")({
  component: Home,
});

interface Stats {
  nbMp: number;
  nbPf: number;
  nbEmplacements: number;
  nbNomenclatures: number;
  nbAffectations: number;
}

function Home() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    chargerStats()
      .then(setStats)
      .catch(() => setErreur("Impossible de charger les statistiques."));
  }, []);

  const compteurs = stats
    ? [
        { label: "Matières premières", valeur: stats.nbMp, lien: "/matieres-premieres", couleur: "text-sky-600" },
        { label: "Produits finis", valeur: stats.nbPf, lien: "/produits-finis", couleur: "text-emerald-600" },
        { label: "Emplacements", valeur: stats.nbEmplacements, lien: "/emplacements", couleur: "text-violet-600" },
        { label: "Nomenclatures", valeur: stats.nbNomenclatures, lien: "/nomenclatures", couleur: "text-amber-600" },
      ]
    : [];

  return (
    <div>
      <EntetePage
        titre="Tableau de bord"
        sousTitre="Vue d'ensemble du socle de données FluxProd"
      />

      {erreur ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {erreur}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {compteurs.map((c) => (
          <Link key={c.lien} to={c.lien}>
            <Carte className="p-5 transition hover:border-slate-400 hover:shadow">
              <p className="text-sm font-medium text-slate-500">{c.label}</p>
              <p className={`mt-1 text-3xl font-bold ${c.couleur}`}>{c.valeur}</p>
            </Carte>
          </Link>
        ))}
        {!stats && !erreur
          ? [0, 1, 2, 3].map((i) => (
              <Carte key={i} className="h-24 animate-pulse bg-slate-100 p-5" />
            ))
          : null}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Carte className="p-5">
          <h2 className="text-base font-semibold text-slate-800">Bienvenue dans FluxProd</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            FluxProd est votre GPAO web : gérez vos matières premières, vos emplacements de
            stockage et de travail, vos produits finis, leurs nomenclatures (recettes à 100 %)
            et les affectations articles ↔ emplacements qui respectent vos règles de flux.
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
            <li>
              <span className="font-medium text-slate-800">1.</span> Créez vos{" "}
              <Link to="/emplacements" className="font-medium text-sky-700 hover:underline">
                emplacements
              </Link>{" "}
              (7 types : Réception, Stockage MP, Stockage PF, Dosage/Préparation…).
            </li>
            <li>
              <span className="font-medium text-slate-800">2.</span> Enregistrez vos{" "}
              <Link to="/matieres-premieres" className="font-medium text-sky-700 hover:underline">
                matières premières
              </Link>{" "}
              et vos{" "}
              <Link to="/produits-finis" className="font-medium text-sky-700 hover:underline">
                produits finis
              </Link>
              .
            </li>
            <li>
              <span className="font-medium text-slate-800">3.</span> Affectez les articles à leurs
              emplacements selon les règles de flux.
            </li>
            <li>
              <span className="font-medium text-slate-800">4.</span> Définissez les{" "}
              <Link to="/nomenclatures" className="font-medium text-sky-700 hover:underline">
                nomenclatures
              </Link>{" "}
              : la somme des MP doit être exactement 100 %.
            </li>
          </ul>
        </Carte>

        <Carte className="p-5">
          <h2 className="text-base font-semibold text-slate-800">Règles métier appliquées</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li className="flex gap-2">
              <span className="text-emerald-600">✓</span>
              <span>
                <span className="font-medium text-slate-800">Nomenclature à 100 %</span> — la
                somme des pourcentages de MP doit être exactement 100 %, sinon l'enregistrement
                est refusé.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-600">✓</span>
              <span>
                <span className="font-medium text-slate-800">Flux des affectations</span> — une MP
                ne va que dans un Stockage MP, un Dosage/Préparation ou un Sous-ensemble/Prémix ;
                un PF uniquement dans un Stockage PF ou un Traitement/Finition.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-600">✓</span>
              <span>
                <span className="font-medium text-slate-800">Zone de Réception</span> — transit
                dynamique : aucune affectation fixe d'article.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-600">✓</span>
              <span>
                <span className="font-medium text-slate-800">Une nomenclature par PF</span> — un
                même produit fini ne peut avoir qu'une seule recette.
              </span>
            </li>
          </ul>
        </Carte>
      </div>
    </div>
  );
}
