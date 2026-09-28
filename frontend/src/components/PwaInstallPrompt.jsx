import Icon from "./Icon";
import React, { useState, useEffect } from "react";
import safeStorage from "../utils/safeStorage";

export default function PwaInstallPrompt({ showToast }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    // Check if already in standalone PWA mode
    const standaloneMode =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      window.navigator?.standalone === true ||
      document.referrer.includes("android-app://");

    if (standaloneMode) {
      setIsStandalone(true);
      return;
    }

    // Detect iOS Safari
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua) && !window.MSStream;
    const isSafari = ua.includes("safari") && !ua.includes("crios") && !ua.includes("fxios");
    setIsIos(isIosDevice);

    // Check if user dismissed recently (less than 3 days ago)
    const dismissedAt = safeStorage.getItem("gotoshop_pwa_dismissed_time");
    const now = Date.now();
    const isDismissedRecently = dismissedAt && now - parseInt(dismissedAt, 10) < 3 * 24 * 3600 * 1000;

    // Handler for Chrome / Android beforeinstallprompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!isDismissedRecently) {
        setShowPrompt(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Provide a global window function so Header menu can open it anytime
    window.openGotoShopInstall = () => {
      if (deferredPrompt) {
        handleInstallClick();
      } else if (isIosDevice) {
        setShowIosGuide(true);
      } else {
        showToast?.("Pour installer l'application, utilisez l'option 'Ajouter à l'écran d'accueil' de votre navigateur.");
      }
    };

    // If iOS and not dismissed recently, show subtle banner after 3 seconds
    let timer;
    if (isIosDevice && isSafari && !isDismissedRecently) {
      timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3500);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      if (timer) clearTimeout(timer);
      delete window.openGotoShopInstall;
    };
  }, [deferredPrompt]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
          showToast?.("🎉 Bienvenue sur l'application GotoShop !");
        }
        setDeferredPrompt(null);
        setShowPrompt(false);
      } catch (err) {
        console.warn("Install prompt error:", err);
      }
    } else if (isIos) {
      setShowIosGuide(true);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setShowIosGuide(false);
    safeStorage.setItem("gotoshop_pwa_dismissed_time", Date.now().toString());
  };

  if (isStandalone || (!showPrompt && !showIosGuide)) {
    return null;
  }

  return (
    <>
      {/* Floating Smart PWA Install Banner */}
      {showPrompt && !showIosGuide && (
        <div className="fixed bottom-18 sm:bottom-6 left-3 right-3 sm:left-auto sm:right-6 sm:w-96 z-40 bg-surface border border-slate-300 dark:border-slate-700 rounded-2xl p-3 sm:p-3.5 shadow-2xl backdrop-blur-xl animate-fade-in flex items-center justify-between gap-3 text-on-surface">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-primary/10 border border-primary/20 shrink-0 p-0.5">
              <img
                src="/icon-192.png"
                alt="GotoShop"
                className="w-full h-full object-cover rounded-lg"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "/media/store/logo.png";
                }}
              />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-on-surface tracking-tight truncate">
                Installer GotoShop
              </p>
              <p className="text-[11px] text-on-surface-variant truncate">
                Application légère &amp; suivi direct
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleInstallClick}
              className="h-8 px-3 rounded-xl bg-primary hover:brightness-105 text-white text-xs font-bold shadow-xs active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Icon name="download" className="text-[16px]" />
              <span>Installer</span>
            </button>
            <button
              onClick={handleDismiss}
              className="w-7 h-7 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-secondary flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Fermer"
            >
              <Icon name="close" className="text-[16px]" />
            </button>
          </div>
        </div>
      )}

      {/* iOS Safari Guided Installation Modal */}
      {showIosGuide && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowIosGuide(false);
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
        >
          <div className="w-full max-w-sm rounded-3xl bg-surface border border-slate-300 dark:border-slate-700 p-5 shadow-2xl text-on-surface space-y-4 mb-2 sm:mb-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <img
                  src="/icon-192.png"
                  alt="GotoShop"
                  className="w-9 h-9 rounded-xl object-cover shadow-sm"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "/media/store/logo.png";
                  }}
                />
                <div>
                  <h3 className="font-bold text-sm text-on-surface">Installer sur iPhone / iPad</h3>
                  <p className="text-[11px] text-on-surface-variant">Application Web Directe</p>
                </div>
              </div>
              <button
                onClick={() => setShowIosGuide(false)}
                className="w-7 h-7 rounded-xl bg-surface-secondary text-on-surface-variant hover:text-on-surface flex items-center justify-center cursor-pointer"
              >
                <Icon name="close" className="text-[16px]" />
              </button>
            </div>

            <div className="space-y-3 bg-surface-secondary/70 border border-subtle rounded-2xl p-3.5 text-xs text-on-surface">
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                  1
                </div>
                <p className="text-xs">
                  Dans Safari, appuyez sur le bouton <strong>Partager</strong> <Icon name="ios_share" className="text-[15px] inline align-text-bottom text-primary" /> situé en bas de l'écran.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                  2
                </div>
                <p className="text-xs">
                  Faites défiler vers le bas et touchez <strong>« Sur l'écran d'accueil »</strong> <Icon name="add_box" className="text-[15px] inline align-text-bottom text-secondary" />.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                  3
                </div>
                <p className="text-xs">
                  Touchez <strong>Ajouter</strong> en haut à droite pour lancer l'application directement.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowIosGuide(false)}
              className="w-full py-2.5 rounded-xl bg-primary hover:brightness-105 text-white font-bold text-xs shadow-sm cursor-pointer"
            >
              J'ai compris
            </button>
          </div>
        </div>
      )}
    </>
  );
}
