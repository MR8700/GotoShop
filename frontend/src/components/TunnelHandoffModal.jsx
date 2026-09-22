import React, { useState, useEffect } from "react";
import { getMediaUrl, createOrderIntent, saveLocalGuestOrder } from "../api/client";

export default function TunnelHandoffModal({
  store,
  product,
  customer,
  initialChannel = "WHATSAPP",
  initialColor = "Bleu Nuit",
  onClose,
  showToast,
  onOrderCreated,
  onOpenCustomerAuth,
  onNavigateToOrders,
}) {
  const [selectedColor, setSelectedColor] = useState(initialColor);
  const [quantity, setQuantity] = useState(1);
  const [selectedCity, setSelectedCity] = useState(customer?.city || "Ouagadougou");
  const [customLocality, setCustomLocality] = useState(customer?.delivery_address || "");
  const [activeChannel, setActiveChannel] = useState((customer?.preferred_channel || initialChannel).toUpperCase());
  const [referenceCode, setReferenceCode] = useState("CMD-" + Math.random().toString(36).substring(2, 8).toUpperCase());
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccessIntent, setOrderSuccessIntent] = useState(null);

  // Editable social media message state
  const [customMessage, setCustomMessage] = useState("");
  const [isMessageEdited, setIsMessageEdited] = useState(false);

  // GPS Location state - EXCLUSIVELY sent if client explicitly wants it
  const [wantSendGps, setWantSendGps] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [customerLocationUrl, setCustomerLocationUrl] = useState(customer?.gps_location_url || null);
  const [customerCoordinates, setCustomerCoordinates] = useState(customer?.gps_coordinates || null);

  const handleCaptureLocation = () => {
    if (!navigator.geolocation) {
      showToast("La géolocalisation n'est pas supportée par votre appareil");
      return;
    }
    setIsLocating(true);
    showToast("Recherche de votre position GPS exacte...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(5);
        const lng = position.coords.longitude.toFixed(5);
        const coordsStr = `${lat}, ${lng}`;
        const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;
        setCustomerCoordinates(coordsStr);
        setCustomerLocationUrl(mapsUrl);
        setWantSendGps(true);
        setIsLocating(false);
        showToast("📍 Position GPS prête à l'envoi !");
      },
      (error) => {
        setIsLocating(false);
        let errorMsg = "Impossible d'obtenir la position GPS";
        if (error.code === 1) errorMsg = "Veuillez autoriser l'accès GPS pour partager votre position";
        else if (error.code === 2) errorMsg = "Signal GPS indisponible";
        else if (error.code === 3) errorMsg = "Délai GPS dépassé";
        showToast(errorMsg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleClearLocation = () => {
    setCustomerCoordinates(null);
    setCustomerLocationUrl(null);
    setWantSendGps(false);
    showToast("Position GPS retirée.");
  };

  // Available cities from store or defaults (Burkina Faso oriented)
  const cities = store?.delivery_cities?.length
    ? store.delivery_cities
    : [
        { id: "1", name: "Ouagadougou", display_label: "📍 Ouaga" },
        { id: "2", name: "Bobo-Dioulasso", display_label: "📍 Bobo" },
        { id: "3", name: "Koudougou", display_label: "Koudougou" },
        { id: "4", name: "Autre", display_label: "Autre Ville" },
      ];

  // Available variants from product or defaults
  const colorOptions = product?.variants?.length
    ? product.variants.map((v) => v.name)
    : ["Bleu Nuit", "Noir Minéral", "Or Jaune"];

  const unitPrice = product?.price || 85000;
  const totalPrice = unitPrice * quantity;

  const copyRefCode = () => {
    navigator.clipboard?.writeText(referenceCode).catch(() => {});
    setCopied(true);
    showToast(`Référence #${referenceCode} copiée !`);
    setTimeout(() => setCopied(false), 2000);
  };

  const destinationStr = customLocality.trim() ? `${selectedCity} (${customLocality.trim()})` : selectedCity;

  const getDefaultMessage = () => {
    const colorStr = selectedColor ? ` (${selectedColor})` : "";
    const clientGreeting = customer ? `Je suis ${customer.name}. ` : "";
    let msg = `Bonjour ${store?.name || "Boutique"}, ${clientGreeting}je confirme l'achat de ${quantity}x ${product?.name}${colorStr} pour ${destinationStr}. Réf: ${referenceCode}`;
    if (wantSendGps && customerLocationUrl) {
      msg += ` 📍 Ma localisation exacte : ${customerLocationUrl}`;
    }
    return msg;
  };

  useEffect(() => {
    if (!isMessageEdited) {
      setCustomMessage(getDefaultMessage());
    }
  }, [
    quantity,
    selectedColor,
    destinationStr,
    wantSendGps,
    customerLocationUrl,
    customer,
    store?.name,
    product?.name,
    referenceCode,
    isMessageEdited,
  ]);

  const handleLaunchHandshake = async () => {
    setIsSubmitting(true);
    showToast(`Création de l'intention ${referenceCode}...`);

    const finalMessage = (customMessage.trim() || getDefaultMessage()).trim();

    try {
      const payload = {
        store_id: store.id,
        product_id: product.id,
        channel_type: activeChannel,
        quantity: quantity,
        selected_color: selectedColor,
        delivery_city: destinationStr,
        customer_source: "MOBILE_WEB",
        customer_name: customer?.name || "Client Mobile",
        customer_phone: customer?.phone || null,
        customer_id: customer?.id || null,
        customer_location_url: wantSendGps ? customerLocationUrl : null,
        customer_coordinates: wantSendGps ? customerCoordinates : null,
        custom_message: finalMessage,
      };

      const res = await createOrderIntent(payload);
      
      // Persist in local storage so guest can track and manage even without account
      saveLocalGuestOrder({
        id: res.id,
        reference_code: res.reference_code,
        product_name: product.name,
        product_image_url: product.primary_image_url,
        quantity: quantity,
        selected_color: selectedColor,
        delivery_city: destinationStr,
        total_amount: totalPrice,
        currency: product.currency || "FCFA",
        channel_type: activeChannel,
        status: res.status || "CREATED",
        client_status: "PENDING",
        redirect_url: res.redirect_url,
        customer_location_url: wantSendGps ? customerLocationUrl : null,
        customer_coordinates: wantSendGps ? customerCoordinates : null,
        created_at: res.created_at || new Date().toISOString(),
      });

      if (onOrderCreated) onOrderCreated(res);

      let finalRedirectUrl = res.redirect_url;
      const rawWa = store?.contact_whatsapp || store?.channels?.find((c) => c.channel_type === "WHATSAPP")?.account_handle || "22670123456";
      const cleanWa = rawWa.replace(/\D/g, "");

      if (activeChannel === "WHATSAPP") {
        finalRedirectUrl = `https://wa.me/${cleanWa || "22670123456"}?text=${encodeURIComponent(finalMessage)}`;
      } else if (activeChannel === "SMS") {
        finalRedirectUrl = `sms:${rawWa || "+22670123456"}?body=${encodeURIComponent(finalMessage)}`;
      }

      showToast(`Redirection vers ${activeChannel}...`);
      setTimeout(() => {
        window.open(finalRedirectUrl, "_blank");
        setIsSubmitting(false);
        if (!customer) {
          setOrderSuccessIntent(res);
        } else {
          setTimeout(() => onClose(), 1500);
        }
      }, 500);
    } catch (err) {
      showToast(err.message || "Erreur de redirection");
      setIsSubmitting(false);
    }
  };

  // CTA button styling per channel
  const getCtaConfig = () => {
    switch (activeChannel) {
      case "MESSENGER":
        return {
          bg: "bg-[#0084FF] text-on-surface shadow-[#0084FF]/20",
          icon: "forum",
          label: "Discuter sur Messenger Facebook",
        };
      case "TIKTOK":
        return {
          bg: "bg-[#FE2C55] text-on-surface shadow-[#FE2C55]/20",
          icon: "smart_display",
          label: `Envoyer un TikTok DM (${store?.channels?.find(c => c.channel_type === 'TIKTOK')?.account_handle || "@awachic"})`,
        };
      case "SMS":
        return {
          bg: "bg-surface-variant text-on-surface shadow-md border border-primary/40",
          icon: "sms",
          label: "Envoyer un SMS Direct",
        };
      case "CALL":
        return {
          bg: "bg-primary-container text-on-primary-container shadow-primary-container/20",
          icon: "phone_in_talk",
          label: "Lancer un Appel Vocal Immédiat",
        };
      default:
        return {
          bg: "bg-[#25D366] text-surface-container-lowest shadow-[#25D366]/20",
          icon: "chat",
          label: "Ouvrir la conversation WhatsApp",
        };
    }
  };

  const cta = getCtaConfig();

  if (orderSuccessIntent) {
    const pointsEst = Math.max(1, Math.floor(totalPrice / 1000));
    return (
      <div className="flex flex-col w-full max-w-lg mx-auto pb-safe space-y-4 pt-4 pb-24 text-center animate-fadeIn">
        {/* Success Icon */}
        <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shadow-sm">
          <span className="material-symbols-outlined text-[36px]">check_circle</span>
        </div>

        {/* Title */}
        <div className="space-y-1 px-4">
          <span className="font-mono text-xs font-bold text-secondary bg-secondary/15 px-3 py-1 rounded-full">
            #{orderSuccessIntent.reference_code}
          </span>
          <h2 className="font-headline-sm text-xl font-bold text-on-surface pt-1">
            Commande Transmise sur {activeChannel} !
          </h2>
          <p className="text-xs text-on-surface-variant max-w-xs mx-auto">
            La conversation avec {store?.name || "Awa"} est ouverte. Votre commande est enregistrée.
          </p>
        </div>

        {/* VIP Advantage Nudge Card */}
        <div className="rounded-2xl bg-surface-container p-4 text-left border border-primary/20 shadow-md space-y-3 mx-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">stars</span>
              <span className="font-label-lg font-bold text-on-surface text-sm">Awa Club Privilège</span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-primary/15 text-primary text-xs font-bold">
              +{pointsEst} Points
            </span>
          </div>

          <p className="text-xs text-on-surface-variant leading-relaxed">
            Activez votre compte en 3 secondes (Nom + WhatsApp) pour sécuriser vos avantages :
          </p>

          <div className="space-y-2 text-xs text-on-surface">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-400 text-[18px] shrink-0">verified</span>
              <span><strong>Suivi en direct</strong> &amp; confirmation de livraison en 1 clic</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-[18px] shrink-0">pin_drop</span>
              <span><strong>GPS mémorisé</strong> pour vos prochaines livraisons</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px] shrink-0">card_membership</span>
              <span><strong>Réductions VIP</strong> cumulables dès aujourd'hui</span>
            </div>
          </div>

          {/* Registration CTA Button */}
          <button
            type="button"
            onClick={() => {
              if (onOpenCustomerAuth) onOpenCustomerAuth();
              onClose();
            }}
            className="w-full h-11 rounded-xl bg-primary text-on-primary font-label-lg font-bold flex items-center justify-center gap-2 shadow-md hover:brightness-105 tap-scale transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">bolt</span>
            <span>Activer mes points &amp; M'inscrire</span>
          </button>
        </div>

        {/* Secondary Actions */}
        <div className="flex flex-col gap-2 px-3 pt-1">
          <button
            type="button"
            onClick={() => {
              if (onNavigateToOrders) onNavigateToOrders();
              onClose();
            }}
            className="w-full h-11 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md font-semibold flex items-center justify-center gap-2 tap-scale transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">receipt_long</span>
            <span>Suivre ma commande en mode invité</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-xs text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
          >
            Retourner au catalogue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full max-w-lg mx-auto pb-safe space-y-3.5 pt-2 pb-24">
      {/* Top step indicators */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-xs">
            Commande Directe
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-secondary/15 text-secondary font-label-sm text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary mr-1.5 animate-pulse"></span>
            Vendeur disponible
          </span>
        </div>
        <span className="font-label-sm text-xs text-on-surface-variant font-mono">Étape 1/2</span>
      </div>

      {/* Order Intent Summary Card */}
      <div className="rounded-2xl bg-surface-container p-4 border border-white/5 shadow-sm">
        <div className="flex gap-3.5 items-start">
          <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-surface-container-highest shadow-sm">
            <img
              className="w-full h-full object-cover"
              src={getMediaUrl(product?.primary_image_url)}
              alt={product?.name}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "/media/products/samsung_galaxy_a15.jpg";
              }}
            />
            <span className="absolute bottom-1 right-1 bg-surface/80 text-on-surface text-[10px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm">
              Stock: {product?.stock || 4}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-[11px] text-primary font-bold uppercase tracking-wider">
                Article Sélectionné
              </span>
              <span className="font-label-sm text-[10px] text-secondary bg-secondary/15 px-2 py-0.5 rounded-full font-mono font-medium">
                DISPO
              </span>
            </div>
            <h2 className="font-headline-sm text-base font-bold text-on-surface truncate mt-0.5">
              {product?.name}
            </h2>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg font-bold text-primary tabular-nums">
                {totalPrice.toLocaleString("fr-FR")}
              </span>
              <span className="text-xs text-on-surface-variant uppercase font-bold">
                {product?.currency || "FCFA"}
              </span>
              {product?.old_price && (
                <span className="text-xs text-on-surface-variant line-through ml-1 opacity-60">
                  {(product.old_price * quantity).toLocaleString("fr-FR")}
                </span>
              )}
            </div>

            {/* Reference Box */}
            <div className="mt-2 flex items-center justify-between bg-surface-container-high/60 px-2.5 py-1.5 rounded-xl">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="material-symbols-outlined text-[15px] text-on-surface-variant">tag</span>
                <span className="font-label-sm text-xs text-on-surface-variant font-mono truncate">
                  RÉF: #{referenceCode}
                </span>
              </div>
              <button
                onClick={copyRefCode}
                className="flex items-center gap-1 text-primary hover:text-primary-fixed-dim tap-scale text-xs font-bold cursor-pointer"
              >
                <span className="material-symbols-outlined text-[13px]">content_copy</span>
                <span>{copied ? "COPIÉ !" : "COPIER"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Précisez votre commande */}
      <div className="bg-surface-container rounded-2xl p-4 border border-white/5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-headline-sm text-sm font-bold text-on-surface flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary text-[18px]">tune</span>
            Options de commande
          </h3>
          <span className="text-xs text-on-surface-variant">Personnalisable</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Color Pills */}
          <div className="space-y-1">
            <label className="font-label-sm text-[11px] text-on-surface-variant uppercase font-bold">Variante</label>
            <div className="flex gap-1.5 p-1 bg-surface-container-high/60 rounded-xl">
              {colorOptions.map((cName) => (
                <button
                  key={cName}
                  onClick={() => setSelectedColor(cName)}
                  className={`flex-1 py-1.5 rounded-lg text-center font-label-sm text-xs tap-scale transition-all cursor-pointer ${
                    selectedColor === cName
                      ? "bg-surface-container-highest text-on-surface font-bold shadow-sm"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {cName.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity Stepper */}
          <div className="space-y-1">
            <label className="font-label-sm text-[11px] text-on-surface-variant uppercase font-bold">Quantité</label>
            <div className="flex items-center justify-between p-1 bg-surface-container-high/60 rounded-xl h-9">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-7 h-7 rounded-lg flex items-center justify-center bg-surface-container-highest text-on-surface tap-scale cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">remove</span>
              </button>
              <span className="font-headline-sm text-sm font-bold text-on-surface">{quantity}</span>
              <button
                onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                className="w-7 h-7 rounded-lg flex items-center justify-center bg-surface-container-highest text-on-surface tap-scale cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
              </button>
            </div>
          </div>
        </div>

        {/* City selection */}
        <div className="space-y-1">
          <label className="font-label-sm text-[11px] text-on-surface-variant uppercase font-bold">Ville de livraison</label>
          <div className="grid grid-cols-4 gap-1.5">
            {cities.map((city) => (
              <button
                key={city.id}
                onClick={() => setSelectedCity(city.name)}
                className={`py-2 px-1 rounded-xl text-center font-label-sm text-xs tap-scale transition-all cursor-pointer ${
                  selectedCity === city.name
                    ? "bg-secondary/15 text-secondary font-bold ring-1 ring-secondary/40"
                    : "bg-surface-container-high/60 text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {city.display_label}
              </button>
            ))}
          </div>
        </div>

        {/* Free-text Locality / Quartier / Repère */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="font-label-sm text-[11px] text-on-surface-variant uppercase font-bold">
              Quartier &amp; Repère précis (Champ libre)
            </label>
            <span className="text-[10px] text-primary">Facilite la livraison</span>
          </div>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-primary">
              pin_drop
            </span>
            <input
              type="text"
              placeholder="Ex: Ouaga 2000, Dassasgho face pharmacie, Zone 4..."
              value={customLocality}
              onChange={(e) => setCustomLocality(e.target.value)}
              className="w-full h-10 pl-9 pr-3 rounded-xl bg-surface-container-high/60 border border-white/10 text-on-surface placeholder:text-on-surface-variant/40 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Localisation GPS exacte pour livraison directe (Opt-in exclusif) */}
        <div className="space-y-2 pt-2 border-t border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-[18px]">pin_drop</span>
              <div>
                <span className="font-label-sm text-xs font-bold text-on-surface block">
                  Partager ma localisation GPS exacte
                </span>
                <span className="text-[10px] text-on-surface-variant">
                  {wantSendGps ? "Préremplie dans le message WhatsApp" : "Optionnel • Non partagée par défaut"}
                </span>
              </div>
            </div>

            {/* Consent Toggle Switch */}
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={wantSendGps}
                onChange={(e) => {
                  const val = e.target.checked;
                  setWantSendGps(val);
                  if (val && !customerCoordinates) {
                    handleCaptureLocation();
                  } else if (val) {
                    showToast("📍 Position GPS activée pour le message");
                  } else {
                    showToast("Position GPS désactivée (non transmise)");
                  }
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-secondary"></div>
            </label>
          </div>

          {wantSendGps && (
            <div className="mt-1 transition-all">
              {!customerCoordinates ? (
                <button
                  type="button"
                  onClick={handleCaptureLocation}
                  disabled={isLocating}
                  className="w-full py-2.5 px-3 rounded-lg bg-surface-container-lowest border border-dashed border-secondary/50 hover:border-secondary text-secondary flex items-center justify-center gap-2 font-label-sm text-xs font-semibold transition-all active:scale-[0.98]"
                >
                  <span className={`material-symbols-outlined text-[18px] ${isLocating ? "animate-spin" : ""}`}>
                    {isLocating ? "progress_activity" : "my_location"}
                  </span>
                  <span>
                    {isLocating ? "Détection satellite GPS en cours..." : "Capturer ma position GPS exacte (1 clic)"}
                  </span>
                </button>
              ) : (
                <div className="p-2.5 rounded-lg bg-secondary/10 border border-secondary/30 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-secondary text-[20px] shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
                      check_circle
                    </span>
                    <div className="min-w-0">
                      <p className="font-label-sm text-xs text-secondary font-bold truncate">
                        📍 Position prête : {customerCoordinates}
                      </p>
                      <a
                        href={customerLocationUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-on-surface-variant underline hover:text-primary flex items-center gap-1 mt-0.5"
                      >
                        <span>Vérifier sur Google Maps</span>
                        <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                      </a>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleClearLocation}
                    className="w-7 h-7 rounded-full bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant flex items-center justify-center shrink-0"
                    title="Supprimer la position"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              )}
            </div>
          )}

          <p className="font-body-sm text-[10px] text-on-surface-variant/80">
            {wantSendGps
              ? "Le lien GPS exact sera directement prérempli dans votre message pour guider le livreur moto à votre porte."
              : "La position GPS ne sera PAS transmise. Activez l'interrupteur ci-dessus uniquement si vous souhaitez guider le livreur."}
          </p>
        </div>
      </div>

      {/* Choisir le canal de discussion */}
      <div className="space-y-space-xs">
        <div className="flex items-center justify-between px-space-xs">
          <h3 className="font-headline-sm text-headline-sm text-on-surface">Choisir le canal de discussion</h3>
          <span className="font-label-sm text-label-sm text-secondary flex items-center gap-1 font-semibold">
            <span className="material-symbols-outlined text-[14px]">bolt</span>
            Instantané
          </span>
        </div>

        <div className="space-y-2">
          {/* WhatsApp Card */}
          <div
            onClick={() => setActiveChannel("WHATSAPP")}
            className={`cursor-pointer p-3 rounded-2xl transition-all tap-scale flex flex-col gap-2 ${
              activeChannel === "WHATSAPP"
                ? "bg-surface-container-high shadow-md ring-1 ring-[#25D366]/40"
                : "bg-surface-container hover:bg-surface-container-high/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#25D366]/15 text-[#25D366] shrink-0">
                  <span className="material-symbols-outlined text-[22px]">chat</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-headline-sm text-sm font-bold text-on-surface">WhatsApp Direct</span>
                    <span className="font-label-sm text-[10px] px-2 py-0.5 rounded-full bg-[#25D366]/20 text-[#25D366] font-bold">
                      RECOMMANDÉ
                    </span>
                  </div>
                  <p className="font-body-sm text-xs text-on-surface-variant">Réponse en moins de 3 min</p>
                </div>
              </div>
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center ${
                  activeChannel === "WHATSAPP"
                    ? "bg-[#25D366] text-surface-container-lowest"
                    : "bg-surface-container-highest text-transparent"
                }`}
              >
                <span className="material-symbols-outlined text-[13px] font-bold">check</span>
              </span>
            </div>
            {activeChannel === "WHATSAPP" && (
              <div className="p-2.5 rounded-xl bg-surface-container-lowest/80 text-on-surface-variant font-body-sm text-xs flex items-start gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-[#25D366] shrink-0 mt-0.5">sms</span>
                <span className="italic text-on-surface-variant/90 line-clamp-2">
                  "{customMessage}"
                </span>
              </div>
            )}
          </div>

          {/* Messenger Card */}
          <div
            onClick={() => setActiveChannel("MESSENGER")}
            className={`cursor-pointer p-3 rounded-2xl transition-all tap-scale flex items-center justify-between ${
              activeChannel === "MESSENGER"
                ? "bg-surface-container-high shadow-md ring-1 ring-[#0084FF]/40"
                : "bg-surface-container hover:bg-surface-container-high/50"
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#0084FF]/15 text-[#0084FF] shrink-0">
                <span className="material-symbols-outlined text-[22px]">forum</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-headline-sm text-sm font-bold text-on-surface">Messenger</span>
                  <span className="font-label-sm text-[10px] px-2 py-0.5 rounded-full bg-[#0084FF]/20 text-[#0084FF] font-semibold">
                    Facebook
                  </span>
                </div>
                <p className="font-body-sm text-xs text-on-surface-variant">Messagerie officielle</p>
              </div>
            </div>
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center ${
                activeChannel === "MESSENGER"
                  ? "bg-[#0084FF] text-surface-container-lowest"
                  : "bg-surface-container-highest text-transparent"
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">check</span>
            </span>
          </div>

          {/* TikTok Card */}
          <div
            onClick={() => setActiveChannel("TIKTOK")}
            className={`cursor-pointer p-3 rounded-2xl transition-all tap-scale flex items-center justify-between ${
              activeChannel === "TIKTOK"
                ? "bg-surface-container-high shadow-md ring-1 ring-[#FE2C55]/40"
                : "bg-surface-container hover:bg-surface-container-high/50"
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#FE2C55]/15 text-[#FE2C55] shrink-0">
                <span className="material-symbols-outlined text-[22px]">smart_display</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-headline-sm text-sm font-bold text-on-surface">TikTok</span>
                  <span className="font-label-sm text-[10px] px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface font-semibold">
                    @awachic
                  </span>
                </div>
                <p className="font-body-sm text-xs text-on-surface-variant">Message direct</p>
              </div>
            </div>
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center ${
                activeChannel === "TIKTOK"
                  ? "bg-[#FE2C55] text-surface-container-lowest"
                  : "bg-surface-container-highest text-transparent"
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">check</span>
            </span>
          </div>

          {/* Call Vocal Card */}
          <div
            onClick={() => setActiveChannel("CALL")}
            className={`cursor-pointer p-3 rounded-2xl transition-all tap-scale flex items-center justify-between ${
              activeChannel === "CALL"
                ? "bg-surface-container-high shadow-md ring-1 ring-primary/40"
                : "bg-surface-container hover:bg-surface-container-high/50"
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/15 text-primary shrink-0">
                <span className="material-symbols-outlined text-[22px]">phone_in_talk</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-headline-sm text-sm font-bold text-on-surface">Appel Vocal</span>
                  <span className="font-label-sm text-[10px] px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface font-semibold">
                    Direct
                  </span>
                </div>
                <p className="font-body-sm text-xs text-on-surface-variant">Ligne téléphonique</p>
              </div>
            </div>
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center ${
                activeChannel === "CALL"
                  ? "bg-primary text-surface-container-lowest"
                  : "bg-surface-container-highest text-transparent"
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">check</span>
            </span>
          </div>

          {/* SMS Direct Card */}
          <div
            onClick={() => setActiveChannel("SMS")}
            className={`cursor-pointer p-3 rounded-2xl transition-all tap-scale flex items-center justify-between ${
              activeChannel === "SMS"
                ? "bg-surface-container-high shadow-md ring-1 ring-secondary/40"
                : "bg-surface-container hover:bg-surface-container-high/50"
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-secondary/15 text-secondary shrink-0">
                <span className="material-symbols-outlined text-[22px]">sms</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-headline-sm text-sm font-bold text-on-surface">SMS Instantané</span>
                  <span className="font-label-sm text-[10px] px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface font-semibold">
                    Sans Internet
                  </span>
                </div>
                <p className="font-body-sm text-xs text-on-surface-variant">Message texte classique</p>
              </div>
            </div>
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center ${
                activeChannel === "SMS"
                  ? "bg-secondary text-surface-container-lowest"
                  : "bg-surface-container-highest text-transparent"
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">check</span>
            </span>
          </div>
        </div>
      </div>

      {/* Message Prérempli & Personnalisable */}
      <div className="bg-surface-container rounded-2xl p-4 border border-white/5 shadow-sm space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary text-[18px]">edit_note</span>
            <label className="font-headline-sm text-xs font-bold text-on-surface">
              Message prérempli pour le vendeur
            </label>
          </div>
          {isMessageEdited && (
            <button
              type="button"
              onClick={() => {
                setIsMessageEdited(false);
                setCustomMessage(getDefaultMessage());
                showToast("Message réinitialisé");
              }}
              className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[13px]">refresh</span>
              <span>Réinitialiser</span>
            </button>
          )}
        </div>

        <textarea
          rows={3}
          value={customMessage}
          onChange={(e) => {
            setIsMessageEdited(true);
            setCustomMessage(e.target.value);
          }}
          placeholder="Personnalisez votre message ou vos consignes de livraison ici..."
          className="w-full p-3 rounded-xl bg-surface-container-high/70 border border-white/10 text-on-surface placeholder:text-on-surface-variant/40 text-xs focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed resize-none transition-all"
        />

        <div className="flex items-center justify-between text-[10px] text-on-surface-variant px-1">
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[12px] text-secondary">check_circle</span>
            <span>Vous pourrez aussi éditer ce texte directement dans {activeChannel === "WHATSAPP" ? "WhatsApp" : activeChannel}</span>
          </span>
          <span className="font-mono text-[10px]">{customMessage.length} car.</span>
        </div>
      </div>

      {/* Trust guarantees strip */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <div className="flex items-center space-x-2 bg-surface-container p-3 rounded-xl border border-white/5">
          <span className="material-symbols-outlined text-secondary text-[20px] shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
            verified_user
          </span>
          <span className="font-label-sm text-xs text-on-surface-variant leading-tight">
            Paiement à la livraison
          </span>
        </div>
        <div className="flex items-center space-x-2 bg-surface-container p-3 rounded-xl border border-white/5">
          <span className="material-symbols-outlined text-primary text-[20px] shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
            handshake
          </span>
          <span className="font-label-sm text-xs text-on-surface-variant leading-tight">
            Discussion sans intermédiaire
          </span>
        </div>
      </div>

      {/* Sticky Bottom CTA */}
      <div className="sticky bottom-2 z-20 pt-2">
        <div className="p-2 rounded-2xl bg-surface/90 backdrop-blur-xl shadow-2xl border border-white/5">
          <button
            onClick={handleLaunchHandshake}
            disabled={isSubmitting}
            className={`w-full h-13 rounded-xl font-label-lg text-sm flex items-center justify-center gap-2 font-bold tracking-wide transition-all duration-150 tap-scale cursor-pointer shadow-lg ${cta.bg}`}
          >
            <span className="material-symbols-outlined text-[20px]">{cta.icon}</span>
            <span>{isSubmitting ? "Génération..." : cta.label}</span>
          </button>
          <p className="text-center font-label-sm text-[11px] text-on-surface-variant mt-1.5 opacity-80">
            Réf #{referenceCode} préremplie automatiquement
          </p>
        </div>
      </div>
    </div>
  );
}
