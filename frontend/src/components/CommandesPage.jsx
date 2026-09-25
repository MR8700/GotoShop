import Icon from "./Icon";
import React, { useState, useEffect } from "react";
import {
  getMediaUrl,
  confirmSale,
  fetchPendingFollowups,
  fetchIntentFeed,
  fetchDiscrepancies,
  resolveDiscrepancy,
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  archiveIntent,
  deleteIntent,
  dataCache,
} from "../api/client";
import NewProductModal from "./NewProductModal";
import ShareSocialModal from "./ShareSocialModal";
import { formatSalesQuantity } from "../utils/salesEngine";

export default function CommandesPage({ store, categories, showToast, onSaleConfirmed, onProductCreated, onOpenChat }) {
  const [pendingList, setPendingList] = useState(() => dataCache.get("intents:pending-followup") || []);
  const [feedList, setFeedList] = useState(() => dataCache.get("intents:feed:?include_archived=true") || dataCache.get("intents:feed:") || []);
  const [discrepanciesList, setDiscrepanciesList] = useState(() => dataCache.get("intents:discrepancies") || []);
  const [notificationsData, setNotificationsData] = useState(() => dataCache.get("notifications:{}") || { unread_count: 0, discrepancies_count: 0, notifications: [] });
  const [loading, setLoading] = useState(() => {
    return !dataCache.has("intents:pending-followup") && !dataCache.has("intents:feed:?include_archived=true");
  });
  const [confirmedSuccess, setConfirmedSuccess] = useState(false);
  const [confirmedAmount, setConfirmedAmount] = useState(85000);
  const [abandoned, setAbandoned] = useState(false);

  // Modals & Intent CRM Controls
  const [isNewProductOpen, setIsNewProductOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isNotifsOpen, setIsNotifsOpen] = useState(false);
  const [isResolvingId, setIsResolvingId] = useState(null);
  const [selectedIntentDetail, setSelectedIntentDetail] = useState(null);

  // Search & Filter state for Intentions
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [channelFilter, setChannelFilter] = useState("ALL");
  const [sortOrder, setSortOrder] = useState("recent");
  const [showArchivedOnly, setShowArchivedOnly] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(30);

  const loadData = async (forceSpinner = false) => {
    if (forceSpinner || (!pendingList.length && !feedList.length)) {
      setLoading(true);
    }
    try {
      const [pending, feed, disc, notifs] = await Promise.all([
        fetchPendingFollowups(),
        fetchIntentFeed({ include_archived: true }),
        fetchDiscrepancies(),
        fetchNotifications(),
      ]);
      setPendingList(pending);
      setFeedList(feed);
      setDiscrepanciesList(disc);
      setNotificationsData(notifs);
    } catch (e) {
      console.error("Error loading commandes data:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async (item, e) => {
    if (e) e.stopPropagation();
    try {
      const updated = await archiveIntent(item.id);
      showToast(updated.is_archived ? "Intention mise aux archives" : "Intention restaurée");
      loadData();
    } catch (err) {
      showToast(err.message || "Erreur d'archivage");
    }
  };

  const handleDelete = async (item, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Confirmer la suppression définitive de la commande / intention ${item.reference_code} ?`)) {
      return;
    }
    try {
      await deleteIntent(item.id);
      showToast("Intention supprimée définitivement");
      loadData();
    } catch (err) {
      showToast(err.message || "Erreur de suppression");
    }
  };

  const filteredFeed = feedList.filter((item) => {
    // Archive toggle
    if (showArchivedOnly) {
      if (!item.is_archived) return false;
    } else {
      if (item.is_archived) return false;
    }

    // Status filter
    if (statusFilter !== "ALL") {
      if (statusFilter === "SATISFIED" && item.client_status !== "SATISFIED") return false;
      else if (statusFilter === "CANCELLED" && (item.status !== "CANCELLED" && item.client_status !== "CANCELLED")) return false;
      else if (statusFilter === "SOLD" && item.status !== "SOLD") return false;
      else if (statusFilter === "PENDING" && (item.status === "SOLD" || item.status === "CANCELLED")) return false;
      else if (statusFilter === "DISCREPANCY" && !["DISCREPANCY_CONFLICT", "DISCREPANCY_SURPRISE"].includes(item.coherence_status)) return false;
    }

    // Channel filter
    if (channelFilter !== "ALL") {
      if (channelFilter === "GPS") {
        if (!item.customer_location_url) return false;
      } else if (item.channel_type?.toUpperCase() !== channelFilter.toUpperCase()) {
        return false;
      }
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const ref = (item.reference_code || "").toLowerCase();
      const prod = (item.product_name || "").toLowerCase();
      const cust = (item.customer_name || "").toLowerCase();
      const phone = (item.customer_phone || "").toLowerCase();
      const ch = (item.channel_type || "").toLowerCase();
      const city = (item.delivery_city || "").toLowerCase();
      const amount = (item.total_amount ? String(item.total_amount) : "");

      if (!ref.includes(q) && !prod.includes(q) && !cust.includes(q) && !phone.includes(q) && !ch.includes(q) && !city.includes(q) && !amount.includes(q)) {
        return false;
      }
    }

    return true;
  }).sort((a, b) => {
    if (sortOrder === "recent") return new Date(b.created_at) - new Date(a.created_at);
    if (sortOrder === "oldest") return new Date(a.created_at) - new Date(b.created_at);
    if (sortOrder === "amount_desc") return (b.total_amount || 0) - (a.total_amount || 0);
    if (sortOrder === "amount_asc") return (a.total_amount || 0) - (b.total_amount || 0);
    return 0;
  });

  const displayedFeed = filteredFeed.slice(0, visibleLimit);

  useEffect(() => {
    loadData();
  }, []);

  const urgentItem = pendingList[0] || null;

  const handleConfirmYes = async (item = urgentItem) => {
    if (!item) return;
    try {
      const res = await confirmSale(item.id, { is_sold: true });
      setConfirmedAmount(item.total_amount);
      setConfirmedSuccess(true);
      showToast("+ " + item.total_amount.toLocaleString("fr-FR") + " FCFA Encaissés !");
      if (onSaleConfirmed) onSaleConfirmed(res);
      loadData();
    } catch (err) {
      showToast(err.message || "Erreur de validation");
    }
  };

  const handleConfirmNo = async (item = urgentItem) => {
    if (!item) return;
    try {
      await confirmSale(item.id, { is_sold: false, reason: "Abandon client" });
      setAbandoned(true);
      showToast("Abandon enregistré pour cette intention.");
      setTimeout(() => {
        loadData();
        setAbandoned(false);
      }, 500);
    } catch (err) {
      showToast(err.message || "Erreur d'abandon");
    }
  };

  const handleResolve = async (intentId, resolution, notes = null) => {
    setIsResolvingId(intentId);
    try {
      await resolveDiscrepancy(intentId, resolution, notes);
      showToast(resolution === "ACCEPT_CANCELLATION" ? "Annulation acceptée & stock réajusté." : "Vente confirmée sur justificatif.");
      if (onSaleConfirmed) onSaleConfirmed();
      loadData();
    } catch (err) {
      showToast(err.message || "Erreur lors de la résolution");
    } finally {
      setIsResolvingId(null);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    loadData();
    showToast("Toutes les alertes sont marquées comme lues");
  };

  const hasPending = pendingList.length > 0;
  const hasDiscrepancies = discrepanciesList.length > 0;

  return (
    <div className="flex flex-col w-full gap-5 sm:gap-6 max-w-3xl mx-auto pb-32">
      {/* Top Merchant Header Bar with Notifications Bell */}
      <div className="flex items-center justify-between px-space-xs pt-1">
        <div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Arbitrage &amp; Relances</h2>
          <p className="text-xs text-on-surface-variant">
            Vérification réelle des ventes &amp; gestion des flux
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Notifications button with indicator */}
          <button
            onClick={() => setIsNotifsOpen(true)}
            className="relative w-10 h-10 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface flex items-center justify-center transition-transform active:scale-95 shadow-sm"
            title="Notifications & Alertes"
          >
            <Icon name="notifications" className="text-[20px]" />
            {(notificationsData.unread_count > 0 || notificationsData.discrepancies_count > 0) && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-rose-500 text-white font-bold text-[10px] flex items-center justify-center shadow animate-pulse">
                {notificationsData.unread_count || notificationsData.discrepancies_count}
              </span>
            )}
          </button>
          <button
            onClick={loadData}
            className="w-10 h-10 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant flex items-center justify-center transition-transform active:scale-95 shadow-sm"
            title="Actualiser"
          >
            <Icon name="refresh" className="text-[18px]" />
          </button>
        </div>
      </div>

      {/* Discrepancies / Conflict Resolution Section */}
      {hasDiscrepancies && (
        <section className="w-full bg-rose-500/10 border-2 border-rose-500/40 rounded-2xl p-4 shadow-lg space-y-3.5 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-400">
              <Icon name="warning" className="text-[22px] animate-bounce" />
              <span className="font-label-lg font-bold uppercase tracking-wider text-xs">
                Incohérences &amp; Litiges Détectés ({discrepanciesList.length})
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono text-xs font-bold">
              Action Requise
            </span>
          </div>

          <div className="space-y-3">
            {discrepanciesList.map((disc) => {
              const isConflict = disc.coherence_status === "DISCREPANCY_CONFLICT";
              return (
                <div
                  key={disc.id}
                  className="rounded-xl bg-surface-container-high p-3.5 space-y-2.5 border border-rose-500/30 shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-secondary bg-secondary/15 px-2 py-0.5 rounded">
                      #{disc.reference_code}
                    </span>
                    <span className="text-xs font-bold text-on-surface">
                      {disc.total_amount?.toLocaleString("fr-FR")} {disc.currency}
                    </span>
                  </div>

                  <div className="text-xs space-y-1">
                    <p className="font-semibold text-on-surface">
                      {disc.product_name} • Client : <span className="text-secondary">{disc.customer_name || "Client"}</span>
                    </p>
                    {isConflict ? (
                      <div className="p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 leading-relaxed">
                        <strong>⚠️ Conflit détecté :</strong> Vous aviez validé la vente, mais le client a déclaré avoir <strong>annulé</strong> (Motif : « {disc.client_feedback || "Non précisé"} »).
                      </div>
                    ) : (
                      <div className="p-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 leading-relaxed">
                        <strong>💡 Requalification possible :</strong> Vous aviez classé en abandon, mais le client se déclare <strong>satisfait(e)</strong> ({disc.client_satisfaction_rating || 5}★).
                      </div>
                    )}
                  </div>

                  {/* Arbitrage Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {isConflict ? (
                      <>
                        <button
                          type="button"
                          disabled={isResolvingId === disc.id}
                          onClick={() => handleResolve(disc.id, "ACCEPT_CANCELLATION", "Annulation client acceptée")}
                          className="h-10 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition-all active:scale-98 flex items-center justify-center gap-1"
                        >
                          <Icon name="restart_alt" className="text-[16px]" />
                          <span>Accepter l'annulation (+Stock)</span>
                        </button>
                        <button
                          type="button"
                          disabled={isResolvingId === disc.id}
                          onClick={() => handleResolve(disc.id, "FORCE_CONFIRM_SALE", "Vente maintenue sur preuve")}
                          className="h-10 rounded-xl bg-secondary hover:bg-secondary/90 text-surface text-xs font-bold transition-all active:scale-98 flex items-center justify-center gap-1 shadow"
                        >
                          <Icon name="verified" className="text-[16px]" />
                          <span>Maintenir Vente Conclue</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={isResolvingId === disc.id}
                          onClick={() => handleResolve(disc.id, "FORCE_CONFIRM_SALE", "Requalifié en vente sur retour client")}
                          className="h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-surface text-xs font-bold transition-all active:scale-98 flex items-center justify-center gap-1 shadow"
                        >
                          <Icon name="thumb_up" className="text-[16px]" />
                          <span>Requalifier en Vente (+CA)</span>
                        </button>
                        <button
                          type="button"
                          disabled={isResolvingId === disc.id}
                          onClick={() => handleResolve(disc.id, "ACCEPT_CANCELLATION", "Abandon maintenu")}
                          className="h-10 rounded-xl bg-surface-container-highest text-on-surface-variant text-xs font-semibold transition-all active:scale-98"
                        >
                          Conserver Abandon
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Dynamic Intentions Header */}
      {hasPending ? (
        <section className="w-full bg-primary-container/20 rounded-xl p-space-md flex items-center justify-between shadow-md relative overflow-hidden">
          <div className="flex items-center gap-space-sm min-w-0">
            <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center flex-shrink-0 animate-bounce">
              <Icon name="bolt" className="text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }} />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-baseline gap-1">
                <span className="font-headline-sm text-2xl font-bold text-on-surface">
                  {pendingList.length}
                </span>
                <span className="font-label-lg text-label-lg text-on-surface truncate">
                  intentions en attente
                </span>
              </div>
              <span className="font-body-sm text-body-sm text-primary">
                Relance 24h requise pour valider le CA
              </span>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-surface-container-high text-primary font-label-sm text-label-sm uppercase flex items-center gap-1 flex-shrink-0 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-ping"></span>
            Urgent
          </span>
        </section>
      ) : (
        <section className="w-full bg-secondary/10 border border-secondary/20 rounded-xl p-space-md flex items-center justify-between shadow-md relative overflow-hidden">
          <div className="flex items-center gap-space-sm min-w-0">
            <div className="w-10 h-10 rounded-full bg-secondary text-surface flex items-center justify-center flex-shrink-0">
              <Icon name="check_circle" className="text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }} />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-baseline gap-1">
                <span className="font-headline-sm text-2xl font-bold text-secondary">0</span>
                <span className="font-label-lg text-label-lg text-on-surface truncate">
                  intention en attente
                </span>
              </div>
              <span className="font-body-sm text-body-sm text-secondary">
                Toutes les relances sont à jour ! Chiffre d'affaires validé.
              </span>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-secondary/20 text-secondary font-label-sm text-label-sm uppercase flex items-center gap-1 flex-shrink-0 shadow-sm font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
            À jour
          </span>
        </section>
      )}

      {/* 24h Verification Card */}
      {urgentItem && !abandoned && (
        <section
          className={`w-full rounded-xl p-space-md shadow-xl flex flex-col gap-space-md transition-all duration-300 ${
            confirmedSuccess ? "bg-surface-container-highest" : "bg-surface-container-high"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-space-xs">
              <span className="px-2 py-0.5 rounded-full bg-primary-container/15 text-primary-fixed-dim font-label-sm text-label-sm uppercase tracking-wide">
                {urgentItem.reference_code}
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1">
                <Icon name="schedule" className="text-[14px] text-secondary" />
                {urgentItem.time_elapsed_display || "Il y a 23h40"}
              </span>
            </div>
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary flex items-center gap-1">
              <Icon name="forum" className="text-[14px]" />
              {urgentItem.channel_type}
            </span>
          </div>

          {/* Client Feedback Callout Banner if client already acted */}
          {urgentItem.client_status === "SATISFIED" && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-start gap-2.5 text-xs text-emerald-300 shadow-sm animate-pulse">
              <Icon name="thumb_up" className="text-[20px] text-emerald-400 shrink-0" />
              <div>
                <strong className="block font-bold text-emerald-300">
                  Le client confirme avoir reçu le produit et est Satisfait(e) ({urgentItem.client_satisfaction_rating || 5}★) !
                </strong>
                <span>
                  « {urgentItem.client_feedback || "Très satisfait(e)"} » • Validez la vente pour consolider définitivement le CA.
                </span>
              </div>
            </div>
          )}

          {urgentItem.client_status === "CANCELLED" && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300 shadow-sm">
              <Icon name="cancel" className="text-[20px] text-rose-400 shrink-0" />
              <div>
                <strong className="block font-bold text-rose-300">
                  Le client a annulé cette commande !
                </strong>
                <span>
                  Motif : « {urgentItem.client_feedback || "Non précisé"} ». Enregistrez l'abandon pour maintenir vos stocks.
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-space-md bg-surface-container-low p-space-sm rounded-xl">
            <img
              className="w-16 h-16 rounded-lg object-cover flex-shrink-0 shadow-sm"
              src={getMediaUrl(urgentItem.product_image_url)}
              alt={urgentItem.product_name}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "/media/products/samsung_galaxy_a15.jpg";
              }}
            />
            <div className="flex flex-col min-w-0">
              <span className="font-headline-sm text-headline-sm text-on-surface truncate">
                {urgentItem.product_name}
              </span>
              <span className="font-currency-display text-currency-display text-secondary tracking-tight">
                {urgentItem.total_amount?.toLocaleString("fr-FR")} {urgentItem.currency}
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
                Client : {urgentItem.customer_name || "Client"}
              </span>
              {urgentItem.customer_location_url && (
                <a
                  href={urgentItem.customer_location_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-[11px] text-secondary hover:underline bg-secondary/10 px-2 py-0.5 rounded w-fit"
                >
                  <Icon name="pin_drop" className="text-[13px]" />
                  <span>Position GPS de livraison (Google Maps)</span>
                  <Icon name="open_in_new" className="text-[11px]" />
                </a>
              )}
            </div>
          </div>

          {!confirmedSuccess ? (
            <>
              <p className="font-body-md text-body-md text-on-surface">
                Client redirigé sur {urgentItem.channel_type}. Cette vente a-t-elle été conclue et payée réellement ?
              </p>
              <div className="flex flex-col gap-space-xs pt-space-xs">
                <button
                  type="button"
                  onClick={() => handleConfirmYes(urgentItem)}
                  className="w-full h-14 rounded-xl bg-secondary-container text-on-secondary-container font-label-lg text-label-lg flex items-center justify-center gap-space-sm shadow-md active:scale-95 transition-transform font-bold"
                >
                  <Icon name="check_circle" className="text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }} />
                  <span>OUI, VENTE CONCLUE</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmNo(urgentItem)}
                  className="w-full h-12 rounded-xl bg-surface-container-highest text-on-surface-variant font-label-md text-label-md flex items-center justify-center gap-space-xs active:scale-95 transition-transform font-semibold"
                >
                  <Icon name="cancel" className="text-[18px]" />
                  <span>NON, ABANDON / REPORT</span>
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center p-space-md bg-secondary-container/20 rounded-xl text-center">
              <Icon name="verified" className="text-[36px] text-secondary" />
              <span className="font-headline-sm text-headline-sm text-on-surface mt-1">
                +{confirmedAmount?.toLocaleString("fr-FR")} FCFA Encaissés
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Statistiques et stock mis à jour immédiatement en base.
              </span>
            </div>
          )}
        </section>
      )}

      {/* Quick Merchant Action Buttons */}
      <section className="grid grid-cols-2 gap-space-sm w-full">
        <button
          type="button"
          onClick={() => setIsNewProductOpen(true)}
          className="flex flex-col items-start justify-between p-space-md bg-surface-container rounded-xl shadow-md active:scale-98 transition-transform min-h-[110px] text-left"
        >
          <div className="w-10 h-10 rounded-full bg-primary-container/20 text-primary-fixed-dim flex items-center justify-center">
            <Icon name="add_a_photo" className="text-[20px]" />
          </div>
          <div>
            <span className="font-label-lg text-label-lg text-on-surface block leading-tight">Nouveau Produit</span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">Photo instantanée &amp; Média</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setIsShareOpen(true)}
          className="flex flex-col items-start justify-between p-space-md bg-surface-container rounded-xl shadow-md active:scale-98 transition-transform min-h-[110px] text-left"
        >
          <div className="w-10 h-10 rounded-full bg-secondary/20 text-secondary flex items-center justify-center">
            <Icon name="share" className="text-[20px]" />
          </div>
          <div>
            <span className="font-label-lg text-label-lg text-on-surface block leading-tight">
              Partager le lien sur les réseaux
            </span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">TikTok, WhatsApp, FB &amp; QR</span>
          </div>
        </button>
      </section>

      {/* Flux des Intentions & Commandes */}
      <section className="flex flex-col gap-3 w-full mt-space-xs">
        <div className="flex flex-col gap-2 bg-surface-container p-3.5 rounded-2xl shadow-md border border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="swap_horizontal_circle" className="text-primary text-[22px]" />
              <h2 className="font-headline-sm text-base font-bold text-on-surface">Flux des Intentions</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-label-sm text-xs text-on-surface-variant">
                {filteredFeed.length} sur {feedList.length}
              </span>
              <button
                type="button"
                onClick={() => setVisibleLimit((prev) => (prev >= filteredFeed.length ? 30 : filteredFeed.length))}
                className="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-label-sm text-xs font-bold flex items-center gap-1 transition-all"
              >
                {visibleLimit >= filteredFeed.length ? "Réduire" : `Tout afficher (${filteredFeed.length})`}
                <Icon name={visibleLimit >= filteredFeed.length ? "unfold_less" : "unfold_more"} className="text-[14px]" />
              </button>
            </div>
          </div>

          {/* Smart Search Bar */}
          <div className="relative w-full">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[19px]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Recherche intelligente : client, réf CMD-, produit, tél, ville..."
              className="w-full h-11 pl-10 pr-9 rounded-xl bg-surface-container-high text-on-surface placeholder-on-surface-variant/60 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all border border-white/5"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-white/10"
              >
                <Icon name="close" className="text-[16px]" />
              </button>
            )}
          </div>

          {/* Quick Dropdown Filters */}
          <div className="grid grid-cols-3 gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-2 rounded-lg bg-surface-container-high text-on-surface text-[11px] font-semibold focus:outline-none border border-white/5 truncate"
            >
              <option value="ALL">Statuts: Tous</option>
              <option value="PENDING">⏳ En attente</option>
              <option value="SOLD">✅ Confirmée</option>
              <option value="SATISFIED">👍 Satisfait(e)</option>
              <option value="CANCELLED">❌ Annulée</option>
              <option value="DISCREPANCY">⚠️ Litige / Arbitrage</option>
            </select>

            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="h-9 px-2 rounded-lg bg-surface-container-high text-on-surface text-[11px] font-semibold focus:outline-none border border-white/5 truncate"
            >
              <option value="ALL">Canaux: Tous</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="SMS">SMS Direct</option>
              <option value="DIRECT">Direct Web</option>
              <option value="MESSENGER">Messenger FB</option>
              <option value="TIKTOK">TikTok Shop</option>
              <option value="GPS">📍 Livraison GPS</option>
            </select>

            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="h-9 px-2 rounded-lg bg-surface-container-high text-on-surface text-[11px] font-semibold focus:outline-none border border-white/5 truncate"
            >
              <option value="recent">Tri: Récentes</option>
              <option value="oldest">Tri: Anciennes</option>
              <option value="amount_desc">Tri: Prix fort</option>
              <option value="amount_asc">Tri: Prix faible</option>
            </select>
          </div>

          {/* Archive toggle switch */}
          <div className="flex items-center justify-between pt-1 text-xs">
            <button
              type="button"
              onClick={() => setShowArchivedOnly(false)}
              className={`px-2.5 py-1 rounded-full font-bold transition-all ${
                !showArchivedOnly ? "bg-primary text-surface shadow-sm" : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Actives ({feedList.filter((i) => !i.is_archived).length})
            </button>
            <button
              type="button"
              onClick={() => setShowArchivedOnly(true)}
              className={`px-2.5 py-1 rounded-full font-bold transition-all flex items-center gap-1 ${
                showArchivedOnly ? "bg-amber-500 text-surface shadow-sm" : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <Icon name="archive" className="text-[13px]" />
              Archivées ({feedList.filter((i) => i.is_archived).length})
            </button>
          </div>
        </div>

        {/* Intentions List */}
        <div className="flex flex-col gap-2">
          {displayedFeed.length === 0 ? (
            <div className="p-8 text-center bg-surface-container rounded-2xl border border-white/5">
              <Icon name="search_off" className="text-4xl text-on-surface-variant/40 mb-2 block" />
              <p className="font-bold text-on-surface text-sm mb-1">Aucune intention trouvée</p>
              <p className="text-xs text-on-surface-variant mb-4">
                Aucun résultat ne correspond aux filtres ou à la recherche appliquée.
              </p>
              {(searchQuery || statusFilter !== "ALL" || channelFilter !== "ALL") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("ALL");
                    setChannelFilter("ALL");
                  }}
                  className="px-4 py-1.5 rounded-xl bg-primary/10 text-primary font-bold text-xs hover:bg-primary/20 transition-all"
                >
                  Réinitialiser les filtres
                </button>
              )}
            </div>
          ) : (
            displayedFeed.map((item) => {
              const isSold = item.status === "SOLD";
              const isCancelled = item.status === "CANCELLED" || item.client_status === "CANCELLED";
              const isSatisfied = item.client_status === "SATISFIED";
              const isArchived = Boolean(item.is_archived);

              return (
                <div
                  key={item.id}
                  className={`w-full bg-surface-container p-3.5 rounded-xl shadow-sm border border-white/5 flex flex-col gap-2 transition-all ${
                    isArchived
                      ? "opacity-60 bg-surface-container-low"
                      : isSold
                      ? "opacity-95"
                      : isCancelled
                      ? "opacity-75"
                      : "hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        className="w-13 h-13 min-w-[52px] min-h-[52px] rounded-xl object-cover shadow-sm bg-surface-container-high"
                        src={getMediaUrl(item.product_image_url)}
                        alt={item.product_name}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = "/media/products/casque_bluetooth_pro.jpg";
                        }}
                      />
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface-variant">
                            {item.reference_code}
                          </span>
                          <span className="font-body-sm text-[11px] text-on-surface-variant">
                            {item.time_elapsed_display}
                          </span>
                        </div>
                        <span className="font-headline-sm text-sm font-bold text-on-surface truncate mt-0.5">
                          {item.product_name}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-label-md text-xs text-secondary font-bold">
                            {item.total_amount?.toLocaleString("fr-FR")} {item.currency}
                          </span>
                          <span className="text-[11px] text-on-surface-variant truncate">
                            • {item.customer_name || "Client"} via {item.channel_type}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end shrink-0 gap-1">
                      {isSatisfied ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-label-sm text-[10px] font-bold flex items-center gap-1">
                          <Icon name="thumb_up" className="text-[12px]" />
                          Satisfait
                        </span>
                      ) : isSold ? (
                        <span className="px-2 py-0.5 rounded-full bg-secondary/20 text-secondary font-label-sm text-[10px] font-bold flex items-center gap-1">
                          <Icon name="check" className="text-[12px]" />
                          Confirmée
                        </span>
                      ) : isCancelled ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-label-sm text-[10px] font-bold flex items-center gap-1">
                          <Icon name="close" className="text-[12px]" />
                          Annulée
                        </span>
                      ) : item.status === "REDIRECTED" ? (
                        <span className="px-2 py-0.5 rounded-full bg-secondary-container/20 text-secondary font-label-sm text-[10px] font-semibold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                          En discussion
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-primary-container/20 text-primary-fixed-dim font-label-sm text-[10px] uppercase flex items-center gap-1 font-semibold">
                          <Icon name="alarm" className="text-[11px]" />
                          En attente
                        </span>
                      )}

                      {isArchived && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold uppercase">
                          Archivée
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Customer Location & GPS link if available */}
                  {item.customer_location_url && (
                    <a
                      href={item.customer_location_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-secondary hover:underline bg-secondary/10 px-2 py-1 rounded-lg w-fit"
                    >
                      <Icon name="pin_drop" className="text-[13px]" />
                      <span>Livraison GPS Google Maps : {item.delivery_city || "Position client"}</span>
                      <Icon name="open_in_new" className="text-[11px]" />
                    </a>
                  )}

                  {/* Actions Bar on each intent card */}
                  <div className="flex items-center justify-between pt-1.5 border-t border-white/5 text-xs">
                    <div className="flex items-center gap-1">
                      {/* Archive Button */}
                      <button
                        type="button"
                        onClick={(e) => handleArchive(item, e)}
                        title={isArchived ? "Restaurer l'intention" : "Archiver l'intention"}
                        className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all ${
                          isArchived
                            ? "bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
                            : "bg-surface-container-high text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest"
                        }`}
                      >
                        <Icon name={isArchived ? "unarchive" : "archive"} className="text-[14px]" />
                        <span>{isArchived ? "Désarchiver" : "Archiver"}</span>
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={(e) => handleDelete(item, e)}
                        title="Supprimer définitivement cette intention"
                        className="px-2 py-1 rounded-lg bg-surface-container-high text-rose-400 hover:bg-rose-500/20 text-[11px] font-semibold flex items-center gap-1 transition-all"
                      >
                        <Icon name="delete" className="text-[14px]" />
                        <span>Supprimer</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Direct Internal Chat Button */}
                      {onOpenChat && (
                        <button
                          type="button"
                          onClick={() => onOpenChat(item.conversation_id)}
                          className="px-2.5 py-1 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                          title="Ouvrir la messagerie interne"
                        >
                          <Icon name="forum" className="text-[14px]" />
                          <span>Discuter en direct</span>
                        </button>
                      )}

                      {/* Detail Modal button */}
                      <button
                        type="button"
                        onClick={() => setSelectedIntentDetail(item)}
                        className="px-2 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-[11px] font-bold flex items-center gap-1 transition-all"
                      >
                        <span>Détails</span>
                        <Icon name="arrow_forward" className="text-[13px]" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Load More Button */}
          {filteredFeed.length > visibleLimit && (
            <div className="flex items-center justify-center pt-2 gap-2">
              <button
                type="button"
                onClick={() => setVisibleLimit((prev) => prev + 30)}
                className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
              >
                <span>Afficher 30 suivants</span>
                <Icon name="expand_more" className="text-[16px]" />
              </button>
              <button
                type="button"
                onClick={() => setVisibleLimit(filteredFeed.length)}
                className="px-4 py-2 rounded-xl bg-primary-container text-on-primary-container text-xs font-bold transition-all shadow-sm"
              >
                Tout charger ({filteredFeed.length})
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Detail Modal for Selected Intent */}
      {selectedIntentDetail && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="rounded-2xl bg-surface-container-high border border-white/10 p-5 max-w-md w-full max-h-[85vh] flex flex-col shadow-2xl animate-fadeIn overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Icon name="receipt_long" className="text-primary text-[20px]" />
                <h3 className="font-headline-sm text-base font-bold text-on-surface">
                  Commande {selectedIntentDetail.reference_code}
                </h3>
              </div>
              <button
                onClick={() => setSelectedIntentDetail(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-white/10"
              >
                <Icon name="close" className="text-[18px]" />
              </button>
            </div>

            <div className="flex flex-col gap-3 py-3 text-xs">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-container">
                <img
                  className="w-14 h-14 rounded-lg object-cover"
                  src={getMediaUrl(selectedIntentDetail.product_image_url)}
                  alt={selectedIntentDetail.product_name}
                />
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-sm text-on-surface truncate">
                    {selectedIntentDetail.product_name}
                  </span>
                  <span className="text-secondary font-bold text-xs">
                    {selectedIntentDetail.total_amount?.toLocaleString("fr-FR")} {selectedIntentDetail.currency}
                  </span>
                  <span className="text-on-surface-variant text-[11px]">
                    Quantité : {formatSalesQuantity(selectedIntentDetail.quantity, selectedIntentDetail.unit_label)} • {selectedIntentDetail.selected_color || "Standard"}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-surface-container flex flex-col gap-1.5">
                <span className="font-bold text-on-surface uppercase tracking-wider text-[10px] text-primary">
                  Informations Client &amp; Livraison
                </span>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Nom client :</span>
                  <span className="font-semibold text-on-surface">{selectedIntentDetail.customer_name || "Non renseigné"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Téléphone :</span>
                  <span className="font-semibold text-on-surface">{selectedIntentDetail.customer_phone || "Non renseigné"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Ville de livraison :</span>
                  <span className="font-semibold text-on-surface">{selectedIntentDetail.delivery_city || "Abidjan"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Canal d'origine :</span>
                  <span className="font-semibold text-on-surface">{selectedIntentDetail.channel_type}</span>
                </div>
                {selectedIntentDetail.customer_location_url && (
                  <a
                    href={selectedIntentDetail.customer_location_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 p-2 rounded-lg bg-secondary/15 text-secondary flex items-center justify-between font-bold"
                  >
                    <span className="flex items-center gap-1">
                      <Icon name="pin_drop" className="text-[15px]" />
                      Position GPS Client (Maps)
                    </span>
                    <Icon name="open_in_new" className="text-[14px]" />
                  </a>
                )}
              </div>

              <div className="p-3 rounded-xl bg-surface-container flex flex-col gap-1.5">
                <span className="font-bold text-on-surface uppercase tracking-wider text-[10px] text-primary">
                  Statut &amp; Arbitrage
                </span>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Statut commande :</span>
                  <span className="font-bold text-on-surface">{selectedIntentDetail.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Avis client :</span>
                  <span className="font-bold text-emerald-400">{selectedIntentDetail.client_status}</span>
                </div>
                {selectedIntentDetail.client_feedback && (
                  <p className="italic text-on-surface-variant text-[11px] p-2 bg-surface-container-high rounded-lg">
                    « {selectedIntentDetail.client_feedback} »
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={(e) => {
                  handleArchive(selectedIntentDetail, e);
                  setSelectedIntentDetail(null);
                }}
                className="px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-highest text-on-surface text-xs font-bold transition-all flex items-center gap-1"
              >
                <Icon name={selectedIntentDetail.is_archived ? "unarchive" : "archive"} className="text-[14px]" />
                <span>{selectedIntentDetail.is_archived ? "Désarchiver" : "Archiver"}</span>
              </button>
              {onOpenChat && (
                <button
                  type="button"
                  onClick={() => {
                    const convId = selectedIntentDetail.conversation_id;
                    setSelectedIntentDetail(null);
                    onOpenChat(convId);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-primary text-surface text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Icon name="forum" className="text-[14px]" />
                  <span>Ouvrir le Chat</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedIntentDetail(null)}
                className="px-4 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-highest text-on-surface text-xs font-bold transition-all"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notifications Modal */}
      {isNotifsOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="rounded-2xl bg-surface-container-high border border-white/10 p-5 max-w-md w-full max-h-[85vh] flex flex-col shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Icon name="notifications" className="text-primary text-[22px]" />
                <h3 className="font-headline-sm text-base font-bold text-on-surface">Alertes &amp; Rappels</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-secondary hover:underline font-semibold"
                >
                  Tout marquer lu
                </button>
                <button
                  onClick={() => setIsNotifsOpen(false)}
                  className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface"
                >
                  <Icon name="close" className="text-[18px]" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
              {notificationsData.notifications?.length === 0 ? (
                <div className="p-8 text-center text-on-surface-variant text-xs space-y-2">
                  <Icon name="notifications_off" className="text-[32px] opacity-40" />
                  <p>Aucune notification pour le moment. Tout est à jour !</p>
                </div>
              ) : (
                notificationsData.notifications.map((n) => {
                  const isUrgent = n.urgency === "HIGH";
                  return (
                    <div
                      key={n.id}
                      className={`p-3 rounded-xl border transition-colors ${
                        !n.is_read
                          ? isUrgent
                            ? "bg-rose-500/10 border-rose-500/30"
                            : "bg-surface-container border-primary/30"
                          : "bg-surface-container/50 border-white/5 opacity-70"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-xs text-on-surface">{n.title}</h4>
                        <span className="text-[10px] text-on-surface-variant shrink-0">
                          {new Date(n.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                        {n.message}
                      </p>
                      {!n.is_read && (
                        <button
                          onClick={async () => {
                            await markNotificationRead(n.id);
                            loadData();
                          }}
                          className="mt-2 text-[11px] font-semibold text-secondary hover:underline"
                        >
                          Marquer comme lu ✓
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Product Modal */}
      {isNewProductOpen && (
        <NewProductModal
          store={store}
          categories={categories}
          onClose={() => setIsNewProductOpen(false)}
          onProductCreated={(p) => {
            if (onProductCreated) onProductCreated(p);
            loadData();
          }}
          showToast={showToast}
        />
      )}

      {/* Share Social Modal */}
      {isShareOpen && (
        <ShareSocialModal
          store={store}
          onClose={() => setIsShareOpen(false)}
          showToast={showToast}
        />
      )}
    </div>
  );
}
