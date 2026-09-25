import Icon from "./Icon";
import React, { useState, useEffect } from "react";
import {
  fetchCustomerOrders,
  fetchConversationalOrders,
  cancelConversationalOrder,
  getCustomerToken,
  getMediaUrl,
  getLocalGuestOrders,
  updateLocalGuestOrder,
  fetchBatchOrders,
  recordClientOrderAction,
  dataCache,
} from "../api/client";
import { formatSalesQuantity } from "../utils/salesEngine";
import Footer from "./Footer";

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
    const cachedCust = token ? (dataCache.get(`customer:orders:${token}`) || []) : [];
    return cachedCust.length > 0 ? cachedCust : local;
  });
  const [loading, setLoading] = useState(() => {
    const local = getLocalGuestOrders();
    const token = customer?.session_token || getCustomerToken();
    const hasCached = token ? dataCache.has(`customer:orders:${token}`) : false;
    return !hasCached && local.length === 0;
  });

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
        reasonToSend = cancelReason === "Autre" ? (customReason.trim() || "Annulation client") : cancelReason;
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

  const confirmedCount = orders.filter((o) => o.is_sold === true || o.status === "SOLD").length;
  const satisfiedCount = orders.filter((o) => o.client_status === "SATISFIED").length;
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
          className="w-9 h-9 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant flex items-center justify-center transition-transform active:scale-95 border border-slate-300 dark:border-slate-700"
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

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3.5 rounded-xl bg-surface-container shadow-sm border-2 border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-secondary/15 text-secondary flex items-center justify-center shrink-0 border border-secondary/20">
            <Icon name="shopping_bag" className="text-[22px]" />
          </div>
          <div>
            <p className="text-[11px] text-on-surface-variant font-bold uppercase tracking-wider">Total Passées</p>
            <p className="text-lg font-bold text-on-surface tabular-nums">{orders.length}</p>
          </div>
        </div>
        <div className="p-3.5 rounded-xl bg-surface-container shadow-sm border-2 border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0 border border-emerald-500/20">
            <Icon name="verified" className="text-[22px]" />
          </div>
          <div>
            <p className="text-[11px] text-on-surface-variant font-bold uppercase tracking-wider">Livrées / Satisfaites</p>
            <p className="text-lg font-bold text-emerald-500 tabular-nums">
              {Math.max(confirmedCount, satisfiedCount)}
            </p>
          </div>
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="p-8 text-center text-on-surface-variant text-sm">
          <Icon name="sync" className="animate-spin text-primary text-[28px] mb-2" />
          <p>Chargement de vos commandes...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl bg-surface-container p-8 text-center space-y-4 shadow-card border-2 border-slate-200 dark:border-slate-800">
          <div className="w-14 h-14 rounded-full bg-surface-secondary text-on-surface-variant flex items-center justify-center mx-auto border border-slate-300 dark:border-slate-700">
            <Icon name="production_quantity_limits" className="text-[28px]" />
          </div>
          <div className="space-y-1">
            <h3 className="font-headline-sm text-headline-sm text-on-surface">Aucune commande pour l'instant</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Merci pour votre fidélité ! ✨ Découvrez les créations et produits vérifiés dans notre vitrine pour passer votre première commande.
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
          {orders.map((order) => {
            const isConfirmedByMerchant = order.is_sold === true || order.status === "SOLD";
            const isClientSatisfied = order.client_status === "SATISFIED";
            const isClientCancelled = order.client_status === "CANCELLED" || order.status === "CANCELLED";
            const hasConflict = order.coherence_status === "DISCREPANCY_CONFLICT";
            const isMutualSale = order.coherence_status === "CONSOLIDATED_SALE" || (isConfirmedByMerchant && isClientSatisfied);

            return (
              <div
                key={order.id}
                className={`rounded-2xl bg-surface-container p-4 sm:p-5 shadow-card border-2 space-y-3.5 transition-all ${
                  hasConflict
                    ? "border-amber-500/60 bg-amber-500/5"
                    : isMutualSale
                    ? "border-emerald-500/50"
                    : "border-slate-200 dark:border-slate-800 hover:border-primary/50"
                }`}
              >
                {/* Order Top Bar */}
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-secondary bg-secondary/15 border border-secondary/30 px-2.5 py-0.5 rounded-full">
                    #{order.reference_code}
                  </span>
                  <span className="text-[11px] text-on-surface-variant font-medium">
                    {formatDate(order.created_at)}
                  </span>
                </div>

                {/* Conflict Alert Banner if discrepancy exists */}
                {hasConflict && (
                  <div className="rounded-xl bg-amber-500/15 p-2.5 border border-amber-500/30 flex items-start gap-2 text-xs text-amber-500">
                    <Icon name="warning" className="text-[18px] text-amber-500 shrink-0" />
                    <div>
                      <strong className="block font-semibold">Litige en cours de conciliation</strong>
                      <span>
                        Vous avez déclaré cette commande annulée, mais elle figurait comme conclue côté boutique. L'équipe régularise le dossier.
                      </span>
                    </div>
                  </div>
                )}

                {/* Product details in layered inner card: Multi-items or single fallback */}
                {order.items && order.items.length > 0 ? (
                  <div className="space-y-2 p-3 rounded-xl bg-surface-secondary/80 border border-slate-200 dark:border-slate-700/80 shadow-xs">
                    <div className="flex items-center justify-between text-[11px] font-bold text-on-surface-variant border-b border-subtle pb-1">
                      <span>{order.items.length} article{order.items.length > 1 ? "s" : ""} commandé{order.items.length > 1 ? "s" : ""}</span>
                      <span className="text-primary font-bold">{order.total_amount?.toLocaleString("fr-FR")} {order.currency || "FCFA"}</span>
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
                          {(it.total_price || (it.quantity * it.unit_price))?.toLocaleString("fr-FR")} {order.currency || "FCFA"}
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

                {/* Status Badges & Explanations */}
                <div className="flex flex-col gap-2 pt-1 border-t border-subtle">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-on-surface-variant">État client :</span>
                    {isClientSatisfied ? (
                      <span className="flex items-center gap-1 text-emerald-500 font-bold bg-emerald-500/15 px-2 py-0.5 rounded-full text-[11px]">
                        <Icon name="thumb_up" className="text-[14px]" />
                        Satisfait(e) ({order.client_satisfaction_rating || 5}★)
                      </span>
                    ) : (order.status === "CANCELLED" || isClientCancelled) ? (
                      <span className="flex items-center gap-1 text-rose-500 font-bold bg-rose-500/15 px-2 py-0.5 rounded-full text-[11px]">
                        <Icon name="cancel" className="text-[14px]" />
                        Commande Annulée
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-500 font-semibold bg-amber-500/15 px-2 py-0.5 rounded-full text-[11px]">
                        <Icon name="schedule" className="text-[14px]" />
                        En attente de validation (Pending)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-on-surface-variant">Suivi boutique :</span>
                    {order.status === "ACCEPTED" ? (
                      <span className="flex items-center gap-1 text-emerald-500 font-bold bg-emerald-500/15 px-2 py-0.5 rounded-full text-[11px]">
                        <Icon name="check_circle" className="text-[14px]" />
                        Acceptée par le vendeur
                      </span>
                    ) : isMutualSale ? (
                      <span className="flex items-center gap-1 text-emerald-500 font-bold bg-emerald-500/15 px-2 py-0.5 rounded-full text-[11px]">
                        <Icon name="check_circle" className="text-[14px]" />
                        Vente 100% Consolidée
                      </span>
                    ) : isConfirmedByMerchant ? (
                      <span className="flex items-center gap-1 text-emerald-500 font-semibold bg-emerald-500/15 px-2 py-0.5 rounded-full text-[11px]">
                        <Icon name="local_shipping" className="text-[14px]" />
                        Validé &amp; Expédié
                      </span>
                    ) : order.status === "CANCELLED" ? (
                      <span className="flex items-center gap-1 text-rose-500 font-medium bg-rose-500/15 px-2 py-0.5 rounded-full text-[11px]">
                        <Icon name="close" className="text-[14px]" />
                        Annulée
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-on-surface-variant font-medium bg-surface-secondary px-2 py-0.5 rounded-full text-[11px]">
                        <Icon name="hourglass_top" className="text-[14px]" />
                        En attente du commerçant
                      </span>
                    )}
                  </div>

                  {order.delivery_city && (
                    <div className="flex items-center justify-between text-xs text-on-surface-variant">
                      <span>Destination :</span>
                      <span className="text-on-surface font-medium">{order.delivery_city}</span>
                    </div>
                  )}

                  {order.customer_location_url && (
                    <div className="flex items-center justify-between text-xs text-on-surface-variant">
                      <span>Localisation transmise :</span>
                      <a
                        href={order.customer_location_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-secondary hover:underline flex items-center gap-1 font-semibold"
                      >
                        <Icon name="pin_drop" className="text-[14px]" />
                        Google Maps
                      </a>
                    </div>
                  )}
                </div>

                {/* Client Action Buttons (Annuler ou Marquer Satisfait) */}
                {!isClientSatisfied && order.status !== "CANCELLED" && !isClientCancelled && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-subtle">
                    <button
                      type="button"
                      onClick={() => handleOpenSatisfyModal(order)}
                      className="h-10 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-500 font-label-sm font-bold flex items-center justify-center gap-1.5 transition-all active:scale-98 border border-emerald-500/30 cursor-pointer"
                    >
                      <Icon name="thumb_up" className="text-[18px]" />
                      <span>Marquer Satisfait(e)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenCancelModal(order)}
                      className="h-10 rounded-xl bg-surface-secondary hover:bg-rose-500/20 text-on-surface-variant hover:text-rose-500 font-label-sm font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-98 border border-subtle hover:border-rose-500/30 cursor-pointer"
                    >
                      <Icon name="close" className="text-[18px]" />
                      <span>Annuler Commande</span>
                    </button>
                  </div>
                )}

                {/* Contact buttons - 100% Platform Autonomy */}
                <div className="flex flex-col gap-2 pt-1">
                  {onOpenChat && (
                    <button
                      type="button"
                      onClick={() => onOpenChat(order.conversation_id)}
                      className="w-full h-10 rounded-xl bg-primary hover:brightness-105 text-white font-label-md font-bold flex items-center justify-center gap-2 transition-all active:scale-98 shadow-sm cursor-pointer"
                    >
                      <Icon name="forum" className="text-[18px]" />
                      <span>Ouvrir la discussion avec le vendeur</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
                Commande #{actionOrder.reference_code} • {actionOrder.product_name}
              </p>
            </div>

            {/* Star selector */}
            <div className="flex items-center justify-center gap-2 py-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setRating(s)}
                  className={`text-[28px] transition-transform active:scale-125 cursor-pointer ${
                    s <= rating ? "text-amber-500" : "text-on-surface-variant opacity-30"
                  }`}
                >
                  ★
                </button>
              ))}
            </div>

            {/* Note */}
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                Votre commentaire (optionnel) :
              </label>
              <textarea
                rows={2}
                value={feedbackNote}
                onChange={(e) => setFeedbackNote(e.target.value)}
                placeholder="Qualité du produit, rapidité de livraison..."
                className="w-full rounded-xl bg-surface-secondary border border-subtle p-2.5 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-emerald-500"
              />
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
                Fermer
              </button>
              <button
                type="button"
                disabled={submittingAction}
                onClick={handleSubmitAction}
                className="h-11 rounded-xl bg-emerald-500 hover:brightness-105 text-white font-label-md font-bold transition-all shadow-md active:scale-98 cursor-pointer"
              >
                {submittingAction ? "Envoi..." : "Valider (5★)"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {actionType === "CANCEL" && actionOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="rounded-2xl bg-surface-card border border-subtle p-6 max-w-sm w-full space-y-4 shadow-2xl animate-fadeIn">
            <div className="w-14 h-14 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center mx-auto">
              <Icon name="cancel" className="text-[32px]" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-headline-sm text-lg font-bold text-on-surface">
                Annuler la commande ?
              </h3>
              <p className="text-xs text-on-surface-variant">
                Réf: #{actionOrder.reference_code} • {actionOrder.product_name}
              </p>
            </div>

            {/* Reason selector */}
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
