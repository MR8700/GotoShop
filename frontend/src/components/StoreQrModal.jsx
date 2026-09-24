import React, { useState, useEffect } from "react";
import Icon from "./Icon";
import { fetchStoreQr, getMediaUrl } from "../api/client";

export default function StoreQrModal({
  isOpen,
  onClose,
  store,
  showToast,
}) {
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedFormat, setSelectedFormat] = useState("AFFICHE_A4");

  useEffect(() => {
    if (isOpen && store?.id) {
      loadQr();
    }
  }, [isOpen, store?.id]);

  const loadQr = async () => {
    try {
      setLoading(true);
      const data = await fetchStoreQr(store.slug || store.id);
      setQrData(data);
    } catch (e) {
      console.error("Erreur chargement QR Code:", e);
      if (showToast) showToast("Impossible de charger le QR code");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyUrl = () => {
    const url = qrData?.full_web_url || `${window.location.origin}/store/${store?.slug}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      if (showToast) showToast("Lien de la boutique copié !");
    }
  };

  const handleDownloadSvg = () => {
    if (!qrData?.qr_svg) return;
    const blob = new Blob([qrData.qr_svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-${store?.slug || "boutique"}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (showToast) showToast("Fichier SVG téléchargé !");
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in print:p-0 print:bg-white"
    >
      <div className="w-full max-w-2xl bg-surface-card border border-subtle rounded-3xl shadow-dropdown overflow-hidden flex flex-col max-h-[90vh] print:max-h-none print:border-none print:shadow-none">
        {/* Header - Hidden in Print */}
        <div className="p-4 sm:p-5 border-b border-subtle flex items-center justify-between shrink-0 bg-surface-secondary/40 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Icon name="qr_code_2" className="text-[24px]" />
            </div>
            <div>
              <h2 className="font-bold text-on-surface text-base sm:text-lg">
                QR Code & Supports d'Impression
              </h2>
              <p className="text-xs text-on-surface-variant">
                Accès instantané et commande directe pour vos clients
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-surface-secondary hover:bg-surface-elevated text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-colors"
          >
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* Format selector chips - Hidden in Print */}
          <div className="space-y-2 print:hidden">
            <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
              Format d'impression recommandé
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: "AFFICHE_A4", label: "Affiche A4", sub: "Vitrine & Caisse", icon: "storefront" },
                { id: "CARTE_VISITE", label: "Carte Visite", sub: "Chevalet de table", icon: "badge" },
                { id: "STICKER_COLIS", label: "Sticker Colis", sub: "Sacs de livraison", icon: "local_offer" },
                { id: "FORMAT_CARRE", label: "Format Carré", sub: "Statuts WhatsApp", icon: "grid_view" },
              ].map((fmt) => (
                <button
                  key={fmt.id}
                  onClick={() => setSelectedFormat(fmt.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedFormat === fmt.id
                      ? "border-primary bg-primary/10 text-primary shadow-xs"
                      : "border-subtle bg-surface-secondary/50 text-on-surface-variant hover:text-on-surface hover:border-strong"
                  }`}
                >
                  <Icon name={fmt.icon} className="text-[18px] mb-1" />
                  <p className="text-xs font-bold leading-tight truncate">{fmt.label}</p>
                  <p className="text-[10px] text-on-surface-variant/80 truncate">{fmt.sub}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Printable Layout Container */}
          <div className="flex justify-center">
            <div
              id="printable-qr-card"
              className={`bg-white text-slate-900 border-2 border-slate-900 rounded-3xl p-6 sm:p-8 flex flex-col items-center text-center shadow-lg transition-all ${
                selectedFormat === "AFFICHE_A4"
                  ? "w-full max-w-sm aspect-[1/1.414]"
                  : selectedFormat === "CARTE_VISITE"
                  ? "w-full max-w-xs aspect-[1.5/1]"
                  : selectedFormat === "STICKER_COLIS"
                  ? "w-full max-w-xs aspect-square"
                  : "w-full max-w-sm aspect-square"
              }`}
            >
              {/* Store Branding on QR Printout */}
              <div className="flex items-center gap-3 mb-4">
                <img
                  src={getMediaUrl(store?.logo_url) || "/media/store/logo.jpg"}
                  alt={store?.name}
                  className="w-12 h-12 rounded-2xl object-cover border-2 border-slate-900 shadow-xs"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "/media/store/logo.jpg";
                  }}
                />
                <div className="text-left">
                  <h3 className="font-extrabold text-slate-900 text-lg sm:text-xl leading-tight">
                    {store?.name || "Boutique"}
                  </h3>
                  <p className="text-xs text-slate-600 font-medium">
                    {store?.delivery_city?.split("(")[0]?.trim() || "Burkina Faso"} • GotoShop
                  </p>
                </div>
              </div>

              {/* Tagline */}
              <p className="text-xs sm:text-sm text-slate-700 italic max-w-xs mb-4 line-clamp-2">
                « {store?.tagline || "Commandez en direct en scannant ce code"} »
              </p>

              {/* Vector QR Matrix */}
              <div className="w-48 h-48 sm:w-56 sm:h-56 p-2 bg-white rounded-2xl border-2 border-slate-900 shadow-xs flex items-center justify-center">
                {loading ? (
                  <Icon name="sync" className="text-[32px] animate-spin text-slate-400" />
                ) : qrData?.qr_svg ? (
                  <div
                    className="w-full h-full"
                    dangerouslySetInnerHTML={{ __html: qrData.qr_svg }}
                  />
                ) : (
                  <Icon name="qr_code_2" className="text-[64px] text-slate-400" />
                )}
              </div>

              {/* Call to Action Footer on Printout */}
              <div className="mt-4 space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-900 text-xs font-bold border border-slate-300">
                  <Icon name="photo_camera" className="text-[14px]" />
                  <span>Scannez avec votre téléphone</span>
                </div>
                <p className="text-[11px] text-slate-500 font-mono tracking-wider pt-1">
                  gotoshop.com/store/{store?.slug}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Action Buttons - Hidden in Print */}
        <div className="p-4 sm:p-5 border-t border-subtle bg-surface-secondary/40 shrink-0 flex flex-wrap items-center justify-between gap-2.5 print:hidden">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyUrl}
              className="h-10 px-3 sm:px-4 rounded-xl bg-surface-secondary hover:bg-surface-elevated text-on-surface text-xs font-semibold border border-subtle flex items-center gap-1.5 transition-colors"
            >
              <Icon name="link" className="text-[16px] text-primary" />
              <span>Copier le lien</span>
            </button>
            <button
              onClick={handleDownloadSvg}
              className="h-10 px-3 sm:px-4 rounded-xl bg-surface-secondary hover:bg-surface-elevated text-on-surface text-xs font-semibold border border-subtle flex items-center gap-1.5 transition-colors"
            >
              <Icon name="download" className="text-[16px] text-secondary" />
              <span>SVG Vectoriel</span>
            </button>
          </div>

          <button
            onClick={handlePrint}
            className="h-10 px-5 rounded-xl bg-primary hover:brightness-105 text-white text-xs font-bold shadow-sm flex items-center gap-2 transition-all active:scale-95"
          >
            <Icon name="print" className="text-[16px]" />
            <span>Imprimer le Support</span>
          </button>
        </div>
      </div>
    </div>
  );
}
