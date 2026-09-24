import Icon from "./Icon";
import React, { useState, useEffect } from "react";
import { fetchCustomerStats } from "../api/client";

export default function ClientStatsPage({ customer, onOpenAuth, onNavigateToShop, showToast }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (customer) {
      loadStats();
    } else {
      setLoading(false);
    }
  }, [customer]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await fetchCustomerStats();
      setStats(data);
    } catch {
      showToast("Erreur de chargement de vos avantages");
    } finally {
      setLoading(false);
    }
  };

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

  const tierBadge =
    stats?.loyalty_tier === "Gold VIP"
      ? "bg-amber-500/15 text-amber-300 border-amber-400/30"
      : stats?.loyalty_tier === "Silver"
      ? "bg-slate-400/15 text-slate-200 border-slate-300/30"
      : "bg-primary/15 text-primary border-primary/30";

  return (
    <div className="flex flex-col w-full gap-space-md max-w-lg mx-auto pb-32">
      {/* Header */}
      <div className="flex items-center justify-between px-space-xs pt-1">
        <div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Mes Avantages & Fidélité</h2>
          <p className="text-xs text-on-surface-variant">Espace Privilège Membre</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 border ${tierBadge}`}>
          <Icon name="verified" className="text-[15px]" />
          {stats?.loyalty_tier || "Bronze"}
        </span>
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
              {stats?.loyalty_points || 0} <span className="text-xs font-normal text-secondary">pts</span>
            </p>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-on-surface-variant uppercase font-semibold block">Statut</span>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border inline-block ${tierBadge}`}>{stats?.loyalty_tier || "Bronze"}</span>
          </div>
        </div>

        {/* Progress bar to next tier */}
        {stats?.next_tier && (
          <div className="space-y-1.5 pt-2 border-t border-white/10">
            <div className="flex justify-between text-[11px] text-on-surface-variant font-medium">
              <span>Prochain niveau : {stats.next_tier}</span>
              <span>{stats.next_tier_progress}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-surface-container-highest overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${stats.next_tier_progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

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

      {/* Member Benefits List & Tiers from Store */}
      <div className="rounded-2xl bg-surface-container p-4 shadow-md border border-white/5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-headline-sm text-sm font-bold text-on-surface flex items-center gap-2">
            <Icon name="redeem" className="text-[20px] text-secondary" />
            Paliers & Privilèges Définis par la Boutique
          </h3>
          <span className="text-[11px] text-on-surface-variant font-mono">
            1 pt / {(stats?.loyalty_spend_per_point || 1000).toLocaleString()} {stats?.currency || "FCFA"}
          </span>
        </div>

        {stats?.all_tiers && stats.all_tiers.length > 0 ? (
          <div className="space-y-3">
            {stats.all_tiers.map((tier) => {
              const currentPoints = stats?.loyalty_points || 0;
              const isUnlocked = currentPoints >= tier.min_points;
              const pointsNeeded = tier.min_points - currentPoints;

              return (
                <div
                  key={tier.id}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    isUnlocked
                      ? "bg-secondary/10 border-secondary/40 shadow-sm"
                      : "bg-surface-container-high/60 border-white/5 opacity-80"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon name={isUnlocked ? "verified" : "lock"} className={`text-[20px] ${ isUnlocked ? "text-secondary" : "text-on-surface-variant" }`} />
                        <h4 className="font-headline-sm text-sm font-bold text-on-surface">
                          {tier.name}
                        </h4>
                        {tier.badge_label && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-on-surface-variant">
                            {tier.badge_label}
                          </span>
                        )}
                      </div>

                      <p className="font-bold text-xs text-primary flex items-center gap-1.5 pt-0.5">
                        <span>{tier.perk_title}</span>
                        {tier.discount_percent > 0 && (
                          <span className="px-1.5 py-0.2 rounded bg-primary/20 text-primary font-mono text-[10px]">
                            -{tier.discount_percent}% remise
                          </span>
                        )}
                      </p>

                      {tier.perk_description && (
                        <p className="text-[11px] text-on-surface-variant leading-relaxed">
                          {tier.perk_description}
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      {isUnlocked ? (
                        <span className="px-2 py-1 rounded-full bg-secondary/20 text-secondary text-[10px] font-bold inline-block">
                          Débloqué ✅
                        </span>
                      ) : (
                        <div className="text-right">
                          <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[10px] font-medium block">
                            Dès {tier.min_points} pts
                          </span>
                          <span className="text-[10px] text-primary font-semibold block mt-0.5">
                            encore {pointsNeeded} pts
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2.5 text-xs">
            <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-surface-container-high/60 border border-white/5">
              <Icon name="bolt" className="text-secondary text-[18px] shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-on-surface">Traitement & Expédition Prioritaire</p>
                <p className="text-on-surface-variant text-[11px]">
                  Vos commandes sont traitées en tête de file pour une livraison ultra-rapide.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-surface-container-high/60 border border-white/5">
              <Icon name="loyalty" className="text-primary text-[18px] shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-on-surface">Points Convertibles en Réductions</p>
                <p className="text-on-surface-variant text-[11px]">
                  Chaque tranche de {(stats?.loyalty_spend_per_point || 1000).toLocaleString()} {stats?.currency || "FCFA"} dépensée vous rapporte 1 point de fidélité.
                </p>
              </div>
            </div>
          </div>
        )}
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
