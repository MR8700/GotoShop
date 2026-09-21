import React, { useState, useEffect } from "react";
import { getMediaUrl } from "../api/client";

export default function SplashScreen({ store, onFinished }) {
  const [stage, setStage] = useState(0);
  const [isFading, setIsFading] = useState(false);

  const messages = [
    "Initialisation du commerce conversationnel...",
    "Vérification des canaux WhatsApp & SMS...",
    "Chargement du catalogue certifié...",
    "Bienvenue sur la boutique !"
  ];

  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 400);
    const t2 = setTimeout(() => setStage(2), 900);
    const t3 = setTimeout(() => setStage(3), 1400);
    const t4 = setTimeout(() => {
      setIsFading(true);
      setTimeout(() => {
        onFinished();
      }, 500);
    }, 1900);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [onFinished]);

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-surface px-6 transition-opacity duration-500 select-none ${
        isFading ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Background ambient lighting */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-primary/20 rounded-full blur-[100px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-64 h-64 bg-secondary/15 rounded-full blur-[90px] pointer-events-none"></div>

      {/* Main Container */}
      <div className="relative flex flex-col items-center text-center max-w-xs w-full">
        {/* Animated Brand Icon / Logo */}
        <div className="relative mb-6">
          <div className="absolute -inset-2 bg-gradient-to-r from-primary to-secondary rounded-3xl blur-md opacity-70 animate-pulse"></div>
          
          <div className="relative w-24 h-24 rounded-2xl bg-surface-container-highest border border-white/10 p-3 shadow-2xl flex items-center justify-center overflow-hidden transform hover:scale-105 transition-transform duration-300">
            <img
              src={getMediaUrl(store?.logo_url) || "/media/store/logo.jpg"}
              alt="Logo"
              className="w-full h-full object-contain filter drop-shadow-md animate-bounce"
              style={{ animationDuration: "2s" }}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "/media/store/logo.jpg";
              }}
            />
          </div>

          <span className="absolute -bottom-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-surface shadow-lg ring-2 ring-surface animate-pulse">
            <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              bolt
            </span>
          </span>
        </div>

        {/* Title */}
        <h1 className="font-headline-sm text-2xl font-bold tracking-tight text-on-surface mb-1">
          {store?.name || "Awa Chic & Tech"}
        </h1>
        <p className="font-label-sm text-xs uppercase tracking-widest text-primary font-semibold mb-6">
          Commerce Social & Conversationnel
        </p>

        {/* Progress indicator */}
        <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden mb-4 shadow-inner">
          <div
            className="bg-gradient-to-r from-primary to-secondary h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${((stage + 1) / messages.length) * 100}%` }}
          ></div>
        </div>

        {/* Dynamic Loading Message */}
        <div className="h-6 flex items-center justify-center">
          <p className="font-body-sm text-xs text-on-surface-variant animate-fade-in flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-ping"></span>
            <span>{messages[stage]}</span>
          </p>
        </div>
      </div>

      {/* Footer reassurance */}
      <div className="absolute bottom-8 text-center">
        <span className="font-label-sm text-[11px] text-on-surface-variant/60 tracking-wider font-mono">
          MOTEUR CONVERSASTORE • 100% DB DRIVEN
        </span>
      </div>
    </div>
  );
}
