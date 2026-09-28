import Icon from "./Icon";
import React, { useState } from "react";
import { createConversationalOrder, getActiveStoreSlug, setCustomerToken, getCustomerToken, checkOrderCoupon, customerQuickRegister } from "../api/client";
import CustomerAuthModal from "./CustomerAuthModal";
import { getBusinessContext } from "../utils/businessContext";
import {
  getProductSalesConfig,
  formatSalesQuantity,
  formatSalesUnitPrice,
  validateSalesQuantity,
} from "../utils/salesEngine";

export default function ConversationalOrderModal({
  store,
  product,
  customer,
  onClose,
  showToast,
  onOrderCreated,
  onOpenChat,
  onCustomerAuthenticated,
}) {
  const ctx = getBusinessContext(store);
  const salesConfig = getProductSalesConfig(product);

  const [quantity, setQuantity] = useState(salesConfig.minQuantity);
  const [customWidth, setCustomWidth] = useState("");
  const [customHeight, setCustomHeight] = useState("");
  const [selectedVariant, setSelectedVariant] = useState(
    product?.variants && product.variants.length > 0 ? product.variants[0] : null
  );

  // Customization state
  const isCustomizable = Boolean(product?.is_customizable);
  const [customizationText, setCustomizationText] = useState("");

  // Domain-specific customization choices
  const [spiceLevel, setSpiceLevel] = useState("Peu de piment");
  const [onionsChoice, setOnionsChoice] = useState("Beaucoup d'oignons");
  const [cookingChoice, setCookingChoice] = useState("Poisson bien grillé et croustillant");
  const [portionsChoice, setPortionsChoice] = useState("1 portion standard");

  // Fashion customization choices
  const [sizeMeasure, setSizeMeasure] = useState("Standard M / L");
  const [finishingChoice, setFinishingChoice] = useState("Ourlet soigné standard");

  // Delivery Location Mode: "GPS_AND_DESCRIPTION" | "EXACT_GPS" | "ADDRESS_DESCRIPTION"
  const defaultCity = customer?.city || store?.city || store?.delivery_city || "Ouagadougou";
  const [deliveryMode, setDeliveryMode] = useState("GPS_AND_DESCRIPTION");
  const [deliveryCity, setDeliveryCity] = useState(defaultCity);
  const [deliveryAddress, setDeliveryAddress] = useState(customer?.delivery_address || "");
  const [deliveryNotes, setDeliveryNotes] = useState("");

  // GPS coordinates
  const [latitude, setLatitude] = useState(customer?.gps_coordinates ? parseFloat(customer.gps_coordinates.split(",")[0]) : 12.4172);
  const [longitude, setLongitude] = useState(customer?.gps_coordinates ? parseFloat(customer.gps_coordinates.split(",")[1]) : -1.4889);
  const [locationAccuracy, setLocationAccuracy] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [gpsCaptured, setGpsCaptured] = useState(Boolean(customer?.gps_coordinates));

  // Customer Contact & Seamless Checkout Onboarding
  const [customerName, setCustomerName] = useState(customer?.name || "");
  const [customerPhone, setCustomerPhone] = useState(customer?.phone || "");
  const [customerCountry, setCustomerCountry] = useState(customer?.country || store?.country || "Burkina Faso");
  const [customerCity, setCustomerCity] = useState(customer?.city || defaultCity);
  const [deliveryNeighborhood, setDeliveryNeighborhood] = useState(
    customer?.delivery_neighborhood || customer?.delivery_address || ""
  );
  const [registerAccount, setRegisterAccount] = useState(!customer);

  // Flow State: "EDIT" | "SUCCESS"
  const [step, setStep] = useState("EDIT");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [createdOrder, setCreatedOrder] = useState(null);

  // Coupon & Discount state
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState("");
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  // Mandatory account confirmation state for visitors
  const [accountPromptOpen, setAccountPromptOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const deliveryFee = 500;
  const unitPrice = selectedVariant?.price_override || product?.price || 0;
  const subtotal = Math.round(unitPrice * quantity);
  const discountAmount = appliedCoupon?.discount_amount || 0;
  const totalAmount = Math.max(0, subtotal - discountAmount) + deliveryFee;

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    try {
      setValidatingCoupon(true);
      setCouponError("");
      const resolvedStoreId = store?.id || store?.slug || getActiveStoreSlug() || "default";
      const res = await checkOrderCoupon(resolvedStoreId, couponCode.trim(), subtotal);
      if (res.valid) {
        setAppliedCoupon(res);
        showToast?.(`Coupon appliqué : -${res.discount_amount} FCFA`);
      } else {
        setCouponError(res.message || "Code promo invalide");
      }
    } catch (e) {
      setCouponError(e.message || "Erreur de validation");
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleStepQuantity = (delta) => {
    setQuantity((prev) => {
      const step = salesConfig.quantityStep || 1;
      const next = parseFloat((Number(prev) + delta * step).toFixed(salesConfig.precision || 2));
      if (next < salesConfig.minQuantity) return salesConfig.minQuantity;
      if (next > salesConfig.maxQuantity) return salesConfig.maxQuantity;
      return next;
    });
  };

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

  const executeOrderSubmission = async (activeCustomer = null, activeToken = null) => {
    setIsSubmitting(true);
    try {
      let customizationOptions = null;
      if (isCustomizable) {
        if (ctx.domain === "FOOD") {
          customizationOptions = {
            spice_level: spiceLevel,
            onions: onionsChoice,
            cooking: cookingChoice,
            attieke_portions: portionsChoice,
          };
        } else if (ctx.domain === "FASHION") {
          customizationOptions = {
            size_measure: sizeMeasure,
            finishing: finishingChoice,
          };
        }
      }

      const customMeasurements = salesConfig.allowCustomMeasurements && (customWidth || customHeight) ? {
        width: customWidth ? parseFloat(customWidth) : null,
        height: customHeight ? parseFloat(customHeight) : null,
      } : null;

      const resolvedStoreId = store?.id || store?.slug || getActiveStoreSlug() || "default-store";
      const targetCustomer = activeCustomer || customer;
      const targetToken = activeToken || (targetCustomer && targetCustomer.session_token) || getCustomerToken();

      const orderPayload = {
        store_id: resolvedStoreId,
        items: [
          {
            product_id: product?.id || null,
            variant_id: selectedVariant?.id || null,
            product_name: product?.name || ctx.terms.item_singular,
            variant_name: selectedVariant?.name || null,
            quantity: quantity,
            unit_price: unitPrice,
            unit: salesConfig.unit,
            unit_label: salesConfig.unitLabel,
            pricing_model: salesConfig.pricingModel,
            measurements: customMeasurements,
            customization_text: isCustomizable ? customizationText : null,
            customization_options: customizationOptions,
          },
        ],
        delivery: {
          delivery_mode: deliveryMode,
          delivery_city: deliveryCity || defaultCity,
          delivery_address: deliveryAddress || deliveryNeighborhood || "En magasin / Point de livraison",
          latitude: deliveryMode !== "ADDRESS_DESCRIPTION" ? latitude : null,
          longitude: deliveryMode !== "ADDRESS_DESCRIPTION" ? longitude : null,
          location_accuracy: locationAccuracy,
          delivery_notes: deliveryNotes,
        },
        customer_name: targetCustomer?.name || customerName?.trim() || "Client GotoShop",
        customer_phone: targetCustomer?.phone || customerPhone?.trim() || null,
        customer_id: targetCustomer?.id && !targetCustomer.id.startsWith("cust-local-") ? targetCustomer.id : null,
        customer_token: targetToken,
        delivery_fee: deliveryFee,
        notes: isCustomizable ? customizationText : null,
        register_account: true,
        country: customerCountry,
        city: customerCity,
        delivery_neighborhood: deliveryNeighborhood || deliveryAddress,
        coupon_code: appliedCoupon ? appliedCoupon.code : null,
      };

      const result = await createConversationalOrder(orderPayload);
      setCreatedOrder(result);
      if (result?.customer_token) {
        setCustomerToken(result.customer_token);
      }
      if (result?.customer && onCustomerAuthenticated) {
        onCustomerAuthenticated(result.customer);
      }
      showToast?.(`Commande #${result?.order_number || ""} transmise avec succès !`);
      if (onOrderCreated) {
        onOrderCreated(result);
      }
      setStep("SUCCESS");
    } catch (err) {
      console.error("Order submit failed:", err);
      const msg = err.message || "Erreur lors de la transmission de la commande. Veuillez réessayer.";
      setErrorMessage(msg);
      showToast?.(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitOrder = async () => {
    setErrorMessage("");

    // Validate polymorphic sales quantity against rules
    const valResult = validateSalesQuantity(quantity, salesConfig);
    if (!valResult.valid) {
      setErrorMessage(valResult.message);
      showToast?.(valResult.message);
      return;
    }

    if (!customerName.trim()) {
      const msg = "Veuillez renseigner votre nom";
      setErrorMessage(msg);
      showToast?.(msg);
      return;
    }
    if (deliveryMode !== "EXACT_GPS" && !deliveryAddress.trim() && !deliveryNeighborhood.trim()) {
      const msg = "Veuillez préciser votre adresse ou repère de livraison";
      setErrorMessage(msg);
      showToast?.(msg);
      return;
    }

    // MANDATORY ACCOUNT CHECK
    if (!customer) {
      if (!customerName.trim() || !customerPhone.trim()) {
        const msg = "Compte obligatoire pour commander : veuillez renseigner votre nom et votre numéro de téléphone.";
        setErrorMessage(msg);
        showToast?.(msg);
        setAuthModalOpen(true);
        return;
      }
      setAccountPromptOpen(true);
      return;
    }

    await executeOrderSubmission(customer);
  };

  const handleAcceptDirectAccount = async () => {
    setAccountPromptOpen(false);
    setIsSubmitting(true);
    try {
      showToast?.("Création et activation de votre compte client...");
      const fullCity = deliveryAddress?.trim() ? `${deliveryCity} (${deliveryAddress.trim()})` : deliveryCity;
      const res = await customerQuickRegister({
        name: customerName.trim(),
        phone: customerPhone.trim(),
        city: fullCity,
        country: customerCountry || store?.country || "Burkina Faso",
        locality: deliveryAddress?.trim() || "",
      });
      showToast?.(`Compte activé pour ${res.customer.name} !`);
      const token = res.access_token || res.token;
      if (token) {
        setCustomerToken(token);
      }
      if (onCustomerAuthenticated) {
        onCustomerAuthenticated(res.customer);
      }
      await executeOrderSubmission(res.customer, token);
    } catch (err) {
      showToast?.(err.message || "Erreur lors de l'activation du compte. Vérifiez vos informations.");
      setAuthModalOpen(true);
      setIsSubmitting(false);
    }
  };

  const handleRejectDirectAccount = () => {
    setAccountPromptOpen(false);
    setAuthModalOpen(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg max-h-[92vh] flex flex-col bg-surface border-2 border-slate-300 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden text-foreground">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-surface-elevated/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Icon name={ctx.icon} />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">
                {ctx.getOrderModalTitle(step)}
              </h3>
              <p className="text-xs text-foreground-muted">
                {ctx.storeName} • {ctx.storeLocation}
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
                  <p className="text-xs font-bold text-primary">
                    {formatSalesUnitPrice(unitPrice, salesConfig.unitLabel, store?.currency || "FCFA")}
                  </p>
                </div>
              </div>

              {/* Polymorphic Quantity & Measurement Selector */}
              <div className="p-3.5 bg-surface-elevated/40 rounded-xl border border-border space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <label className="block text-xs font-bold text-foreground">
                      Quantité / Mesure :
                    </label>
                    <span className="text-xs font-semibold text-primary">
                      {formatSalesQuantity(quantity, salesConfig.unitLabel, salesConfig.precision)}
                    </span>
                  </div>

                  {/* Stepper with Decimal Numerical Input */}
                  <div className="flex items-center gap-1 bg-surface border-2 border-slate-200 dark:border-slate-700 rounded-xl p-1 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => handleStepQuantity(-1)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-elevated active:scale-95 text-base font-bold text-foreground transition-all"
                      title={`Diminuer de ${salesConfig.quantityStep}`}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      step={salesConfig.quantityStep}
                      min={salesConfig.minQuantity}
                      max={salesConfig.maxQuantity}
                      value={quantity}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) setQuantity(val);
                      }}
                      className="w-16 text-center font-bold text-sm bg-transparent focus:outline-none text-foreground"
                    />
                    <button
                      type="button"
                      onClick={() => handleStepQuantity(1)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-elevated active:scale-95 text-base font-bold text-foreground transition-all"
                      title={`Augmenter de ${salesConfig.quantityStep}`}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Quick Selection Chips */}
                {salesConfig.quickChips && salesConfig.quickChips.length > 1 && (
                  <div className="pt-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] text-foreground-muted mr-0.5">Choix rapide :</span>
                      {salesConfig.quickChips.map((chipVal) => (
                        <button
                          key={chipVal}
                          type="button"
                          onClick={() => setQuantity(chipVal)}
                          className={`px-2 py-0.5 rounded-lg text-xs font-semibold transition-all ${
                            quantity === chipVal
                              ? "bg-primary text-white shadow-xs"
                              : "bg-surface border border-border text-foreground hover:bg-surface-elevated"
                          }`}
                        >
                          {formatSalesQuantity(chipVal, salesConfig.unitLabel, salesConfig.precision)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom dimensions if allowed */}
                {salesConfig.allowCustomMeasurements && (
                  <div className="pt-2 border-t border-border grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-foreground-muted mb-0.5">Largeur (mètres) :</label>
                      <input
                        type="number"
                        step="0.05"
                        placeholder="Ex: 2.50"
                        value={customWidth}
                        onChange={(e) => setCustomWidth(e.target.value)}
                        className="w-full text-xs p-2 rounded-lg bg-surface border border-border focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-foreground-muted mb-0.5">Hauteur / Longueur (m) :</label>
                      <input
                        type="number"
                        step="0.05"
                        placeholder="Ex: 2.20"
                        value={customHeight}
                        onChange={(e) => setCustomHeight(e.target.value)}
                        className="w-full text-xs p-2 rounded-lg bg-surface border border-border focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Product Variants Selection (if present) */}
              {product?.variants && product.variants.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-foreground">
                    Modèle / Finition :
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {product.variants.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVariant(v)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          selectedVariant?.id === v.id
                            ? "border-primary bg-primary/5 text-primary font-bold shadow-sm"
                            : "border-border bg-surface hover:bg-surface-elevated text-foreground"
                        }`}
                      >
                        <div className="text-xs truncate">{v.name}</div>
                        <div className="text-[11px] text-foreground-muted">
                          {(v.price_override || product.price).toLocaleString()} {store?.currency || "FCFA"}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Product Customization Section */}
              {isCustomizable && (
                <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 space-y-4">
                  <div className="flex items-center gap-2 text-primary font-bold text-sm">
                    <Icon name={ctx.icon} className="text-lg" />
                    <span>{ctx.terms.customization_title}</span>
                  </div>

                  {/* Free text prompt */}
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      {product.customization_prompt || ctx.terms.customization_default_prompt} :
                    </label>
                    <textarea
                      rows={2}
                      value={customizationText}
                      onChange={(e) => setCustomizationText(e.target.value)}
                      placeholder={
                        ctx.domain === "FOOD"
                          ? "Ex: Bien cuit, sauce à part, sans trop d'oignons..."
                          : ctx.domain === "FASHION"
                          ? "Ex: Tour de taille 84cm, longueur pantalon 102cm, broderie dorée..."
                          : "Ex: Précisez votre couleur préférée ou toute demande spécifique..."
                      }
                      className="w-full text-xs p-3 rounded-lg bg-surface border border-border focus:border-primary focus:outline-none transition-colors"
                    />
                  </div>

                  {/* FOOD PRESETS (Food stores only) */}
                  {ctx.domain === "FOOD" && (
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
                        <span className="font-semibold block mb-1 text-foreground-muted">🧅 Oignons / Condiments :</span>
                        <select
                          value={onionsChoice}
                          onChange={(e) => setOnionsChoice(e.target.value)}
                          className="w-full p-2 rounded-lg bg-surface border border-border focus:border-primary focus:outline-none text-xs"
                        >
                          <option value="Sans oignon">Sans oignon</option>
                          <option value="Oignons normaux">Normal</option>
                          <option value="Beaucoup d'oignons">Généreux 🧅</option>
                        </select>
                      </div>

                      <div>
                        <span className="font-semibold block mb-1 text-foreground-muted">🔥 Cuisson :</span>
                        <select
                          value={cookingChoice}
                          onChange={(e) => setCookingChoice(e.target.value)}
                          className="w-full p-2 rounded-lg bg-surface border border-border focus:border-primary focus:outline-none text-xs"
                        >
                          <option value="Tendre et moelleux">Tendre & Moelleux</option>
                          <option value="Bien grillé et croustillant">Bien grillé & croustillant</option>
                        </select>
                      </div>

                      <div>
                        <span className="font-semibold block mb-1 text-foreground-muted">🍚 Accompagnement :</span>
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
                  )}

                  {/* FASHION PRESETS (Fashion / clothing stores only) */}
                  {ctx.domain === "FASHION" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="font-semibold block mb-1 text-foreground-muted">📏 Taille & Mensurations :</span>
                        <select
                          value={sizeMeasure}
                          onChange={(e) => setSizeMeasure(e.target.value)}
                          className="w-full p-2 rounded-lg bg-surface border border-border focus:border-primary focus:outline-none text-xs"
                        >
                          <option value="Standard M / L">Standard M / L</option>
                          <option value="Taille S (Ajustée)">Taille S (Ajustée)</option>
                          <option value="Taille XL (Ample)">Taille XL (Ample)</option>
                          <option value="Sur mesure (selon message)">Sur mesure (décrit ci-dessus)</option>
                        </select>
                      </div>

                      <div>
                        <span className="font-semibold block mb-1 text-foreground-muted">✂️ Finitions :</span>
                        <select
                          value={finishingChoice}
                          onChange={(e) => setFinishingChoice(e.target.value)}
                          className="w-full p-2 rounded-lg bg-surface border border-border focus:border-primary focus:outline-none text-xs"
                        >
                          <option value="Ourlet soigné standard">Ourlet soigné standard</option>
                          <option value="Broderie artisanale fine">Broderie artisanale fine</option>
                          <option value="Doublure satinée">Doublure satinée</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Delivery Mode & Location Section */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-foreground">
                  Mode de localisation & livraison :
                </label>

                {/* Delivery Mode Selector */}
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-surface-elevated rounded-xl border border-border text-xs">
                  <button
                    type="button"
                    onClick={() => setDeliveryMode("EXACT_GPS")}
                    className={`py-2 px-1 rounded-lg text-center font-medium transition-all ${
                      deliveryMode === "EXACT_GPS"
                        ? "bg-primary text-white shadow-sm"
                        : "text-foreground-muted hover:text-foreground"
                    }`}
                  >
                    GPS Direct
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
                    <label className="block text-[11px] font-medium text-foreground-muted mb-1">
                      Repère et description d'accès (Bâtiment, porte, carrefour) :
                    </label>
                    <textarea
                      rows={2}
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Ex: Porte bleue à côté de la pharmacie, 1er étage..."
                      className="w-full text-xs p-2.5 rounded-lg bg-surface border border-border focus:border-primary focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* CUSTOMER 5 MANDATORY FIELDS (Checkout Onboarding) */}
              <div className="p-4 bg-surface-elevated/40 rounded-xl border border-border space-y-3">
                <div className="flex items-center gap-2 text-foreground font-bold text-xs pb-1 border-b border-border">
                  <Icon name="person" className="text-primary text-base" />
                  <span>Vos coordonnées de commande & livraison</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* 1. Nom & Prénom */}
                  <div>
                    <label className="block text-[11px] font-medium text-foreground-muted mb-1">
                      1. Nom & Prénom <span className="text-primary">*</span>
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-lg bg-surface border border-border focus:border-primary focus:outline-none"
                      placeholder="Ex: Ousmane Ouédraogo"
                      required
                    />
                  </div>

                  {/* 2. Pays */}
                  <div>
                    <label className="block text-[11px] font-medium text-foreground-muted mb-1">
                      2. Pays
                    </label>
                    <input
                      type="text"
                      value={customerCountry}
                      onChange={(e) => setCustomerCountry(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-lg bg-surface border border-border focus:border-primary focus:outline-none"
                      placeholder="Ex: Burkina Faso, Côte d'Ivoire..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* 3. Téléphone / WhatsApp */}
                  <div>
                    <label className="block text-[11px] font-medium text-foreground-muted mb-1">
                      3. Téléphone (WhatsApp direct) <span className="text-primary">*</span>
                    </label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-lg bg-surface border border-border focus:border-primary focus:outline-none"
                      placeholder="Ex: +226 70 00 00 00"
                      required
                    />
                  </div>

                  {/* 4. Ville Principale */}
                  <div>
                    <label className="block text-[11px] font-medium text-foreground-muted mb-1">
                      4. Ville Principale
                    </label>
                    <input
                      type="text"
                      value={customerCity}
                      onChange={(e) => {
                        setCustomerCity(e.target.value);
                        setDeliveryCity(e.target.value);
                      }}
                      className="w-full text-xs p-2.5 rounded-lg bg-surface border border-border focus:border-primary focus:outline-none"
                      placeholder="Ex: Ouagadougou, Bobo-Dioulasso, Abidjan..."
                    />
                  </div>
                </div>

                {/* 5. Quartier / Repère de livraison */}
                <div>
                  <label className="block text-[11px] font-medium text-foreground-muted mb-1">
                    5. Quartier / Repère de livraison précis
                  </label>
                  <input
                    type="text"
                    value={deliveryNeighborhood}
                    onChange={(e) => setDeliveryNeighborhood(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg bg-surface border border-border focus:border-primary focus:outline-none"
                    placeholder="Ex: Secteur 12, pharmacie en face, portail vert"
                  />
                </div>

                {/* Seamless Account Creation Checkbox */}
                {!customer && (
                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-primary/5 border border-primary/20 text-xs text-foreground cursor-pointer hover:bg-primary/10 transition-colors">
                    <input
                      type="checkbox"
                      checked={registerAccount}
                      onChange={(e) => setRegisterAccount(e.target.checked)}
                      className="w-4 h-4 rounded text-primary focus:ring-primary/40 accent-primary"
                    />
                    <span className="leading-snug">
                      <strong>Mémoriser mes coordonnées</strong> et créer mon compte client automatiquement (accès permanent sans mot de passe).
                    </span>
                  </label>
                )}
              </div>

              {/* Promo Code / Coupon Section */}
              <div className="p-3 bg-surface-elevated/50 rounded-xl border border-border space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Icon name="local_offer" className="text-[15px] text-primary" />
                    <span>Code Promo / Réduction</span>
                  </span>
                  {appliedCoupon && (
                    <span className="text-[11px] text-emerald-400 font-bold">
                      ✓ -{appliedCoupon.discount_amount} FCFA
                    </span>
                  )}
                </div>

                {appliedCoupon ? (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs">
                    <div className="flex items-center gap-2">
                      <Icon name="confirmation_number" className="text-[16px] text-emerald-400" />
                      <div>
                        <p className="font-bold text-emerald-400">{appliedCoupon.code}</p>
                        <p className="text-[10px] text-foreground-muted">{appliedCoupon.title}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAppliedCoupon(null);
                        setCouponCode("");
                      }}
                      className="text-[11px] text-foreground-muted hover:text-rose-400 underline cursor-pointer"
                    >
                      Retirer
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ex: BIENVENUE10, OR5"
                      value={couponCode}
                      onChange={(e) => {
                        setCouponCode(e.target.value.toUpperCase());
                        setCouponError("");
                      }}
                      className="flex-1 h-9 px-3 rounded-lg bg-surface border border-border text-xs uppercase font-mono tracking-wider focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      disabled={!couponCode.trim() || validatingCoupon}
                      className="px-3 h-9 rounded-lg bg-primary text-white font-bold text-xs flex items-center gap-1 disabled:opacity-50 cursor-pointer transition-all"
                    >
                      {validatingCoupon ? (
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span>Appliquer</span>
                      )}
                    </button>
                  </div>
                )}
                {couponError && <p className="text-[11px] text-rose-400">{couponError}</p>}
              </div>

              {/* Order Breakdown / Totals */}
              <div className="p-3.5 bg-surface-elevated/70 rounded-xl border border-border space-y-1.5 text-xs">
                <div className="flex justify-between text-foreground-muted">
                  <span className="truncate pr-2">
                    {product?.name} ({formatSalesQuantity(quantity, salesConfig.unitLabel, salesConfig.precision)})
                  </span>
                  <span className="font-semibold text-foreground whitespace-nowrap">{subtotal.toLocaleString()} {store?.currency || "FCFA"}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-400 font-semibold">
                    <span>Remise ({appliedCoupon?.code || "Fidélité"})</span>
                    <span>-{discountAmount.toLocaleString()} {store?.currency || "FCFA"}</span>
                  </div>
                )}
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
                  Votre commande a été transmise en direct à <strong>{ctx.storeName}</strong>.
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
                {createdOrder?.items && createdOrder.items.length > 0 && (
                  <div className="text-foreground-muted border-t border-slate-200 dark:border-slate-700/60 pt-1.5">
                    <span>Détails : </span>
                    <span className="text-foreground font-medium">
                      {createdOrder.items.map((it) => `${it.product_name} • ${formatSalesQuantity(it.quantity, it.unit_label)}`).join(", ")}
                    </span>
                  </div>
                )}
                <div className="text-foreground-muted">
                  <span>Livraison : </span>
                  <span className="text-foreground font-medium">{createdOrder?.delivery?.delivery_address}</span>
                </div>
              </div>

              <div className="p-3.5 bg-primary/10 rounded-xl border-2 border-primary/30 text-xs text-primary max-w-sm mx-auto shadow-xs">
                💬 <strong>Commerce conversationnel intégré :</strong> Vous pouvez maintenant échanger directement avec l'équipe de <strong>{ctx.storeName}</strong>, envoyer votre reçu de paiement et suivre votre commande.
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

      {/* Mandatory Account Confirmation Modal for Visitors */}
      {accountPromptOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setAccountPromptOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
        >
          <div className="relative w-full max-w-md rounded-3xl bg-surface border-2 border-primary/30 p-6 shadow-2xl space-y-4 text-on-surface">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-1">
                <Icon name="verified_user" className="text-[28px]" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-on-surface">
                Activation de votre compte client
              </h3>
              <p className="text-xs text-on-surface-variant max-w-xs mx-auto">
                Pour valider votre commande et suivre sa livraison en temps réel, un compte GotoShop est obligatoire.
              </p>
            </div>

            <div className="bg-surface-secondary/80 rounded-2xl p-4 border border-subtle space-y-2 text-xs">
              <p className="text-[11px] font-semibold text-primary uppercase tracking-wider">
                Vos coordonnées renseignées :
              </p>
              <div className="space-y-1.5 text-on-surface">
                <div className="flex items-center gap-2">
                  <Icon name="person" className="text-[16px] text-on-surface-variant" />
                  <span className="font-semibold">{customerName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Icon name="phone" className="text-[16px] text-on-surface-variant" />
                  <span className="font-mono">{customerPhone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Icon name="location_on" className="text-[16px] text-on-surface-variant" />
                  <span>{deliveryCity} {deliveryAddress ? `(${deliveryAddress})` : ""}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleAcceptDirectAccount}
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl bg-primary hover:brightness-105 text-white font-bold text-xs shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
              >
                <Icon name="check_circle" className="text-[18px]" />
                <span>Oui, ce sont mes coordonnées — Activer &amp; Commander</span>
              </button>

              <button
                type="button"
                onClick={handleRejectDirectAccount}
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl bg-surface-secondary hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface font-semibold text-xs border border-subtle transition-all cursor-pointer"
              >
                Non, utiliser d'autres coordonnées
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Auth Modal (Prefilled with input fields when requested) */}
      <CustomerAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialData={{
          name: customerName,
          phone: customerPhone,
          city: deliveryCity,
          locality: deliveryAddress || deliveryNeighborhood,
        }}
        onSuccess={async (newCust) => {
          setAuthModalOpen(false);
          if (onCustomerAuthenticated) {
            onCustomerAuthenticated(newCust);
          }
          showToast?.(`Compte activé : ${newCust.name}`);
          await executeOrderSubmission(newCust, newCust.session_token);
        }}
        showToast={showToast}
      />
    </div>
  );
}
