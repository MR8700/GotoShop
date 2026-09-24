import Icon from "./Icon";
import React, { useState } from "react";
import { createConversationalOrder, getActiveStoreSlug } from "../api/client";

export default function ConversationalOrderModal({
  store,
  product,
  customer,
  onClose,
  showToast,
  onOrderCreated,
  onOpenChat,
}) {
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState(
    product?.variants && product.variants.length > 0 ? product.variants[0] : null
  );

  // Customization state
  const isCustomizable = Boolean(product?.is_customizable);
  const [customizationText, setCustomizationText] = useState("");
  const [spiceLevel, setSpiceLevel] = useState("Peu de piment");
  const [onionsChoice, setOnionsChoice] = useState("Beaucoup d'oignons");
  const [cookingChoice, setCookingChoice] = useState("Poisson bien grillé et croustillant");
  const [portionsChoice, setPortionsChoice] = useState("1 portion standard");

  // Delivery Location Mode: "GPS_AND_DESCRIPTION" | "EXACT_GPS" | "ADDRESS_DESCRIPTION"
  const [deliveryMode, setDeliveryMode] = useState("GPS_AND_DESCRIPTION");
  const [deliveryCity, setDeliveryCity] = useState(customer?.city || "Cité Universitaire Kossodo");
  const [deliveryAddress, setDeliveryAddress] = useState(
    customer?.delivery_address || "Cité universitaire de Kossodo, Pavillon B, Chambre 14, près de la porte principale"
  );
  const [deliveryNotes, setDeliveryNotes] = useState("");

  // GPS coordinates
  const [latitude, setLatitude] = useState(customer?.gps_coordinates ? parseFloat(customer.gps_coordinates.split(",")[0]) : 12.4172);
  const [longitude, setLongitude] = useState(customer?.gps_coordinates ? parseFloat(customer.gps_coordinates.split(",")[1]) : -1.4889);
  const [locationAccuracy, setLocationAccuracy] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [gpsCaptured, setGpsCaptured] = useState(Boolean(customer?.gps_coordinates));

  // Customer Contact
  const [customerName, setCustomerName] = useState(customer?.name || "Richard");
  const [customerPhone, setCustomerPhone] = useState(customer?.phone || "+226 76 00 10 45");

  // Flow State: "EDIT" | "SUCCESS"
  const [step, setStep] = useState("EDIT");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [createdOrder, setCreatedOrder] = useState(null);

  const deliveryFee = 500;
  const unitPrice = selectedVariant?.price_override || product?.price || 0;
  const subtotal = unitPrice * quantity;
  const totalAmount = subtotal + deliveryFee;

  const handleCaptureGps = () => {
    if (!navigator.geolocation) {
      showToast?.("La géolocalisation n'est pas supportée par votre navigateur");
      return;
    }
    setIsLocating(true);
    showToast?.("Recherche de votre position GPS exacte...");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(parseFloat(pos.coords.latitude.toFixed(5)));
        setLongitude(parseFloat(pos.coords.longitude.toFixed(5)));
        setLocationAccuracy(parseFloat(pos.coords.accuracy.toFixed(1)));
        setGpsCaptured(true);
        setIsLocating(false);
        showToast?.("Position GPS exacte capturée avec succès !");
      },
      (err) => {
        setIsLocating(false);
        let msg = "Impossible d'obtenir la position GPS";
        if (err.code === 1) msg = "Veuillez autoriser l'accès GPS sur votre appareil";
        showToast?.(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSubmitOrder = async () => {
    setErrorMessage("");
    if (!customerName.trim()) {
      const msg = "Veuillez renseigner votre nom";
      setErrorMessage(msg);
      showToast?.(msg);
      return;
    }
    if (deliveryMode !== "EXACT_GPS" && !deliveryAddress.trim()) {
      const msg = "Veuillez préciser votre adresse ou repère de livraison";
      setErrorMessage(msg);
      showToast?.(msg);
      return;
    }

    setIsSubmitting(true);
    try {
      const customizationOptions = isCustomizable
        ? {
            spice_level: spiceLevel,
            onions: onionsChoice,
            cooking: cookingChoice,
            attieke_portions: portionsChoice,
          }
        : null;

      const resolvedStoreId = store?.id || store?.slug || getActiveStoreSlug() || "default-store";

      let guestToken = customer?.session_token || localStorage.getItem("conversastore_guest_token");
      if (!guestToken) {
        guestToken = "guest_" + Math.random().toString(36).substring(2, 10);
        try {
          localStorage.setItem("conversastore_guest_token", guestToken);
        } catch (e) {}
      }

      const orderPayload = {
        store_id: resolvedStoreId,
        items: [
          {
            product_id: product?.id || null,
            variant_id: selectedVariant?.id || null,
            product_name: product?.name || "Article Spécial",
            variant_name: selectedVariant?.name || null,
            quantity: quantity,
            unit_price: unitPrice,
            customization_text: isCustomizable ? customizationText : null,
            customization_options: customizationOptions,
          },
        ],
        delivery: {
          delivery_mode: deliveryMode,
          delivery_city: deliveryCity || "Ouagadougou",
          delivery_address: deliveryAddress || "En magasin / Point de livraison",
          latitude: deliveryMode !== "ADDRESS_DESCRIPTION" ? latitude : null,
          longitude: deliveryMode !== "ADDRESS_DESCRIPTION" ? longitude : null,
          location_accuracy: locationAccuracy,
          delivery_notes: deliveryNotes,
        },
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_id: customer?.id || null,
        customer_token: guestToken,
        delivery_fee: deliveryFee,
        notes: isCustomizable ? customizationText : null,
      };

      const result = await createConversationalOrder(orderPayload);
      setCreatedOrder(result);
      setStep("SUCCESS");
      showToast?.("Commande transmise avec succès au commerçant !");
      onOrderCreated?.(result);
    } catch (err) {
      console.error("Erreur transmission commande :", err);
      const msg = err.message || "Erreur de transmission de la commande. Veuillez vérifier votre connexion et réessayer.";
      setErrorMessage(msg);
      showToast?.(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg max-h-[92vh] flex flex-col bg-surface border-2 border-slate-300 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden text-foreground">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-surface-elevated/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Icon name="restaurant" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">
                {step === "EDIT" ? "Commander votre plat" : "Commande transmise !"}
              </h3>
              <p className="text-xs text-foreground-muted">
                {store?.name || "Boutique"} • Cité Kossodo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-foreground-muted hover:bg-surface-elevated hover:text-foreground transition-colors"
          >
            <Icon name="close" className="text-xl" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {errorMessage && (
            <div className="p-3.5 bg-red-500/10 border-2 border-red-500/40 rounded-xl text-red-600 dark:text-red-400 text-xs flex items-start gap-2.5 shadow-sm">
              <Icon name="error" className="text-[20px] text-red-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-bold">Attention</p>
                <p className="mt-0.5 leading-relaxed">{errorMessage}</p>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage("")}
                className="text-red-500 hover:text-red-700 font-bold p-0.5"
              >
                <Icon name="close" className="text-[16px]" />
              </button>
            </div>
          )}

          {step === "EDIT" ? (
            <>
              {/* Product summary card */}
              <div className="p-3.5 bg-surface-elevated/50 rounded-xl border border-border flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">
                      {isCustomizable ? "Personnalisable" : "Standard"}
                    </span>
                    {product?.badge_tag && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                        {product.badge_tag}
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-sm truncate">{product?.name}</h4>
                  <p className="text-xs text-foreground-muted">
                    {unitPrice.toLocaleString()} {store?.currency || "FCFA"} / portion
                  </p>
                </div>

                {/* Quantity Stepper */}
                <div className="flex items-center gap-2 bg-surface border border-border rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-7 h-7 rounded flex items-center justify-center hover:bg-surface-elevated text-sm font-bold text-foreground"
                  >
                    -
                  </button>
                  <span className="w-5 text-center font-bold text-sm">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-7 h-7 rounded flex items-center justify-center hover:bg-surface-elevated text-sm font-bold text-foreground"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Product Customization Section */}
              {isCustomizable && (
                <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 space-y-4">
                  <div className="flex items-center gap-2 text-primary font-bold text-sm">
                    <Icon name="tune" className="text-lg" />
                    <span>Personnalisation sur mesure</span>
                  </div>

                  {/* Free text prompt */}
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      {product.customization_prompt || "Décris ton plat"} :
                    </label>
                    <textarea
                      rows={2}
                      value={customizationText}
                      onChange={(e) => setCustomizationText(e.target.value)}
                      placeholder="Ex: Je veux beaucoup d'oignons, peu de piment, deux portions d'attiéké et un poisson bien grillé..."
                      className="w-full text-xs p-3 rounded-lg bg-surface border border-border focus:border-primary focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Structured presets */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="font-semibold block mb-1 text-foreground-muted">🌶 Piment :</span>
                      <select
                        value={spiceLevel}
                        onChange={(e) => setSpiceLevel(e.target.value)}
                        className="w-full p-2 rounded-lg bg-surface border border-border focus:border-primary focus:outline-none text-xs"
                      >
                        <option value="Sans piment">Sans piment</option>
                        <option value="Peu de piment">Peu de piment (Doux)</option>
                        <option value="Piment moyen">Piment moyen</option>
                        <option value="Très pimenté 🔥">Très pimenté 🔥</option>
                      </select>
                    </div>

                    <div>
                      <span className="font-semibold block mb-1 text-foreground-muted">🧅 Oignons :</span>
                      <select
                        value={onionsChoice}
                        onChange={(e) => setOnionsChoice(e.target.value)}
                        className="w-full p-2 rounded-lg bg-surface border border-border focus:border-primary focus:outline-none text-xs"
                      >
                        <option value="Sans oignon">Sans oignon</option>
                        <option value="Oignons normaux">Oignons normaux</option>
                        <option value="Beaucoup d'oignons">Beaucoup d'oignons 🧅</option>
                      </select>
                    </div>

                    <div>
                      <span className="font-semibold block mb-1 text-foreground-muted">🐟 Cuisson Thon :</span>
                      <select
                        value={cookingChoice}
                        onChange={(e) => setCookingChoice(e.target.value)}
                        className="w-full p-2 rounded-lg bg-surface border border-border focus:border-primary focus:outline-none text-xs"
                      >
                        <option value="Poisson tendre">Poisson tendre</option>
                        <option value="Poisson bien grillé et croustillant">Bien grillé & croustillant</option>
                      </select>
                    </div>

                    <div>
                      <span className="font-semibold block mb-1 text-foreground-muted">🍚 Portions Attiéké :</span>
                      <select
                        value={portionsChoice}
                        onChange={(e) => setPortionsChoice(e.target.value)}
                        className="w-full p-2 rounded-lg bg-surface border border-border focus:border-primary focus:outline-none text-xs"
                      >
                        <option value="1 portion standard">1 portion standard</option>
                        <option value="2 portions">2 portions</option>
                        <option value="3 portions maxi">3 portions maxi</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Delivery Location Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-foreground-muted flex items-center gap-1.5">
                    <Icon name="location_on" className="text-sm text-primary" />
                    Où souhaitez-vous recevoir votre commande ?
                  </label>
                </div>

                {/* 3 Options Tabs */}
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-surface-elevated/70 rounded-xl border border-border text-xs">
                  <button
                    type="button"
                    onClick={() => setDeliveryMode("EXACT_GPS")}
                    className={`py-2 px-1 rounded-lg text-center font-medium transition-all ${
                      deliveryMode === "EXACT_GPS"
                        ? "bg-primary text-white shadow-sm"
                        : "text-foreground-muted hover:text-foreground"
                    }`}
                  >
                    Position GPS
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryMode("ADDRESS_DESCRIPTION")}
                    className={`py-2 px-1 rounded-lg text-center font-medium transition-all ${
                      deliveryMode === "ADDRESS_DESCRIPTION"
                        ? "bg-primary text-white shadow-sm"
                        : "text-foreground-muted hover:text-foreground"
                    }`}
                  >
                    Adresse décrite
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryMode("GPS_AND_DESCRIPTION")}
                    className={`py-2 px-1 rounded-lg text-center font-medium transition-all ${
                      deliveryMode === "GPS_AND_DESCRIPTION"
                        ? "bg-primary text-white shadow-sm"
                        : "text-foreground-muted hover:text-foreground"
                    }`}
                  >
                    GPS + Adresse ⭐
                  </button>
                </div>

                {/* GPS Capture sub-card */}
                {(deliveryMode === "EXACT_GPS" || deliveryMode === "GPS_AND_DESCRIPTION") && (
                  <div className="p-3 bg-surface-elevated/40 rounded-xl border border-border flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-foreground flex items-center gap-1">
                        <Icon name="my_location" className="text-sm text-primary" />
                        <span>Coordonnées GPS exactes</span>
                      </div>
                      <p className="text-[11px] text-foreground-muted truncate">
                        {gpsCaptured ? `📍 ${latitude}, ${longitude} (Précision: ${locationAccuracy ? locationAccuracy + "m" : "5m"})` : "Aucune position GPS capturée"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleCaptureGps}
                      disabled={isLocating}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors flex items-center gap-1 shrink-0"
                    >
                      <Icon name={isLocating ? "hourglass_empty" : "near_me"} className="text-sm" />
                      <span>{isLocating ? "Localisation..." : gpsCaptured ? "Actualiser" : "Utiliser ma position"}</span>
                    </button>
                  </div>
                )}

                {/* Described Address text */}
                {(deliveryMode === "ADDRESS_DESCRIPTION" || deliveryMode === "GPS_AND_DESCRIPTION") && (
                  <div>
                    <label className="block text-xs font-medium text-foreground-muted mb-1">
                      Description précise du lieu (Campus / Pavillon / Chambre) :
                    </label>
                    <textarea
                      rows={2}
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Ex: Cité universitaire de Kossodo, Pavillon B, Chambre 14, près de la porte principale."
                      className="w-full text-xs p-2.5 rounded-lg bg-surface border border-border focus:border-primary focus:outline-none transition-colors"
                    />
                  </div>
                )}
              </div>

              {/* Customer Contact */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-medium text-foreground-muted mb-1">Votre Nom :</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg bg-surface border border-border focus:border-primary focus:outline-none"
                    placeholder="Ex: Richard"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground-muted mb-1">Téléphone :</label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg bg-surface border border-border focus:border-primary focus:outline-none"
                    placeholder="+226 70 00 00 00"
                  />
                </div>
              </div>

              {/* Order Breakdown / Totals */}
              <div className="p-3.5 bg-surface-elevated/70 rounded-xl border border-border space-y-1.5 text-xs">
                <div className="flex justify-between text-foreground-muted">
                  <span>{product?.name} × {quantity}</span>
                  <span className="font-semibold text-foreground">{subtotal.toLocaleString()} {store?.currency || "FCFA"}</span>
                </div>
                <div className="flex justify-between text-foreground-muted">
                  <span>Frais de livraison ({deliveryCity})</span>
                  <span className="font-semibold text-foreground">{deliveryFee.toLocaleString()} {store?.currency || "FCFA"}</span>
                </div>
                <div className="border-t border-border pt-1.5 flex justify-between font-bold text-sm text-foreground">
                  <span>Total à payer</span>
                  <span className="text-primary">{totalAmount.toLocaleString()} {store?.currency || "FCFA"}</span>
                </div>
              </div>
            </>
          ) : (
            /* SUCCESS STATE */
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 mx-auto flex items-center justify-center animate-bounce">
                <Icon name="check_circle" className="text-3xl" />
              </div>

              <div>
                <h4 className="text-lg font-bold">Commande #{createdOrder?.order_number} créée !</h4>
                <p className="text-xs text-foreground-muted max-w-sm mx-auto mt-1">
                  Votre commande a été transmise en direct à <strong>{store?.name}</strong>.
                </p>
              </div>

              {/* Order recap box */}
              <div className="p-4 bg-surface-secondary border-2 border-slate-300 dark:border-slate-700 rounded-xl text-left text-xs space-y-2 max-w-sm mx-auto shadow-sm">
                <div className="flex justify-between font-bold border-b border-slate-300 dark:border-slate-700 pb-1.5">
                  <span>Statut :</span>
                  <span className="text-amber-500 font-semibold">En attente d'acceptation</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-muted">Total :</span>
                  <span className="font-bold text-primary">{createdOrder?.total_amount?.toLocaleString()} {createdOrder?.currency}</span>
                </div>
                <div className="text-foreground-muted">
                  <span>Livraison : </span>
                  <span className="text-foreground font-medium">{createdOrder?.delivery?.delivery_address}</span>
                </div>
              </div>

              <div className="p-3.5 bg-primary/10 rounded-xl border-2 border-primary/30 text-xs text-primary max-w-sm mx-auto shadow-xs">
                💬 <strong>Commerce conversationnel intégré :</strong> Vous pouvez maintenant échanger directement avec le chef, envoyer votre preuve de paiement et suivre la préparation.
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t-2 border-slate-200 dark:border-slate-800 bg-surface-elevated/40 flex items-center gap-3">
          {step === "EDIT" ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 text-xs font-semibold rounded-xl border border-border hover:bg-surface-elevated transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSubmitOrder}
                disabled={isSubmitting}
                className="flex-[2] py-2.5 px-4 text-xs font-bold rounded-xl bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary-hover active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <Icon name={isSubmitting ? "hourglass_empty" : "send"} className="text-sm" />
                <span>{isSubmitting ? "Transmission..." : `Confirmer la commande (${totalAmount.toLocaleString()} F)`}</span>
              </button>
            </>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 text-xs font-semibold rounded-xl border border-border hover:bg-surface-elevated text-foreground transition-colors cursor-pointer"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (createdOrder?.conversation_id) {
                    onOpenChat?.(createdOrder.conversation_id);
                  }
                }}
                className="flex-[2] py-3 px-4 text-xs font-bold rounded-xl bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary-hover active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Icon name="forum" className="text-base" />
                <span>Ouvrir le chat de la commande</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
