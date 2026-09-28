import Icon from "./Icon";
import React from "react";

export default function BottomNav({ activeTab, onSelectTab, pendingCount = 0, mode = "client", clientOrdersCount = 0, unreadChatCount = 0 }) {
  const isClient = mode === "client";

  const tabs = isClient
    ? [
        { id: "boutique", label: "Vitrine", icon: "storefront" },
        { id: "commandes", label: "Commandes", icon: "receipt_long", badge: clientOrdersCount },
        { id: "chat", label: "Chat", icon: "forum", badge: unreadChatCount },
        { id: "stats", label: "Avantages", icon: "stars" },
        { id: "reglages", label: "Profil", icon: "person" },
      ]
    : [
        { id: "boutique", label: "Vitrine", icon: "storefront" },
        { id: "commandes", label: "Commandes", icon: "receipt_long", badge: pendingCount },
        { id: "portefeuille", label: "Caisse", icon: "account_balance_wallet" },
        { id: "chat", label: "Messages", icon: "forum", badge: unreadChatCount },
        { id: "stats", label: "Stats", icon: "monitoring" },
        { id: "reglages", label: "Réglages", icon: "tune" },
      ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 pb-safe bg-surface/95 backdrop-blur-md border-t border-subtle shadow-lg">
      <div className="flex justify-around items-center h-15 px-1 sm:px-3 max-w-lg mx-auto w-full">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`relative flex-1 min-w-0 max-w-[68px] flex flex-col items-center justify-center gap-0.5 sm:gap-1 h-12 rounded-xl transition-all duration-150 cursor-pointer active:scale-95 ${
                isActive
                  ? "text-primary font-semibold"
                  : "text-on-surface-variant hover:text-on-surface font-medium"
              }`}
            >
              <div className="relative flex items-center justify-center">
                <Icon name={tab.icon} className="text-[22px] transition-transform" style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}} />
                {tab.badge && tab.badge > 0 ? (
                  <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-primary text-white text-[9.5px] font-bold flex items-center justify-center leading-none">
                    {tab.badge}
                  </span>
                ) : null}
              </div>
              <span className="text-[10.5px] tracking-tight leading-none truncate max-w-full px-0.5">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
