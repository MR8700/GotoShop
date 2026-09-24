import Icon from "./Icon";
import React, { useState, useEffect } from "react";
import {
  fetchCustomerOrders,
  getMediaUrl,
  getLocalGuestOrders,
  updateLocalGuestOrder,
  fetchBatchOrders,
  recordClientOrderAction,
} from "../api/client";
import Footer from "./Footer";

export default function ClientCommandesPage({
  customer,
  onOpenAuth,
  onNavigateToShop,
  showToast,
  onOpenChat,
}) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

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
    setLoading(true);
    try {
      if (customer) {
        // Authenticated customer: fetch orders from DB
        const data = await fetchCustomerOrders();
        setOrders(data);
      } else {
        // Guest mode: fetch orders from local storage
        const local = getLocalGuestOrders();
        if (local.length > 0) {
          // Enrich with live backend database status
          const ids = local.map((o) => o.id).filter(Boolean);
          try {
            const liveOrders = await fetchBatchOrders(ids);
            if (liveOrders && liveOrders.length > 0) {
              const liveMap = new Map(liveOrders.map((o) => [o.id, o]));
              const merged = local.map((l) => {
                const live = liveMap.get(l.id);
                return live
                  ? {
                      ...l,
                      status: live.status,
                      client_status: live.client_status,
                      client_feedback: live.client_feedback,
                      client_satisfaction_rating: live.client_satisfaction_rating,
                      coherence_status: live.coherence_status,
                      coherence_notes: live.coherence_notes,
                      is_sold: live.status === "SOLD",
                      total_amount: live.total_amount,
                    }
                  : l;
              });
              setOrders(merged);
              return;
            }
          } catch {}
        }
        setOrders(local);
      }
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

      const updatedIntent = await recordClientOrderAction(
        actionOrder.id,
        actionType,
        reasonToSend,
        rating
      );

      // Update local storage if guest
      if (!customer) {
        updateLocalGuestOrder(actionOrder.id, {
          client_status: updatedIntent.client_status,
          client_feedback: updatedIntent.client_feedback,
          client_satisfaction_rating: updatedIntent.client_satisfaction_rating,
          coherence_status: updatedIntent.coherence_status,
          coherence_notes: updatedIntent.coherence_notes,
          status: updatedIntent.status,
        });
      }

      // Update UI state
      setOrders((prev) =>
        prev.map((o) =>
          o.id === actionOrder.id
            ? {
                ...o,
                client_status: updatedIntent.client_status,
                client_feedback: updatedIntent.client_feedback,
                client_satisfaction_rating: updatedIntent.client_satisfaction_rating,
                coherence_status: updatedIntent.coherence_status,
                coherence_notes: updatedIntent.coherence_notes,
                status: updatedIntent.status,
              }
            : o
        )
      );

      if (actionType === "SATISFY") {
        showToast("⭐ Merci ! Votre satisfaction a été transmise à la commerçante.");
      } else {
        showToast("❌ Commande annulée. La commerçante a été notifiée.");
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
    <div className="flex flex-col w-full gap-space-md max-w-lg mx-auto pb-32">
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

                {/* Product details in layered inner card */}
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

                {/* Status Badges & Explanations */}
                <div className="flex flex-col gap-2 pt-1 border-t border-subtle">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-on-surface-variant">État client :</span>
                    {isClientSatisfied ? (
                      <span className="flex items-center gap-1 text-emerald-500 font-bold bg-emerald-500/15 px-2 py-0.5 rounded-full text-[11px]">
                        <Icon name="thumb_up" className="text-[14px]" />
                        Satisfait(e) ({order.client_satisfaction_rating || 5}★)
                      </span>
                    ) : isClientCancelled ? (
                      <span className="flex items-center gap-1 text-rose-500 font-bold bg-rose-500/15 px-2 py-0.5 rounded-full text-[11px]">
                        <Icon name="cancel" className="text-[14px]" />
                        Annulée par vous
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-500 font-semibold bg-amber-500/15 px-2 py-0.5 rounded-full text-[11px]">
                        <Icon name="schedule" className="text-[14px]" />
                        En attente de votre retour
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-on-surface-variant">Suivi boutique :</span>
                    {isMutualSale ? (
                      <span className="flex items-center gap-1 text-emerald-500 font-bold bg-emerald-500/15 px-2 py-0.5 rounded-full text-[11px]">
                        <Icon name="check_circle" className="text-[14px]" />
                        Vente 100% Consolidée
                      </span>
                    ) : isConfirmedByMerchant ? (
                      <span className="flex items-center gap-1 text-emerald-500 font-semibold bg-emerald-500/15 px-2 py-0.5 rounded-full text-[11px]">
                        <Icon name="local_shipping" className="text-[14px]" />
                        Validé &amp; Expédié
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-on-surface-variant font-medium bg-surface-secondary px-2 py-0.5 rounded-full text-[11px]">
                        <Icon name="chat" className="text-[14px]" />
                        Discussion en cours
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
                {!isClientSatisfied && !isClientCancelled && (
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

                {/* Contact buttons */}
                <div className="flex flex-col gap-2 pt-1">
                  {onOpenChat && (
                    <button
                      type="button"
                      onClick={() => onOpenChat(order.conversation_id)}
                      className="w-full h-10 rounded-xl bg-primary hover:brightness-105 text-white font-label-md font-bold flex items-center justify-center gap-2 transition-all active:scale-98 shadow-sm cursor-pointer"
                    >
                      <Icon name="forum" className="text-[18px]" />
                      <span>Ouvrir la discussion en direct</span>
                    </button>
                  )}
                  <a
                    href={order.redirect_url || `https://wa.me/2250700000000?text=Bonjour%20Awa,%20suivi%20de%20ma%20commande%20${order.reference_code}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full h-9 rounded-xl bg-surface-secondary hover:bg-surface-elevated text-on-surface-variant hover:text-on-surface border border-subtle font-label-sm font-semibold flex items-center justify-center gap-2 transition-colors active:scale-98"
                  >
                    <Icon name="chat" className="text-[16px] text-green-600" />
                    <span>Relancer sur WhatsApp</span>
                  </a>
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
