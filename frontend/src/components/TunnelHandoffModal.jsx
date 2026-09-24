import Icon from "./Icon";
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
        showToast("Position GPS capturée avec succès");
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
        { id: "1", name: "Ouagadougou", display_label: "Ouagadougou" },
        { id: "2", name: "Bobo-Dioulasso", display_label: "Bobo-Dioulasso" },
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
    showToast(`Référence #${referenceCode} copiée`);
    setTimeout(() => setCopied(false), 2000);
  };

  const destinationStr = customLocality.trim() ? `${selectedCity} (${customLocality.trim()})` : selectedCity;

  const getDefaultMessage = () => {
    const colorStr = selectedColor ? ` (${selectedColor})` : "";
    const clientGreeting = customer ? `Je suis ${customer.name}. ` : "";
    let msg = `Bonjour ${store?.name || "Boutique"}, ${clientGreeting}je souhaite commander ${quantity}x ${product?.name}${colorStr} pour livraison à ${destinationStr}. Réf: ${referenceCode}`;
    if (wantSendGps && customerLocationUrl) {
      msg += ` 📍 Position GPS livraison : ${customerLocationUrl}`;
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
    showToast(`Préparation de la commande #${referenceCode}...`);

    const finalMessage = (customMessage.trim() || getDefaultMessage()).trim();

    try {
      const resolvedStoreId = store?.id || store?.slug || "faso-danfani";
      const resolvedProductId = product?.id || "hero-product";

      const payload = {
        store_id: resolvedStoreId,
        product_id: resolvedProductId,
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

      // Persist in local storage for guest tracking
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

  // Channel configuration
  const getCtaConfig = () => {
    switch (activeChannel) {
      case "MESSENGER":
        return {
          bg: "bg-[#0084FF] text-white hover:bg-[#0073e6]",
          icon: "forum",
          label: "Discuter sur Messenger Facebook",
        };
      case "SMS":
        return {
          bg: "bg-white/[0.1] hover:bg-white/[0.15] text-white border border-white/20",
          icon: "sms",
          label: "Envoyer par SMS Direct",
        };
      case "CALL":
        return {
          bg: "bg-primary hover:brightness-105 text-white",
          icon: "phone_in_talk",
          label: "Appeler le commerçant",
        };
      default:
        return {
          bg: "bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 font-bold",
          icon: "chat",
          label: "Ouvrir WhatsApp et commander",
        };
    }
  };

  const cta = getCtaConfig();

  if (orderSuccessIntent) {
    return (
      <div className="flex flex-col w-full max-w-lg mx-auto pb-safe space-y-4 pt-6 pb-24 text-center animate-fade-in">
        {/* Success Icon */}
        <div className="mx-auto w-14 h-14 rounded-2xl bg-secondary/15 text-secondary flex items-center justify-center border border-secondary/30 shadow-sm">
          <Icon name="check_circle" className="text-[30px]" style={{ fontVariationSettings: "'FILL' 1" }} />
        </div>

        {/* Title */}
        <div className="space-y-1 px-4">
          <span className="font-mono text-xs font-semibold text-secondary bg-secondary/10 px-3 py-1 rounded-full border border-secondary/20">
            #{orderSuccessIntent.reference_code}
          </span>
          <h2 className="text-xl font-bold text-on-surface pt-2 tracking-tight">
            Commande Transmise avec Succès
          </h2>
          <p className="text-xs text-on-surface-variant max-w-xs mx-auto leading-relaxed">
            La discussion directe avec {store?.name || "le commerçant"} est initiée. Votre demande a bien été enregistrée.
          </p>
        </div>

        {/* Account Activation Banner */}
        <div className="rounded-2xl bg-surface-card p-5 text-left border border-subtle shadow-card space-y-3 mx-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="stars" className="text-primary text-[20px]" />
              <span className="text-sm font-semibold text-on-surface">Espace Client Partagé</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
              Reconnu Partout
            </span>
          </div>

          <p className="text-xs text-on-surface-variant leading-relaxed">
            Activez votre compte en 10 secondes (Nom &amp; WhatsApp) pour synchroniser vos adresses de livraison et suivre vos commandes en direct.
          </p>

          <button
            type="button"
            onClick={() => {
              if (onOpenCustomerAuth) onOpenCustomerAuth();
              onClose();
            }}
            className="w-full h-11 rounded-xl bg-primary hover:brightness-105 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <Icon name="bolt" className="text-[16px]" />
            <span>Activer mon profil client</span>
          </button>
        </div>

        {/* Secondary Actions */}
        <div className="flex flex-col gap-2 px-3 pt-2">
          <button
            type="button"
            onClick={() => {
              if (onNavigateToOrders) onNavigateToOrders();
              onClose();
            }}
            className="w-full h-11 rounded-xl bg-surface-secondary hover:bg-surface-elevated text-on-surface text-xs font-medium flex items-center justify-center gap-2 border border-subtle transition-colors cursor-pointer"
          >
            <Icon name="receipt_long" className="text-[17px]" />
            <span>Suivre ma commande</span>
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
    <div className="flex flex-col w-full max-w-lg mx-auto pb-safe space-y-4 pt-2 pb-24 animate-fade-in">
      {/* Top Header */}
      <div className="flex items-center justify-between px-1">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
        >
          <Icon name="arrow_back" className="text-[16px]" />
          <span>Retour</span>
        </button>
        <span className="text-xs text-on-surface-variant font-mono">Commande Directe</span>
      </div>

      {/* Selected Product Summary Card */}
      <div className="rounded-2xl bg-surface-card p-4 border border-subtle shadow-card">
        <div className="flex gap-3.5 items-center">
          <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-surface-secondary border border-subtle">
            <img
              className="w-full h-full object-cover"
              src={getMediaUrl(product?.primary_image_url)}
              alt={product?.name}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "/media/products/samsung_galaxy_a15.jpg";
              }}
            />
          </div>

          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-semibold text-primary uppercase tracking-wide block">
              Article sélectionné
            </span>
            <h2 className="text-sm sm:text-base font-semibold text-on-surface truncate mt-0.5">
              {product?.name}
            </h2>

            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-lg font-bold text-on-surface tabular-nums">
                {totalPrice.toLocaleString("fr-FR")}
              </span>
              <span className="text-xs text-on-surface-variant font-medium">
                {product?.currency || "FCFA"}
              </span>
            </div>

            <div className="mt-2 flex items-center justify-between bg-surface-secondary border border-subtle px-2.5 py-1 rounded-lg">
              <span className="text-[11px] text-on-surface-variant font-mono">
                RÉF #{referenceCode}
              </span>
              <button
                onClick={copyRefCode}
                className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span>{copied ? "Copié !" : "Copier"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Customization Options */}
      <div className="bg-surface-card rounded-2xl p-4 border border-subtle shadow-card space-y-3.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
            <Icon name="tune" className="text-primary text-[17px]" />
            <span>Options de livraison</span>
          </h3>
          <span className="text-[11px] text-on-surface-variant">Paiement à la remise</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Color Variant */}
          <div className="space-y-1">
            <label className="text-xs text-on-surface-variant font-medium">Variante / Couleur</label>
            <div className="flex gap-1 p-1 bg-surface-secondary rounded-xl border border-subtle">
              {colorOptions.map((cName) => (
                <button
                  key={cName}
                  onClick={() => setSelectedColor(cName)}
                  className={`flex-1 py-1.5 rounded-lg text-center text-xs font-medium transition-all cursor-pointer ${
                    selectedColor === cName
                      ? "bg-primary/15 text-primary border border-primary/30 font-semibold"
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
            <label className="text-xs text-on-surface-variant font-medium">Quantité</label>
            <div className="flex items-center justify-between p-1 bg-surface-secondary rounded-xl border border-subtle h-9">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-7 h-7 rounded-lg flex items-center justify-center bg-surface-card text-on-surface hover:bg-surface-elevated active:scale-95 transition-all cursor-pointer"
              >
                <Icon name="remove" className="text-[15px]" />
              </button>
              <span className="text-sm font-semibold text-on-surface">{quantity}</span>
              <button
                onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                className="w-7 h-7 rounded-lg flex items-center justify-center bg-surface-card text-on-surface hover:bg-surface-elevated active:scale-95 transition-all cursor-pointer"
              >
                <Icon name="add" className="text-[15px]" />
              </button>
            </div>
          </div>
        </div>

        {/* City Selection */}
        <div className="space-y-1">
          <label className="text-xs text-on-surface-variant font-medium">Ville de destination</label>
          <div className="grid grid-cols-4 gap-1.5">
            {cities.map((city) => (
              <button
                key={city.id}
                onClick={() => setSelectedCity(city.name)}
                className={`py-2 px-1 rounded-xl text-center text-xs font-medium transition-all cursor-pointer ${
                  selectedCity === city.name
                    ? "bg-primary/15 text-primary font-semibold border border-primary/30"
                    : "bg-surface-secondary text-on-surface-variant hover:text-on-surface border border-subtle"
                }`}
              >
                {city.display_label}
              </button>
            ))}
          </div>
        </div>

        {/* Quartier / Repère text field */}
        <div className="space-y-1">
          <label className="text-xs text-on-surface-variant font-medium">
            Quartier ou repère de livraison (champ libre)
          </label>
          <input
            type="text"
            placeholder="Ex: Ouaga 2000, face pharmacie, Zone 4..."
            value={customLocality}
            onChange={(e) => setCustomLocality(e.target.value)}
            className="w-full h-10 px-3 rounded-xl bg-surface-secondary border border-subtle text-on-surface placeholder:text-on-surface-variant/50 text-xs focus:outline-none focus:border-strong transition-all"
          />
        </div>

        {/* Optional GPS Location Toggle */}
        <div className="pt-2 border-t border-subtle space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="pin_drop" className="text-primary text-[18px]" />
              <div>
                <span className="text-xs font-medium text-on-surface block">
                  Partager ma position GPS exacte
                </span>
                <span className="text-[11px] text-on-surface-variant">
                  {wantSendGps ? "Transmise au livreur dans le message" : "Optionnel • Non partagée par défaut"}
                </span>
              </div>
            </div>

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
                    showToast("Position GPS activée");
                  } else {
                    showToast("Position GPS désactivée");
                  }
                }}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-surface-elevated peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-secondary"></div>
            </label>
          </div>

          {wantSendGps && (
            <div className="pt-1">
              {!customerCoordinates ? (
                <button
                  type="button"
                  onClick={handleCaptureLocation}
                  disabled={isLocating}
                  className="w-full py-2 px-3 rounded-xl bg-surface-secondary border border-subtle text-secondary text-xs font-medium flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer"
                >
                  <Icon name={isLocating ? "progress_activity" : "my_location"} className={`text-[16px] ${isLocating ? "animate-spin" : ""}`} />
                  <span>{isLocating ? "Recherche satellite GPS..." : "Capturer ma position GPS"}</span>
                </button>
              ) : (
                <div className="p-2.5 rounded-xl bg-secondary/10 border border-secondary/20 flex items-center justify-between text-xs text-secondary">
                  <div className="flex items-center gap-2">
                    <Icon name="check_circle" className="text-[18px]" />
                    <span>Position capturée : {customerCoordinates}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearLocation}
                    className="text-on-surface-variant hover:text-on-surface cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Channel Selector */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-on-surface uppercase tracking-wider px-1">
          Canal de discussion
        </label>

        <div className="space-y-2">
          {/* WhatsApp highlighted */}
          <div
            onClick={() => setActiveChannel("WHATSAPP")}
            className={`cursor-pointer p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
              activeChannel === "WHATSAPP"
                ? "bg-surface-card border-[#25D366]/40 shadow-sm"
                : "bg-surface-card hover:bg-surface-secondary border-subtle"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#25D366]/15 text-[#25D366] flex items-center justify-center shrink-0">
                <Icon name="chat" className="text-[20px]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-on-surface">WhatsApp Direct</span>
                  <span className="px-2 py-0.2 rounded-full bg-[#25D366]/15 text-[#25D366] text-[10px] font-semibold">
                    Recommandé
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant">Réponse moyenne en moins de 3 minutes</p>
              </div>
            </div>
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                activeChannel === "WHATSAPP"
                  ? "bg-[#25D366] text-slate-900"
                  : "border border-subtle text-transparent"
              }`}
            >
              ✓
            </span>
          </div>

          {/* Messenger */}
          <div
            onClick={() => setActiveChannel("MESSENGER")}
            className={`cursor-pointer p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
              activeChannel === "MESSENGER"
                ? "bg-surface-card border-[#0084FF]/40 shadow-sm"
                : "bg-surface-card hover:bg-surface-secondary border-subtle"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0084FF]/15 text-[#0084FF] flex items-center justify-center shrink-0">
                <Icon name="forum" className="text-[20px]" />
              </div>
              <div>
                <span className="text-sm font-semibold text-on-surface">Messenger Facebook</span>
                <p className="text-xs text-on-surface-variant">Messagerie officielle de la page</p>
              </div>
            </div>
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                activeChannel === "MESSENGER"
                  ? "bg-[#0084FF] text-white"
                  : "border border-subtle text-transparent"
              }`}
            >
              ✓
            </span>
          </div>
        </div>
      </div>

      {/* Dedicated Editable Message Card */}
      <div className="bg-surface-card rounded-2xl p-4 border border-subtle shadow-card space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Icon name="edit_note" className="text-primary text-[17px]" />
            <label className="text-xs font-semibold text-on-surface uppercase tracking-wider">
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
              className="text-xs text-primary hover:underline font-medium flex items-center gap-0.5 cursor-pointer"
            >
              <Icon name="refresh" className="text-[13px]" />
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
          placeholder="Personnalisez vos consignes ou votre message..."
          className="w-full p-3 rounded-xl bg-surface-secondary border border-subtle text-on-surface placeholder:text-on-surface-variant/50 text-xs focus:outline-none focus:border-strong leading-relaxed resize-none transition-all"
        />

        <div className="flex items-center justify-between text-[11px] text-on-surface-variant px-1">
          <span>Vous pourrez modifier ce texte directement dans {activeChannel === "WHATSAPP" ? "WhatsApp" : activeChannel}</span>
          <span className="font-mono">{customMessage.length} car.</span>
        </div>
      </div>

      {/* Trust Guarantees */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <div className="flex items-center gap-2 p-3 rounded-xl bg-surface-card border border-subtle">
          <Icon name="verified_user" className="text-secondary text-[18px]" />
          <span className="text-xs text-on-surface-variant">Paiement après vérification</span>
        </div>
        <div className="flex items-center gap-2 p-3 rounded-xl bg-surface-card border border-subtle">
          <Icon name="handshake" className="text-primary text-[18px]" />
          <span className="text-xs text-on-surface-variant">Zéro intermédiaire</span>
        </div>
      </div>

      {/* Sticky Bottom Final CTA Button */}
      <div className="sticky bottom-2 z-20 pt-2">
        <div className="p-2 rounded-2xl bg-surface/90 backdrop-blur-xl border border-subtle shadow-card-hover">
          <button
            onClick={handleLaunchHandshake}
            disabled={isSubmitting}
            className={`w-full h-12 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-[0.99] ${cta.bg}`}
          >
            <Icon name={cta.icon} className="text-[19px]" />
            <span>{isSubmitting ? "Connexion..." : cta.label}</span>
          </button>
          <p className="text-center text-[11px] text-on-surface-variant mt-1.5">
            Référence #{referenceCode} préremplie
          </p>
        </div>
      </div>
    </div>
  );
}
