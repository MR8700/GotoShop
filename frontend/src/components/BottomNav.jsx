import React from "react";

export default function BottomNav({ activeTab, onSelectTab, pendingCount = 0, mode = "client", clientOrdersCount = 0 }) {
  const isClient = mode === "client";

  const tabs = isClient
    ? [
        { id: "boutique", label: "Boutique", icon: "storefront" },
        { id: "commandes", label: "Commandes", icon: "receipt_long", badge: clientOrdersCount },
        { id: "stats", label: "Avantages", icon: "stars" },
        { id: "reglages", label: "Profil", icon: "person" },
      ]
    : [
        { id: "boutique", label: "Boutique", icon: "storefront" },
        { id: "commandes", label: "Commandes", icon: "receipt_long", badge: pendingCount },
        { id: "stats", label: "Stats", icon: "monitoring" },
        { id: "reglages", label: "Réglages", icon: "tune" },
      ];

  return (
    <nav className="fixed bottom-0 w-full z-50 pb-safe bg-surface/85 backdrop-blur-xl shadow-[0_-8px_24px_rgba(0,0,0,0.4)]">
      <div className="flex justify-around items-center h-20 px-space-xs max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-col items-center justify-center gap-1 w-16 h-14 rounded-xl transition-all duration-150 active:scale-95 ${
                isActive
                  ? "text-primary-container bg-surface-container-high/60"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <div className="relative flex items-center justify-center">
                <span className="material-symbols-outlined text-[22px]">{tab.icon}</span>
                {tab.badge && tab.badge > 0 ? (
                  <span className="absolute -top-1 -right-2 px-1.5 py-0.2 rounded-full bg-primary-container text-on-primary-container font-label-sm text-[10px] font-bold leading-none">
                    {tab.badge}
                  </span>
                ) : null}
              </div>
              <span className="font-label-md text-label-md font-semibold tracking-tight">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
