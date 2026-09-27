import React from "react";

export default function Footer({ storeName, onOpenSuperAdmin }) {
  return (
    <footer className="w-full py-8 mt-10 border-t-2 border-slate-200 dark:border-slate-800 bg-surface-container text-center flex flex-col items-center justify-center gap-3 px-4 select-none">
      {/* Brand & Partner Badge */}
      <div className="flex items-center justify-center gap-2.5">
        <img
          src="/GOT.png"
          alt="Logo Go Technologie (GOT)"
          className="h-7 w-auto object-contain drop-shadow-sm"
          onError={(e) => {
            e.target.style.display = "none";
          }}
        />
        <div className="flex flex-col text-left">
          <span className="text-xs font-bold text-on-surface tracking-wide leading-none">
            Go Technologie (GOT)
          </span>
          <span className="text-[10px] text-primary font-medium tracking-tight mt-0.5">
            Solutions Numériques &amp; Commerce Intégré
          </span>
        </div>
      </div>

      {/* Rights line */}
      <p className="text-[11px] text-on-surface-variant leading-relaxed max-w-sm">
        © {new Date().getFullYear()} {storeName ? `${storeName} • ` : ""}GotoShop. Tous droits réservés.
        <br />
        <span className="text-[10px] text-on-surface-variant/80">
          Plateforme propulsée avec fierté par <strong>Go Technologie (GOT)</strong>.
        </span>
      </p>

      {/* Pill tags */}
      <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] text-on-surface-variant/70 pt-1">
        <span className="px-2 py-0.5 rounded-full bg-surface-secondary border border-slate-300 dark:border-slate-700 font-medium">
          🔒 Commerce Conversationnel Sécurisé
        </span>
        <span className="px-2 py-0.5 rounded-full bg-surface-secondary border border-slate-300 dark:border-slate-700 font-medium">
          ⚡ GPS &amp; Envoi Direct
        </span>
      </div>

      {/* Discreet SuperAdmin Access */}
      {onOpenSuperAdmin && (
        <div className="pt-2">
          <button
            type="button"
            onClick={onOpenSuperAdmin}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-medium text-on-surface-variant/70 hover:text-amber-500 hover:bg-surface-secondary border border-slate-200 dark:border-slate-800 hover:border-amber-500/40 transition-all cursor-pointer"
            title="Console d'Administration GOT"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            <span>Console Super-Admin</span>
          </button>
        </div>
      )}
    </footer>
  );
}
