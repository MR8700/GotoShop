import Icon from "./Icon";
import React, { useState, useEffect, useMemo } from "react";
import {
  fetchCustomerStats,
  dataCache,
  getCustomerToken,
  fetchLoyaltySummary,
  fetchCustomerLoyaltyCards,
} from "../api/client";

const fmtPts = (n) => Number(n || 0).toLocaleString("fr-FR", { maximumFractionDigits: 1 });

export default function ClientStatsPage({
  customer,
  store,
  viewMode = "explorer",
  isInsideStore = false,
  onOpenAuth,
  onNavigateToShop,
  showToast,
}) {
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
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [isFlipped, setIsFlipped] = useState(false);

  const loadSummary = async () => {
    try {
      const data = await fetchLoyaltySummary();
      if (data) setSummary(data);
    } catch {
      /* fallback silently */
    }
  };

  const loadCards = async () => {
    try {
      const cards = await fetchCustomerLoyaltyCards();
      if (Array.isArray(cards) && cards.length > 0) {
        setLoyaltyCards(cards);
        if (isInsideStore && store?.id) {
          const matchIdx = cards.findIndex(
            (c) => c.store_id === store.id || (store.slug && c.store_slug === store.slug)
          );
          if (matchIdx !== -1) {
            setSelectedCardIndex(matchIdx);
          }
        }
      } else {
        setLoyaltyCards([]);
      }
    } catch {
      setLoyaltyCards([]);
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
        showToast?.("Erreur de chargement de vos avantages");
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

  // Categories derivation
  const categories = useMemo(() => {
    const set = new Set();
    loyaltyCards.forEach((c) => {
      const cat = c.category || c.store?.category || "Commerce Général";
      if (cat) set.add(cat);
    });
    return ["ALL", ...Array.from(set)];
  }, [loyaltyCards]);

  // Filter cards by category
  const filteredCards = useMemo(() => {
    if (selectedCategory === "ALL") return loyaltyCards;
    return loyaltyCards.filter(
      (c) => (c.category || c.store?.category || "Commerce Général") === selectedCategory
    );
  }, [loyaltyCards, selectedCategory]);

  const activeCard = filteredCards[selectedCardIndex] || filteredCards[0] || null;

  // Header display name
  const clubName = isInsideStore && store?.name
    ? `Club Privilège ${store.name}`
    : activeCard?.store?.name
    ? `Club Privilège ${activeCard.store.name}`
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
          className="gs-3d-btn gs-3d-btn--primary w-full h-12 rounded-xl text-white font-bold text-sm shadow-md hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Icon name="flash_on" className="text-[20px]" />
          <span>Activer mes Avantages (3s)</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full gap-5 sm:gap-6 max-w-2xl sm:max-w-3xl mx-auto pb-32 animate-fadeIn">
      {/* Header Profile Bar */}
      <div className="flex items-center justify-between px-space-xs pt-1">
        <div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">
            Mes Avantages &amp; Fidélité
          </h2>
          <p className="text-xs text-on-surface-variant">
            {loyaltyCards.length > 0
              ? isInsideStore && store?.name
                ? `Club Privilège ${store.name} • Espace Privilège Membre`
                : `Cartes Débloquées (${loyaltyCards.length} boutique${loyaltyCards.length > 1 ? "s" : ""}) • Espace Privilège`
              : "Programme de fidélité, cashback & privilèges commerçants"}
          </p>
        </div>
        <button
          onClick={() => {
            loadCards();
            loadStats(true);
            loadSummary();
          }}
          className="w-9 h-9 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant flex items-center justify-center transition-transform active:scale-95 border border-slate-300 dark:border-slate-700 cursor-pointer"
          title="Actualiser"
        >
          <Icon name="refresh" className={`text-[18px] ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* CASE A: EMPTY CARDS STATE (NO ORDERS / NO CARDS YET) */}
      {loyaltyCards.length === 0 ? (
        <div className="space-y-5">
          {/* Main 3D Empty Card Notice */}
          <div className="gs-3d-panel rounded-3xl p-6 sm:p-8 bg-surface-container border-2 border-slate-200/90 dark:border-slate-800 text-center space-y-4 shadow-lg">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border-2 border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto shadow-md animate-pulse">
              <Icon name="card_membership" className="text-[34px]" />
            </div>

            <div className="space-y-2 max-w-lg mx-auto">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold text-xs mb-1">
                <span>Cartes accordées à la commande • 100% Automatique</span>
              </div>
              <h3 className="text-lg font-bold text-on-surface">
                Vous n'avez pas encore de carte de fidélité active
              </h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Vos cartes Club Privilège et vos points cashback sont accordés individuellement par chaque boutique partenaire. Dès que vous passez votre première commande ou activez un avantage de bienvenue, votre carte dédiée s'affichera ici instantanément !
              </p>
            </div>

            {/* Features & Advantages Explainer */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left pt-2 max-w-lg mx-auto">
              <div className="gs-3d-panel-sm p-3.5 rounded-2xl bg-surface-container-high/60 border border-slate-200 dark:border-slate-800 space-y-1">
                <div className="flex items-center gap-2 font-bold text-xs text-on-surface">
                  <Icon name="card_giftcard" className="text-primary text-[18px]" />
                  <span>Privilèges Nouveaux Clients</span>
                </div>
                <p className="text-[11px] text-on-surface-variant leading-snug">
                  Bénéficiez de remises immédiates, codes promo et ventes flash exclusifs offerts lors de votre 1ère visite.
                </p>
              </div>

              <div className="gs-3d-panel-sm p-3.5 rounded-2xl bg-surface-container-high/60 border border-slate-200 dark:border-slate-800 space-y-1">
                <div className="flex items-center gap-2 font-bold text-xs text-on-surface">
                  <Icon name="savings" className="text-emerald-500 text-[18px]" />
                  <span>Cashback &amp; Points Débloqués</span>
                </div>
                <p className="text-[11px] text-on-surface-variant leading-snug">
                  Chaque commande soldée vous crédite des points convertibles en réductions directes sur vos prochains achats.
                </p>
              </div>
            </div>

            {/* CTA to explore shops */}
            <div className="pt-3 max-w-sm mx-auto">
              <button
                type="button"
                onClick={onNavigateToShop}
                className="gs-3d-btn gs-3d-btn--primary w-full h-12 rounded-xl text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98 transition-all"
              >
                <Icon name="storefront" className="text-[20px]" />
                <span>Explorer les Boutiques &amp; Découvrir les Offres 🛍️</span>
              </button>
            </div>
          </div>

          {/* Grille des Paliers & Avantages Universels GotoShop */}
          <div className="gs-3d-panel-sm rounded-3xl p-5 bg-surface-container border-2 border-slate-200/90 dark:border-slate-800 space-y-3 shadow-sm">
            <div className="flex items-center gap-2">
              <Icon name="workspace_premium" className="text-amber-500 text-[20px]" />
              <h4 className="font-bold text-xs uppercase tracking-wider text-on-surface">
                Grille des Privilèges Universels GotoShop
              </h4>
            </div>
            <p className="text-xs text-on-surface-variant">
              Toutes vos boutiques partenaires suivent la même échelle de progression garantie :
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 rounded-xl border-2 bg-amber-950/40 border-amber-600/70 shadow-xs">
                <p className="font-bold text-amber-500">Bronze (0 pt)</p>
                <p className="text-[11px] text-on-surface-variant mt-0.5">Accès catalogue &amp; suivi 24h</p>
              </div>
              <div className="p-2.5 rounded-xl border-2 bg-slate-800/60 border-slate-300 shadow-xs">
                <p className="font-bold text-slate-300">Argent (50 pts)</p>
                <p className="text-[11px] text-on-surface-variant mt-0.5">-3% sur les commandes</p>
              </div>
              <div className="p-2.5 rounded-xl border-2 bg-amber-950/50 border-amber-400 shadow-xs">
                <p className="font-bold text-yellow-400">Or (150 pts)</p>
                <p className="text-[11px] text-on-surface-variant mt-0.5">-5% + support prioritaire</p>
              </div>
              <div className="p-2.5 rounded-xl border-2 bg-indigo-950/50 border-sky-400 shadow-xs">
                <p className="font-bold text-sky-300">Platine (400 pts)</p>
                <p className="text-[11px] text-on-surface-variant mt-0.5">-8% + livraisons express</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* CASE B: ACTIVE CARDS PRESENT */
        <div className="space-y-5">
          {/* Category Tabs (if multiple categories available) */}
          {categories.length > 2 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat;
                const count = cat === "ALL" ? loyaltyCards.length : loyaltyCards.filter((c) => (c.category || c.store?.category || "Commerce Général") === cat).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(cat);
                      setSelectedCardIndex(0);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer border ${
                      isSelected
                        ? "bg-primary text-white border-primary shadow-xs font-bold"
                        : "bg-surface-secondary text-on-surface-variant hover:text-on-surface border-subtle"
                    }`}
                  >
                    <span>{cat === "ALL" ? "Toutes les catégories" : cat}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isSelected ? "bg-white/20 text-white" : "bg-black/10 dark:bg-white/10"
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Multi-Store Cards Selector & Pagination Controls */}
          {filteredCards.length > 1 && (
            <div className="bg-surface-container rounded-2xl p-3 border-2 border-slate-200 dark:border-slate-800 shadow-[0_4px_15px_rgba(0,0,0,0.06)] flex items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedCardIndex(Math.max(0, selectedCardIndex - 1))}
                disabled={selectedCardIndex === 0}
                className="w-8 h-8 rounded-xl bg-surface-container-high hover:bg-surface-container-highest disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-on-surface transition-all active:scale-90 shrink-0 cursor-pointer"
                title="Carte précédente"
              >
                <Icon name="chevron_left" className="text-[20px]" />
              </button>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 min-w-0 flex-1 justify-center">
                <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider shrink-0 mr-1 hidden sm:flex items-center gap-1">
                  <Icon name="storefront" className="text-primary text-[15px]" />
                  <span>Boutiques ({filteredCards.length}) :</span>
                </span>
                {filteredCards.map((c, idx) => (
                  <button
                    key={c.card_number || idx}
                    type="button"
                    onClick={() => setSelectedCardIndex(idx)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                      selectedCardIndex === idx
                        ? "bg-primary text-white shadow-md ring-2 ring-primary/40 scale-102"
                        : "bg-surface-container-high/80 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest"
                    }`}
                  >
                    <span>{c.store?.name || c.store_name || `Boutique ${idx + 1}`}</span>
                    <span className="text-[10px] font-mono opacity-85">({fmtPts(c.points)} pt)</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] font-mono font-bold text-on-surface-variant bg-surface-container-highest px-2 py-1 rounded-lg">
                  {selectedCardIndex + 1}/{filteredCards.length}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedCardIndex(Math.min(filteredCards.length - 1, selectedCardIndex + 1))}
                  disabled={selectedCardIndex === filteredCards.length - 1}
                  className="w-8 h-8 rounded-xl bg-surface-container-high hover:bg-surface-container-highest disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-on-surface transition-all active:scale-90 shrink-0 cursor-pointer"
                  title="Carte suivante"
                >
                  <Icon name="chevron_right" className="text-[20px]" />
                </button>
              </div>
            </div>
          )}

          {/* 3D Realistic Physical Flip Card Container */}
          {activeCard && (
            <div className="bg-surface-container rounded-3xl p-4 sm:p-6 shadow-[0_12px_30px_-8px_rgba(0,0,0,0.15)] border-2 border-slate-200/90 dark:border-slate-800">
              <div className="flex items-center justify-between mb-3 text-xs">
                <span className="text-on-surface-variant font-medium flex items-center gap-1.5">
                  <Icon name="touch_app" className="text-[16px] text-primary" />
                  <span>Cliquez sur la carte pour voir le verso</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsFlipped(!isFlipped)}
                  className="text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Icon name="flip" className="text-[15px]" />
                  <span>{isFlipped ? "Afficher Recto" : "Afficher Verso"}</span>
                </button>
              </div>

              {/* Realistic 3D Card Scene */}
              <div
                className="relative w-full max-w-sm sm:max-w-md mx-auto aspect-[85.6/53.98] select-none group"
                style={{ perspective: "1400px" }}
              >
                <div
                  onClick={() => setIsFlipped(!isFlipped)}
                  className="relative w-full h-full cursor-pointer transition-transform duration-700 ease-out rounded-2xl shadow-[0_20px_45px_-12px_rgba(0,0,0,0.5),0_0_20px_rgba(234,179,8,0.12)] hover:shadow-[0_25px_50px_-10px_rgba(0,0,0,0.6),0_0_25px_rgba(234,179,8,0.2)] transition-shadow"
                  style={{
                    transformStyle: "preserve-3d",
                    transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                  }}
                  title="Cliquer pour retourner la carte"
                >
                  {/* Front Face */}
                  <div
                    className="absolute inset-0 w-full h-full rounded-2xl overflow-hidden border border-white/20 dark:border-white/10"
                    style={{
                      backfaceVisibility: "hidden",
                      background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #020617 100%)",
                    }}
                  >
                    {/* Metallic sheen overlay */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-amber-400/15 via-transparent to-primary/20 pointer-events-none" />
                    <div className="absolute -right-12 -top-12 w-44 h-44 rounded-full bg-amber-400/20 blur-2xl pointer-events-none" />

                    <div className="relative z-10 p-4 sm:p-5 h-full flex flex-col justify-between text-white">
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-amber-400/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0">
                            <Icon name="workspace_premium" className="text-[18px]" />
                          </div>
                          <div>
                            <p className="text-[11px] font-bold text-amber-300 tracking-wide uppercase truncate max-w-[170px] sm:max-w-[210px]">
                              {activeCard.store?.name || activeCard.store_name || "Club Privilège"}
                            </p>
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-white/10 text-slate-300 font-medium border border-white/15">
                              {activeCard.category || "Commerce Général"}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-slate-300 bg-black/40 px-2 py-0.5 rounded border border-white/15">
                          {activeCard.card_number_formatted || activeCard.card_number || "GOTO-CARD"}
                        </span>
                      </div>

                      {/* Gold Chip & Contactless */}
                      <div className="flex items-center gap-3 py-1">
                        <div className="w-9 h-7 rounded bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-600 border border-amber-300 shadow-sm relative overflow-hidden flex items-center justify-center">
                          <div className="w-full h-[1px] bg-amber-900/40 absolute top-2" />
                          <div className="w-full h-[1px] bg-amber-900/40 absolute bottom-2" />
                          <div className="h-full w-[1px] bg-amber-900/40 absolute left-3" />
                          <div className="h-full w-[1px] bg-amber-900/40 absolute right-3" />
                        </div>
                        <Icon name="contactless" className="text-slate-400 text-[18px]" />
                      </div>

                      {/* Cardholder & Points */}
                      <div className="flex items-end justify-between gap-2">
                        <div>
                          <p className="text-[9px] text-slate-400 uppercase tracking-wider">Titulaire de la carte</p>
                          <p className="font-bold text-xs sm:text-sm text-white tracking-wide truncate max-w-[160px] sm:max-w-[200px]">
                            {customer.name}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] text-amber-300/80 uppercase font-semibold block">Solde Points</span>
                          <span className="text-lg sm:text-xl font-black text-amber-400 tabular-nums">
                            {fmtPts(activeCard.points || 0)} <span className="text-[10px] font-semibold text-amber-200/80">pts</span>
                          </span>
                          <span className="block text-[9px] text-slate-300 font-medium">
                            Statut : <strong className="text-amber-300">{activeCard.tier_name || cardTier}</strong>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Back Face */}
                  <div
                    className="absolute inset-0 w-full h-full rounded-2xl overflow-hidden border border-white/20 dark:border-white/10"
                    style={{
                      backfaceVisibility: "hidden",
                      transform: "rotateY(180deg)",
                      background: "linear-gradient(135deg, #090d16 0%, #172033 50%, #030712 100%)",
                    }}
                  >
                    {/* Magnetic Stripe */}
                    <div className="w-full h-8 bg-black mt-3 sm:mt-4" />

                    <div className="p-3 sm:p-4 text-white space-y-2">
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="flex-1 bg-white/90 text-black px-2 py-1 rounded text-right font-mono text-[11px] font-bold tracking-widest shadow-inner">
                          {activeCard.security_code_formatted || activeCard.security_code || "•••• ••••"}
                        </div>
                        <span className="text-[9px] text-slate-400 uppercase">Clé Sécurité</span>
                      </div>

                      <div className="flex items-center justify-between text-[9px] text-slate-400 border-t border-white/10 pt-2">
                        <span>Carte émise par {activeCard.store?.name || "la boutique"}</span>
                        <span className="font-mono text-emerald-400 font-bold flex items-center gap-1">
                          <Icon name="verified" className="text-[12px]" /> Authentique
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action: Go to this store */}
              <div className="flex flex-col sm:flex-row gap-2.5 mt-4 justify-center">
                <button
                  type="button"
                  onClick={onNavigateToShop}
                  className="gs-3d-btn gs-3d-btn--primary px-4 py-2.5 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
                >
                  <Icon name="storefront" className="text-[16px]" />
                  <span>Commander dans cette boutique</span>
                </button>
              </div>
            </div>
          )}

          {/* Points Redemption & Usage Guide */}
          <div className="gs-3d-panel-sm rounded-2xl bg-surface-container p-4 shadow-sm border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-on-surface flex items-center gap-2">
                <Icon name="redeem" className="text-secondary text-[18px]" />
                <span>Utiliser mes points en réduction</span>
              </h3>
              <span className="text-[11px] text-on-surface-variant font-mono">1 pt = 1 % de remise</span>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              Solde utilisable : <span className="font-bold text-on-surface font-mono">{fmtPts(cardPoints)} pt</span>.
              À la commande, vous pouvez choisir de dépenser vos points sur un article pour obtenir une remise directe immédiate.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
