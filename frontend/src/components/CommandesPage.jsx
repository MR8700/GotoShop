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
  fetchConversationalOrders,
  acceptOrder,
  rejectOrder,
  updateOrderStatus,
  getLocalGuestOrders,
} from "../api/client";
import NewProductModal from "./NewProductModal";
import ShareSocialModal from "./ShareSocialModal";
import { formatSalesQuantity } from "../utils/salesEngine";

export default function CommandesPage({ store, categories, showToast, onSaleConfirmed, onProductCreated, onOpenChat }) {
  // Merchant Main Sub-Tab: "DIRECT_ORDERS" | "ARBITRAGE"
  const [merchantSubTab, setMerchantSubTab] = useState("DIRECT_ORDERS");

  // Conversational Direct Orders
  const [conversationalOrders, setConversationalOrders] = useState(() => {
    const cached = dataCache.get(`orders:conv:store_id=${store?.id || ""}`);
    return cached && Array.isArray(cached) ? cached : [];
  });
  const [convStatusFilter, setConvStatusFilter] = useState("ALL"); // "ALL" | "PENDING" | "ACCEPTED" | "PAID" | "IN_DELIVERY" | "DELIVERED"
  const [processingOrderId, setProcessingOrderId] = useState(null);
  const [selectedConversationalOrder, setSelectedConversationalOrder] = useState(null);

  const [pendingList, setPendingList] = useState(() => dataCache.get("intents:pending-followup") || []);
  const [feedList, setFeedList] = useState(() => dataCache.get("intents:feed:?include_archived=true") || dataCache.get("intents:feed:") || []);
  const [discrepanciesList, setDiscrepanciesList] = useState(() => dataCache.get("intents:discrepancies") || []);
  const [notificationsData, setNotificationsData] = useState(() => dataCache.get("notifications:{}") || { unread_count: 0, discrepancies_count: 0, notifications: [] });
  const [loading, setLoading] = useState(() => {
    return !dataCache.has("intents:pending-followup") && !dataCache.has("intents:feed:?include_archived=true") && !conversationalOrders.length;
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
    if (forceSpinner || (!pendingList.length && !feedList.length && !conversationalOrders.length)) {
      setLoading(true);
    }
    try {
      const [pending, feed, disc, notifs, convOrders] = await Promise.all([
        fetchPendingFollowups(),
        fetchIntentFeed({ include_archived: true }),
        fetchDiscrepancies(),
        fetchNotifications(),
        fetchConversationalOrders({ store_id: store?.id }),
      ]);
      setPendingList(pending || []);
      setFeedList(feed || []);
      setDiscrepanciesList(disc || []);
      setNotificationsData(notifs || { unread_count: 0, discrepancies_count: 0, notifications: [] });

      // Merge backend orders with any local test/guest orders
      const local = getLocalGuestOrders().filter(
        (o) => !store?.id || o.store_id === store.id || !o.store_id
      );
      const combined = Array.isArray(convOrders) ? [...convOrders] : [];
      local.forEach((lo) => {
        if (
          !combined.some(
            (o) =>
              o.id === lo.id ||
              (lo.reference_code && o.order_number === lo.reference_code) ||
              (lo.order_number && o.order_number === lo.order_number)
          )
        ) {
          combined.push({
            ...lo,
            order_number: lo.reference_code || lo.order_number,
            status: lo.status || "PENDING_SELLER_ACCEPTANCE",
            delivery: {
              delivery_address: lo.delivery_address,
              delivery_city: lo.delivery_city,
              latitude: lo.delivery_lat,
              longitude: lo.delivery_lng,
              maps_url: lo.delivery_lat
                ? `https://maps.google.com/?q=${lo.delivery_lat},${lo.delivery_lng}`
                : null,
            },
          });
        }
      });
      setConversationalOrders(combined);
    } catch (e) {
      console.error("Error loading commandes data:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptDirectOrder = async (orderId) => {
    setProcessingOrderId(orderId);
    try {
      await acceptOrder(orderId, store?.name || "Commerçant");
      showToast("✓ Commande acceptée ! Le client a été invité à régler par Mobile Money.");
      setConversationalOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: "ACCEPTED" } : o))
      );
      dataCache.invalidate("orders:");
      dataCache.invalidate("customer:orders:");
      loadData();
    } catch (err) {
      showToast(err.message || "Erreur lors de l'acceptation");
    } finally {
      setProcessingOrderId(null);
    }
  };

  const handleRejectDirectOrder = async (orderId) => {
    const reason = window.prompt("Motif du refus (optionnel) :", "Article temporairement en rupture de stock");
    if (reason === null) return;
    setProcessingOrderId(orderId);
    try {
      await rejectOrder(orderId, reason || "Article indisponible", store?.name || "Commerçant");
      showToast("Commande refusée.");
      setConversationalOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: "CANCELLED", rejection_reason: reason } : o))
      );
      dataCache.invalidate("orders:");
      dataCache.invalidate("customer:orders:");
      loadData();
    } catch (err) {
      showToast(err.message || "Erreur lors du refus");
    } finally {
      setProcessingOrderId(null);
    }
  };

  const handleUpdateStatus = async (orderId, nextStatus) => {
    setProcessingOrderId(orderId);
    try {
      await updateOrderStatus(orderId, nextStatus);
      showToast(
        nextStatus === "IN_DELIVERY"
          ? "🚚 Commande marquée en cours de livraison !"
          : "🎉 Commande marquée comme livrée !"
      );
      setConversationalOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
      );
      dataCache.invalidate("orders:");
      dataCache.invalidate("customer:orders:");
      loadData();
    } catch (err) {
      showToast(err.message || "Erreur lors de la mise à jour");
    } finally {
      setProcessingOrderId(null);
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

  const pendingConvCount = conversationalOrders.filter((o) =>
    ["PENDING_SELLER_ACCEPTANCE", "PENDING", "CREATED"].includes((o.status || "").toUpperCase())
  ).length;

  const acceptedConvCount = conversationalOrders.filter((o) =>
    (o.status || "").toUpperCase() === "ACCEPTED"
  ).length;

  const paidConvCount = conversationalOrders.filter((o) => {
    const st = (o.status || "").toUpperCase();
    const paySt = (o.payment_status || "").toUpperCase();
    return (
      paySt === "PAID" ||
      paySt === "CONFIRMED" ||
      st === "PAID" ||
      st === "PREPARING" ||
      st === "READY_FOR_DELIVERY"
    );
  }).length;

  const inDeliveryConvCount = conversationalOrders.filter((o) =>
    ["OUT_FOR_DELIVERY", "IN_DELIVERY"].includes((o.status || "").toUpperCase())
  ).length;

  const deliveredConvCount = conversationalOrders.filter((o) =>
    ["DELIVERED", "COMPLETED"].includes((o.status || "").toUpperCase())
  ).length;

  const cancelledConvCount = conversationalOrders.filter((o) =>
    ["CANCELLED", "REJECTED"].includes((o.status || "").toUpperCase())
  ).length;

  const filteredConversationalOrders = conversationalOrders.filter((order) => {
    // Status filter
    if (convStatusFilter !== "ALL") {
      const st = (order.status || "").toUpperCase();
      const paySt = (order.payment_status || "").toUpperCase();
      if (
        convStatusFilter === "PENDING" &&
        !["PENDING_SELLER_ACCEPTANCE", "PENDING", "CREATED"].includes(st)
      ) {
        return false;
      }
      if (convStatusFilter === "ACCEPTED" && st !== "ACCEPTED") {
        return false;
      }
      if (
        convStatusFilter === "PAID" &&
        !(
          paySt === "PAID" ||
          paySt === "CONFIRMED" ||
          st === "PAID" ||
          st === "PREPARING" ||
          st === "READY_FOR_DELIVERY"
        )
      ) {
        return false;
      }
      if (
        convStatusFilter === "IN_DELIVERY" &&
        !["OUT_FOR_DELIVERY", "IN_DELIVERY"].includes(st)
      ) {
        return false;
      }
      if (
        convStatusFilter === "DELIVERED" &&
        !["DELIVERED", "COMPLETED"].includes(st)
      ) {
        return false;
      }
      if (
        convStatusFilter === "CANCELLED" &&
        !["CANCELLED", "REJECTED"].includes(st)
      ) {
        return false;
      }
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const num = (order.order_number || order.reference_code || "").toLowerCase();
      const cname = (order.customer_name || "").toLowerCase();
      const cphone = (order.customer_phone || "").toLowerCase();
      const city = (order.delivery?.delivery_city || order.delivery_city || "").toLowerCase();
      const addr = (order.delivery?.delivery_address || order.delivery_address || "").toLowerCase();
      const itemsMatch = (order.items || []).some((it) =>
        (it.product_name || "").toLowerCase().includes(q)
      );
      if (
        !num.includes(q) &&
        !cname.includes(q) &&
        !cphone.includes(q) &&
        !city.includes(q) &&
        !addr.includes(q) &&
        !itemsMatch
      ) {
        return false;
      }
    }
    return true;
  }).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  const hasPending = pendingList.length > 0;
  const hasDiscrepancies = discrepanciesList.length > 0;

  return (
    <div className="flex flex-col w-full gap-5 sm:gap-6 max-w-3xl mx-auto pb-32">
      {/* Top Merchant Header Bar */}
      <div className="flex items-center justify-between px-space-xs pt-1">
        <div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">
            {merchantSubTab === "DIRECT_ORDERS" ? "Commandes Reçues" : "Arbitrage & Relances"}
          </h2>
          <p className="text-xs text-on-surface-variant">
            {merchantSubTab === "DIRECT_ORDERS"
              ? "Acceptation en 1 clic, livraison express & coordonnées GPS"
              : "Vérification réelle des ventes & gestion des flux"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Notifications button with indicator */}
          <button
            onClick={() => setIsNotifsOpen(true)}
            className="relative w-10 h-10 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface flex items-center justify-center transition-transform active:scale-95 shadow-sm cursor-pointer"
            title="Notifications & Alertes"
          >
            <Icon name="notifications" className="text-[20px]" />
            {((notificationsData?.unread_count || 0) > 0 || (notificationsData?.discrepancies_count || 0) > 0) && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-rose-500 text-white font-bold text-[10px] flex items-center justify-center shadow animate-pulse">
                {notificationsData?.unread_count || notificationsData?.discrepancies_count}
              </span>
            )}
          </button>
          <button
            onClick={loadData}
            className="w-10 h-10 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant flex items-center justify-center transition-transform active:scale-95 shadow-sm cursor-pointer"
            title="Actualiser"
          >
            <Icon name="refresh" className="text-[18px]" />
          </button>
        </div>
      </div>

      {/* Sub-Tab Navigation Bar */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-surface-container-high border-2 border-slate-200 dark:border-slate-800 shadow-xs">
        <button
          type="button"
          onClick={() => setMerchantSubTab("DIRECT_ORDERS")}
          className={`flex-1 py-2.5 px-3 rounded-xl font-label-md text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            merchantSubTab === "DIRECT_ORDERS"
              ? "bg-primary text-on-primary shadow-md"
              : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
          }`}
        >
          <Icon name="local_shipping" className="text-[18px]" />
          <span>Commandes Directes</span>
          {pendingConvCount > 0 ? (
            <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[11px] font-extrabold animate-pulse">
              {pendingConvCount}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface text-[11px] font-semibold">
              {conversationalOrders.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setMerchantSubTab("ARBITRAGE")}
          className={`flex-1 py-2.5 px-3 rounded-xl font-label-md text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            merchantSubTab === "ARBITRAGE"
              ? "bg-primary text-on-primary shadow-md"
              : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
          }`}
        >
          <Icon name="sync_alt" className="text-[18px]" />
          <span>Arbitrage &amp; Relances WA</span>
          {pendingList.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-900 text-[11px] font-extrabold">
              {pendingList.length}
            </span>
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: COMMANDES DIRECTES CONVERSATIONNELLES                          */}
      {/* ========================================================================= */}
      {merchantSubTab === "DIRECT_ORDERS" && (
        <section className="space-y-4 animate-fadeIn">
          {/* Status Tabs Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: "ALL", label: "Toutes", count: conversationalOrders.length, icon: "list_alt" },
              {
                id: "PENDING",
                label: "À Accepter",
                count: pendingConvCount,
                icon: "hourglass_top",
                urgent: pendingConvCount > 0,
              },
              { id: "ACCEPTED", label: "Acceptées", count: acceptedConvCount, icon: "check_circle" },
              { id: "PAID", label: "Soldées", count: paidConvCount, icon: "payments" },
              { id: "IN_DELIVERY", label: "En Livraison", count: inDeliveryConvCount, icon: "local_shipping" },
              { id: "DELIVERED", label: "Livrées", count: deliveredConvCount, icon: "task_alt" },
              { id: "CANCELLED", label: "Refusées", count: cancelledConvCount, icon: "cancel" },
            ].map((tab) => {
              const active = convStatusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setConvStatusFilter(tab.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer border ${
                    active
                      ? "bg-primary text-on-primary border-primary shadow-sm"
                      : "bg-surface-container border-slate-200 dark:border-slate-800 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                  }`}
                >
                  <Icon name={tab.icon} className="text-[15px]" />
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                      tab.urgent && !active
                        ? "bg-rose-500 text-white animate-pulse"
                        : active
                        ? "bg-white/20 text-white"
                        : "bg-surface-container-highest text-on-surface-variant"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Quick Search */}
          <div className="relative">
            <Icon
              name="search"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par n° commande, client, ville, produit..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-surface-container border-2 border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
              >
                <Icon name="close" className="text-[16px]" />
              </button>
            )}
          </div>

          {/* Orders List */}
          {filteredConversationalOrders.length === 0 ? (
            <div className="p-8 rounded-2xl bg-surface-container border-2 border-dashed border-slate-200 dark:border-slate-800 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <Icon name="inbox" className="text-[28px]" />
              </div>
              <h3 className="font-bold text-sm sm:text-base text-on-surface">
                {convStatusFilter === "ALL"
                  ? "Aucune commande directe pour l'instant"
                  : "Aucune commande dans cet état"}
              </h3>
              <p className="text-xs text-on-surface-variant max-w-md mx-auto leading-relaxed">
                Les commandes passées par vos clients depuis la vitrine avec sélection d'articles,
                adresse et géolocalisation apparaîtront ici avec possibilité d'acceptation en 1 clic.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredConversationalOrders.map((order) => {
                const orderNum = order.order_number || order.reference_code || order.id?.substring(0, 8);
                const st = (order.status || "").toUpperCase();
                const paySt = (order.payment_status || "").toUpperCase();
                const isPending = ["PENDING_SELLER_ACCEPTANCE", "PENDING", "CREATED"].includes(st);
                const isAccepted = st === "ACCEPTED";
                const isPaid =
                  paySt === "PAID" ||
                  paySt === "CONFIRMED" ||
                  st === "PAID" ||
                  st === "PREPARING" ||
                  st === "READY_FOR_DELIVERY";
                const isInDelivery = ["OUT_FOR_DELIVERY", "IN_DELIVERY"].includes(st);
                const isDelivered = ["DELIVERED", "COMPLETED"].includes(st);
                const isCancelled = ["CANCELLED", "REJECTED"].includes(st);

                const lat = order.delivery?.latitude ?? order.delivery_lat;
                const lng = order.delivery?.longitude ?? order.delivery_lng;
                const hasGps = lat != null && lng != null && !isNaN(Number(lat)) && !isNaN(Number(lng));
                const mapsUrl = hasGps
                  ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
                  : order.delivery?.maps_url || null;

                const phoneClean = (order.customer_phone || "").replace(/\D/g, "");
                const whatsappNumber = phoneClean.length === 8 ? `226${phoneClean}` : phoneClean;
                const whatsappMsg = `Bonjour ${order.customer_name || "Client"}, suite à votre commande #${orderNum} sur notre boutique ${store?.name || "GotoShop"} : `;

                return (
                  <div
                    key={order.id || orderNum}
                    className="rounded-2xl p-4 sm:p-5 bg-surface-container border-2 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all space-y-3.5 relative overflow-hidden"
                  >
                    {/* Header Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-lg">
                          #{orderNum}
                        </span>
                        <span className="text-[11px] text-on-surface-variant flex items-center gap-1">
                          <Icon name="schedule" className="text-[13px]" />
                          {order.created_at
                            ? new Date(order.created_at).toLocaleDateString("fr-FR", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Récent"}
                        </span>
                      </div>

                      {/* Status Badge */}
                      {isPending && (
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/15 border-2 border-amber-500/40 text-amber-600 dark:text-amber-400 font-bold text-xs flex items-center gap-1.5 animate-pulse">
                          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                          <span>À Accepter (1 Clic)</span>
                        </span>
                      )}
                      {isAccepted && !isPaid && (
                        <span className="px-2.5 py-1 rounded-full bg-blue-500/15 border-2 border-blue-500/40 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center gap-1.5">
                          <Icon name="hourglass_top" className="text-[14px]" />
                          <span>Acceptée • Attente Paiement</span>
                        </span>
                      )}
                      {isPaid && !isInDelivery && !isDelivered && (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border-2 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-1.5">
                          <Icon name="payments" className="text-[14px]" />
                          <span>Soldée (Mobile Money)</span>
                        </span>
                      )}
                      {isInDelivery && (
                        <span className="px-2.5 py-1 rounded-full bg-purple-500/15 border-2 border-purple-500/40 text-purple-600 dark:text-purple-400 font-bold text-xs flex items-center gap-1.5">
                          <Icon name="local_shipping" className="text-[14px]" />
                          <span>En cours de livraison</span>
                        </span>
                      )}
                      {isDelivered && (
                        <span className="px-2.5 py-1 rounded-full bg-teal-500/15 border-2 border-teal-500/40 text-teal-600 dark:text-teal-400 font-bold text-xs flex items-center gap-1.5">
                          <Icon name="task_alt" className="text-[14px]" />
                          <span>Livrée avec succès</span>
                        </span>
                      )}
                      {isCancelled && (
                        <span className="px-2.5 py-1 rounded-full bg-rose-500/15 border-2 border-rose-500/40 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center gap-1.5">
                          <Icon name="cancel" className="text-[14px]" />
                          <span>Refusée / Annulée</span>
                        </span>
                      )}
                    </div>

                    {/* Customer Information Block */}
                    <div className="p-3 rounded-xl bg-surface-container-high border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-xs">
                          {(order.customer_name || "C")[0].toUpperCase()}
                        </div>
                        <div>
                          <span className="font-bold text-xs sm:text-sm text-on-surface block">
                            {order.customer_name || "Client GotoShop"}
                          </span>
                          <span className="text-[11px] text-on-surface-variant font-mono">
                            {order.customer_phone || "Téléphone non renseigné"}
                          </span>
                        </div>
                      </div>

                      {/* Contact Shortcuts */}
                      <div className="flex items-center gap-2 shrink-0">
                        {order.customer_phone && (
                          <>
                            <a
                              href={`tel:${phoneClean}`}
                              className="px-2.5 py-1 rounded-lg bg-surface-container-highest hover:bg-primary hover:text-white text-on-surface text-xs font-semibold flex items-center gap-1 transition-colors"
                              title="Appeler directement"
                            >
                              <Icon name="call" className="text-[14px]" />
                              <span>Appeler</span>
                            </a>
                            <a
                              href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMsg)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500 hover:text-white text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1 transition-all"
                              title="Discuter sur WhatsApp"
                            >
                              <Icon name="chat" className="text-[14px]" />
                              <span>WhatsApp</span>
                            </a>
                          </>
                        )}
                        {order.conversation_id && onOpenChat && (
                          <button
                            type="button"
                            onClick={() => onOpenChat(order.conversation_id)}
                            className="px-2.5 py-1 rounded-lg bg-primary/15 hover:bg-primary hover:text-white text-primary border border-primary/30 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                            title="Ouvrir le chat interactif"
                          >
                            <Icon name="forum" className="text-[14px]" />
                            <span>Chat</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Delivery & GPS Location */}
                    <div className="p-3 rounded-xl bg-surface-container-high border border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-xs space-y-0.5">
                          <span className="font-bold text-on-surface flex items-center gap-1">
                            <Icon name="pin_drop" className="text-[15px] text-primary" />
                            <span>
                              {order.delivery?.delivery_city || order.delivery_city || "Ouagadougou"}
                            </span>
                          </span>
                          <p className="text-[11px] text-on-surface-variant leading-relaxed">
                            {order.delivery?.delivery_address ||
                              order.delivery_address ||
                              "Adresse non détaillée"}
                          </p>
                          {order.delivery?.delivery_notes && (
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 italic">
                              Indication : « {order.delivery.delivery_notes} »
                            </p>
                          )}
                        </div>

                        {/* GPS Button */}
                        {hasGps ? (
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 active:scale-95 text-white font-bold text-xs shadow-xs transition-transform shrink-0 cursor-pointer"
                            title="Ouvrir la position GPS exacte dans Google Maps"
                          >
                            <Icon name="location_on" className="text-[15px]" />
                            <span>Google Maps GPS 📍</span>
                          </a>
                        ) : (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                              (order.delivery?.delivery_address || order.delivery_address || "") +
                                " " +
                                (order.delivery?.delivery_city || order.delivery_city || "Ouagadougou")
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-sky-600 dark:text-sky-400 hover:underline font-semibold shrink-0"
                          >
                            <Icon name="map" className="text-[14px]" />
                            <span>Rechercher Maps</span>
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Ordered Items List */}
                    <div className="space-y-1.5 text-xs">
                      <span className="font-bold text-[10px] uppercase tracking-wider text-on-surface-variant block">
                        Articles commandés ({(order.items || []).length || 1})
                      </span>
                      <div className="rounded-xl bg-surface-container-high p-2.5 space-y-1.5 divide-y divide-slate-200 dark:divide-slate-800">
                        {(order.items || []).length > 0 ? (
                          order.items.map((it, idx) => (
                            <div key={idx} className="pt-1.5 first:pt-0 flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <span className="font-semibold text-on-surface block truncate">
                                  {it.product_name}
                                </span>
                                <span className="text-[11px] text-on-surface-variant">
                                  {formatSalesQuantity(it.quantity, it.unit_label)} ×{" "}
                                  {(it.unit_price || 0).toLocaleString("fr-FR")} {order.currency || "FCFA"}
                                  {it.variant_name ? ` • ${it.variant_name}` : ""}
                                </span>
                              </div>
                              <span className="font-bold text-on-surface shrink-0 tabular-nums">
                                {(it.total_price || (it.unit_price || 0) * (it.quantity || 1)).toLocaleString("fr-FR")}{" "}
                                {order.currency || "FCFA"}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-on-surface">{order.product_name || "Produit"}</span>
                            <span className="font-bold text-on-surface tabular-nums">
                              {(order.total_amount || 0).toLocaleString("fr-FR")} {order.currency || "FCFA"}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Total Bar */}
                      <div className="flex items-center justify-between pt-1 px-1 text-xs">
                        <span className="text-on-surface-variant">Total à encaisser :</span>
                        <span className="text-sm font-bold text-primary tabular-nums">
                          {(order.total_amount || 0).toLocaleString("fr-FR")} {order.currency || "FCFA"}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons Section */}
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                      {isPending && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={processingOrderId === order.id}
                            onClick={() => handleAcceptDirectOrder(order.id)}
                            className="h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                          >
                            <Icon name="check_circle" className="text-[18px]" />
                            <span>
                              {processingOrderId === order.id ? "Traitement..." : "✓ Accepter la Commande (1 Clic)"}
                            </span>
                          </button>
                          <button
                            type="button"
                            disabled={processingOrderId === order.id}
                            onClick={() => handleRejectDirectOrder(order.id)}
                            className="h-10 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 active:scale-98 text-rose-600 dark:text-rose-400 border border-rose-500/30 font-bold text-xs sm:text-sm flex items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                          >
                            <Icon name="close" className="text-[18px]" />
                            <span>Refuser</span>
                          </button>
                        </div>
                      )}

                      {isAccepted && !isPaid && (
                        <div className="space-y-2">
                          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5">
                              <Icon name="info" className="text-[16px] shrink-0" />
                              <span>En attente du règlement Mobile Money LigdiCash du client.</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(order.id, "PAID")}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shrink-0 transition-colors cursor-pointer"
                              title="Si le client a déjà payé en espèces ou par virement direct"
                            >
                              Valider paiement reçu
                            </button>
                          </div>
                        </div>
                      )}

                      {isPaid && !isInDelivery && !isDelivered && (
                        <button
                          type="button"
                          disabled={processingOrderId === order.id}
                          onClick={() => handleUpdateStatus(order.id, "IN_DELIVERY")}
                          className="w-full h-10 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-98 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                        >
                          <Icon name="local_shipping" className="text-[18px]" />
                          <span>🚚 Expédier / Marquer En Cours de Livraison</span>
                        </button>
                      )}

                      {isInDelivery && (
                        <button
                          type="button"
                          disabled={processingOrderId === order.id}
                          onClick={() => handleUpdateStatus(order.id, "DELIVERED")}
                          className="w-full h-10 rounded-xl bg-teal-600 hover:bg-teal-500 active:scale-98 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                        >
                          <Icon name="task_alt" className="text-[18px]" />
                          <span>🎉 Confirmer la Livraison Reçue par le Client</span>
                        </button>
                      )}

                      {/* Detail View Button */}
                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          onClick={() => setSelectedConversationalOrder(order)}
                          className="text-xs text-primary hover:underline font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Icon name="visibility" className="text-[14px]" />
                          <span>Voir la fiche complète &amp; reçu</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: ARBITRAGE & RELANCES WHATSAPP (ANCIEN FLUX)                     */}
      {/* ========================================================================= */}
      {merchantSubTab === "ARBITRAGE" && (
        <>
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
        </>
      )}

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

      {/* Detail Modal for Selected Conversational Direct Order */}
      {selectedConversationalOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
          <div className="rounded-2xl bg-surface border-2 border-slate-300 dark:border-slate-700 p-5 sm:p-6 max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-y-auto space-y-4 text-on-surface">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-bold">
                  <Icon name="receipt_long" className="text-[20px]" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base">
                    Commande #{selectedConversationalOrder.order_number || selectedConversationalOrder.reference_code || selectedConversationalOrder.id?.substring(0, 8)}
                  </h3>
                  <span className="text-[11px] text-on-surface-variant">
                    {selectedConversationalOrder.created_at
                      ? new Date(selectedConversationalOrder.created_at).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Date non précisée"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedConversationalOrder(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
              >
                <Icon name="close" className="text-[18px]" />
              </button>
            </div>

            {/* Customer Details */}
            <div className="p-3.5 rounded-xl bg-surface-container space-y-2 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs uppercase tracking-wider text-primary flex items-center gap-1">
                  <Icon name="person" className="text-[14px]" />
                  <span>Client &amp; Contact</span>
                </span>
                <span className="text-[11px] font-bold text-on-surface">
                  {selectedConversationalOrder.customer_name || "Client"}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-xs font-mono text-on-surface-variant">
                  {selectedConversationalOrder.customer_phone || "Téléphone non renseigné"}
                </span>
                <div className="flex items-center gap-2">
                  {selectedConversationalOrder.customer_phone && (
                    <>
                      <a
                        href={`tel:${(selectedConversationalOrder.customer_phone || "").replace(/\D/g, "")}`}
                        className="px-2.5 py-1 rounded-lg bg-surface-container-highest hover:bg-primary hover:text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                      >
                        <Icon name="call" className="text-[13px]" />
                        <span>Appeler</span>
                      </a>
                      <a
                        href={`https://wa.me/${(selectedConversationalOrder.customer_phone || "").replace(/\D/g, "")}?text=${encodeURIComponent(
                          `Bonjour ${selectedConversationalOrder.customer_name || "Client"}, concernant votre commande #${selectedConversationalOrder.order_number || selectedConversationalOrder.reference_code} : `
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500 hover:text-white text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1 transition-all"
                      >
                        <Icon name="chat" className="text-[13px]" />
                        <span>WhatsApp</span>
                      </a>
                    </>
                  )}
                  {selectedConversationalOrder.conversation_id && onOpenChat && (
                    <button
                      type="button"
                      onClick={() => {
                        const convId = selectedConversationalOrder.conversation_id;
                        setSelectedConversationalOrder(null);
                        onOpenChat(convId);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-primary/15 hover:bg-primary hover:text-white text-primary border border-primary/30 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <Icon name="forum" className="text-[13px]" />
                      <span>Chat</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Delivery & GPS Location */}
            <div className="p-3.5 rounded-xl bg-surface-container space-y-2 border border-slate-200 dark:border-slate-800">
              <span className="font-bold text-xs uppercase tracking-wider text-primary flex items-center gap-1">
                <Icon name="local_shipping" className="text-[14px]" />
                <span>Adresse &amp; Géolocalisation</span>
              </span>
              <div className="text-xs space-y-1">
                <p>
                  <strong>Ville :</strong>{" "}
                  {selectedConversationalOrder.delivery?.delivery_city ||
                    selectedConversationalOrder.delivery_city ||
                    "Ouagadougou"}
                </p>
                <p>
                  <strong>Adresse :</strong>{" "}
                  {selectedConversationalOrder.delivery?.delivery_address ||
                    selectedConversationalOrder.delivery_address ||
                    "Non renseignée"}
                </p>
                {selectedConversationalOrder.delivery?.delivery_notes && (
                  <p className="text-amber-600 dark:text-amber-400 italic">
                    <strong>Indication :</strong> « {selectedConversationalOrder.delivery.delivery_notes} »
                  </p>
                )}
              </div>

              {/* GPS Maps Link */}
              {(() => {
                const lat =
                  selectedConversationalOrder.delivery?.latitude ??
                  selectedConversationalOrder.delivery_lat;
                const lng =
                  selectedConversationalOrder.delivery?.longitude ??
                  selectedConversationalOrder.delivery_lng;
                const hasGps =
                  lat != null && lng != null && !isNaN(Number(lat)) && !isNaN(Number(lng));
                if (hasGps) {
                  return (
                    <div className="pt-1">
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2 px-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-transform active:scale-98"
                      >
                        <Icon name="location_on" className="text-[16px]" />
                        <span>Ouvrir les Coordonnées GPS dans Google Maps 📍</span>
                      </a>
                    </div>
                  );
                }
                return (
                  <div className="pt-1">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        (selectedConversationalOrder.delivery?.delivery_address || "") +
                          " " +
                          (selectedConversationalOrder.delivery?.delivery_city || "Ouagadougou")
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <Icon name="map" className="text-[14px]" />
                      <span>Rechercher cette adresse sur Google Maps</span>
                    </a>
                  </div>
                );
              })()}
            </div>

            {/* Articles Details */}
            <div className="p-3.5 rounded-xl bg-surface-container space-y-2.5 border border-slate-200 dark:border-slate-800">
              <span className="font-bold text-xs uppercase tracking-wider text-primary flex items-center gap-1">
                <Icon name="shopping_bag" className="text-[14px]" />
                <span>Détail du panier</span>
              </span>
              <div className="space-y-2 divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {(selectedConversationalOrder.items || []).length > 0 ? (
                  selectedConversationalOrder.items.map((it, idx) => (
                    <div key={idx} className="pt-2 first:pt-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-on-surface">{it.product_name}</span>
                        <span className="font-bold text-on-surface tabular-nums">
                          {(it.total_price || (it.unit_price || 0) * (it.quantity || 1)).toLocaleString("fr-FR")}{" "}
                          {selectedConversationalOrder.currency || "FCFA"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
                        <span>
                          Quantité : {formatSalesQuantity(it.quantity, it.unit_label)} ×{" "}
                          {(it.unit_price || 0).toLocaleString("fr-FR")} {selectedConversationalOrder.currency || "FCFA"}
                        </span>
                        {it.variant_name && <span>Variante : {it.variant_name}</span>}
                      </div>
                      {it.customization_text && (
                        <p className="text-[10px] text-primary italic">
                          Personnalisation : « {it.customization_text} »
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-between text-xs">
                    <span>{selectedConversationalOrder.product_name || "Produit commandé"}</span>
                    <span className="font-bold">
                      {(selectedConversationalOrder.total_amount || 0).toLocaleString("fr-FR")}{" "}
                      {selectedConversationalOrder.currency || "FCFA"}
                    </span>
                  </div>
                )}
              </div>

              {/* Financial Calculation */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1 text-xs">
                <div className="flex justify-between text-on-surface-variant">
                  <span>Sous-total articles :</span>
                  <span className="tabular-nums">
                    {(
                      selectedConversationalOrder.subtotal_amount ||
                      selectedConversationalOrder.total_amount ||
                      0
                    ).toLocaleString("fr-FR")}{" "}
                    {selectedConversationalOrder.currency || "FCFA"}
                  </span>
                </div>
                {selectedConversationalOrder.delivery_fee > 0 && (
                  <div className="flex justify-between text-on-surface-variant">
                    <span>Frais de livraison express :</span>
                    <span className="tabular-nums">
                      {selectedConversationalOrder.delivery_fee.toLocaleString("fr-FR")}{" "}
                      {selectedConversationalOrder.currency || "FCFA"}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-on-surface pt-1 border-t border-slate-200 dark:border-slate-800">
                  <span>Total commande :</span>
                  <span className="text-primary tabular-nums">
                    {(selectedConversationalOrder.total_amount || 0).toLocaleString("fr-FR")}{" "}
                    {selectedConversationalOrder.currency || "FCFA"}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment & LigdiCash Information */}
            <div className="p-3.5 rounded-xl bg-surface-container space-y-2 border border-slate-200 dark:border-slate-800 text-xs">
              <span className="font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                <Icon name="payments" className="text-[14px]" />
                <span>Statut du Règlement</span>
              </span>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Mode de règlement :</span>
                  <span className="font-bold">
                    {selectedConversationalOrder.payment?.payment_method || "Mobile Money (LigdiCash)"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">État du paiement :</span>
                  <span className="font-bold">
                    {selectedConversationalOrder.payment_status === "PAID"
                      ? "✓ Surchargé / Soldé"
                      : "⏳ En attente de règlement client"}
                  </span>
                </div>
                {selectedConversationalOrder.payment?.transaction_reference && (
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">Réf. transaction :</span>
                    <span className="font-mono text-[11px] text-secondary">
                      {selectedConversationalOrder.payment.transaction_reference}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              {["PENDING_SELLER_ACCEPTANCE", "PENDING", "CREATED"].includes(
                (selectedConversationalOrder.status || "").toUpperCase()
              ) && (
                <>
                  <button
                    type="button"
                    disabled={processingOrderId === selectedConversationalOrder.id}
                    onClick={async () => {
                      await handleAcceptDirectOrder(selectedConversationalOrder.id);
                      setSelectedConversationalOrder(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer"
                  >
                    ✓ Accepter la Commande
                  </button>
                  <button
                    type="button"
                    disabled={processingOrderId === selectedConversationalOrder.id}
                    onClick={async () => {
                      await handleRejectDirectOrder(selectedConversationalOrder.id);
                      setSelectedConversationalOrder(null);
                    }}
                    className="px-3 py-2 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-bold transition-all cursor-pointer"
                  >
                    Refuser
                  </button>
                </>
              )}

              {selectedConversationalOrder.status === "ACCEPTED" && (
                <button
                  type="button"
                  onClick={async () => {
                    await handleUpdateStatus(selectedConversationalOrder.id, "PAID");
                    setSelectedConversationalOrder(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer"
                >
                  Valider Paiement Reçu en Espèces
                </button>
              )}

              {["PAID", "PREPARING"].includes(selectedConversationalOrder.status) && (
                <button
                  type="button"
                  onClick={async () => {
                    await handleUpdateStatus(selectedConversationalOrder.id, "IN_DELIVERY");
                    setSelectedConversationalOrder(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all cursor-pointer"
                >
                  🚚 Marquer En Cours de Livraison
                </button>
              )}

              {selectedConversationalOrder.status === "IN_DELIVERY" && (
                <button
                  type="button"
                  onClick={async () => {
                    await handleUpdateStatus(selectedConversationalOrder.id, "DELIVERED");
                    setSelectedConversationalOrder(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all cursor-pointer"
                >
                  🎉 Confirmer Livraison Reçue
                </button>
              )}

              <button
                type="button"
                onClick={() => setSelectedConversationalOrder(null)}
                className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-highest text-on-surface text-xs font-bold transition-all cursor-pointer"
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
              {(notificationsData?.notifications || []).length === 0 ? (
                <div className="p-8 text-center text-on-surface-variant text-xs space-y-2">
                  <Icon name="notifications_off" className="text-[32px] opacity-40" />
                  <p>Aucune notification pour le moment. Tout est à jour !</p>
                </div>
              ) : (
                (notificationsData?.notifications || []).map((n) => {
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
