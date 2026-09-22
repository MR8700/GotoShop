import React, { useState, useEffect } from "react";
import { getMediaUrl } from "../api/client";

export default function SplashScreen({ store, onFinished }) {
  const [stage, setStage] = useState(0);
  const [isFading, setIsFading] = useState(false);

  const messages = [
    "Bienvenue dans votre boutique...",
    "Sélection de vos créations favorites...",
    "Prêt pour vous accueillir ✨",
  ];

  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 400);
    const t2 = setTimeout(() => setStage(2), 900);
    const t3 = setTimeout(() => {
      setIsFading(true);
      setTimeout(() => {
        onFinished();
      }, 400);
    }, 1400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onFinished]);

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-between bg-[#0e1117] px-6 py-12 transition-opacity duration-400 select-none ${
        isFading ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Top subtle spacer */}
      <div />

      {/* Center Brand Identity */}
      <div className="relative flex flex-col items-center text-center max-w-xs w-full animate-fade-in">
        {/* Boutique Logo with elegant soft ring */}
        <div className="relative mb-5">
          <div className="relative w-20 h-20 rounded-2xl bg-surface-container border border-white/10 p-2.5 shadow-xl flex items-center justify-center overflow-hidden">
            <img
              src={getMediaUrl(store?.logo_url) || "/media/store/logo.jpg"}
              alt="Logo"
              className="w-full h-full object-cover rounded-xl"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "/media/store/logo.jpg";
              }}
            />
          </div>
          {/* Subtle online dot */}
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-surface shadow-md ring-2 ring-[#0e1117]">
            <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
          </span>
        </div>

        {/* Store Title */}
        <h1 className="font-headline-sm text-2xl font-bold tracking-tight text-white mb-1.5">
          {store?.name || "GotoShop"}
        </h1>

        {/* Warm emotional tagline */}
        <p className="text-xs text-on-surface-variant font-medium mb-6 max-w-[240px] leading-relaxed">
          {store?.tagline || "Le réseau des meilleures boutiques africaines en direct ✨"}
        </p>

        {/* Clean, minimalist progress line */}
        <div className="w-36 bg-surface-container-highest/50 h-1 rounded-full overflow-hidden mb-3.5">
          <div
            className="bg-primary h-full rounded-full transition-all duration-400 ease-out"
            style={{ width: `${((stage + 1) / messages.length) * 100}%` }}
          />
        </div>

        {/* Dynamic Human Message */}
        <div className="h-5 flex items-center justify-center">
          <p className="text-[11px] text-on-surface-variant flex items-center gap-1.5 animate-fade-in font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
            <span>{messages[stage]}</span>
          </p>
        </div>
      </div>

      {/* Emotional reassurance footer */}
      <div className="text-center">
        <span className="text-[11px] text-on-surface-variant/50 font-medium tracking-wide">
          Boutiques officielles certifiées • Burkina Faso &amp; International
        </span>
      </div>
    </div>
  );
}
