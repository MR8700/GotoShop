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
  const [selectedCity, setSelectedCity] = useState(customer?.city || "Cocody (Abidjan)");
  const [activeChannel, setActiveChannel] = useState((customer?.preferred_channel || initialChannel).toUpperCase());
  const [referenceCode, setReferenceCode] = useState("CMD-" + Math.random().toString(36).substring(2, 8).toUpperCase());
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccessIntent, setOrderSuccessIntent] = useState(null);

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

  // Available cities from store or defaults
  const cities = store?.delivery_cities?.length
    ? store.delivery_cities
    : [
        { id: "1", name: "Cocody (Abidjan)", display_label: "📍 Cocody" },
        { id: "2", name: "Ouagadougou", display_label: "Ouaga" },
        { id: "3", name: "Dakar", display_label: "Dakar" },
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

  const getDynamicMessagePreview = () => {
    const colorStr = selectedColor ? ` (${selectedColor})` : "";
    const clientGreeting = customer ? `Je suis ${customer.name}. ` : "";
    let msg = `"Bonjour ${store?.name || "Awa"}, ${clientGreeting}je confirme l'achat de ${quantity}x ${product?.name}${colorStr} pour ${selectedCity}. Réf: ${referenceCode}`;
    if (wantSendGps && customerLocationUrl) {
      msg += ` 📍 Ma localisation exacte : ${customerLocationUrl}`;
    }
    msg += `"`;
    return msg;
  };

  const handleLaunchHandshake = async () => {
    setIsSubmitting(true);
    showToast(`Création de l'intention ${referenceCode}...`);

    try {
      const payload = {
        store_id: store.id,
        product_id: product.id,
        channel_type: activeChannel,
        quantity: quantity,
        selected_color: selectedColor,
        delivery_city: selectedCity,
        customer_source: "MOBILE_WEB",
        customer_name: customer?.name || "Client Mobile",
        customer_phone: customer?.phone || null,
        customer_id: customer?.id || null,
        customer_location_url: wantSendGps ? customerLocationUrl : null,
        customer_coordinates: wantSendGps ? customerCoordinates : null,
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
        delivery_city: selectedCity,
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

      showToast(`Redirection vers ${activeChannel}...`);
      setTimeout(() => {
        window.open(res.redirect_url, "_blank");
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
      <div className="flex flex-col w-full max-w-lg mx-auto pb-safe space-y-5 pt-4 pb-24 text-center animate-fadeIn">
        {/* Success Icon */}
        <div className="relative mx-auto w-20 h-20 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shadow-lg shadow-emerald-500/10">
          <span className="material-symbols-outlined text-[40px] animate-bounce">check_circle</span>
          <div className="absolute inset-0 rounded-full border-2 border-emerald-400/40 animate-ping"></div>
        </div>

        {/* Title */}
        <div className="space-y-1.5 px-4">
          <span className="font-mono text-xs font-bold text-secondary bg-secondary/15 px-3 py-1 rounded-full uppercase tracking-wider">
            Réf: #{orderSuccessIntent.reference_code}
          </span>
          <h2 className="font-headline-sm text-2xl font-bold text-on-surface">
            Commande Transmise sur {activeChannel} !
          </h2>
          <p className="text-xs text-on-surface-variant max-w-xs mx-auto">
            La discussion avec {store?.name || "Awa"} a été ouverte. Votre commande est enregistrée sur cet appareil.
          </p>
        </div>

        {/* VIP Advantage Nudge Card */}
        <div className="rounded-2xl bg-gradient-to-b from-primary-container/20 to-surface-container p-5 text-left border border-primary/30 shadow-xl space-y-4 relative overflow-hidden mx-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[24px]">stars</span>
              <span className="font-label-lg font-bold text-primary">Awa Club Privilège</span>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-primary text-surface font-label-sm text-xs font-bold shadow">
              +{pointsEst} Points à Gagner
            </span>
          </div>

          <p className="text-xs text-on-surface font-medium leading-relaxed">
            Vous commandez en <strong className="text-primary">mode invité</strong>. Activez votre compte gratuit en 3 secondes (Nom + WhatsApp) pour ne rien perdre :
          </p>

          <div className="space-y-2.5 text-xs text-on-surface-variant">
            <div className="flex items-start gap-2.5">
              <span className="material-symbols-outlined text-emerald-400 text-[18px] shrink-0 mt-0.5">verified</span>
              <div>
                <strong className="text-on-surface font-semibold">Suivi en direct &amp; Décision :</strong> Possibilité d'annuler ou de marquer satisfait(e) en 1 clic pour valider la livraison.
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="material-symbols-outlined text-secondary text-[18px] shrink-0 mt-0.5">pin_drop</span>
              <div>
                <strong className="text-on-surface font-semibold">GPS sauvegardé :</strong> Vos futures commandes expédiées à votre position exacte sans répétition.
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="material-symbols-outlined text-amber-400 text-[18px] shrink-0 mt-0.5">card_membership</span>
              <div>
                <strong className="text-on-surface font-semibold">Réductions VIP :</strong> Accédez aux paliers Bronze, Silver VIP (-5%) et Gold Élite (-10%).
              </div>
            </div>
          </div>

          {/* Registration CTA Button */}
          <button
            type="button"
            onClick={() => {
              if (onOpenCustomerAuth) onOpenCustomerAuth();
              onClose();
            }}
            className="w-full h-12 rounded-xl bg-primary text-surface font-label-lg font-bold flex items-center justify-center gap-2 shadow-lg hover:brightness-110 active:scale-98 transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">bolt</span>
            <span>Activer mes points &amp; M'inscrire (3s)</span>
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
            className="w-full h-11 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md font-semibold flex items-center justify-center gap-2 transition-colors active:scale-98"
          >
            <span className="material-symbols-outlined text-[18px]">receipt_long</span>
            <span>Suivre ma commande en mode invité</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 text-xs text-on-surface-variant hover:text-on-surface transition-colors"
          >
            Retourner au catalogue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full max-w-lg mx-auto pb-safe space-y-space-md pt-2 pb-24">
      {/* Top step indicators */}
      <div className="flex items-center justify-between px-space-xs">
        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
            Processus Express
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-secondary-container/20 text-secondary font-label-sm text-label-sm font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary mr-1.5 animate-pulse"></span>
            Vendeur en ligne
          </span>
        </div>
        <span className="font-label-sm text-label-sm text-on-surface-variant font-mono">1/2 Étape</span>
      </div>

      {/* Order Intent Summary Card */}
      <div className="relative overflow-hidden rounded-xl bg-surface-container-high p-space-md shadow-xl">
        <div className="absolute -right-8 -top-8 w-28 h-28 bg-primary-container/10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="flex gap-space-md items-start">
          <div className="relative w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-surface-container-highest shadow-md">
            <img
              className="w-full h-full object-cover"
              src={getMediaUrl(product?.primary_image_url)}
              alt={product?.name}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "/media/products/samsung_galaxy_a15.jpg";
              }}
            />
            <span className="absolute bottom-1 right-1 bg-surface-container-lowest/80 text-on-surface font-label-sm text-label-sm px-1 py-0.5 rounded backdrop-blur-sm">
              Stock: {product?.stock || 4}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-primary font-bold uppercase tracking-wider">
                Panier Ouvert
              </span>
              <span className="font-label-sm text-label-sm text-secondary bg-secondary-container/20 px-2 py-0.5 rounded-full font-mono font-medium">
                DISPO
              </span>
            </div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface truncate mt-0.5">
              {product?.name}
            </h2>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="font-currency-display text-currency-display text-primary">
                {totalPrice.toLocaleString("fr-FR")}
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase font-bold tracking-tight">
                {product?.currency || "FCFA"}
              </span>
              {product?.old_price && (
                <span className="font-body-sm text-body-sm text-on-surface-variant line-through ml-1.5 opacity-60">
                  {(product.old_price * quantity).toLocaleString("fr-FR")}
                </span>
              )}
            </div>

            {/* Reference Box */}
            <div className="mt-2 flex items-center justify-between bg-surface-container-lowest/70 px-2.5 py-1.5 rounded-lg">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant">tag</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant font-mono truncate">
                  RÉF INTENTION: #{referenceCode}
                </span>
              </div>
              <button
                onClick={copyRefCode}
                className="flex items-center gap-1 text-primary hover:text-primary-fixed-dim active:scale-90 transition-transform text-label-sm font-label-sm font-bold"
              >
                <span className="material-symbols-outlined text-[14px]">content_copy</span>
                <span>{copied ? "COPIÉ !" : "COPIER"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Précisez votre commande */}
      <div className="bg-surface-container rounded-xl p-space-md shadow-md space-y-space-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary text-[20px]">tune</span>
            Précisez votre commande
          </h3>
          <span className="font-body-sm text-body-sm text-on-surface-variant">Optionnel</span>
        </div>

        <div className="grid grid-cols-2 gap-space-sm">
          {/* Color Pills */}
          <div className="space-y-1">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase font-bold">Couleur</label>
            <div className="flex gap-1.5 p-1 bg-surface-container-lowest rounded-lg">
              {colorOptions.map((cName) => (
                <button
                  key={cName}
                  onClick={() => setSelectedColor(cName)}
                  className={`flex-1 py-1.5 rounded text-center font-label-sm text-label-sm transition-all ${
                    selectedColor === cName
                      ? "bg-surface-container-high text-on-surface font-semibold shadow-sm"
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
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase font-bold">Quantité</label>
            <div className="flex items-center justify-between p-1 bg-surface-container-lowest rounded-lg h-9">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-7 h-7 rounded flex items-center justify-center bg-surface-container-high text-on-surface active:scale-90 transition-transform"
              >
                <span className="material-symbols-outlined text-[16px]">remove</span>
              </button>
              <span className="font-headline-sm text-headline-sm text-on-surface">{quantity}</span>
              <button
                onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                className="w-7 h-7 rounded flex items-center justify-center bg-surface-container-high text-on-surface active:scale-90 transition-transform"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
              </button>
            </div>
          </div>
        </div>

        {/* City selection */}
        <div className="space-y-1">
          <label className="font-label-sm text-label-sm text-on-surface-variant uppercase font-bold">Ville de livraison</label>
          <div className="grid grid-cols-3 gap-1.5">
            {cities.map((city) => (
              <button
                key={city.id}
                onClick={() => setSelectedCity(city.name)}
                className={`py-2 px-1 rounded-lg text-center font-label-sm text-label-sm transition-all shadow-sm ${
                  selectedCity === city.name
                    ? "bg-surface-container-lowest text-secondary font-bold ring-1 ring-secondary/50"
                    : "bg-surface-container-lowest text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {city.display_label}
              </button>
            ))}
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
            className={`cursor-pointer p-space-sm rounded-xl transition-all active:scale-[0.99] flex flex-col gap-2 ${
              activeChannel === "WHATSAPP"
                ? "bg-surface-container-high shadow-md ring-1 ring-[#25D366]/40"
                : "bg-surface-container"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#25D366]/20 text-[#25D366] shrink-0">
                  <span className="material-symbols-outlined text-[22px]">chat</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-headline-sm text-headline-sm text-on-surface">WhatsApp Direct</span>
                    <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-[#25D366]/20 text-[#25D366] font-bold">
                      RECOMMANDÉ
                    </span>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">Réponse moyenne en &lt; 3 minutes</p>
                </div>
              </div>
              <span
                className={`radio-indicator w-5 h-5 rounded-full flex items-center justify-center ${
                  activeChannel === "WHATSAPP"
                    ? "bg-[#25D366] text-surface-container-lowest"
                    : "bg-surface-container-highest text-transparent"
                }`}
              >
                <span className="material-symbols-outlined text-[14px] font-bold">check</span>
              </span>
            </div>
            {activeChannel === "WHATSAPP" && (
              <div className="p-2 rounded-lg bg-surface-container-lowest/80 text-on-surface-variant font-body-sm text-body-sm flex items-start gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-[#25D366] shrink-0 mt-0.5">sms</span>
                <span className="italic text-on-surface-variant/90 line-clamp-2">
                  {getDynamicMessagePreview()}
                </span>
              </div>
            )}
          </div>

          {/* Messenger Card */}
          <div
            onClick={() => setActiveChannel("MESSENGER")}
            className={`cursor-pointer p-space-sm rounded-xl transition-all active:scale-[0.99] flex items-center justify-between ${
              activeChannel === "MESSENGER"
                ? "bg-surface-container-high shadow-md ring-1 ring-[#0084FF]/40"
                : "bg-surface-container"
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#0084FF]/20 text-[#0084FF] shrink-0">
                <span className="material-symbols-outlined text-[22px]">forum</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-headline-sm text-headline-sm text-on-surface">Messenger</span>
                  <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-[#0084FF]/20 text-[#0084FF] font-semibold">
                    Page Officielle
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">Messagerie Facebook certifiée</p>
              </div>
            </div>
            <span
              className={`radio-indicator w-5 h-5 rounded-full flex items-center justify-center ${
                activeChannel === "MESSENGER"
                  ? "bg-[#0084FF] text-surface-container-lowest"
                  : "bg-surface-container-highest text-transparent"
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">check</span>
            </span>
          </div>

          {/* TikTok Card */}
          <div
            onClick={() => setActiveChannel("TIKTOK")}
            className={`cursor-pointer p-space-sm rounded-xl transition-all active:scale-[0.99] flex items-center justify-between ${
              activeChannel === "TIKTOK"
                ? "bg-surface-container-high shadow-md ring-1 ring-[#FE2C55]/40"
                : "bg-surface-container"
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#FE2C55]/20 text-[#FE2C55] shrink-0">
                <span className="material-symbols-outlined text-[22px]">smart_display</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-headline-sm text-headline-sm text-on-surface">TikTok Message</span>
                  <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface font-semibold">
                    @awachic
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">Discussion avec la créatrice</p>
              </div>
            </div>
            <span
              className={`radio-indicator w-5 h-5 rounded-full flex items-center justify-center ${
                activeChannel === "TIKTOK"
                  ? "bg-[#FE2C55] text-surface-container-lowest"
                  : "bg-surface-container-highest text-transparent"
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">check</span>
            </span>
          </div>

          {/* Call Vocal Card */}
          <div
            onClick={() => setActiveChannel("CALL")}
            className={`cursor-pointer p-space-sm rounded-xl transition-all active:scale-[0.99] flex items-center justify-between ${
              activeChannel === "CALL"
                ? "bg-surface-container-high shadow-md ring-1 ring-primary/40"
                : "bg-surface-container"
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-container-high text-primary shrink-0">
                <span className="material-symbols-outlined text-[22px]">phone_in_talk</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-headline-sm text-headline-sm text-on-surface">Appel Vocal Direct</span>
                  <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface font-semibold">
                    Standard
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">Ligne directe avec le service client</p>
              </div>
            </div>
            <span
              className={`radio-indicator w-5 h-5 rounded-full flex items-center justify-center ${
                activeChannel === "CALL"
                  ? "bg-primary text-surface-container-lowest"
                  : "bg-surface-container-highest text-transparent"
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">check</span>
            </span>
          </div>

          {/* SMS Direct Card */}
          <div
            onClick={() => setActiveChannel("SMS")}
            className={`cursor-pointer p-space-sm rounded-xl transition-all active:scale-[0.99] flex items-center justify-between ${
              activeChannel === "SMS"
                ? "bg-surface-container-high shadow-md ring-1 ring-primary/40"
                : "bg-surface-container"
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-container-high text-secondary shrink-0">
                <span className="material-symbols-outlined text-[22px]">sms</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-headline-sm text-headline-sm text-on-surface">SMS Instantané</span>
                  <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface font-semibold">
                    Sans Internet
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">Messagerie texte mobile immédiate</p>
              </div>
            </div>
            <span
              className={`radio-indicator w-5 h-5 rounded-full flex items-center justify-center ${
                activeChannel === "SMS"
                  ? "bg-primary text-surface-container-lowest"
                  : "bg-surface-container-highest text-transparent"
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">check</span>
            </span>
          </div>
        </div>
      </div>

      {/* Trust guarantees strip */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <div className="flex items-center space-x-2 bg-surface-container-low p-2.5 rounded-lg">
          <span className="material-symbols-outlined text-secondary text-[20px] shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
            verified_user
          </span>
          <span className="font-label-sm text-label-sm text-on-surface-variant leading-tight">
            Paiement à la livraison après inspection
          </span>
        </div>
        <div className="flex items-center space-x-2 bg-surface-container-low p-2.5 rounded-lg">
          <span className="material-symbols-outlined text-primary text-[20px] shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
            handshake
          </span>
          <span className="font-label-sm text-label-sm text-on-surface-variant leading-tight">
            Discussion directe sans intermédiaire
          </span>
        </div>
      </div>

      {/* Sticky Bottom CTA */}
      <div className="sticky bottom-2 z-20 pt-2">
        <div className="p-2 rounded-2xl bg-surface/90 backdrop-blur-xl shadow-2xl">
          <button
            onClick={handleLaunchHandshake}
            disabled={isSubmitting}
            className={`w-full h-14 rounded-xl font-label-lg text-label-lg flex items-center justify-center gap-2 font-bold tracking-wide transition-all duration-200 active:scale-[0.98] shadow-lg ${cta.bg}`}
          >
            <span className="material-symbols-outlined text-[22px]">{cta.icon}</span>
            <span>{isSubmitting ? "Génération de la commande..." : cta.label}</span>
          </button>
          <p className="text-center font-label-sm text-label-sm text-on-surface-variant mt-2 opacity-80">
            Réf #{referenceCode} injectée automatiquement dans le message
          </p>
        </div>
      </div>
    </div>
  );
}
