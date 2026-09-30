import Icon from "./Icon";
import React, { useState, useEffect } from "react";
import { fetchShareStats } from "../api/client";

const PERIODS = [{ d: 7, l: "7 j" }, { d: 30, l: "30 j" }, { d: null, l: "Tout" }];
const fmt = (n) => Number(n || 0).toLocaleString("fr-FR");

/** Tableau de bord : résultats de la publicité produit (vues → intentions → commandes → achats) par produit et par réseau. */
export default function ProductAdsSection({ store }) {
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!store?.id) return undefined;
    let alive = true;
    fetchShareStats(store.id, { days })
      .then((d) => { if (alive) { setStats(d); setError(""); } })
      .catch((e) => { if (alive) setError(e.message || "Résultats indisponibles"); });
    return () => { alive = false; };
  }, [store?.id, days]);

  const t = stats?.totals || {};
  const cur = stats?.currency || store?.currency || "FCFA";
  const products = (stats?.products || []).filter((p) => p.views || p.clicks || p.orders);
  const networks = (stats?.networks || []).filter((n) => n.views || n.clicks || n.orders);

  return (
    <section className="bg-surface-container rounded-xl p-space-md shadow-md space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-headline-sm text-sm font-bold text-on-surface flex items-center gap-2">
          <Icon name="campaign" className="text-[20px] text-primary" />
          Publicité produits
        </h3>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button key={p.l} type="button" onClick={() => setDays(p.d)}
              className={`px-2 h-7 rounded-lg text-[11px] font-bold cursor-pointer ${days === p.d ? "bg-primary text-white" : "bg-surface-container-high text-on-surface-variant"}`}>{p.l}</button>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-on-surface-variant">Chaque produit partagé sur un réseau (bouton « Promouvoir sur les réseaux » dans la vitrine) a son lien suivi.</p>
      {error && <p className="text-[11px] text-rose-600 dark:text-rose-400">{error}</p>}

      <div className="grid grid-cols-4 gap-1.5">
        {[["views", "Vues"], ["intents", "Intentions"], ["orders", "Commandes"], ["purchases", "Achats"]].map(([k, l]) => (
          <div key={k} className="p-2 rounded-xl bg-surface-container-high text-center">
            <p className="text-base font-bold text-on-surface leading-tight">{fmt(t[k])}</p>
            <p className="text-[10px] text-on-surface-variant">{l}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
        <span className="text-on-surface-variant">Chiffre d'affaires généré · conversion {t.conversion_rate || 0}%</span>
        <span className="font-bold text-emerald-600 dark:text-emerald-400">{fmt(t.revenue)} {cur}</span>
      </div>

      {products.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-bold text-on-surface-variant uppercase">Par produit</p>
          {products.slice(0, 8).map((p) => (
            <div key={p.product_id} className="flex items-center gap-2 p-2 rounded-lg bg-surface-container-high text-[11px]">
              <span className="font-semibold text-on-surface flex-1 truncate">{p.product_name}</span>
              <span className="text-on-surface-variant">{fmt(p.views)} vues · {fmt(p.orders)} cmd · <b className="text-on-surface">{fmt(p.purchases)} achats</b> · {fmt(p.revenue)} {cur}</span>
            </div>
          ))}
        </div>
      )}
      {networks.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-bold text-on-surface-variant uppercase">Par réseau</p>
          {networks.map((n) => (
            <div key={n.network} className="flex items-center gap-2 p-2 rounded-lg bg-surface-container-high text-[11px]">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: n.color }} />
              <span className="font-semibold text-on-surface flex-1 truncate">{n.network_label}</span>
              <span className="text-on-surface-variant">{fmt(n.views)} vues · {fmt(n.intents)} int. · {fmt(n.orders)} cmd · <b className="text-on-surface">{fmt(n.purchases)} achats</b></span>
            </div>
          ))}
        </div>
      )}
      {stats && products.length === 0 && networks.length === 0 && (
        <div className="p-4 text-center text-xs text-on-surface-variant rounded-xl border border-dashed border-white/10">Aucune publicité pour l'instant : ouvrez la vitrine et touchez « Promouvoir sur les réseaux » sur un produit.</div>
      )}
    </section>
  );
}
