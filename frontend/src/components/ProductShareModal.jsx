import Icon from "./Icon";
import React, { useState, useEffect, useCallback } from "react";
import { createProductShareLink, fetchShareStats, shareLinkUrl, getMediaUrl } from "../api/client";

const enc = encodeURIComponent;
// open(url, text) : adresse de partage du réseau. null = pas de bouton de partage web : on copie le lien à coller dans la bio, la story ou un message.
const NETWORKS = [
  { id: "whatsapp", label: "WhatsApp", icon: "chat", color: "#25D366", open: (u, t) => `https://wa.me/?text=${enc(`${t} ${u}`)}` },
  { id: "facebook", label: "Facebook", icon: "forum", color: "#1877F2", open: (u) => `https://www.facebook.com/sharer/sharer.php?u=${enc(u)}` },
  { id: "instagram", label: "Instagram", icon: "photo_camera", color: "#E1306C", open: null, hint: "Copiez le lien, puis collez-le dans votre bio, une story (autocollant lien) ou un message." },
  { id: "tiktok", label: "TikTok", icon: "smart_display", color: "#FE2C55", open: null, hint: "Copiez le lien, puis collez-le dans votre bio ou la description de votre vidéo." },
  { id: "telegram", label: "Telegram", icon: "send", color: "#229ED9", open: (u, t) => `https://t.me/share/url?url=${enc(u)}&text=${enc(t)}` },
  { id: "x", label: "X (Twitter)", icon: "alternate_email", color: "#9ca3af", open: (u, t) => `https://twitter.com/intent/tweet?text=${enc(t)}&url=${enc(u)}` },
  { id: "snapchat", label: "Snapchat", icon: "photo_camera", color: "#FFFC00", open: null, hint: "Copiez le lien, puis collez-le dans un snap ou un message." },
  { id: "linkedin", label: "LinkedIn", icon: "work", color: "#0A66C2", open: (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${enc(u)}` },
  { id: "sms", label: "SMS", icon: "sms", color: "#10b981", open: (u, t) => `sms:?&body=${enc(`${t} ${u}`)}` },
  { id: "email", label: "E-mail", icon: "mail", color: "#6366f1", open: (u, t) => `mailto:?subject=${enc(t)}&body=${enc(`${t}\n${u}`)}` },
  { id: "qr", label: "QR / affiche", icon: "qr_code_2", color: "#f59e0b", open: null, hint: "Copiez le lien pour générer un QR code à imprimer sur une affiche ou un flyer." },
  { id: "other", label: "Autre réseau", icon: "link", color: "#94a3b8", open: null, hint: "Un lien distinct est suivi séparément : utilisez-le sur le réseau ou le support de votre choix." },
];
const PERIODS = [{ d: 7, l: "7 j" }, { d: 30, l: "30 j" }, { d: null, l: "Tout" }];
const fmt = (n) => Number(n || 0).toLocaleString("fr-FR");

export default function ProductShareModal({ store, product, onClose, showToast }) {
  const currency = product?.currency || store?.currency || "FCFA";
  const [network, setNetwork] = useState("whatsapp");
  const [link, setLink] = useState(null);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState(`${product?.name} — ${fmt(product?.price)} ${currency} chez ${store?.name}. Commandez en ligne !`);
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState("");

  const net = NETWORKS.find((n) => n.id === network) || NETWORKS[0];
  const url = link ? shareLinkUrl(link.code) : "";

  useEffect(() => {
    let alive = true;
    setLink(null);
    setBusy(true);
    createProductShareLink(store.id, product.id, network)
      .then((l) => { if (alive) setLink(l); })
      .catch((e) => { if (alive) showToast?.(e.message || "Erreur de création du lien"); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [store.id, product.id, network]);

  const loadStats = useCallback(async () => {
    try {
      setStatsError("");
      setStats(await fetchShareStats(store.id, { productId: product.id, days }));
    } catch (e) {
      setStatsError(e.message || "Résultats indisponibles");
    }
  }, [store.id, product.id, days]);
  useEffect(() => { loadStats(); }, [loadStats, link?.code]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); showToast?.(`Lien ${net.label} copié`); }
    catch  { window.prompt("Copiez ce lien :", url); }
  };
  const share = () => {
    if (!url) return;
    if (net.open) { window.open(net.open(url, text), "_blank", "noopener"); return; }
    if (navigator.share) { navigator.share({ title: product.name, text, url }).catch(() => {}); return; }
    copy();
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const t = stats?.totals || {};
  const kpis = [
    { k: "views", l: "Vues", i: "visibility" }, { k: "intents", l: "Intentions", i: "touch_app" },
    { k: "orders", l: "Commandes", i: "shopping_bag" }, { k: "purchases", l: "Achats", i: "paid" },
  ];

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-fadeIn"
    >
      <div className="bg-surface-container-high rounded-2xl p-4 max-w-md w-full shadow-2xl border border-outline-variant/30 max-h-[92vh] overflow-y-auto space-y-4">
        <div className="flex items-center gap-3">
          {product?.primary_image_url && <img src={getMediaUrl(product.primary_image_url)} alt="" className="w-12 h-12 rounded-lg object-cover" />}
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-sm text-on-surface truncate">Promouvoir : {product?.name}</h3>
            <p className="text-[11px] text-on-surface-variant">{fmt(product?.price)} {currency} · un lien suivi par réseau</p>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="w-8 h-8 rounded-full bg-surface-container-highest text-on-surface flex items-center justify-center cursor-pointer hover:bg-surface-container transition-colors">
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>

        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {NETWORKS.map((n) => (
            <button key={n.id} type="button" onClick={() => setNetwork(n.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-colors ${network === n.id ? "bg-surface-container-highest text-on-surface ring-1 ring-primary font-bold shadow-sm" : "bg-surface-container text-on-surface-variant hover:text-on-surface"}`}>
              <Icon name={n.icon} className="text-[16px]" style={{ color: n.color }} />
              <span>{n.label}</span>
            </button>
          ))}
        </div>

        <div className="p-3 rounded-xl bg-surface-container space-y-2.5">
          <label className="text-[11px] font-bold text-on-surface-variant uppercase block">Message</label>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2}
            className="w-full px-3 py-2 rounded-lg bg-surface-container-high border border-outline-variant/30 text-xs text-on-surface focus:outline-none focus:border-primary" />
          <div className="p-2 rounded-lg bg-surface-container-lowest border border-outline-variant/20 flex items-center gap-2 min-w-0">
            <Icon name="link" className="text-secondary text-[16px]" />
            <span className="font-mono text-[11px] text-on-surface-variant truncate flex-1">{busy ? "Création du lien…" : url || "—"}</span>
            <button type="button" onClick={copy} disabled={!url} className="px-2.5 py-1 rounded-md bg-surface-container-high text-primary text-xs font-bold disabled:opacity-40 cursor-pointer hover:bg-surface-container transition-colors">Copier</button>
          </div>
          {net.hint && <p className="text-[11px] text-on-surface-variant">{net.hint}</p>}
          <button type="button" onClick={share} disabled={!url}
            className="w-full h-11 rounded-xl bg-primary text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer hover:brightness-105 active:scale-[0.99] transition-all">
            <Icon name={net.open ? "send" : "share"} className="text-[18px]" />
            <span>{net.open ? `Partager sur ${net.label}` : "Partager / copier le lien"}</span>
          </button>
          <p className="text-[10px] text-on-surface-variant">L'aperçu (photo, nom, prix) s'affiche automatiquement dans WhatsApp, Facebook, Telegram…</p>
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-on-surface flex items-center gap-1.5"><Icon name="insights" className="text-[16px] text-primary" />Résultats de ce produit</h4>
            <div className="flex gap-1">
              {PERIODS.map((p) => (
                <button key={p.l} type="button" onClick={() => setDays(p.d)}
                  className={`px-2 h-7 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${days === p.d ? "bg-primary text-white" : "bg-surface-container text-on-surface-variant hover:text-on-surface"}`}>{p.l}</button>
              ))}
            </div>
          </div>
          {statsError && <p className="text-[11px] text-rose-600 dark:text-rose-400">{statsError}</p>}
          <div className="grid grid-cols-4 gap-1.5">
            {kpis.map((x) => (
              <div key={x.k} className="p-2 rounded-xl bg-surface-container text-center">
                <Icon name={x.i} className="text-[15px] text-on-surface-variant" />
                <p className="text-base font-bold text-on-surface leading-tight">{fmt(t[x.k])}</p>
                <p className="text-[10px] text-on-surface-variant">{x.l}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
            <span className="text-on-surface-variant">Chiffre d'affaires généré</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">{fmt(t.revenue)} {stats?.currency || currency}</span>
          </div>
          {(stats?.networks || []).filter((n) => n.views || n.orders || n.clicks).length > 0 && (
            <div className="space-y-1">
              {stats.networks.filter((n) => n.views || n.orders || n.clicks).map((n) => (
                <div key={n.network} className="flex items-center gap-2 p-2 rounded-lg bg-surface-container text-[11px]">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: n.color }} />
                  <span className="font-semibold text-on-surface flex-1 truncate">{n.network_label}</span>
                  <span className="text-on-surface-variant">{fmt(n.views)} vues · {fmt(n.intents)} int. · {fmt(n.orders)} cmd · <b className="text-on-surface">{fmt(n.purchases)} achats</b></span>
                </div>
              ))}
            </div>
          )}
          {stats && (t.clicks || 0) + (t.views || 0) === 0 && <p className="text-[11px] text-on-surface-variant text-center">Pas encore de visite : partagez le lien pour voir les résultats ici.</p>}
        </div>
      </div>
    </div>
  );
}
