import React, { useState, useEffect } from "react";
import Icon from "./Icon";
import {
  fetchCustomerOrders,
  fetchConversationalOrders,
  cancelConversationalOrder,
  getCustomerToken,
  getMediaUrl,
  getLocalGuestOrders,
  updateLocalGuestOrder,
  recordClientOrderAction,
  dataCache,
} from "../api/client";
import { formatSalesQuantity } from "../utils/salesEngine";
import Footer from "./Footer";
import MobileMoneyPaymentModal from "./MobileMoneyPaymentModal";

export default function ClientCommandesPage({
  customer,
  onOpenAuth,
  onNavigateToShop,
  showToast,
  onOpenChat,
}) {
  const [orders, setOrders] = useState(() => {
    const local = getLocalGuestOrders();
    const token = customer?.session_token || getCustomerToken();
    const cachedCust = token ? dataCache.get(`customer:orders:${token}`) || [] : [];
    return cachedCust.length > 0 ? cachedCust : local;
  });

  const [loading, setLoading] = useState(() => {
    const local = getLocalGuestOrders();
    const token = customer?.session_token || getCustomerToken();
    const hasCached = token ? dataCache.has(`customer:orders:${token}`) : false;
    return !hasCached && local.length === 0;
  });

  // Tab filter: "ALL" | "PENDING" | "ACCEPTED" | "PAID" | "DELIVERED" | "AVANTAGES"
  const [statusTab, setStatusTab] = useState("ALL");

  // Detailed Modal for Structured Order inspection
  const [selectedOrderDetail, setSelectedOrderDetail] = useState(null);

  // Mobile Money Payment Modal
  const [paymentOrder, setPaymentOrder] = useState(null);

  // Modals for satisfaction and cancellation
  const [actionOrder, setActionOrder] = useState(null);
  const [actionType, setActionType] = useState(null); // "SATISFY" | "CANCEL"
  const [cancelReason, setCancelReason] = useState("Changement d'avis");
  const [customReason, setCustomReason] = useState("");
  const [rating, setRating] = useState(5);
  const [feedbackNote, setFeedbackNote] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);

  useEffect(() => {
    loadOrders();
  }, [customer]);

  const loadOrders = async () => {
    if (!orders.length) {
      setLoading(true);
    }
    try {
      const token = customer?.session_token || getCustomerToken();
      let combined = [];

      // 1. Fetch conversational orders from backend
      try {
        const convOrders = await fetchConversationalOrders({
          customer_id: customer?.id,
          customer_token: token,
        });
        if (Array.isArray(convOrders) && convOrders.length > 0) {
          combined = convOrders.map((o) => ({
            ...o,
            reference_code: o.order_number || o.reference_code,
            product_name: o.items?.length
              ? o.items.map((it) => `${it.product_name} (${it.quantity})`).join(", ")
              : (o.product_name || "Commande"),
            product_image_url: o.items?.[0]?.primary_image_url || o.product_image_url,
          }));
        }
      } catch (e) {
        console.warn("fetchConversationalOrders warning:", e);
      }

      // 2. Fetch authenticated customer legacy intents
      if (customer) {
        try {
          const custOrders = await fetchCustomerOrders();
          if (Array.isArray(custOrders)) {
            custOrders.forEach((co) => {
              if (
                !combined.some(
                  (o) =>
                    o.id === co.id ||
                    (co.reference_code && (o.order_number === co.reference_code || o.reference_code === co.reference_code))
                )
              ) {
                combined.push(co);
              }
            });
          }
        } catch (e) {}
      }

      // 3. Merge local guest orders
      const local = getLocalGuestOrders();
      if (Array.isArray(local) && local.length > 0) {
        local.forEach((lo) => {
          if (
            !combined.some(
              (o) =>
                o.id === lo.id ||
                (lo.reference_code && (o.order_number === lo.reference_code || o.reference_code === lo.reference_code))
            )
          ) {
            combined.push(lo);
          }
        });
      }

      setOrders(combined);
    } catch (err) {
      showToast("Erreur lors du chargement des commandes");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (isoStr) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  // State classification helpers
  const isOrderCancelled = (o) =>
    o.status === "CANCELLED" || o.client_status === "CANCELLED";

  const isOrderPending = (o) =>
    !isOrderCancelled(o) &&
    (o.status === "PENDING_SELLER_ACCEPTANCE" ||
      o.status === "PENDING" ||
      o.client_status === "PENDING" ||
      o.status === "DRAFT");

  const isOrderAccepted = (o) =>
    !isOrderCancelled(o) &&
    (o.status === "ACCEPTED" || o.payment_status === "PAYMENT_PENDING") &&
    o.payment_status !== "PAYMENT_CONFIRMED" &&
    o.status !== "PAID" &&
    o.status !== "DELIVERED" &&
    o.status !== "COMPLETED";

  const isOrderPaid = (o) =>
    !isOrderCancelled(o) &&
    (o.status === "PAID" ||
      o.payment_status === "PAYMENT_CONFIRMED" ||
      o.status === "PREPARING" ||
      o.status === "READY_FOR_DELIVERY" ||
      o.status === "OUT_FOR_DELIVERY") &&
    o.status !== "DELIVERED" &&
    o.status !== "COMPLETED" &&
    o.client_status !== "SATISFIED";

  const isOrderDelivered = (o) =>
    !isOrderCancelled(o) &&
    (o.status === "DELIVERED" ||
      o.status === "COMPLETED" ||
      o.client_status === "SATISFIED" ||
      o.is_sold === true ||
      o.status === "SOLD");

  // Counts for tabs
  const pendingOrders = orders.filter(isOrderPending);
  const acceptedOrders = orders.filter(isOrderAccepted);
  const paidOrders = orders.filter(isOrderPaid);
  const deliveredOrders = orders.filter(isOrderDelivered);

  // Filtered orders according to selected tab
  const getFilteredOrders = () => {
    switch (statusTab) {
      case "PENDING":
        return pendingOrders;
      case "ACCEPTED":
        return acceptedOrders;
      case "PAID":
        return paidOrders;
      case "DELIVERED":
        return deliveredOrders;
      case "ALL":
      default:
        return orders;
    }
  };

  const filteredOrders = getFilteredOrders();

  // Perks / Bonus points calculation (5% of paid/delivered orders or customer points)
  const calculateTotalBonusPoints = () => {
    if (customer?.bonus_points) return customer.bonus_points;
    const eligibleAmount = orders
      .filter((o) => isOrderPaid(o) || isOrderDelivered(o))
      .reduce((sum, o) => sum + (o.total_amount || 0), 0);
    return Math.round(eligibleAmount * 0.05);
  };
  const totalBonusPoints = calculateTotalBonusPoints();

  const handleOpenSatisfyModal = (order) => {
    setActionOrder(order);
    setActionType("SATISFY");
    setRating(5);
    setFeedbackNote("Produit reçu en parfait état, très satisfait(e) !");
  };

  const handleOpenCancelModal = (order) => {
    setActionOrder(order);
    setActionType("CANCEL");
    setCancelReason("Changement d'avis");
    setCustomReason("");
  };

  const handleSubmitAction = async () => {
    if (!actionOrder) return;
    setSubmittingAction(true);

    try {
      let reasonToSend = "";
      if (actionType === "SATISFY") {
        reasonToSend = feedbackNote.trim() || "Client très satisfait(e)";
      } else {
        reasonToSend = cancelReason === "Autre" ? customReason.trim() || "Annulation client" : cancelReason;
      }

      if (actionType === "CANCEL") {
        try {
          await cancelConversationalOrder(actionOrder.id, reasonToSend);
        } catch (e) {
          await recordClientOrderAction(actionOrder.id, actionType, reasonToSend, rating).catch(() => {});
        }
      } else {
        await recordClientOrderAction(actionOrder.id, actionType, reasonToSend, rating);
      }

      // Update local storage if guest
      if (!customer) {
        updateLocalGuestOrder(actionOrder.id, {
          status: actionType === "CANCEL" ? "CANCELLED" : actionOrder.status,
          client_status: actionType === "CANCEL" ? "CANCELLED" : "SATISFIED",
          client_feedback: reasonToSend,
          client_satisfaction_rating: rating,
        });
      }

      // Update UI state
      setOrders((prev) =>
        prev.map((o) =>
          o.id === actionOrder.id
            ? {
                ...o,
                status: actionType === "CANCEL" ? "CANCELLED" : o.status,
                client_status: actionType === "CANCEL" ? "CANCELLED" : "SATISFIED",
                client_feedback: reasonToSend,
                client_satisfaction_rating: rating,
              }
            : o
        )
      );

      if (selectedOrderDetail?.id === actionOrder.id) {
        setSelectedOrderDetail((prev) => ({
          ...prev,
          status: actionType === "CANCEL" ? "CANCELLED" : prev.status,
          client_status: actionType === "CANCEL" ? "CANCELLED" : "SATISFIED",
        }));
      }

      if (actionType === "SATISFY") {
        showToast("⭐ Merci ! Votre satisfaction a été enregistrée.");
      } else {
        showToast("❌ Commande annulée avec succès.");
      }

      setActionOrder(null);
      setActionType(null);
    } catch (err) {
      showToast(err.message || "Erreur lors de l'action");
    } finally {
      setSubmittingAction(false);
    }
  };

  const handlePaymentSuccess = (paymentResult) => {
    // Update local orders list to show PAID
    setOrders((prev) =>
      prev.map((o) =>
        o.id === paymentResult.order_id
          ? {
              ...o,
              status: "PAID",
              payment_status: "PAYMENT_CONFIRMED",
              transaction_reference: paymentResult.transaction_reference,
            }
          : o
      )
    );

    if (selectedOrderDetail?.id === paymentResult.order_id) {
      setSelectedOrderDetail((prev) => ({
        ...prev,
        status: "PAID",
        payment_status: "PAYMENT_CONFIRMED",
        transaction_reference: paymentResult.transaction_reference,
      }));
    }

    setPaymentOrder(null);
    setStatusTab("PAID");
    showToast?.("🎉 Paiement validé ! Votre commande est passée en préparation pour livraison express (45 min - 2h).");
  };

  const isGuest = !customer;

  return (
    <div className="flex flex-col w-full gap-5 sm:gap-6 max-w-2xl sm:max-w-3xl mx-auto pb-32">
      {/* Header Profile Bar */}
      <div className="flex items-center justify-between px-space-xs pt-1">
        <div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">
            Mes Commandes
          </h2>
          <p className="text-xs text-on-surface-variant">
            {isGuest ? (
              <span>Commandes mémorisées sur cet appareil</span>
            ) : (
              <span>Commandes associées au <span className="text-secondary font-mono">{customer.phone}</span></span>
            )}
          </p>
        </div>
        <button
          onClick={loadOrders}
          className="w-9 h-9 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant flex items-center justify-center transition-transform active:scale-95 border border-slate-300 dark:border-slate-700 cursor-pointer"
          title="Actualiser"
        >
          <Icon name="refresh" className="text-[18px]" />
        </button>
      </div>

      {/* Guest Smart Nudge Banner */}
      {isGuest && (
        <div className="rounded-2xl bg-surface-container p-4 border-2 border-primary/30 shadow-sm flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <Icon name="stars" className="text-[22px]" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-headline-sm text-sm font-bold text-on-surface">
                {orders.length > 0
                  ? `⭐ ${orders.length} commande(s) enregistrée(s)`
                  : "Débloquez vos privilèges Awa Club"}
              </h3>
              <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
                Inscrivez-vous (Nom + WhatsApp) pour retrouver vos commandes sur tous vos appareils et cumuler vos points fidélité.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenAuth}
            className="w-full h-11 rounded-xl bg-primary text-on-primary font-label-md text-xs font-bold flex items-center justify-center gap-2 shadow hover:brightness-105 tap-scale transition-all cursor-pointer"
          >
            <Icon name="bolt" className="text-[18px]" />
            <span>Activer mon compte fidélité</span>
          </button>
        </div>
      )}

      {/* Structured Status Tabs Bar: En attente, Accepter, Solder, Reçu, Avantages */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 no-scrollbar border-b border-subtle">
        {/* 1. All */}
        <button
          onClick={() => setStatusTab("ALL")}
          className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
            statusTab === "ALL"
              ? "bg-primary text-white shadow-sm"
              : "bg-surface-secondary text-on-surface-variant hover:text-on-surface hover:bg-surface-elevated"
          }`}
        >
          <Icon name="receipt_long" className="text-[16px]" />
          <span>Toutes</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20 font-mono">
            {orders.length}
          </span>
        </button>

        {/* 2. En attente (Pending) */}
        <button
          onClick={() => setStatusTab("PENDING")}
          className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
            statusTab === "PENDING"
              ? "bg-amber-500 text-white shadow-sm"
              : "bg-surface-secondary text-on-surface-variant hover:text-on-surface hover:bg-surface-elevated"
          }`}
        >
          <Icon name="hourglass_top" className="text-[16px]" />
          <span>En attente</span>
          {pendingOrders.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-600/30 text-white font-mono">
              {pendingOrders.length}
            </span>
          )}
        </button>

        {/* 3. Acceptée (Accepted by merchant) */}
        <button
          onClick={() => setStatusTab("ACCEPTED")}
          className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
            statusTab === "ACCEPTED"
              ? "bg-emerald-600 text-white shadow-sm"
              : "bg-surface-secondary text-on-surface-variant hover:text-on-surface hover:bg-surface-elevated"
          }`}
        >
          <Icon name="check_circle" className="text-[16px]" />
          <span>Acceptées</span>
          {acceptedOrders.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-700/30 text-white font-mono animate-pulse">
              {acceptedOrders.length}
            </span>
          )}
        </button>

        {/* 4. Soldée (Paid / Mobile Money confirmed) */}
        <button
          onClick={() => setStatusTab("PAID")}
          className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
            statusTab === "PAID"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-surface-secondary text-on-surface-variant hover:text-on-surface hover:bg-surface-elevated"
          }`}
        >
          <Icon name="payments" className="text-[16px]" />
          <span>Soldées</span>
          {paidOrders.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-700/30 text-white font-mono">
              {paidOrders.length}
            </span>
          )}
        </button>

        {/* 5. Reçue (Delivered & Completed) */}
        <button
          onClick={() => setStatusTab("DELIVERED")}
          className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
            statusTab === "DELIVERED"
              ? "bg-purple-600 text-white shadow-sm"
              : "bg-surface-secondary text-on-surface-variant hover:text-on-surface hover:bg-surface-elevated"
          }`}
        >
          <Icon name="package_2" className="text-[16px]" />
          <span>Reçues</span>
          {deliveredOrders.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-700/30 text-white font-mono">
              {deliveredOrders.length}
            </span>
          )}
        </button>

        {/* 6. Avantages (Perks & Loyalty) */}
        <button
          onClick={() => setStatusTab("AVANTAGES")}
          className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
            statusTab === "AVANTAGES"
              ? "bg-amber-600 text-white shadow-sm"
              : "bg-surface-secondary text-amber-600 dark:text-amber-400 hover:bg-surface-elevated border border-amber-500/30"
          }`}
        >
          <Icon name="redeem" className="text-[16px]" />
          <span>Avantages</span>
          {totalBonusPoints > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-700/30 text-white font-mono font-bold">
              {totalBonusPoints} pts
            </span>
          )}
        </button>
      </div>

      {/* VIEW: AVANTAGES TAB */}
      {statusTab === "AVANTAGES" ? (
        <div className="space-y-4 animate-fadeIn">
          {/* Main Loyalty Balance Card */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-500/20 via-primary/10 to-surface-secondary border-2 border-amber-500/40 shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center border border-amber-500/30">
                  <Icon name="military_tech" className="text-[28px]" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-on-surface">Club Privilège GotoShop</h3>
                  <p className="text-xs text-on-surface-variant">Programme de fidélité &amp; Cashback</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold border border-amber-500/30">
                Membre Actif
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-surface/80 border border-subtle shadow-xs">
                <p className="text-[11px] text-on-surface-variant font-bold uppercase">Solde Points Fidélité</p>
                <p className="text-2xl font-bold text-amber-500 tabular-nums mt-0.5">
                  {totalBonusPoints.toLocaleString("fr-FR")} <span className="text-xs font-medium">pts</span>
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-surface/80 border border-subtle shadow-xs">
                <p className="text-[11px] text-on-surface-variant font-bold uppercase">Cashback Disponible</p>
                <p className="text-2xl font-bold text-emerald-500 tabular-nums mt-0.5">
                  {totalBonusPoints.toLocaleString("fr-FR")} <span className="text-xs font-medium">FCFA</span>
                </p>
              </div>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              💡 <strong>Comment ça marche ?</strong> Chaque commande soldée vous rapporte automatiquement <strong>5% de son montant en points fidélité</strong>. Utilisez vos points pour obtenir des réductions immédiates lors de vos prochains achats.
            </p>
          </div>

          {/* List of Perks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-surface-container border border-subtle space-y-1.5 shadow-xs">
              <div className="flex items-center gap-2 text-primary font-bold text-xs">
                <Icon name="electric_moped" className="text-[18px]" />
                <span>Livraison Prioritaire Kossodo</span>
              </div>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                Vos commandes sont traitées en priorité par les livreurs express partenaires pour un délai garanti de 45 min à 2h.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-surface-container border border-subtle space-y-1.5 shadow-xs">
              <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs">
                <Icon name="verified_user" className="text-[18px]" />
                <span>Garantie Satisfait ou Remboursé</span>
              </div>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                Protection acheteur GotoShop : en cas de non-conformité de votre article, conciliation immédiate ou remboursement.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onNavigateToShop}
            className="w-full h-11 rounded-xl bg-primary text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm hover:brightness-105 active:scale-98 transition-all cursor-pointer"
          >
            <Icon name="shopping_bag" className="text-[18px]" />
            <span>Commander et cumuler plus de points</span>
          </button>
        </div>
      ) : (
        /* ORDERS LIST ACCORDING TO FILTER */
        <div>
          {loading ? (
            <div className="p-8 text-center text-on-surface-variant text-sm">
              <Icon name="sync" className="animate-spin text-primary text-[28px] mb-2" />
              <p>Chargement de vos commandes...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="rounded-2xl bg-surface-container p-8 text-center space-y-4 shadow-card border-2 border-slate-200 dark:border-slate-800">
              <div className="w-14 h-14 rounded-full bg-surface-secondary text-on-surface-variant flex items-center justify-center mx-auto border border-slate-300 dark:border-slate-700">
                <Icon name="inventory_2" className="text-[28px]" />
              </div>
              <div className="space-y-1">
                <h3 className="font-headline-sm text-headline-sm text-on-surface">
                  {statusTab === "PENDING"
                    ? "Aucune commande en attente"
                    : statusTab === "ACCEPTED"
                    ? "Aucune commande acceptée en attente de paiement"
                    : statusTab === "PAID"
                    ? "Aucune commande soldée en préparation"
                    : statusTab === "DELIVERED"
                    ? "Aucune commande reçue"
                    : "Aucune commande pour l'instant"}
                </h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Découvrez les articles de nos boutiques pour passer une commande et suivre son expédition en direct.
                </p>
              </div>
              <button
                onClick={onNavigateToShop}
                className="px-5 py-2.5 rounded-xl bg-primary text-white font-label-md font-bold hover:brightness-105 active:scale-98 transition-all cursor-pointer shadow-md"
              >
                Explorer le Catalogue
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => {
                const isCancelled = isOrderCancelled(order);
                const isPending = isOrderPending(order);
                const isAccepted = isOrderAccepted(order);
                const isPaid = isOrderPaid(order);
                const isDelivered = isOrderDelivered(order);

                return (
                  <div
                    key={order.id}
                    className={`rounded-2xl bg-surface-container p-4 sm:p-5 shadow-card border-2 space-y-3.5 transition-all ${
                      isAccepted
                        ? "border-emerald-500/60 bg-emerald-500/5 ring-1 ring-emerald-500/20"
                        : isPaid
                        ? "border-blue-500/40 bg-blue-500/5"
                        : isCancelled
                        ? "border-rose-500/30 opacity-75"
                        : "border-slate-200 dark:border-slate-800 hover:border-primary/50"
                    }`}
                  >
                    {/* Order Top Bar */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-secondary bg-secondary/15 border border-secondary/30 px-2.5 py-0.5 rounded-full">
                          #{order.reference_code || order.order_number}
                        </span>
                        {order.store_name && (
                          <span className="text-[11px] font-semibold text-on-surface-variant hidden xs:inline">
                            • {order.store_name}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-on-surface-variant font-medium">
                        {formatDate(order.created_at)}
                      </span>
                    </div>

                    {/* Prominent State Alert Badges */}
                    {isAccepted && (
                      <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-start gap-2.5 text-xs text-emerald-700 dark:text-emerald-300">
                        <Icon name="check_circle" className="text-[20px] text-emerald-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="font-bold leading-tight">
                            🎉 Commande acceptée par le commerçant !
                          </p>
                          <p className="text-[11px] opacity-90 leading-relaxed">
                            Soldez votre commande via Mobile Money pour déclencher la <strong>livraison express garantie (45 min à 2h)</strong>. La discussion avec le vendeur est maintenant débloquée !
                          </p>
                        </div>
                      </div>
                    )}

                    {isPaid && (
                      <div className="p-3 rounded-xl bg-blue-500/15 border border-blue-500/40 flex items-start gap-2.5 text-xs text-blue-700 dark:text-blue-300">
                        <Icon name="electric_moped" className="text-[20px] text-blue-600 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <p className="font-bold leading-tight">
                            Paiement Mobile Money validé ✓ • Colis en préparation
                          </p>
                          <p className="text-[11px] opacity-90">
                            Livraison express programmée sous 45 min à 2h. Vous pouvez suivre l'avancée dans la messagerie.
                          </p>
                        </div>
                      </div>
                    )}

                    {isPending && (
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-700 dark:text-amber-400">
                        <div className="flex items-center gap-2">
                          <Icon name="hourglass_top" className="text-[18px] animate-pulse" />
                          <span>En attente de validation par le vendeur</span>
                        </div>
                        <span className="text-[10px] text-on-surface-variant italic">
                          Chat activé après acceptation
                        </span>
                      </div>
                    )}

                    {/* Products details card */}
                    {order.items && order.items.length > 0 ? (
                      <div className="space-y-2 p-3 rounded-xl bg-surface-secondary/80 border border-slate-200 dark:border-slate-700/80 shadow-xs">
                        <div className="flex items-center justify-between text-[11px] font-bold text-on-surface-variant border-b border-subtle pb-1">
                          <span>
                            {order.items.length} article{order.items.length > 1 ? "s" : ""} commandé{order.items.length > 1 ? "s" : ""}
                          </span>
                          <span className="text-primary font-bold">
                            {order.total_amount?.toLocaleString("fr-FR")} {order.currency || "FCFA"}
                          </span>
                        </div>
                        {order.items.map((it, idx) => (
                          <div key={idx} className="flex items-center gap-2.5 py-1.5 border-b border-subtle/50 last:border-0">
                            <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center shrink-0 border border-subtle overflow-hidden">
                              <img
                                src={it.primary_image_url ? getMediaUrl(it.primary_image_url) : (order.product_image_url ? getMediaUrl(order.product_image_url) : "/media/products/samsung_galaxy_a15.jpg")}
                                alt={it.product_name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src = "/media/products/samsung_galaxy_a15.jpg";
                                }}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-on-surface truncate">{it.product_name}</p>
                              <p className="text-[11px] text-on-surface-variant">
                                {it.quantity} {it.unit_label || "pièce"} × {it.unit_price?.toLocaleString("fr-FR")} {order.currency || "FCFA"}
                                {it.customization_text && (
                                  <span className="block text-primary text-[10px] italic">Note : {it.customization_text}</span>
                                )}
                              </p>
                            </div>
                            <span className="text-xs font-bold text-on-surface shrink-0">
                              {(it.total_price || it.quantity * it.unit_price)?.toLocaleString("fr-FR")} {order.currency || "FCFA"}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-secondary/80 border border-slate-200 dark:border-slate-700/80 shadow-xs">
                        <img
                          src={order.product_image_url ? getMediaUrl(order.product_image_url) : "/media/products/samsung_galaxy_a15.jpg"}
                          alt={order.product_name}
                          className="w-16 h-16 rounded-xl object-cover bg-surface shrink-0 border border-slate-300 dark:border-slate-700"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = "/media/products/samsung_galaxy_a15.jpg";
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-headline-sm text-sm text-on-surface truncate font-bold">
                            {order.product_name}
                          </h4>
                          <p className="text-xs text-on-surface-variant">
                            Quantité : <span className="text-on-surface font-semibold">{order.quantity}</span>
                            {order.selected_color && ` • ${order.selected_color}`}
                          </p>
                          <p className="text-sm font-bold text-primary tabular-nums mt-0.5">
                            {order.total_amount?.toLocaleString("fr-FR")} {order.currency || "FCFA"}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Delivery & GPS Details */}
                    <div className="flex items-center justify-between text-xs text-on-surface-variant pt-1">
                      <div className="flex items-center gap-1">
                        <Icon name="location_on" className="text-[16px] text-primary" />
                        <span>{order.delivery_city || order.delivery?.delivery_city || "Ouagadougou"}</span>
                        {(order.delivery_neighborhood || order.delivery?.delivery_address) && (
                          <span className="truncate max-w-[150px] xs:max-w-[200px]">
                            • {order.delivery_neighborhood || order.delivery?.delivery_address}
                          </span>
                        )}
                      </div>
                      {(order.customer_location_url || order.delivery?.maps_url) && (
                        <a
                          href={order.customer_location_url || order.delivery?.maps_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-secondary hover:underline flex items-center gap-1 font-semibold"
                        >
                          <Icon name="pin_drop" className="text-[14px]" />
                          <span>Maps</span>
                        </a>
                      )}
                    </div>

                    {/* Primary Interactive Action Area */}
                    <div className="pt-2 border-t border-subtle flex flex-col gap-2">
                      {/* 1. If Accepted: Solder par Mobile Money is the main CTA */}
                      {isAccepted && (
                        <button
                          type="button"
                          onClick={() => setPaymentOrder(order)}
                          className="w-full h-11 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:brightness-105 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-98 cursor-pointer"
                        >
                          <Icon name="payments" className="text-[20px]" />
                          <span>Solder par Mobile Money (Orange / Moov)</span>
                        </button>
                      )}

                      {/* 2. Chat with seller: Active IF Accepted or Paid, locked otherwise */}
                      <div className="grid grid-cols-2 gap-2">
                        {isAccepted || isPaid || isDelivered ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (onOpenChat) onOpenChat(order.conversation_id);
                            }}
                            className="h-10 rounded-xl bg-primary hover:brightness-105 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-98 cursor-pointer"
                          >
                            <Icon name="forum" className="text-[16px]" />
                            <span>Discuter avec le vendeur</span>
                          </button>
                        ) : isPending ? (
                          <button
                            type="button"
                            onClick={() => handleOpenCancelModal(order)}
                            className="h-10 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-xs font-bold flex items-center justify-center gap-1.5 transition-all border border-rose-500/30 cursor-pointer"
                          >
                            <Icon name="close" className="text-[16px]" />
                            <span>Annuler la commande</span>
                          </button>
                        ) : null}

                        {/* View Structured Details Button */}
                        <button
                          type="button"
                          onClick={() => setSelectedOrderDetail(order)}
                          className={`h-10 rounded-xl bg-surface-secondary hover:bg-surface-elevated text-on-surface text-xs font-semibold flex items-center justify-center gap-1.5 border border-subtle transition-colors cursor-pointer ${
                            isCancelled ? "col-span-2" : ""
                          }`}
                        >
                          <Icon name="receipt" className="text-[16px]" />
                          <span>Détails de la commande</span>
                        </button>
                      </div>

                      {/* If Delivered: Satisfaction Confirmation */}
                      {isDelivered && !order.client_status?.includes("SATISFIED") && (
                        <button
                          type="button"
                          onClick={() => handleOpenSatisfyModal(order)}
                          className="w-full h-9 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center justify-center gap-1.5 border border-emerald-500/30 transition-all cursor-pointer"
                        >
                          <Icon name="thumb_up" className="text-[16px]" />
                          <span>Confirmer la bonne réception / Noter</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* STRUCTURED ORDER DETAILS MODAL */}
      {selectedOrderDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg bg-surface border-2 border-slate-300 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-foreground max-h-[92vh]">
            {/* Header */}
            <div className="px-5 py-4 border-b border-subtle bg-surface-elevated flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Icon name="receipt_long" className="text-[22px]" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-on-surface">
                    Détail de la commande
                  </h3>
                  <p className="text-xs text-on-surface-variant font-mono">
                    #{selectedOrderDetail.order_number || selectedOrderDetail.reference_code}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderDetail(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-secondary transition-colors cursor-pointer"
              >
                <Icon name="close" className="text-[18px]" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Timeline Status */}
              <div className="p-3.5 rounded-xl bg-surface-secondary border border-subtle space-y-2">
                <span className="font-bold text-on-surface block uppercase tracking-wide text-[11px]">
                  État d'avancement
                </span>
                <div className="grid grid-cols-4 gap-1 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[13px] font-bold">
                      ✓
                    </div>
                    <span className="text-[10px] text-on-surface font-semibold">Créée</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold ${
                        isOrderAccepted(selectedOrderDetail) || isOrderPaid(selectedOrderDetail) || isOrderDelivered(selectedOrderDetail)
                          ? "bg-emerald-500 text-white"
                          : "bg-surface text-on-surface-variant border border-subtle"
                      }`}
                    >
                      {isOrderAccepted(selectedOrderDetail) || isOrderPaid(selectedOrderDetail) || isOrderDelivered(selectedOrderDetail) ? "✓" : "2"}
                    </div>
                    <span className="text-[10px] text-on-surface font-semibold">Acceptée</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold ${
                        isOrderPaid(selectedOrderDetail) || isOrderDelivered(selectedOrderDetail)
                          ? "bg-emerald-500 text-white"
                          : "bg-surface text-on-surface-variant border border-subtle"
                      }`}
                    >
                      {isOrderPaid(selectedOrderDetail) || isOrderDelivered(selectedOrderDetail) ? "✓" : "3"}
                    </div>
                    <span className="text-[10px] text-on-surface font-semibold">Soldée</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold ${
                        isOrderDelivered(selectedOrderDetail)
                          ? "bg-emerald-500 text-white"
                          : "bg-surface text-on-surface-variant border border-subtle"
                      }`}
                    >
                      {isOrderDelivered(selectedOrderDetail) ? "✓" : "4"}
                    </div>
                    <span className="text-[10px] text-on-surface font-semibold">Livrée</span>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <span className="font-bold text-on-surface uppercase tracking-wide text-[11px] block">
                  Articles commandés
                </span>
                <div className="divide-y divide-subtle border border-subtle rounded-xl overflow-hidden bg-surface-secondary/40">
                  {(selectedOrderDetail.items || []).map((it, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={it.primary_image_url ? getMediaUrl(it.primary_image_url) : "/media/products/samsung_galaxy_a15.jpg"}
                          alt={it.product_name}
                          className="w-12 h-12 rounded-lg object-cover bg-surface border border-subtle shrink-0"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = "/media/products/samsung_galaxy_a15.jpg";
                          }}
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-on-surface truncate">{it.product_name}</p>
                          <p className="text-[11px] text-on-surface-variant">
                            {it.quantity} {it.unit_label || "pièce"} × {it.unit_price?.toLocaleString("fr-FR")} {selectedOrderDetail.currency || "FCFA"}
                          </p>
                          {it.customization_text && (
                            <p className="text-[10px] text-primary italic">Note : {it.customization_text}</p>
                          )}
                        </div>
                      </div>
                      <span className="font-bold text-on-surface shrink-0 tabular-nums">
                        {(it.total_price || it.quantity * it.unit_price)?.toLocaleString("fr-FR")} {selectedOrderDetail.currency || "FCFA"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Calculation */}
              <div className="p-3.5 rounded-xl bg-surface-secondary border border-subtle space-y-1.5">
                <div className="flex justify-between text-on-surface-variant">
                  <span>Sous-total articles :</span>
                  <span>{((selectedOrderDetail.total_amount || 0) - (selectedOrderDetail.delivery_fee || 500)).toLocaleString("fr-FR")} {selectedOrderDetail.currency || "FCFA"}</span>
                </div>
                <div className="flex justify-between text-on-surface-variant">
                  <span>Frais de livraison express :</span>
                  <span>{(selectedOrderDetail.delivery_fee || 500).toLocaleString("fr-FR")} {selectedOrderDetail.currency || "FCFA"}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-primary border-t border-subtle pt-1.5">
                  <span>Total commande :</span>
                  <span>{selectedOrderDetail.total_amount?.toLocaleString("fr-FR")} {selectedOrderDetail.currency || "FCFA"}</span>
                </div>
              </div>

              {/* Delivery and Address */}
              <div className="p-3.5 rounded-xl bg-surface-secondary border border-subtle space-y-1.5">
                <span className="font-bold text-on-surface uppercase tracking-wide text-[11px] block">
                  Coordonnées &amp; Destination
                </span>
                <p>
                  <strong>Ville :</strong> {selectedOrderDetail.delivery_city || selectedOrderDetail.delivery?.delivery_city || "Ouagadougou"}
                </p>
                <p>
                  <strong>Adresse / Repère :</strong> {selectedOrderDetail.delivery_neighborhood || selectedOrderDetail.delivery?.delivery_address || "Non précisé"}
                </p>
                {(selectedOrderDetail.customer_location_url || selectedOrderDetail.delivery?.maps_url) && (
                  <div className="pt-1">
                    <a
                      href={selectedOrderDetail.customer_location_url || selectedOrderDetail.delivery?.maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/15 text-secondary hover:bg-secondary/25 font-bold transition-colors"
                    >
                      <Icon name="pin_drop" className="text-[16px]" />
                      <span>Ouvrir la position GPS sur Google Maps</span>
                    </a>
                  </div>
                )}
              </div>

              {/* Delivery Guarantee Reminder */}
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <Icon name="electric_moped" className="text-[18px] shrink-0" />
                <span>
                  <strong>Délai garanti :</strong> Livraison express en <strong>45 min à 2h</strong> après règlement.
                </span>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 border-t border-subtle bg-surface-elevated flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedOrderDetail(null)}
                className="flex-1 h-11 rounded-xl bg-surface-secondary hover:bg-surface-elevated text-on-surface text-xs font-semibold border border-subtle transition-colors cursor-pointer"
              >
                Fermer
              </button>

              {isOrderAccepted(selectedOrderDetail) && (
                <button
                  type="button"
                  onClick={() => {
                    setPaymentOrder(selectedOrderDetail);
                    setSelectedOrderDetail(null);
                  }}
                  className="flex-[2] h-11 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:brightness-105 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <Icon name="payments" className="text-[18px]" />
                  <span>Solder par Mobile Money</span>
                </button>
              )}

              {(isOrderAccepted(selectedOrderDetail) || isOrderPaid(selectedOrderDetail)) && (
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenChat) onOpenChat(selectedOrderDetail.conversation_id);
                    setSelectedOrderDetail(null);
                  }}
                  className="flex-1 h-11 rounded-xl bg-primary hover:brightness-105 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Icon name="forum" className="text-[16px]" />
                  <span>Chat</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MOBILE MONEY PAYMENT MODAL (Orange Money / Moov Money + LigdiCash OTP) */}
      {paymentOrder && (
        <MobileMoneyPaymentModal
          order={paymentOrder}
          isOpen={Boolean(paymentOrder)}
          onClose={() => setPaymentOrder(null)}
          onSuccess={handlePaymentSuccess}
          showToast={showToast}
          customer={customer}
        />
      )}

      {/* Satisfaction Modal */}
      {actionType === "SATISFY" && actionOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="rounded-2xl bg-surface-card border border-subtle p-6 max-w-sm w-full space-y-4 shadow-2xl animate-fadeIn">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto">
              <Icon name="thumb_up" className="text-[32px]" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-headline-sm text-lg font-bold text-on-surface">
                Confirmer votre satisfaction
              </h3>
              <p className="text-xs text-on-surface-variant">
                Commande #{actionOrder.reference_code || actionOrder.order_number}
              </p>
            </div>

            <div className="flex justify-center gap-1 py-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`text-[28px] transition-transform active:scale-125 cursor-pointer ${
                    rating >= star ? "text-amber-500" : "text-on-surface-variant opacity-40"
                  }`}
                >
                  ★
                </button>
              ))}
            </div>

            <textarea
              value={feedbackNote}
              onChange={(e) => setFeedbackNote(e.target.value)}
              placeholder="Votre avis aide nos artisans et commerçants..."
              className="w-full h-20 rounded-xl bg-surface-secondary border border-subtle p-3 text-xs text-on-surface resize-none focus:outline-none focus:border-primary"
            />

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setActionType(null);
                  setActionOrder(null);
                }}
                className="h-11 rounded-xl bg-surface-secondary hover:bg-surface-elevated text-on-surface-variant font-label-md font-semibold transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={submittingAction}
                onClick={handleSubmitAction}
                className="h-11 rounded-xl bg-emerald-500 hover:brightness-105 text-white font-label-md font-bold transition-all shadow-md active:scale-98 cursor-pointer"
              >
                {submittingAction ? "Envoi..." : "Valider"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Direct Cancellation Modal */}
      {actionType === "CANCEL" && actionOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="rounded-2xl bg-surface-card border border-subtle p-6 max-w-sm w-full space-y-4 shadow-2xl animate-fadeIn">
            <div className="w-14 h-14 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center mx-auto">
              <Icon name="close" className="text-[32px]" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-headline-sm text-lg font-bold text-on-surface">
                Annuler la commande
              </h3>
              <p className="text-xs text-on-surface-variant">
                Réf: #{actionOrder.reference_code || actionOrder.order_number}
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-on-surface-variant">
                Motif d'annulation :
              </label>
              {[
                "Changement d'avis",
                "Délai de livraison trop long",
                "Prix ou frais non convenus",
                "Acheté ailleurs",
                "Autre",
              ].map((r) => (
                <label
                  key={r}
                  onClick={() => setCancelReason(r)}
                  className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer border transition-colors ${
                    cancelReason === r
                      ? "bg-rose-500/15 border-rose-500/40 text-on-surface font-semibold"
                      : "bg-surface-secondary border-subtle text-on-surface-variant hover:bg-surface-elevated"
                  }`}
                >
                  <span>{r}</span>
                  {cancelReason === r && (
                    <Icon name="check" className="text-rose-500 text-[16px]" />
                  )}
                </label>
              ))}

              {cancelReason === "Autre" && (
                <input
                  type="text"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Précisez votre motif..."
                  className="w-full rounded-xl bg-surface-secondary border border-subtle p-2.5 text-xs text-on-surface mt-1 focus:outline-none focus:border-rose-400"
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setActionType(null);
                  setActionOrder(null);
                }}
                className="h-11 rounded-xl bg-surface-secondary hover:bg-surface-elevated text-on-surface-variant font-label-md font-semibold transition-colors cursor-pointer"
              >
                Garder la commande
              </button>
              <button
                type="button"
                disabled={submittingAction}
                onClick={handleSubmitAction}
                className="h-11 rounded-xl bg-rose-500 hover:brightness-105 text-white font-label-md font-bold transition-all shadow-md active:scale-98 cursor-pointer"
              >
                {submittingAction ? "Annulation..." : "Confirmer l'annulation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Branded Footer */}
      <Footer />
    </div>
  );
}
