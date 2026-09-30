import Icon from "./Icon";
import React, { useState, useEffect } from "react";
import {
  fetchCustomerStats,
  dataCache,
  getCustomerToken,
  fetchLoyaltySummary,
  fetchCustomerLoyaltyCards,
} from "../api/client";

const fmtPts = (n) => Number(n || 0).toLocaleString("fr-FR", { maximumFractionDigits: 1 });

export default function ClientStatsPage({ customer, store, onOpenAuth, onNavigateToShop, showToast }) {
  const [stats, setStats] = useState(() => {
    const token = customer?.session_token || getCustomerToken();
    return token ? dataCache.get(`customer:stats:${token}`) || null : null;
  });
  const [loading, setLoading] = useState(() => {
    const token = customer?.session_token || getCustomerToken();
    const cached = token ? dataCache.get(`customer:stats:${token}`) : null;
    return !cached && !!customer;
  });

  const [summary, setSummary] = useState(null);
  const [loyaltyCards, setLoyaltyCards] = useState([]);
  const [selectedCardIndex, setSelectedCardIndex] = useState(0);

  const loadSummary = async () => {
    try {
      const data = await fetchLoyaltySummary();
      if (data) setSummary(data);
    } catch {
      /* le bloc de rachat reste simplement masqué */
    }
  };

  const loadCards = async () => {
    try {
      const cards = await fetchCustomerLoyaltyCards();
      if (Array.isArray(cards) && cards.length > 0) {
        setLoyaltyCards(cards);
        if (store?.id) {
          const matchIdx = cards.findIndex(
            (c) => c.store_id === store.id || (store.slug && c.store_slug === store.slug)
          );
          if (matchIdx !== -1) {
            setSelectedCardIndex(matchIdx);
          }
        }
      }
    } catch {
      /* fallback silently */
    }
  };

  const loadStats = async (force = false) => {
    if (!stats) {
      setLoading(true);
    }
    try {
      const data = await fetchCustomerStats({ force });
      if (data) {
        setStats(data);
      }
    } catch {
      if (!stats) {
        showToast("Erreur de chargement de vos avantages");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (customer) {
      loadStats(false);
      loadSummary();
      loadCards();
    } else {
      setLoading(false);
    }

    const handleStatsChange = () => {
      if (customer) {
        loadStats(true);
        loadSummary();
        loadCards();
      }
    };

    window.addEventListener("gotoshop:stats_updated", handleStatsChange);
    window.addEventListener("gotoshop:order_created", handleStatsChange);
    window.addEventListener("gotoshop:order_updated", handleStatsChange);
    window.addEventListener("gotoshop:customer_updated", handleStatsChange);

    return () => {
      window.removeEventListener("gotoshop:stats_updated", handleStatsChange);
      window.removeEventListener("gotoshop:order_created", handleStatsChange);
      window.removeEventListener("gotoshop:order_updated", handleStatsChange);
      window.removeEventListener("gotoshop:customer_updated", handleStatsChange);
    };
  }, [customer]);

  const activeCard = loyaltyCards[selectedCardIndex] || null;
  const clubName = activeCard?.store_name
    ? `Club Privilège ${activeCard.store_name}`
    : store?.name
    ? `Club Privilège ${store.name}`
    : "Club Privilège GotoShop";

  const cardPoints = activeCard?.points ?? stats?.loyalty_points ?? 0;
  const cardTier =
    activeCard?.tier_name ||
    (cardPoints >= 400 ? "Platine" : cardPoints >= 150 ? "Or" : cardPoints >= 50 ? "Argent" : "Bronze");

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto space-y-5 pt-12 pb-32">
        <div className="w-16 h-16 rounded-full bg-secondary/20 text-secondary flex items-center justify-center shadow-lg animate-pulse">
          <Icon name="stars" className="text-[32px]" />
        </div>
        <div className="space-y-2">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">
            Rejoignez le {clubName}
          </h2>
          <p className="font-body-md text-on-surface-variant text-sm leading-relaxed">
            Merci pour votre fidélité ! ✨ Cumulez des points à chaque commande confirmée, profitez de remises directes exclusives et d'un traitement prioritaire.
          </p>
        </div>
        <button
          onClick={onOpenAuth}
          className="w-full h-12 rounded-xl bg-primary-container text-on-primary-container font-label-lg font-bold shadow-md hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Icon name="flash_on" className="text-[20px]" />
          <span>Activer mes Avantages (3s)</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full gap-5 sm:gap-6 max-w-2xl sm:max-w-3xl mx-auto pb-32">
      {/* Header */}
      <div className="flex items-center justify-between px-space-xs pt-1">
        <div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Mes Avantages & Fidélité</h2>
          <p className="text-xs text-on-surface-variant">{clubName} • Espace Privilège Membre</p>
        </div>
      </div>

      {/* Multi-Store Cards Selector */}
      {loyaltyCards.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {loyaltyCards.map((c, idx) => {
            const isSelected = selectedCardIndex === idx;
            return (
              <button
                key={c.card_number || idx}
                type="button"
                onClick={() => setSelectedCardIndex(idx)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer border ${
                  isSelected
                    ? "bg-amber-500 text-white border-amber-600 shadow-xs font-bold"
                    : "bg-surface-secondary text-on-surface-variant hover:text-on-surface border-subtle"
                }`}
              >
                <Icon name="badge" className="text-[15px]" />
                <span>{c.store_name || `Boutique #${idx + 1}`}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected ? "bg-white/20 text-white" : "bg-black/10 dark:bg-white/10"
                  }`}
                >
                  {c.points || 0} pts
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Realistic 3D-styled Digital Loyalty Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 border border-amber-500/30 p-6 shadow-2xl space-y-4 text-white">
        {/* Hologram & Sheen overlays */}
        <div className="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-gradient-to-br from-amber-400/20 via-primary/10 to-transparent blur-2xl pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-400/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shadow-xs">
              <Icon name="workspace_premium" className="text-[20px]" />
            </div>
            <span className="font-bold text-xs uppercase tracking-widest text-amber-200">
              {clubName}
            </span>
          </div>
          <span className="text-[11px] font-mono font-bold text-slate-300 px-2 py-0.5 rounded-md bg-white/10 border border-white/15">
            ID: {activeCard?.card_number || (customer.id ? customer.id.slice(0, 8).toUpperCase() : "GOTO-CARD")}
          </span>
        </div>

        {/* EMV Gold Chip Visual */}
        <div className="relative z-10 flex items-center gap-3 pt-1">
          <div className="w-11 h-8 rounded-md bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-600 border border-amber-300 shadow-sm relative overflow-hidden flex items-center justify-center">
            <div className="w-full h-[1px] bg-amber-800/40 absolute top-2.5" />
            <div className="w-full h-[1px] bg-amber-800/40 absolute bottom-2.5" />
            <div className="h-full w-[1px] bg-amber-800/40 absolute left-3.5" />
            <div className="h-full w-[1px] bg-amber-800/40 absolute right-3.5" />
            <div className="w-3.5 h-3 rounded-xs border border-amber-800/40" />
          </div>
          <Icon name="contactless" className="text-slate-400 text-[20px]" />
        </div>

        <div className="relative z-10 pt-1">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Titulaire de la carte</p>
          <h3 className="font-bold text-lg text-white tracking-wide">{customer.name}</h3>
        </div>

        <div className="relative z-10 flex items-end justify-between pt-1">
          <div>
            <p className="text-[10px] text-amber-300/80 uppercase font-semibold">Solde Points</p>
            <p className="text-2xl font-black text-amber-400 tabular-nums">
              {fmtPts(cardPoints)} <span className="text-xs font-semibold text-amber-200/80">pts</span>
            </p>
            <span className="text-[10px] text-slate-300 font-medium">
              Palier : <strong className="text-amber-300">{cardTier}</strong>
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Prochain gain</span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full border inline-block bg-primary/20 text-primary border-primary/40">
              +{fmtPts(summary?.next_gain ?? 0.5)} pt
            </span>
          </div>
        </div>

        {summary && (
          <div className="relative z-10 space-y-1.5 pt-2 border-t border-white/10">
            <div className="flex justify-between text-[11px] text-slate-300 font-medium">
              <span>Encore {summary.payments_before_increase} commande(s) avant +{fmtPts(summary.gain_after_increase)} pt par commande livrée</span>
              <span>{summary.payments_counted} validée(s)</span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-primary rounded-full transition-all duration-500"
                style={{ width: `${((3 - summary.payments_before_increase) / 3) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Mes points : dépensés sur UN produit au moment de la commande */}
      {summary && stats?.is_loyalty_active !== false && (
        <div className="rounded-2xl bg-surface-container p-4 shadow-md border border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-headline-sm text-sm font-bold text-on-surface flex items-center gap-2">
              <Icon name="redeem" className="text-[20px] text-secondary" />
              Utiliser mes points
            </h3>
            <span className="text-[11px] text-on-surface-variant font-mono">1 pt = 1 % de remise</span>
          </div>

          <p className="text-xs text-on-surface-variant">
            Solde disponible : <span className="font-bold text-on-surface tabular-nums">{fmtPts(summary.balance)} pt</span>
            {summary.balance > 0 && (
              <> · sur un produit à 20 000 F : <span className="font-bold text-secondary">-{Math.floor((20000 * Math.min(summary.balance, summary.max_points_per_use)) / 100).toLocaleString("fr-FR")} F</span></>
            )}
          </p>

          <ul className="text-[11px] text-on-surface-variant space-y-1 list-disc pl-4">
            <li>À la commande, choisissez <b>un seul produit</b> et le nombre de points à y consacrer (par pas de 0,1).</li>
            <li>La remise s'applique à <b>une unité</b> du produit choisi. Maximum {fmtPts(summary.max_points_per_use)} pt par utilisation.</li>
            <li>Vos points ne s'utilisent pas avec un coupon, et ceux gagnés par une commande servent dès sa livraison.</li>
            <li>Une commande compte à partir de {Number(summary.min_order_fcfa).toLocaleString("fr-FR")} F, un paiement par boutique et par jour.</li>
          </ul>

          <button
            type="button"
            onClick={onNavigateToShop}
            className="w-full h-11 rounded-xl bg-primary-container text-on-primary-container font-bold text-sm flex items-center justify-center gap-2"
          >
            <Icon name="storefront" className="text-[18px]" />
            <span>Choisir un produit</span>
          </button>

          {summary.coupons?.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-white/10">
              <p className="text-[11px] uppercase font-semibold text-on-surface-variant">Mes bons actifs (anciens échanges)</p>
              {summary.coupons.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-xs text-on-surface">
                  <span className="font-mono font-bold">{c.code}</span>
                  <span className="text-on-surface-variant">
                    {c.discount_amount > 0 ? `${c.discount_amount.toLocaleString()} FCFA` : `${c.discount_percent}%`}
                    {c.expires_at ? ` · jusqu'au ${new Date(c.expires_at).toLocaleDateString("fr-FR")}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats KPI Tiles */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl bg-surface-container shadow-md border border-white/5 space-y-1">
          <div className="w-8 h-8 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center mb-2">
            <Icon name="payments" className="text-[18px]" />
          </div>
          <p className="text-xs text-on-surface-variant">Total Achats Conclus</p>
          <p className="text-lg font-bold text-primary tabular-nums">
            {(stats?.total_spent || 0).toLocaleString()} <span className="text-xs">{stats?.currency || "FCFA"}</span>
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-surface-container shadow-md border border-white/5 space-y-1">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center mb-2">
            <Icon name="savings" className="text-[18px]" />
          </div>
          <p className="text-xs text-on-surface-variant">Économies Ventes Flash</p>
          <p className="text-lg font-bold text-emerald-400 tabular-nums">
            {(stats?.savings_amount || 0).toLocaleString()} <span className="text-xs">{stats?.currency || "FCFA"}</span>
          </p>
        </div>
      </div>

      {/* Loyalty Status Warning if inactive */}
      {stats?.is_loyalty_active === false && (
        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
          <Icon name="info" className="text-[18px]" />
          <span>Le programme de fidélité est actuellement suspendu par la boutique.</span>
        </div>
      )}

      {/* Progression des gains par paiement */}
      <div className="rounded-2xl bg-surface-container p-4 shadow-md border border-white/5 space-y-3">
        <h3 className="font-headline-sm text-sm font-bold text-on-surface flex items-center gap-2">
          <Icon name="trending_up" className="text-[20px] text-secondary" />
          Plus vous commandez, plus vous gagnez
        </h3>
        <p className="text-[11px] text-on-surface-variant">
          Chaque paiement validé rapporte des points, et le gain monte tous les 3 paiements. Vos points s'accumulent tant que vous ne les utilisez pas.
        </p>
        <div className="space-y-1.5">
          {[0, 1, 2, 3, 4, 5].map((k) => {
            const from = k === 0 ? 1 : 3 * k;
            const to = 3 * k + 2;
            const current = summary ? Math.floor((summary.payments_counted + 1) / 3) === k : k === 0;
            return (
              <div
                key={k}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs border ${
                  current ? "bg-secondary/10 border-secondary/40 font-bold text-on-surface" : "bg-surface-container-high/60 border-white/5 text-on-surface-variant"
                }`}
              >
                <span>Paiements {from} à {to}</span>
                <span className="tabular-nums">+{fmtPts((5 + k) / 10)} pt{current ? " · vous êtes ici" : ""}</span>
              </div>
            );
          })}
          <p className="text-[11px] text-on-surface-variant pt-1">Et ainsi de suite : +0,1 pt de gain tous les 3 paiements.</p>
        </div>
      </div>

      <button
        onClick={onNavigateToShop}
        className="w-full h-12 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md font-bold flex items-center justify-center gap-2 transition-colors tap-scale cursor-pointer"
      >
        <Icon name="storefront" className="text-[18px]" />
        <span>Continuer mes achats pour cumuler des points</span>
      </button>
    </div>
  );
}
