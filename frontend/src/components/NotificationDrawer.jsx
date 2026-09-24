import React, { useState, useEffect } from "react";
import Icon from "./Icon";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from "../api/client";

export default function NotificationDrawer({
  isOpen,
  onClose,
  mode = "client", // "client" | "owner"
  customer,
  store,
  onNavigateAction,
}) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState("ALL"); // ALL, TRANSACTIONAL, STORE_NEWS, RELATIONAL
  const [unreadCount, setUnreadCount] = useState(0);

  const recipientType = mode === "owner" ? "STORE_OWNER" : "CUSTOMER";
  const recipientId = mode === "owner" ? store?.id : customer?.id;

  const loadNotifications = async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const res = await fetchNotifications({
        recipient_type: recipientType,
        recipient_id: recipientId,
        store_id: store?.id,
      });
      setNotifications(res.notifications || []);
      setUnreadCount(res.unread_count || 0);
    } catch (e) {
      console.error("Erreur chargement notifications:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen, mode, store?.id, customer?.id]);

  const handleMarkRead = async (id, e) => {
    e?.stopPropagation();
    await markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead({
      recipient_type: recipientType,
      recipient_id: recipientId,
      store_id: store?.id,
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const handleDelete = async (id, e) => {
    e?.stopPropagation();
    await deleteNotification(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleActionClick = (notif) => {
    if (!notif.is_read) {
      markNotificationRead(notif.id);
    }
    onClose();
    if (onNavigateAction && notif.action_url) {
      onNavigateAction(notif.action_url, notif);
    }
  };

  if (!isOpen) return null;

  const filtered = notifications.filter((n) => {
    if (activeFilter === "ALL") return true;
    return n.category === activeFilter;
  });

  const getCategoryIcon = (category, eventType) => {
    switch (category) {
      case "TRANSACTIONAL":
        if (eventType?.includes("PAYMENT")) return "receipt_long";
        return "shopping_bag";
      case "STORE_NEWS":
        return "campaign";
      case "RELATIONAL":
        return "loyalty";
      case "BUSINESS_ASSISTANCE":
        return "insights";
      default:
        return "notifications";
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end animate-fade-in"
    >
      <div className="w-full max-w-md bg-surface border-l border-subtle h-full shadow-2xl flex flex-col animate-slide-left">
        {/* Drawer Header */}
        <div className="p-4 border-b border-subtle flex items-center justify-between shrink-0 bg-surface-secondary/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center relative">
              <Icon name="notifications" className="text-[20px]" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>
            <div>
              <h2 className="font-semibold text-on-surface text-sm sm:text-base">
                Notifications {mode === "owner" ? "Commerçant" : ""}
              </h2>
              <p className="text-xs text-on-surface-variant">
                {unreadCount} message{unreadCount > 1 ? "s" : ""} non lu{unreadCount > 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] font-medium text-primary hover:underline px-2 py-1 rounded-lg"
              >
                Tout lire
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-surface-secondary hover:bg-surface-elevated text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-colors"
              aria-label="Fermer"
            >
              <Icon name="close" className="text-[18px]" />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-subtle bg-surface shrink-0 overflow-x-auto no-scrollbar">
          {[
            { id: "ALL", label: "Toutes" },
            { id: "TRANSACTIONAL", label: "Commandes" },
            { id: "STORE_NEWS", label: "Actualités" },
            { id: "RELATIONAL", label: "Communauté" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                activeFilter === f.id
                  ? "bg-primary text-white shadow-xs"
                  : "bg-surface-secondary text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto divide-y divide-subtle">
          {loading ? (
            <div className="py-16 text-center text-xs text-on-surface-variant">
              <Icon name="sync" className="text-[24px] animate-spin mb-2 text-primary" />
              <p>Chargement de vos notifications...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 px-6 text-center space-y-2">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-surface-secondary flex items-center justify-center text-on-surface-variant">
                <Icon name="notifications_off" className="text-[24px]" />
              </div>
              <p className="text-sm font-semibold text-on-surface">Aucune notification</p>
              <p className="text-xs text-on-surface-variant max-w-xs mx-auto">
                Vous recevrez ici les confirmations de commandes, actualités de vos boutiques et rappels utiles.
              </p>
            </div>
          ) : (
            filtered.map((notif) => {
              const isHigh = notif.urgency === "HIGH";
              const isUnread = !notif.is_read;

              return (
                <div
                  key={notif.id}
                  onClick={() => handleActionClick(notif)}
                  className={`p-3.5 transition-colors cursor-pointer flex items-start gap-3 relative hover:bg-surface-secondary/50 ${
                    isUnread ? "bg-primary/5" : "bg-transparent"
                  }`}
                >
                  {/* Category icon with unread indicator */}
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isHigh
                        ? "bg-red-500/10 text-red-500"
                        : isUnread
                        ? "bg-primary/15 text-primary"
                        : "bg-surface-secondary text-on-surface-variant"
                    }`}
                  >
                    <Icon name={getCategoryIcon(notif.category, notif.event_type)} className="text-[18px]" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4
                        className={`text-xs font-semibold truncate ${
                          isUnread ? "text-on-surface font-bold" : "text-on-surface"
                        }`}
                      >
                        {notif.title}
                      </h4>
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                      )}
                    </div>

                    <p className="text-xs text-on-surface-variant leading-relaxed line-clamp-2">
                      {notif.message}
                    </p>

                    {/* Action Button if specified */}
                    {notif.action_label && (
                      <div className="pt-1 flex items-center justify-between">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline">
                          <span>{notif.action_label}</span>
                          <Icon name="arrow_forward" className="text-[13px]" />
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Micro action: Delete */}
                  <button
                    onClick={(e) => handleDelete(notif.id, e)}
                    className="text-on-surface-variant/40 hover:text-red-500 p-1 rounded transition-colors"
                    title="Supprimer"
                  >
                    <Icon name="close" className="text-[14px]" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
