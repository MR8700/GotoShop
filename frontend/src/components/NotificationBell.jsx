import React, { useState, useEffect } from "react";
import Icon from "./Icon";
import { fetchNotifications } from "../api/client";

export default function NotificationBell({
  mode = "client",
  customer,
  store,
  onClick,
}) {
  const [unreadCount, setUnreadCount] = useState(0);

  const recipientType = mode === "owner" ? "STORE_OWNER" : "CUSTOMER";
  const recipientId = mode === "owner" ? store?.id : customer?.id;

  const refreshUnread = async () => {
    try {
      const res = await fetchNotifications({
        recipient_type: recipientType,
        recipient_id: recipientId,
        store_id: store?.id,
        limit: 1,
      });
      setUnreadCount(res.unread_count || 0);
    } catch (e) {
      // Non-blocking
    }
  };

  useEffect(() => {
    refreshUnread();
    const interval = setInterval(refreshUnread, 20000);
    return () => clearInterval(interval);
  }, [mode, store?.id, customer?.id]);

  return (
    <button
      onClick={onClick}
      className="relative w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-xl bg-surface-secondary hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface border border-slate-300 dark:border-slate-700 flex items-center justify-center transition-all active:scale-95 shrink-0 cursor-pointer"
      title={
        unreadCount > 0
          ? `${unreadCount} notification${unreadCount > 1 ? "s" : ""} non lue${unreadCount > 1 ? "s" : ""}`
          : "Notifications"
      }
      aria-label="Centre de notifications"
    >
      <Icon name="notifications" className="text-[17px] sm:text-[18px]" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center shadow-xs animate-pulse">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
}
