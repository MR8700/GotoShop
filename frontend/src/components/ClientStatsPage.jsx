import Icon from "./Icon";
import React, { useState, useEffect } from "react";
import { fetchCustomerStats, dataCache, getCustomerToken, fetchLoyaltySummary } from "../api/client";

const fmtPts = (n) => Number(n || 0).toLocaleString("fr-FR", { maximumFractionDigits: 1 });

export default function ClientStatsPage({ customer, onOpenAuth, onNavigateToShop, showToast }) {
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

  const loadSummary = async () => {
    try {
      const data = await fetchLoyaltySummary();
      if (data) setSummary(data);
    } catch {
      /* le bloc de rachat reste simplement masqué */
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
    } else {
      setLoading(false);
    }

    const handleStatsChange = () => {
      if (customer) {
        loadStats(true);
        loadSummary();
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

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto space-y-5 pt-12 pb-32">
        <div className="w-16 h-16 rounded-full bg-secondary/20 text-secondary flex items-center justify-center shadow-lg animate-pulse">
          <Icon name="stars" className="text-[32px]" />
        </div>
        <div className="space-y-2">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">
            Rejoignez le Club Privilège Awa
          </h2>
          <p className="font-body-md text-on-surface-variant text-sm leading-relaxed">
            Merci pour votre fidélité ! ✨ Cumulez des points à chaque commande confirmée, profitez de remises flash exclusives et d'un traitement prioritaire.
          </p>
        </div>
        <button
          onClick={onOpenAuth}
          className="w-full h-12 rounded-xl bg-primary-container text-on-primary-container font-label-lg font-bold shadow-md hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2"
        >
          <Icon name="flash_on" className="text-[20px]" />
          <span>Activer mes Avantages (3s)</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full gap-6 max-w-2xl sm:max-w-3xl mx-auto pb-32">
      {/* Header */}
      <div className="flex items-center justify-between px-space-xs pt-1">
        <div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Mes Avantages & Fidélité</h2>
          <p className="text-xs text-on-surface-variant">Espace Privilège Membre</p>
        </div>
      </div>

      {/* Digital Loyalty Card */}
      <div className="relative overflow-hidden rounded-3xl bg-surface-container border border-primary/25 p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="workspace_premium" className="text-[24px] text-primary" />
            <span className="font-headline-sm text-xs font-bold uppercase tracking-widest text-on-surface">
              Awa Club Privilège
            </span>
          </div>
          <span className="text-xs font-mono font-bold text-on-surface-variant">
            ID: {customer.id.slice(0, 8).toUpperCase()}
          </span>
        </div>

        <div className="pt-2">
          <p className="text-xs text-on-surface-variant font-medium">Titulaire de la carte</p>
          <h3 className="font-headline-sm text-xl font-bold text-on-surface">{customer.name}</h3>
        </div>

        <div className="flex items-end justify-between pt-1">
          <div>
            <p className="text-[11px] text-on-surface-variant uppercase font-semibold">Solde Points</p>
            <p className="text-2xl font-bold text-on-surface tabular-nums">
              {fmtPts(stats?.loyalty_points)} <span className="text-xs font-normal text-secondary">pts</span>
            </p>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-on-surface-variant uppercase font-semibold block">Prochain gain</span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full border inline-block bg-primary/15 text-primary border-primary/30">
              +{fmtPts(summary?.next_gain ?? 0.5)} pt
            </span>
          </div>
        </div>

        {summary && (
          <div className="space-y-1.5 pt-2 border-t border-white/10">
            <div className="flex justify-between text-[11px] text-on-surface-variant font-medium">
              <span>Encore {summary.payments_before_increase} paiement(s) avant +{fmtPts(summary.gain_after_increase)} pt par paiement</span>
              <span>{summary.payments_counted} validé(s)</span>
            </div>
            <div className="w-full h-2 rounded-full bg-surface-container-highest overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
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
