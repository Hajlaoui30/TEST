/**
 * Petits composants d'interface réutilisables (design industriel sobre).
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Carte({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function EntetePage({
  titre,
  sousTitre,
  actions,
}: {
  titre: string;
  sousTitre?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{titre}</h1>
        {sousTitre ? <p className="mt-1 text-sm text-slate-500">{sousTitre}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function Alerte({
  type,
  children,
  onFermer,
}: {
  type: "erreur" | "succes" | "info";
  children: ReactNode;
  onFermer?: () => void;
}) {
  const styles = {
    erreur: "border-red-200 bg-red-50 text-red-800",
    succes: "border-emerald-200 bg-emerald-50 text-emerald-800",
    info: "border-sky-200 bg-sky-50 text-sky-800",
  }[type];
  const icone = { erreur: "✕", succes: "✓", info: "ℹ" }[type];
  return (
    <div className={`mb-4 flex items-start gap-3 rounded-md border px-4 py-3 text-sm ${styles}`}>
      <span aria-hidden className="mt-0.5 font-bold">
        {icone}
      </span>
      <div className="flex-1">{children}</div>
      {onFermer ? (
        <button
          type="button"
          onClick={onFermer}
          className="text-xs font-medium opacity-60 hover:opacity-100"
        >
          Fermer
        </button>
      ) : null}
    </div>
  );
}

export function Champ({
  label,
  children,
  aide,
  className = "",
}: {
  label: string;
  children: ReactNode;
  aide?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {aide ? <span className="mt-1 block text-xs text-slate-400">{aide}</span> : null}
    </label>
  );
}

export const inputCls =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-900/10";

export function Bouton({
  variante = "primaire",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: "primaire" | "secondaire" | "danger";
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
  const styles = {
    primaire: "bg-slate-900 text-white hover:bg-slate-700",
    secondaire: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
    danger: "border border-red-200 bg-white text-red-600 hover:bg-red-50",
  }[variante];
  return <button className={`${base} ${styles} ${className}`} {...props} />;
}

export function Badge({ children, cls = "" }: { children: ReactNode; cls?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls || "bg-slate-100 text-slate-700"}`}
    >
      {children}
    </span>
  );
}

export function Vide({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}

export function Th({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={`px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle text-sm text-slate-700 ${className}`}>{children}</td>;
}

export function CaseACocher({
  label,
  aide,
  checked,
  onChange,
}: {
  label: string;
  aide?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-slate-200 px-3 py-2.5 hover:bg-slate-50">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-slate-900"
      />
      <span>
        <span className="block text-sm font-medium text-slate-700">{label}</span>
        {aide ? <span className="block text-xs text-slate-400">{aide}</span> : null}
      </span>
    </label>
  );
}
