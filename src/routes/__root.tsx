import { HeadContent, Outlet, Scripts, createRootRoute, Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

import appCss from "~/styles/app.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "FluxProd — GPAO" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  notFoundComponent: () => (
    <div className="p-10 text-center text-slate-500">
      <p className="text-lg font-medium text-slate-700">Page introuvable</p>
      <Link to="/" className="mt-2 inline-block text-sm text-sky-700 hover:underline">
        Retour au tableau de bord
      </Link>
    </div>
  ),
  component: RootComponent,
});

const LIENS = [
  { to: "/", label: "Tableau de bord", exacte: true, icone: "▤" },
  { to: "/matieres-premieres", label: "Matières premières", icone: "▣" },
  { to: "/emplacements", label: "Emplacements", icone: "▦" },
  { to: "/produits-finis", label: "Produits finis", icone: "▧" },
  { to: "/nomenclatures", label: "Nomenclatures", icone: "▨" },
  { to: "/affectations", label: "Affectations", icone: "▩" },
] as const;

function RootComponent() {
  const chemin = useRouterState({ select: (s) => s.location.pathname });
  return (
    <RootDocument>
      <div className="flex min-h-dvh">
        <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-slate-900 text-slate-100">
          <div className="border-b border-slate-700/60 px-5 py-5">
            <Link to="/" className="block">
              <span className="text-lg font-bold tracking-tight">FluxProd</span>
              <span className="mt-0.5 block text-xs font-medium text-slate-400">
                GPAO — Gestion de production
              </span>
            </Link>
          </div>
          <nav className="flex-1 space-y-0.5 px-3 py-4">
            {LIENS.map((l) => {
              const actif = l.exacte ? chemin === l.to : chemin.startsWith(l.to);
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition ${
                    actif
                      ? "bg-slate-700/70 text-white"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <span aria-hidden className="text-base leading-none opacity-70">
                    {l.icone}
                  </span>
                  {l.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-slate-700/60 px-5 py-4 text-xs text-slate-400">
            Socle de données — vague 1
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col bg-slate-50">
          <main className="mx-auto w-full max-w-6xl flex-1 px-8 py-8">
            <Outlet />
          </main>
          <footer className="border-t border-slate-200 px-8 py-3 text-center text-xs text-slate-400">
            FluxProd — GPAO web en français
          </footer>
        </div>
      </div>
      <Scripts />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>{children}</body>
    </html>
  );
}
