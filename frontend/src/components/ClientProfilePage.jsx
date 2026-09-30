import Icon from "./Icon";
import React, { useState, useEffect } from "react";
import {
  updateCustomerProfile,
  getMediaUrl,
  fetchCustomerLoyaltyCard,
  fetchCustomerLoyaltyCards,
  fetchCustomerLoyaltyHistory,
  fetchCustomerLoyaltyCoupons,
} from "../api/client";
import {
  cardSvg,
  buildCardPdf,
  cardPng,
  downloadPdfBytes,
  downloadBlob,
} from "../utils/cardPdf.js";
import { WEST_AFRICAN_COUNTRIES } from "../utils/locations";
import PasskeySecurityPanel from "./PasskeySecurityPanel";

export default function ClientProfilePage({
  customer,
  store: _store,
  onUpdateCustomer,
  onLogoutCustomer,
  onOpenAuth,
  onOpenOwnerLogin,
  onOpenVerify,
  onNavigateToShop,
  showToast,
}) {
  // Navigation subtabs: "carte" | "historique" | "coupons" | "coordonnees"
  const [profileTab, setProfileTab] = useState("carte");

  // Profile form state
  const [name, setName] = useState(customer?.name || "");
  const [selectedCountryCode, setSelectedCountryCode] = useState(customer?.country_code || "BF");
  const [phone, setPhone] = useState(customer?.phone || "");
  const [email, setEmail] = useState(customer?.email || "");
  const [city, setCity] = useState(customer?.city || "Ouagadougou");
  const [customCity, setCustomCity] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState(customer?.delivery_address || "");
  const [gpsCoordinates, setGpsCoordinates] = useState(customer?.gps_coordinates || "");
  const [gpsLocationUrl, setGpsLocationUrl] = useState(customer?.gps_location_url || "");
  const [preferredChannel, setPreferredChannel] = useState(customer?.preferred_channel || "WHATSAPP");
  const [notes, setNotes] = useState(customer?.notes || "");
  const [avatarPreview, setAvatarPreview] = useState(customer?.avatar_url || "");
  const [avatarData, setAvatarData] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Loyalty Card & Multi-store state
  const [allCards, setAllCards] = useState([]);
  const [selectedCardIndex, setSelectedCardIndex] = useState(0);
  const [cardData, setCardData] = useState(null);
  const [frontSvg, setFrontSvg] = useState("");
  const [backSvg, setBackSvg] = useState("");
  const [isFlipped, setIsFlipped] = useState(false);
  const [cardLoading, setCardLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingPng, setDownloadingPng] = useState(false);

  // Ledger history & coupons
  const [ledgerHistory, setLedgerHistory] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [coupons, setCoupons] = useState([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [copiedCoupon, setCopiedCoupon] = useState(null);

  const currentCountry =
    WEST_AFRICAN_COUNTRIES.find((c) => c.code === selectedCountryCode) || WEST_AFRICAN_COUNTRIES[0];

  const handleSelectCard = (index, cardsList = allCards) => {
    setSelectedCardIndex(index);
    const card = cardsList[index];
    if (card) {
      setCardData(card);
      setFrontSvg(cardSvg(card, {}, "front"));
      setBackSvg(cardSvg(card, {}, "back"));
    }
  };

  const loadCards = async () => {
    try {
      setCardLoading(true);
      const cards = await fetchCustomerLoyaltyCards();
      if (Array.isArray(cards) && cards.length > 0) {
        setAllCards(cards);
        handleSelectCard(0, cards);
      } else {
        const single = await fetchCustomerLoyaltyCard();
        if (single) {
          setAllCards([single]);
          handleSelectCard(0, [single]);
        } else {
          setAllCards([]);
          setCardData(null);
        }
      }
    } catch (err) {
      console.error("Failed to load loyalty cards:", err);
      setAllCards([]);
      setCardData(null);
    } finally {
      setCardLoading(false);
    }
  };

  const loadLedger = async () => {
    try {
      setLedgerLoading(true);
      const items = await fetchCustomerLoyaltyHistory(50);
      setLedgerHistory(items || []);
    } catch (err) {
      console.error("Failed to load ledger history:", err);
    } finally {
      setLedgerLoading(false);
    }
  };

  const loadCoupons = async () => {
    try {
      setCouponsLoading(true);
      const items = await fetchCustomerLoyaltyCoupons();
      setCoupons(items || []);
    } catch (err) {
      console.error("Failed to load coupons:", err);
    } finally {
      setCouponsLoading(false);
    }
  };

  useEffect(() => {
    if (customer) {
      loadCards();
    }
  }, [customer?.id, customer?.session_token]);

  useEffect(() => {
    if (customer && profileTab === "historique") {
      loadLedger();
    } else if (customer && profileTab === "coupons") {
      loadCoupons();
    }
  }, [profileTab, customer?.id]);

  const handleDownloadPdf = async () => {
    if (!cardData) return;
    try {
      setDownloadingPdf(true);
      const bytes = await buildCardPdf(cardData);
      downloadPdfBytes(bytes, `carte-fidelite-${cardData.card_number || "gotoshop"}.pdf`);
      showToast?.("Téléchargement de la carte PDF (A4 échelle réelle) démarré !");
    } catch (err) {
      console.error("PDF generation failed:", err);
      showToast?.("Erreur lors de la génération du PDF");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadPng = async () => {
    if (!cardData) return;
    try {
      setDownloadingPng(true);
      const side = isFlipped ? "back" : "front";
      const blob = await cardPng(cardData, {}, side, 1712);
      downloadBlob(blob, `carte-fidelite-${side}-${cardData.card_number || "gotoshop"}.png`);
      showToast?.(`Téléchargement de l'image (${side === "front" ? "Recto" : "Verso"}) démarré !`);
    } catch (err) {
      console.error("PNG export failed:", err);
      showToast?.("Erreur lors de l'export de l'image PNG");
    } finally {
      setDownloadingPng(false);
    }
  };

  const handleCopyCoupon = (code) => {
    navigator.clipboard?.writeText?.(code);
    setCopiedCoupon(code);
    showToast?.(`Code promo ${code} copié !`);
    setTimeout(() => setCopiedCoupon(null), 3000);
  };

  const handleCountryChange = (code) => {
    setSelectedCountryCode(code);
    const c = WEST_AFRICAN_COUNTRIES.find((it) => it.code === code);
    if (c) {
      setCity(c.cities[0] || "Autre");
      setCustomCity("");
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAvatarPreview(ev.target.result);
      setAvatarData(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleCaptureGPS = () => {
    if (!navigator.geolocation) {
      showToast?.("La géolocalisation n'est pas supportée par votre appareil");
      return;
    }
    setIsLocating(true);
    showToast?.("Recherche de votre position GPS exacte...");
    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          try {
            const rawLat = position?.coords?.latitude;
            const rawLng = position?.coords?.longitude;
            if (rawLat != null && rawLng != null && !isNaN(rawLat) && !isNaN(rawLng)) {
              const lat = parseFloat(Number(rawLat).toFixed(6));
              const lng = parseFloat(Number(rawLng).toFixed(6));
              const coords = `${lat}, ${lng}`;
              const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;
              setGpsCoordinates(coords);
              setGpsLocationUrl(mapsUrl);
              setIsLocating(false);
              showToast?.("Position GPS capturée avec succès !");
            } else {
              setIsLocating(false);
              showToast?.("Position GPS imprécise, veuillez réessayer.");
            }
          } catch (e) {
            console.error("GPS coords processing error:", e);
            setIsLocating(false);
          }
        },
        (err) => {
          setIsLocating(false);
          let msg = "Impossible d'accéder au GPS.";
          if (err?.code === 1) {
            msg = "Localisation bloquée. Cliquez sur le cadenas 🔒 ou paramètres du site à gauche de l'adresse web pour autoriser la position.";
          } else if (err?.code === 2) {
            msg = "Signal GPS indisponible. Activez le GPS de votre appareil.";
          } else if (err?.code === 3) {
            msg = "Délai GPS dépassé. Veuillez réessayer.";
          }
          showToast?.(msg);
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      );
    } catch (e) {
      console.error("GPS invocation error:", e);
      setIsLocating(false);
      showToast?.("Erreur lors de l'activation du GPS");
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const effectiveCity = city === "Autre" ? customCity.trim() || "Autre ville" : city;
      const payload = {
        name,
        phone,
        email: email || null,
        city: effectiveCity,
        delivery_address: deliveryAddress || null,
        gps_coordinates: gpsCoordinates || null,
        gps_location_url: gpsLocationUrl || null,
        preferred_channel: preferredChannel,
        notes: notes || null,
      };
      if (avatarData) {
        payload.avatar_data = avatarData;
      }
      const updated = await updateCustomerProfile(payload);
      onUpdateCustomer(updated);
      setAvatarData(null);
      showToast?.("Profil client mis à jour avec succès !");
    } catch (err) {
      showToast?.(err.message || "Erreur de mise à jour");
    } finally {
      setIsSaving(false);
    }
  };

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto space-y-5 pt-12 pb-32">
        <div className="w-16 h-16 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shadow-lg">
          <Icon name="person" className="text-[32px]" />
        </div>
        <div className="space-y-2">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Votre Profil &amp; Carte de Fidélité</h2>
          <p className="font-body-md text-on-surface-variant text-sm">
            Inscrivez-vous en 3 secondes pour obtenir votre carte de fidélité infalsifiable, cumuler des points à chaque commande et profiter de réductions exclusives.
          </p>
        </div>
        <button
          onClick={onOpenAuth}
          className="w-full h-12 rounded-xl bg-primary-container text-on-primary-container font-label-lg font-bold shadow-md hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Icon name="flash_on" className="text-[20px]" />
          <span>Créer mon Profil (3s)</span>
        </button>

        <div className="pt-8 border-t border-white/10 w-full">
          <button
            onClick={onOpenOwnerLogin}
            className="text-xs text-secondary hover:underline flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
          >
            <Icon name="admin_panel_settings" className="text-[16px]" />
            <span>Accès Commerçante / Propriétaire</span>
          </button>
        </div>
      </div>
    );
  }

  // Tier info helpers
  const tierName = cardData?.tier_name || "Bronze";
  const points = Number(cardData?.points || 0).toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  const fmtPt = (n) => Number(n || 0).toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  const nextTier = cardData?.next_tier;
  const nextProgress = cardData?.next_tier_progress || 0;

  const getTierBadgeStyle = (tier) => {
    const t = String(tier).toLowerCase();
    if (t.includes("plat")) {
      return "bg-gradient-to-r from-slate-200 via-sky-100 to-indigo-200 text-slate-900 border-sky-300";
    }
    if (t.includes("gold") || t.includes("or")) {
      return "bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 border-amber-300";
    }
    if (t.includes("silver") || t.includes("argent")) {
      return "bg-gradient-to-r from-slate-200 via-slate-100 to-slate-300 text-slate-900 border-slate-300";
    }
    return "bg-gradient-to-r from-amber-800/80 via-amber-700/80 to-amber-900/80 text-amber-100 border-amber-600/50";
  };

  return (
    <div className="flex flex-col w-full gap-5 max-w-2xl sm:max-w-3xl mx-auto pb-32 pt-2 animate-fadeIn">
      {/* Top Header Card */}
      <div className="bg-surface-container rounded-2xl p-4 sm:p-5 shadow-sm border border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="relative">
            <div className="w-14 h-14 rounded-full overflow-hidden bg-primary-container text-on-primary-container flex items-center justify-center ring-2 ring-primary/40 shadow-sm shrink-0">
              {avatarPreview ? (
                <img
                  src={avatarPreview.startsWith("data:") ? avatarPreview : getMediaUrl(avatarPreview)}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.style.display = "none";
                    if (e.target.nextSibling) e.target.nextSibling.style.display = "flex";
                  }}
                />
              ) : null}
              <div className={`w-full h-full flex items-center justify-center ${avatarPreview ? "hidden" : "flex"}`}>
                <Icon name="person" className="text-[28px]" />
              </div>
            </div>
            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-surface" title="En ligne" />
          </div>
          <div>
            <h2 className="font-bold text-base sm:text-lg text-on-surface flex items-center gap-2">
              <span>{name || "Client GotoShop"}</span>
              <span className={`text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full border shadow-xs ${getTierBadgeStyle(tierName)}`}>
                {tierName}
              </span>
            </h2>
            <p className="text-xs text-on-surface-variant font-mono">{phone}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <div className="text-right px-3 py-1.5 rounded-xl bg-surface-container-high/80 border border-white/5">
            <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Solde Fidélité</p>
            <p className="text-base font-extrabold text-primary font-mono">{points} <span className="text-xs font-semibold">pt</span></p>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center p-1 bg-surface-container-high/60 rounded-xl border border-white/5 overflow-x-auto no-scrollbar gap-1">
        <button
          onClick={() => setProfileTab("carte")}
          className={`flex-1 min-w-[110px] py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            profileTab === "carte"
              ? "bg-primary text-white shadow-sm"
              : "text-on-surface-variant hover:text-on-surface hover:bg-white/5"
          }`}
        >
          <Icon name="credit_card" className="text-[16px]" />
          <span>Ma Carte</span>
        </button>

        <button
          onClick={() => setProfileTab("historique")}
          className={`flex-1 min-w-[110px] py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            profileTab === "historique"
              ? "bg-primary text-white shadow-sm"
              : "text-on-surface-variant hover:text-on-surface hover:bg-white/5"
          }`}
        >
          <Icon name="history" className="text-[16px]" />
          <span>Historique Points</span>
        </button>

        <button
          onClick={() => setProfileTab("coupons")}
          className={`flex-1 min-w-[110px] py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            profileTab === "coupons"
              ? "bg-primary text-white shadow-sm"
              : "text-on-surface-variant hover:text-on-surface hover:bg-white/5"
          }`}
        >
          <Icon name="local_offer" className="text-[16px]" />
          <span>Mes Coupons</span>
        </button>

        <button
          onClick={() => setProfileTab("coordonnees")}
          className={`flex-1 min-w-[110px] py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            profileTab === "coordonnees"
              ? "bg-primary text-white shadow-sm"
              : "text-on-surface-variant hover:text-on-surface hover:bg-white/5"
          }`}
        >
          <Icon name="edit" className="text-[16px]" />
          <span>Coordonnées</span>
        </button>
      </div>

      {/* TAB 1: MA CARTE & STATUT */}
      {profileTab === "carte" && (
        <div className="space-y-5 animate-fadeIn">
          {/* Multi-Store Cards Selector */}
          {allCards.length > 1 && (
            <div className="bg-surface-container rounded-2xl p-3 border border-subtle flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 min-w-0 flex-1">
                <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
                  <Icon name="storefront" className="text-primary text-[15px]" />
                  <span>Boutiques ({allCards.length}) :</span>
                </span>
                {allCards.map((c, idx) => (
                  <button
                    key={c.card_number || idx}
                    type="button"
                    onClick={() => handleSelectCard(idx)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                      selectedCardIndex === idx
                        ? "bg-primary text-white shadow-sm ring-2 ring-primary/30"
                        : "bg-surface-container-high/80 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest"
                    }`}
                  >
                    <span>{c.store?.name || `Boutique ${idx + 1}`}</span>
                    <span className="text-[10px] font-mono opacity-85">({fmtPt(c.points)} pt)</span>
                  </button>
                ))}
              </div>
              <span className="text-[11px] font-mono font-bold text-on-surface-variant shrink-0 bg-surface-container-highest px-2 py-0.5 rounded-md">
                {selectedCardIndex + 1}/{allCards.length}
              </span>
            </div>
          )}

          {/* 3D Realistic Physical Flip Card Container */}
          <div className="bg-surface-container rounded-2xl p-4 sm:p-6 shadow-sm border border-subtle">
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="text-on-surface-variant font-medium flex items-center gap-1.5">
                <Icon name="touch_app" className="text-[16px] text-primary" />
                <span>Cliquez sur la carte pour voir le verso</span>
              </span>
              <button
                type="button"
                onClick={() => setIsFlipped(!isFlipped)}
                className="text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Icon name="flip" className="text-[15px]" />
                <span>{isFlipped ? "Afficher Recto" : "Afficher Verso"}</span>
              </button>
            </div>

            {/* Realistic 3D Card Scene */}
            {cardLoading ? (
              <div className="w-full max-w-sm sm:max-w-md mx-auto aspect-[85.6/53.98] rounded-2xl bg-surface-container-high/80 animate-pulse flex flex-col items-center justify-center text-on-surface-variant text-sm gap-2">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span>Chargement de votre carte sécurisée...</span>
              </div>
            ) : cardData ? (
              <div
                className="relative w-full max-w-sm sm:max-w-md mx-auto aspect-[85.6/53.98] select-none group"
                style={{ perspective: "1400px" }}
              >
                <div
                  onClick={() => setIsFlipped(!isFlipped)}
                  className="relative w-full h-full cursor-pointer transition-transform duration-700 ease-out rounded-2xl shadow-[0_20px_45px_-12px_rgba(0,0,0,0.5),0_0_20px_rgba(234,179,8,0.12)] hover:shadow-[0_25px_50px_-10px_rgba(0,0,0,0.6),0_0_25px_rgba(234,179,8,0.2)] transition-shadow"
                  style={{
                    transformStyle: "preserve-3d",
                    transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                  }}
                  title="Cliquer pour retourner la carte"
                >
                  {/* Front Face */}
                  <div
                    className="absolute inset-0 w-full h-full rounded-2xl overflow-hidden border border-white/20 dark:border-white/10"
                    style={{
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden",
                    }}
                  >
                    <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: frontSvg }} />
                    {/* Realistic Glossy Sheen Overlay */}
                    <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-60 group-hover:opacity-90 transition-opacity duration-300" />
                  </div>

                  {/* Back Face */}
                  <div
                    className="absolute inset-0 w-full h-full rounded-2xl overflow-hidden border border-white/20 dark:border-white/10"
                    style={{
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden",
                      transform: "rotateY(180deg)",
                    }}
                  >
                    <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: backSvg }} />
                    <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-50" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 sm:p-8 rounded-2xl bg-surface-container-high/40 border border-white/10 text-center space-y-3.5 max-w-md mx-auto my-2">
                <div className="w-14 h-14 rounded-2xl bg-primary/15 text-primary flex items-center justify-center mx-auto shadow-inner">
                  <Icon name="credit_card" className="text-[28px]" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-base text-on-surface">Aucune carte de fidélité active pour le moment</h4>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    Vos cartes de fidélité se créent automatiquement dès votre première commande dans chaque boutique partenaire GotoShop. Cumulez des points et profitez de privilèges exclusifs !
                  </p>
                </div>
                {onNavigateToShop && (
                  <button
                    type="button"
                    onClick={onNavigateToShop}
                    className="px-4 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:brightness-110 active:scale-95 transition-all inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Icon name="storefront" className="text-[16px]" />
                    <span>Découvrir les boutiques</span>
                  </button>
                )}
              </div>
            )}

            {/* Card Action Buttons */}
            {cardData && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-5">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={downloadingPdf}
                  className="h-11 px-3 rounded-xl bg-primary text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm hover:brightness-110 active:scale-98 transition-all cursor-pointer"
                >
                  <Icon name="picture_as_pdf" className="text-[18px]" />
                  <span>{downloadingPdf ? "Génération PDF..." : "Télécharger PDF (A4)"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPng}
                  disabled={downloadingPng}
                  className="h-11 px-3 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-semibold text-xs flex items-center justify-center gap-2 border border-white/5 active:scale-98 transition-all cursor-pointer"
                >
                  <Icon name="image" className="text-[18px] text-secondary" />
                  <span>{downloadingPng ? "Export PNG..." : `Image PNG (${isFlipped ? "Verso" : "Recto"})`}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenVerify?.(cardData.card_number, cardData.security_code)}
                  className="h-11 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 font-semibold text-xs flex items-center justify-center gap-2 border border-emerald-500/30 active:scale-98 transition-all cursor-pointer"
                >
                  <Icon name="verified_user" className="text-[18px]" />
                  <span>Contrôle d'Authenticité</span>
                </button>
              </div>
            )}
          </div>

          {/* Tier Status & Progress Card */}
          <div className="bg-surface-container rounded-2xl p-4 sm:p-5 shadow-sm border border-subtle space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] uppercase font-bold text-on-surface-variant tracking-wider">
                  Votre Statut Actuel {cardData?.store?.name ? `(${cardData.store.name})` : ""}
                </span>
                <h3 className="font-bold text-lg text-on-surface flex items-center gap-2 mt-0.5">
                  <span>Niveau {tierName}</span>
                </h3>
              </div>
              <div className="text-right">
                <span className="text-xs text-on-surface-variant">Solde utilisable :</span>
                <span className="text-sm font-extrabold text-primary font-mono ml-1.5">{points} pt</span>
              </div>
            </div>

            {/* Next tier progress bar */}
            {nextTier ? (
              <div className="space-y-2 p-3.5 rounded-xl bg-surface-container-high/60 border border-white/5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-on-surface font-semibold flex items-center gap-1.5">
                    <Icon name="trending_up" className="text-[16px] text-primary" />
                    <span>Progression vers {nextTier}</span>
                  </span>
                  <span className="font-mono font-bold text-primary">{nextProgress}%</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-surface-container-lowest overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(4, Math.min(100, nextProgress))}%` }}
                  />
                </div>
                <p className="text-[11px] text-on-surface-variant">
                  Plus que <strong className="text-on-surface">{fmtPt(cardData?.points_to_next)} pt gagnés</strong> pour atteindre le statut {nextTier}. Dépenser vos points ne fait pas baisser votre statut.
                </p>
              </div>
            ) : tierName === "Platine" ? (
              <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary font-semibold flex items-center gap-2">
                <Icon name="workspace_premium" className="text-[18px]" />
                <span>Félicitations ! Vous avez atteint le palier maximal Platine. Remise maximale garantie sur toutes vos commandes !</span>
              </div>
            ) : (
              <div className="space-y-2 p-3.5 rounded-xl bg-surface-container-high/60 border border-white/5">
                <p className="text-xs text-on-surface-variant">
                  Passez commande pour progresser vers le statut Argent (50 pts) et débloquer plus de privilèges.
                </p>
              </div>
            )}

            {/* Tiers privileges overview grid */}
            <div>
              <p className="text-xs font-bold text-on-surface mb-2.5">Grille des Privilèges de Fidélité</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className={`p-2.5 rounded-xl border ${tierName === "Bronze" ? "bg-amber-950/40 border-amber-600/50" : "bg-surface-container-high/40 border-white/5"}`}>
                  <p className="font-bold text-amber-500">Bronze (0 pt)</p>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">Accès catalogue &amp; suivi 24h</p>
                </div>
                <div className={`p-2.5 rounded-xl border ${tierName === "Argent" ? "bg-slate-800/60 border-slate-400/50" : "bg-surface-container-high/40 border-white/5"}`}>
                  <p className="font-bold text-slate-300">Argent (50 pt)</p>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">-3% sur les commandes</p>
                </div>
                <div className={`p-2.5 rounded-xl border ${tierName === "Or" ? "bg-amber-950/50 border-amber-400" : "bg-surface-container-high/40 border-white/5"}`}>
                  <p className="font-bold text-yellow-400">Or (150 pt)</p>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">-5% + support prioritaire</p>
                </div>
                <div className={`p-2.5 rounded-xl border ${tierName === "Platine" ? "bg-indigo-950/50 border-sky-400" : "bg-surface-container-high/40 border-white/5"}`}>
                  <p className="font-bold text-sky-300">Platine (400 pt)</p>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">-8% + livraisons express</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: HISTORIQUE DES POINTS */}
      {profileTab === "historique" && (
        <div className="bg-surface-container rounded-2xl p-4 sm:p-5 shadow-sm border border-subtle space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-on-surface text-base">Historique des Points &amp; Mouvements</h3>
              <p className="text-xs text-on-surface-variant">Livre de compte horodaté et sécurisé de votre fidélité</p>
            </div>
            <button
              onClick={loadLedger}
              disabled={ledgerLoading}
              className="p-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant cursor-pointer transition-colors"
              title="Rafraîchir"
            >
              <Icon name="refresh" className={`text-[18px] ${ledgerLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {ledgerLoading ? (
            <div className="py-12 text-center text-xs text-on-surface-variant space-y-2">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p>Chargement des mouvements...</p>
            </div>
          ) : ledgerHistory.length === 0 ? (
            <div className="py-12 text-center text-xs text-on-surface-variant space-y-2 bg-surface-container-high/40 rounded-xl border border-dashed border-white/10">
              <Icon name="receipt_long" className="text-[32px] text-on-surface-variant/40 mx-auto" />
              <p>Aucun mouvement de points pour l'instant.</p>
              <p className="text-[11px]">Vos points seront crédités automatiquement dès la livraison de vos commandes !</p>
            </div>
          ) : (
            <div className="divide-y divide-subtle">
              {ledgerHistory.map((item) => {
                const isEarned = item.points > 0;
                return (
                  <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isEarned ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
                        }`}
                      >
                        <Icon name={isEarned ? "add_circle" : "remove_circle"} className="text-[20px]" />
                      </div>
                      <div>
                        <p className="font-semibold text-xs text-on-surface">{item.description}</p>
                        <p className="text-[10px] text-on-surface-variant font-mono">
                          {item.created_at ? new Date(item.created_at).toLocaleDateString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "--"}
                          {item.expires_at ? ` • Expire le ${new Date(item.expires_at).toLocaleDateString("fr-FR")}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-mono font-bold text-xs ${isEarned ? "text-emerald-400" : "text-rose-400"}`}>
                        {isEarned ? `+${fmtPt(item.points)}` : fmtPt(item.points)} pt
                      </p>
                      <p className="text-[10px] text-on-surface-variant font-mono">
                        Solde: {fmtPt(item.balance_after)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MES COUPONS & RÉCOMPENSES */}
      {profileTab === "coupons" && (
        <div className="bg-surface-container rounded-2xl p-4 sm:p-5 shadow-sm border border-subtle space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-on-surface text-base">Vos Coupons &amp; Codes Promos</h3>
              <p className="text-xs text-on-surface-variant">Saisissez ces codes à la commande. Un coupon ne se cumule pas avec vos points.</p>
            </div>
            <button
              onClick={loadCoupons}
              disabled={couponsLoading}
              className="p-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant cursor-pointer transition-colors"
              title="Rafraîchir"
            >
              <Icon name="refresh" className={`text-[18px] ${couponsLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {couponsLoading ? (
            <div className="py-12 text-center text-xs text-on-surface-variant space-y-2">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p>Recherche de vos récompenses...</p>
            </div>
          ) : coupons.length === 0 ? (
            <div className="py-12 text-center text-xs text-on-surface-variant space-y-2 bg-surface-container-high/40 rounded-xl border border-dashed border-white/10">
              <Icon name="local_offer" className="text-[32px] text-on-surface-variant/40 mx-auto" />
              <p>Aucun coupon actif pour le moment.</p>
              <p className="text-[11px]">Vos points, eux, se dépensent directement sur un produit au moment de la commande.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {coupons.map((c) => (
                <div
                  key={c.id}
                  className="p-3.5 rounded-xl bg-surface-container-high/60 border border-primary/20 flex flex-col justify-between gap-3 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Coupon Privilège</span>
                      <h4 className="font-bold text-sm text-on-surface mt-0.5">{c.title || "Remise Exceptionnelle"}</h4>
                      <p className="text-xs font-extrabold text-emerald-400 mt-1">
                        {c.discount_percent > 0 ? `-${c.discount_percent}% de remise` : `-${c.discount_amount} FCFA de remise`}
                      </p>
                    </div>
                    <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                      <Icon name="confirmation_number" className="text-[20px]" />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px]">
                    <span className="text-on-surface-variant">
                      {c.min_order_amount > 0 ? `Dès ${Number(c.min_order_amount).toLocaleString("fr-FR")} F` : "Sans minimum"}
                      {c.expires_at ? ` · jusqu'au ${new Date(c.expires_at).toLocaleDateString("fr-FR")}` : ""}
                    </span>
                    <button
                      onClick={() => handleCopyCoupon(c.code)}
                      className="px-2.5 py-1 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Icon name={copiedCoupon === c.code ? "check" : "content_copy"} className="text-[13px]" />
                      <span>{copiedCoupon === c.code ? "Copié !" : c.code}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: COORDONNÉES & LIVRAISON */}
      {profileTab === "coordonnees" && (
        <form onSubmit={handleSaveProfile} className="bg-surface-container rounded-2xl p-4 sm:p-5 shadow-sm border border-subtle space-y-4 animate-fadeIn">
          {/* Avatar Section */}
          <div className="flex items-center gap-4 p-3 rounded-xl bg-surface-container-high/60 border border-white/5">
            <div className="relative group shrink-0">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-primary-container text-on-primary-container flex items-center justify-center ring-2 ring-primary shadow-md">
                {avatarPreview ? (
                  <img
                    src={avatarPreview.startsWith("data:") ? avatarPreview : getMediaUrl(avatarPreview)}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.style.display = "none";
                      if (e.target.nextSibling) e.target.nextSibling.style.display = "flex";
                    }}
                  />
                ) : null}
                <div className={`w-full h-full flex items-center justify-center ${avatarPreview ? "hidden" : "flex"}`}>
                  <Icon name="person" className="text-[32px]" />
                </div>
              </div>
              <label className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                <Icon name="photo_camera" className="text-[20px]" />
                <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
              </label>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-on-surface text-sm">{name || "Votre Nom"}</p>
              <p className="text-xs text-secondary font-mono">{phone}</p>
              <label className="text-[11px] text-primary hover:underline cursor-pointer flex items-center gap-1 mt-1">
                <Icon name="upload" className="text-[14px]" />
                <span>Changer ma photo de profil</span>
                <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
              </label>
            </div>
          </div>

          {/* Identity Inputs */}
          <div className="space-y-3">
            <div>
              <label className="font-label-sm text-[11px] text-on-surface-variant uppercase font-bold block mb-1">
                Nom &amp; Prénom
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            {/* Country Selection */}
            <div>
              <label className="font-label-sm text-[11px] text-on-surface-variant uppercase font-bold block mb-1">
                Pays de résidence
              </label>
              <select
                value={selectedCountryCode}
                onChange={(e) => handleCountryChange(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
              >
                {WEST_AFRICAN_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name} ({c.dial})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-label-sm text-[11px] text-on-surface-variant uppercase font-bold block mb-1">
                  Numéro WhatsApp
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="font-label-sm text-[11px] text-on-surface-variant uppercase font-bold block mb-1">
                  Ville Principale
                </label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                >
                  {currentCountry.cities.map((ct) => (
                    <option key={ct} value={ct}>
                      {ct}
                    </option>
                  ))}
                </select>
                {city === "Autre" && (
                  <input
                    type="text"
                    placeholder="Précisez votre ville..."
                    value={customCity}
                    onChange={(e) => setCustomCity(e.target.value)}
                    className="w-full h-11 mt-2 px-3 rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-label-sm text-[11px] text-on-surface-variant uppercase font-bold block mb-1">
                  E-mail (facultatif)
                </label>
                <input
                  type="email"
                  placeholder="nom@exemple.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="font-label-sm text-[11px] text-on-surface-variant uppercase font-bold block mb-1">
                  Canal Préféré
                </label>
                <select
                  value={preferredChannel}
                  onChange={(e) => setPreferredChannel(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                >
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="SMS">SMS Direct</option>
                  <option value="CALL">Appel Vocal</option>
                </select>
              </div>
            </div>

            <div>
              <label className="font-label-sm text-[11px] text-on-surface-variant uppercase font-bold block mb-1">
                Adresse de Livraison / Quartier &amp; Repère
              </label>
              <input
                type="text"
                placeholder="Ex: Ouaga 2000, Dassasgho face pharmacie, Zone 4..."
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* GPS Saved Coordinates Card */}
          <div className="p-3.5 rounded-xl bg-surface-container-high/60 border border-primary/20 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary flex items-center gap-1.5 uppercase tracking-wider">
                <Icon name="pin_drop" className="text-[16px]" />
                Localisation GPS Mémorisée
              </span>
              <button
                type="button"
                onClick={handleCaptureGPS}
                disabled={isLocating}
                className="px-2.5 py-1 rounded-lg bg-primary text-white text-[11px] font-bold hover:brightness-110 active:scale-95 flex items-center gap-1 cursor-pointer transition-all"
              >
                <Icon name="my_location" className="text-[14px]" />
                <span>{isLocating ? "Détection..." : "Activer GPS Actuel"}</span>
              </button>
            </div>

            {gpsCoordinates ? (
              <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-lowest text-xs">
                <span className="text-on-surface font-mono">{gpsCoordinates}</span>
                <a
                  href={gpsLocationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-secondary hover:underline flex items-center gap-1 font-semibold"
                >
                  <span>Voir Maps</span>
                  <Icon name="open_in_new" className="text-[14px]" />
                </a>
              </div>
            ) : (
              <p className="text-[11px] text-on-surface-variant">
                Enregistrez votre position GPS une fois pour l'inclure en 1 clic dans toutes vos futures commandes de livraison express.
              </p>
            )}
          </div>

          {/* Notes for Courier */}
          <div>
            <label className="font-label-sm text-[11px] text-on-surface-variant uppercase font-bold block mb-1">
              Consignes permanentes pour le livreur
            </label>
            <textarea
              rows="2"
              placeholder="Ex: Appeler dès l'arrivée au portail bleu..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Save button */}
          <button
            type="submit"
            disabled={isSaving}
            className="w-full h-12 rounded-xl bg-primary text-white font-label-lg font-bold shadow-md hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Icon name="check" className="text-[20px]" />
            <span>{isSaving ? "Enregistrement..." : "Enregistrer mes Informations"}</span>
          </button>

          {/* Logout Client Button */}
          <button
            type="button"
            onClick={onLogoutCustomer}
            className="w-full h-10 rounded-xl bg-surface-container-high hover:bg-red-500/10 text-on-surface-variant hover:text-red-400 font-label-md font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Icon name="logout" className="text-[16px]" />
            <span>Déconnexion du compte client</span>
          </button>
        </form>
      )}
      {profileTab === "coordonnees" && (
        <div className="mt-4 bg-surface-container rounded-2xl p-4 sm:p-5 shadow-sm border border-subtle">
          <PasskeySecurityPanel showToast={showToast} />
        </div>
      )}

      {/* Switch to Owner Portal Card */}
      <div className="p-4 rounded-2xl bg-surface-container/60 border border-white/5 flex items-center justify-between text-xs">
        <div>
          <p className="font-bold text-on-surface">Espace Propriétaire / Commerçante</p>
          <p className="text-[11px] text-on-surface-variant">Accédez aux statistiques globales, stocks, caisse et arbitrages 24h.</p>
        </div>
        <button
          onClick={onOpenOwnerLogin}
          className="px-3 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-secondary font-bold flex items-center gap-1.5 shrink-0 transition-transform active:scale-95 cursor-pointer"
        >
          <Icon name="admin_panel_settings" className="text-[16px]" />
          <span>Connexion Admin</span>
        </button>
      </div>
    </div>
  );
}
