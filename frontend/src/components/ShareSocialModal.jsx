import React, { useState } from "react";
import { trackVisit } from "../api/client";

export default function ShareSocialModal({ store, onClose, showToast }) {
  const [activeNetwork, setActiveNetwork] = useState("tiktok_bio");
  const [testing, setTesting] = useState(false);

  const networks = [
    {
      id: "tiktok_bio",
      name: "TikTok Bio & Story",
      icon: "smart_display",
      color: "#FE2C55",
      description: "Lien optimisé pour votre profil et vos vidéos TikTok.",
      sourceTag: "tiktok_bio",
    },
    {
      id: "wa_status",
      name: "Statut & Groupes WhatsApp",
      icon: "chat",
      color: "#25D366",
      description: "Partagez en 1 clic dans votre statut ou vers vos contacts.",
      sourceTag: "wa_status",
    },
    {
      id: "fb_post",
      name: "Facebook Page & Post",
      icon: "forum",
      color: "#0084FF",
      description: "Pour vos publications, réels et groupes Facebook.",
      sourceTag: "fb_post",
    },
    {
      id: "instagram",
      name: "Instagram Bio & DM",
      icon: "photo_camera",
      color: "#E1306C",
      description: "Lien de redirection pour votre bio et vos stories Insta.",
      sourceTag: "instagram",
    },
    {
      id: "qr",
      name: "QR Code Boutique Physique",
      icon: "qr_code_2",
      color: "#F59E0B",
      description: "À imprimer sur vos flyers ou comptoir de vente.",
      sourceTag: "qr",
    },
  ];

  const currentNet = networks.find((n) => n.id === activeNetwork) || networks[0];
  const trackedUrl = `${window.location.origin}/?src=${currentNet.sourceTag}`;

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(trackedUrl);
    showToast(`Lien tracké ${currentNet.name} copié !`);
  };

  const handleShareNative = () => {
    if (navigator.share) {
      navigator.share({
        title: store?.name || "Boutique",
        text: `Commandez directement chez ${store?.name} sur WhatsApp & réseaux sociaux !`,
        url: trackedUrl,
      }).catch(() => {});
    } else {
      handleCopyLink();
    }
  };

  const handleTestClick = async () => {
    setTesting(true);
    showToast(`Simulation d'un clic client depuis ${currentNet.name}...`);
    await trackVisit(currentNet.sourceTag);
    setTimeout(() => {
      setTesting(false);
      showToast(`+1 Visite enregistrée en base pour ${currentNet.name} ! Vérifiez l'onglet Stats.`);
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md">
      <div className="bg-surface-container-high rounded-2xl p-5 max-w-md w-full shadow-2xl border border-white/5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-secondary/20 text-secondary flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">share</span>
            </span>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">
              Partager sur les Réseaux Sociaux
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-container-highest text-on-surface flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <p className="font-body-sm text-body-sm text-on-surface-variant mt-3">
          Chaque réseau social possède un <strong>tag de tracking unique</strong>. Lorsque vos clients cliquent, le moteur incrémente automatiquement les statistiques de ce canal dans votre tableau de bord.
        </p>

        {/* Network selector tabs */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-3">
          {networks.map((net) => {
            const isSelected = activeNetwork === net.id;
            return (
              <button
                key={net.id}
                onClick={() => setActiveNetwork(net.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-xl font-label-sm text-xs flex items-center gap-1.5 transition-all ${
                  isSelected
                    ? "bg-surface-container-highest text-on-surface ring-1 ring-primary font-bold shadow-md"
                    : "bg-surface-container text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]" style={{ color: net.color }}>
                  {net.icon}
                </span>
                <span>{net.name.split(" ")[0]}</span>
              </button>
            );
          })}
        </div>

        {/* Active Network Card */}
        <div className="p-4 rounded-xl bg-surface-container space-y-3">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0"
              style={{ backgroundColor: `${currentNet.color}26`, color: currentNet.color }}
            >
              <span className="material-symbols-outlined text-[24px]">{currentNet.icon}</span>
            </div>
            <div>
              <h4 className="font-headline-sm text-headline-sm text-on-surface">{currentNet.name}</h4>
              <p className="font-body-sm text-xs text-on-surface-variant">{currentNet.description}</p>
            </div>
          </div>

          {activeNetwork === "qr" ? (
            <div className="flex flex-col items-center py-2 bg-white rounded-xl p-3 shadow-inner">
              <div className="w-36 h-36 border-4 border-dashed border-gray-800 flex flex-col items-center justify-center text-black text-center font-bold text-xs p-2">
                <span className="material-symbols-outlined text-[36px] text-primary-container">qr_code_2</span>
                <span>SCANNER POUR COMMANDER</span>
                <span className="text-[10px] text-gray-600 mt-1">{store?.name}</span>
              </div>
            </div>
          ) : (
            <div className="p-2.5 rounded-lg bg-surface-container-lowest flex items-center justify-between gap-2 border border-white/5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-secondary text-[16px]">link</span>
                <span className="font-mono text-xs text-on-surface-variant truncate">
                  {trackedUrl}
                </span>
              </div>
              <button
                onClick={handleCopyLink}
                className="px-2.5 py-1 rounded-md bg-surface-container-high text-primary font-label-sm text-xs font-bold hover:bg-primary-container hover:text-on-primary-container transition-all flex-shrink-0"
              >
                Copier
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={handleShareNative}
              className="h-11 rounded-xl bg-primary-container text-on-primary-container font-label-md text-label-md font-bold flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined text-[18px]">send</span>
              <span>Partager</span>
            </button>
            <button
              disabled={testing}
              onClick={handleTestClick}
              className="h-11 rounded-xl bg-surface-container-highest text-secondary font-label-md text-label-md font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-transform hover:bg-surface-bright"
            >
              <span className="material-symbols-outlined text-[18px]">touch_app</span>
              <span>Tester Clic (+1)</span>
            </button>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-outline-variant/20 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-surface-container text-on-surface font-label-md text-label-md"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
