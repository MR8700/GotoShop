import Icon from "./Icon";
import React, { useState, useEffect } from "react";
import { createConversationalOrder, getActiveStoreSlug, setCustomerToken, getCustomerToken, checkOrderCoupon, customerQuickRegister, fetchLoyaltySummary, fetchCustomerLoyaltyCoupons, previewShopDiscount, fetchDeliverySpots, fetchDeliveryCities, checkDeliveryLocation } from "../api/client";
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

  // Cohérence position GPS du client / ville de livraison choisie
  const [locCheck, setLocCheck] = useState(null);
  const [locAck, setLocAck] = useState(false);

  // Lieux de retrait / livraison définis par le commerçant (le client peut en choisir un)
  const [spots, setSpots] = useState([]);
  const [spotId, setSpotId] = useState(null);
  const [spotImg, setSpotImg] = useState({});
  useEffect(() => {
    let alive = true;
    const key = store?.id || store?.slug;
    if (key) fetchDeliverySpots(key).then((r) => alive && setSpots(Array.isArray(r) ? r : []));
    return () => { alive = false; };
  }, [store?.id, store?.slug]);
  const selectedSpot = spots.find((s) => s.id === spotId) || null;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    setLocAck(false);
    const key = store?.id || store?.slug;
    if (!key || selectedSpot || !gpsCaptured || deliveryMode === "ADDRESS_DESCRIPTION") {
      setLocCheck(null);
      return undefined;
    }
    let alive = true;
    const timer = setTimeout(() => {
      checkDeliveryLocation(key, { city: deliveryCity || defaultCity, latitude, longitude })
        .then((r) => { if (alive && r && typeof r === "object") setLocCheck(r); })
        .catch(() => { if (alive) setLocCheck(null); });
    }, 400);
    return () => { alive = false; clearTimeout(timer); };
  }, [store?.id, store?.slug, selectedSpot, gpsCaptured, latitude, longitude, deliveryCity, deliveryMode]);
  const locBlocked = !!locCheck && (locCheck.status === "MISMATCH" || locCheck.status === "OUT_OF_ZONE") && !locAck;

  // Villes livrées et tarifs du commerçant : le montant affiché est celui que le serveur appliquera
  const [cities, setCities] = useState([]);
  useEffect(() => {
    let alive = true;
    const key = store?.id || store?.slug;
    if (key) fetchDeliveryCities(key).then((r) => alive && setCities(Array.isArray(r) ? r : []));
    return () => { alive = false; };
  }, [store?.id, store?.slug]);

  // Customer Contact & Seamless Checkout Onboarding
  const [customerName, setCustomerName] = useState(customer?.name || "");
  const [customerPhone, setCustomerPhone] = useState(customer?.phone || "");
  const [customerCountry, setCustomerCountry] = useState(customer?.country || store?.country || "Burkina Faso");
  const [customerCity, setCustomerCity] = useState(customer?.city || defaultCity);
  const [deliveryNeighborhood, setDeliveryNeighborhood] = useState(
    customer?.delivery_neighborhood || customer?.delivery_address || ""
  );
  const [registerAccount, setRegisterAccount] = useState(!customer);

  // Sync customer prop changes with form inputs
  useEffect(() => {
    if (customer?.name) setCustomerName(customer.name);
    if (customer?.phone) setCustomerPhone(customer.phone);
    if (customer?.city) setCustomerCity(customer.city);
    if (customer?.country) setCustomerCountry(customer.country);
    if (customer?.delivery_address || customer?.delivery_neighborhood) {
      setDeliveryNeighborhood(customer.delivery_neighborhood || customer.delivery_address);
      setDeliveryAddress(customer.delivery_address || customer.delivery_neighborhood);
    }
  }, [customer]);

  // Flow State: "EDIT" | "SUCCESS"
  const [step, setStep] = useState("EDIT");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [createdOrder, setCreatedOrder] = useState(null);

  // Remise boutique automatique (selon le public : visiteur, client, client choisi...)
  const [shopDiscount, setShopDiscount] = useState(null);

  // Fidélité v3 (points en dixièmes)
  const [loyaltySummary, setLoyaltySummary] = useState(null);
  const [loyaltyTenths, setLoyaltyTenths] = useState(0);
  const isLoggedIn = Boolean(customer && !String(customer.id || "").startsWith("cust-local-"));
  useEffect(() => {
    if (!isLoggedIn) return;
    let alive = true;
    fetchLoyaltySummary().then((d) => { if (alive && d) setLoyaltySummary(d); }).catch(() => {});
    return () => { alive = false; };
  }, [isLoggedIn]);
  const [myCoupons, setMyCoupons] = useState([]);
  useEffect(() => {
    if (!isLoggedIn) return;
    let alive = true;
    fetchCustomerLoyaltyCoupons().then((d) => { if (alive && Array.isArray(d)) setMyCoupons(d); }).catch(() => {});
    return () => { alive = false; };
  }, [isLoggedIn]);
  const maxTenths = loyaltySummary
    ? Math.max(0, Math.min(Math.round(loyaltySummary.balance * 10), Math.round(loyaltySummary.max_points_per_use * 10)))
    : 0;
  const fmtPt = (t) => (t / 10).toLocaleString("fr-FR", { maximumFractionDigits: 1 });

  // Coupon & Discount state
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState("");
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  // Mandatory account confirmation state for visitors
  const [accountPromptOpen, setAccountPromptOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const wantedCity = (deliveryCity || "").trim().toLowerCase();
  const cityFee = cities.find(
    (c) => c.delivery_fee != null && [c.name, c.display_label].some((n) => (n || "").trim().toLowerCase() === wantedCity)
  )?.delivery_fee;
  const deliveryFee = selectedSpot
    ? selectedSpot.kind === "PICKUP" ? 0 : selectedSpot.delivery_fee ?? cityFee ?? 500
    : cityFee ?? 500;
  const unitPrice = selectedVariant?.price_override || product?.price || 0;
  const subtotal = Math.round(unitPrice * quantity);
  // Fidélité v3 : points (par pas de 0,1) dépensés sur CE produit, remise sur UNE unité
  const pointsTenths = Math.max(0, Math.round(Number(loyaltyTenths) || 0));
  // Montant calculé par le serveur (la remise peut ne porter que sur ce produit ou sa catégorie, selon le public)
  const shopDiscountAmount = shopDiscount?.applicable ? Math.min(subtotal, Number(shopDiscount.amount) || 0) : 0;
  const couponAmount = appliedCoupon?.discount_amount || 0;
  // Une seule remise : la plus forte entre la remise boutique et le coupon (pas de cumul)
  const useShopDiscount = shopDiscountAmount > 0 && shopDiscountAmount >= couponAmount;
  const pointsDiscount = appliedCoupon ? 0 : Math.min(Math.floor((unitPrice * pointsTenths) / 1000), Math.round(unitPrice));
  const discountAmount = (useShopDiscount ? shopDiscountAmount : couponAmount) + pointsDiscount;
  const totalAmount = Math.max(0, subtotal - discountAmount) + deliveryFee;

  useEffect(() => {
    let alive = true;
    const sid = store?.id || store?.slug || getActiveStoreSlug();
    if (!sid || !subtotal) return undefined;
    const t = setTimeout(() => {
      previewShopDiscount(sid, subtotal, {
        customer_id: customer?.id,
        customer_token: customer?.session_token || getCustomerToken() || undefined,
      }, product?.id ? [{ product_id: String(product.id), amount: subtotal }] : null).then((d) => { if (alive) setShopDiscount(d); }).catch(() => {});
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [store?.id, store?.slug, subtotal, customer?.id, product?.id]);

  const handleApplyCoupon = async (codeArg) => {
    const codeToApply = (typeof codeArg === "string" ? codeArg : couponCode).trim();
    if (!codeToApply) return;
    try {
      setValidatingCoupon(true);
      setCouponError("");
      const resolvedStoreId = store?.id || store?.slug || getActiveStoreSlug() || "default";
      const res = await checkOrderCoupon(resolvedStoreId, codeToApply, subtotal, {
        customer_id: customer?.id,
        customer_token: customer?.session_token || getCustomerToken() || undefined,
      });
      if (res.valid) {
        setAppliedCoupon(res);
        setLoyaltyTenths(0);
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

    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          try {
            const rawLat = pos?.coords?.latitude;
            const rawLng = pos?.coords?.longitude;
            const rawAcc = pos?.coords?.accuracy;
            if (rawLat != null && rawLng != null && !isNaN(rawLat) && !isNaN(rawLng)) {
              setLatitude(parseFloat(Number(rawLat).toFixed(5)));
              setLongitude(parseFloat(Number(rawLng).toFixed(5)));
              setLocationAccuracy(rawAcc != null && !isNaN(rawAcc) ? parseFloat(Number(rawAcc).toFixed(1)) : 5);
              setGpsCaptured(true);
              setIsLocating(false);
              showToast?.("Position GPS exacte capturée avec succès !");
            } else {
              setIsLocating(false);
              showToast?.("Position imprécise. Veuillez réessayer.");
            }
          } catch (e) {
            console.error("GPS processing error:", e);
            setIsLocating(false);
          }
        },
        (err) => {
          setIsLocating(false);
          let msg = "Impossible d'obtenir la position GPS";
          if (err?.code === 1) {
            msg = "Localisation bloquée. Autorisez l'accès GPS dans les paramètres du navigateur ou cliquez sur le cadenas 🔒.";
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
      console.error("Geolocation launch error:", e);
      setIsLocating(false);
      showToast?.("Erreur lors de l'activation de la géolocalisation");
    }
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
          latitude: deliveryMode !== "ADDRESS_DESCRIPTION" && gpsCaptured ? latitude : null,
          longitude: deliveryMode !== "ADDRESS_DESCRIPTION" && gpsCaptured ? longitude : null,
          location_accuracy: locationAccuracy,
          delivery_notes: deliveryNotes,
          spot_id: selectedSpot?.id || null,
          fulfillment_type: selectedSpot ? (selectedSpot.kind === "PICKUP" ? "PICKUP" : "MEETING_POINT") : "HOME",
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
        loyalty_item_index: pointsTenths > 0 && !appliedCoupon ? 0 : null,
        loyalty_points: pointsTenths > 0 && !appliedCoupon ? pointsTenths / 10 : null,
      };

      const result = await createConversationalOrder(orderPayload);
      setCreatedOrder(result);
      if (result?.customer_token) {
        setCustomerToken(result.customer_token);
      }
      if (result?.customer && onCustomerAuthenticated) {
        onCustomerAuthenticated(result.customer);
      }
      const msg = result?._isResilient
        ? `Commande #${result?.order_number || ""} enregistrée en mode direct sécurisé !`
        : `Commande #${result?.order_number || ""} validée et transmise avec succès !`;
      showToast?.(msg);
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

    const activeName = (customer?.name || customerName || "").trim();
    if (!activeName || activeName.length < 2) {
      const msg = "Veuillez renseigner votre nom complet pour la livraison";
      setErrorMessage(msg);
      showToast?.(msg);
      return;
    }

    const activePhone = (customer?.phone || customerPhone || "").trim();
    const digits = activePhone.replace(/\D/g, "");
    if (!activePhone || digits.length < 8) {
      const msg = "Veuillez renseigner un numéro de téléphone valide (au moins 8 chiffres, ex: 65 71 17 41)";
      setErrorMessage(msg);
      showToast?.(msg);
      return;
    }

    if (!selectedSpot && deliveryMode !== "EXACT_GPS" && !deliveryAddress.trim() && !deliveryNeighborhood.trim()) {
      const msg = "Veuillez préciser votre adresse ou repère de livraison";
      setErrorMessage(msg);
      showToast?.(msg);
      return;
    }

    if (locBlocked) {
      const msg = "Votre position ne correspond pas à la ville choisie : corrigez la ville ou confirmez l'alerte.";
      setErrorMessage(msg);
      showToast?.(msg);
      return;
    }

    // MANDATORY ACCOUNT CHECK
    if (!customer) {
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
      showToast?.(err.otpRequired ? "Vérification par SMS requise : saisissez le code reçu pour continuer." : (err.message || "Erreur lors de l'activation du compte. Vérifiez vos informations."));
      setAuthModalOpen(true);
      setIsSubmitting(false);
    }
  };

  const handleRejectDirectAccount = () => {
    setAccountPromptOpen(false);
    setAuthModalOpen(true);
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
    >
      <div className="relative w-full max-w-lg max-h-[92vh] flex flex-col bg-surface border-2 border-slate-300 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden text-on-surface">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-subtle flex items-center justify-between bg-surface-elevated/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Icon name={ctx.icon} />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">
                {ctx.getOrderModalTitle(step)}
              </h3>
              <p className="text-xs text-on-surface-variant">
                {ctx.storeName} • {ctx.storeLocation}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-elevated hover:text-on-surface transition-colors cursor-pointer"
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
              <div className="p-3.5 bg-surface-elevated/50 rounded-xl border border-subtle flex items-center justify-between gap-3">
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
              <div className="p-3.5 bg-surface-elevated/40 rounded-xl border border-subtle space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <label className="block text-xs font-bold text-on-surface">
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
                      className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-elevated active:scale-95 text-base font-bold text-on-surface transition-all"
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
                      className="w-16 text-center font-bold text-sm bg-transparent focus:outline-none text-on-surface"
                    />
                    <button
                      type="button"
                      onClick={() => handleStepQuantity(1)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-elevated active:scale-95 text-base font-bold text-on-surface transition-all"
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
                      <span className="text-[11px] text-on-surface-variant mr-0.5">Choix rapide :</span>
                      {salesConfig.quickChips.map((chipVal) => (
                        <button
                          key={chipVal}
                          type="button"
                          onClick={() => setQuantity(chipVal)}
                          className={`px-2 py-0.5 rounded-lg text-xs font-semibold transition-all ${
                            quantity === chipVal
                              ? "bg-primary text-white shadow-xs"
                              : "bg-surface border border-subtle text-on-surface hover:bg-surface-elevated"
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
                  <div className="pt-2 border-t border-subtle grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-on-surface-variant mb-0.5">Largeur (mètres) :</label>
                      <input
                        type="number"
                        step="0.05"
                        placeholder="Ex: 2.50"
                        value={customWidth}
                        onChange={(e) => setCustomWidth(e.target.value)}
                        className="w-full text-xs p-2 rounded-lg bg-surface border border-subtle focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-on-surface-variant mb-0.5">Hauteur / Longueur (m) :</label>
                      <input
                        type="number"
                        step="0.05"
                        placeholder="Ex: 2.20"
                        value={customHeight}
                        onChange={(e) => setCustomHeight(e.target.value)}
                        className="w-full text-xs p-2 rounded-lg bg-surface border border-subtle focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Product Variants Selection (if present) */}
              {product?.variants && product.variants.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-on-surface">
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
                            : "border-subtle bg-surface hover:bg-surface-elevated text-on-surface"
                        }`}
                      >
                        <div className="text-xs truncate">{v.name}</div>
                        <div className="text-[11px] text-on-surface-variant">
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
                    <label className="block text-xs font-semibold text-on-surface mb-1.5">
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
                      className="w-full text-xs p-3 rounded-lg bg-surface border border-subtle focus:border-primary focus:outline-none transition-colors"
                    />
                  </div>

                  {/* FOOD PRESETS (Food stores only) */}
                  {ctx.domain === "FOOD" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="font-semibold block mb-1 text-on-surface-variant">🌶 Piment :</span>
                        <select
                          value={spiceLevel}
                          onChange={(e) => setSpiceLevel(e.target.value)}
                          className="w-full p-2 rounded-lg bg-surface border border-subtle focus:border-primary focus:outline-none text-xs"
                        >
                          <option value="Sans piment">Sans piment</option>
                          <option value="Peu de piment">Peu de piment (Doux)</option>
                          <option value="Piment moyen">Piment moyen</option>
                          <option value="Très pimenté 🔥">Très pimenté 🔥</option>
                        </select>
                      </div>

                      <div>
                        <span className="font-semibold block mb-1 text-on-surface-variant">🧅 Oignons / Condiments :</span>
                        <select
                          value={onionsChoice}
                          onChange={(e) => setOnionsChoice(e.target.value)}
                          className="w-full p-2 rounded-lg bg-surface border border-subtle focus:border-primary focus:outline-none text-xs"
                        >
                          <option value="Sans oignon">Sans oignon</option>
                          <option value="Oignons normaux">Normal</option>
                          <option value="Beaucoup d'oignons">Généreux 🧅</option>
                        </select>
                      </div>

                      <div>
                        <span className="font-semibold block mb-1 text-on-surface-variant">🔥 Cuisson :</span>
                        <select
                          value={cookingChoice}
                          onChange={(e) => setCookingChoice(e.target.value)}
                          className="w-full p-2 rounded-lg bg-surface border border-subtle focus:border-primary focus:outline-none text-xs"
                        >
                          <option value="Tendre et moelleux">Tendre & Moelleux</option>
                          <option value="Bien grillé et croustillant">Bien grillé & croustillant</option>
                        </select>
                      </div>

                      <div>
                        <span className="font-semibold block mb-1 text-on-surface-variant">🍚 Accompagnement :</span>
                        <select
                          value={portionsChoice}
                          onChange={(e) => setPortionsChoice(e.target.value)}
                          className="w-full p-2 rounded-lg bg-surface border border-subtle focus:border-primary focus:outline-none text-xs"
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
                        <span className="font-semibold block mb-1 text-on-surface-variant">📏 Taille & Mensurations :</span>
                        <select
                          value={sizeMeasure}
                          onChange={(e) => setSizeMeasure(e.target.value)}
                          className="w-full p-2 rounded-lg bg-surface border border-subtle focus:border-primary focus:outline-none text-xs"
                        >
                          <option value="Standard M / L">Standard M / L</option>
                          <option value="Taille S (Ajustée)">Taille S (Ajustée)</option>
                          <option value="Taille XL (Ample)">Taille XL (Ample)</option>
                          <option value="Sur mesure (selon message)">Sur mesure (décrit ci-dessus)</option>
                        </select>
                      </div>

                      <div>
                        <span className="font-semibold block mb-1 text-on-surface-variant">✂️ Finitions :</span>
                        <select
                          value={finishingChoice}
                          onChange={(e) => setFinishingChoice(e.target.value)}
                          className="w-full p-2 rounded-lg bg-surface border border-subtle focus:border-primary focus:outline-none text-xs"
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

              {/* Lieux de retrait / livraison du commerçant */}
              {spots.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-on-surface">
                    Retrait ou point de livraison du commerçant :
                  </label>
                  <div className="space-y-2">
                    {spots.map((s) => {
                      const on = s.id === spotId;
                      const imgs = s.images || [];
                      const shown = imgs[spotImg[s.id] || 0];
                      return (
                        <div key={s.id} className={`rounded-xl border p-2.5 transition-all ${on ? "border-primary bg-primary/10" : "border-subtle bg-surface-elevated"}`}>
                          <div className="flex gap-2.5">
                            {shown && <img src={shown} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />}
                            <div className="min-w-0 flex-1 text-xs">
                              <p className="font-bold text-on-surface">
                                {s.name}
                                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                                  {s.kind === "PICKUP" ? "Retrait gratuit" : `Livraison • ${s.delivery_fee == null ? "tarif zone" : `${Number(s.delivery_fee).toLocaleString()} ${store?.currency || "FCFA"}`}`}
                                </span>
                              </p>
                              {(s.city || s.address) && <p className="text-on-surface-variant">{[s.city, s.address].filter(Boolean).join(" • ")}</p>}
                              {s.hours && <p className="text-on-surface-variant">🕒 {s.hours}</p>}
                              {s.description && <p className="text-on-surface-variant">{s.description}</p>}
                            </div>
                          </div>
                          {imgs.length > 1 && (
                            <div className="flex gap-1.5 mt-2 overflow-x-auto">
                              {imgs.map((u, i) => (
                                <img key={i} src={u} alt="" onClick={() => setSpotImg({ ...spotImg, [s.id]: i })}
                                  className={`w-10 h-10 rounded object-cover cursor-pointer ${(spotImg[s.id] || 0) === i ? "ring-2 ring-primary" : "opacity-70"}`} />
                              ))}
                            </div>
                          )}
                          <button type="button" onClick={() => setSpotId(on ? null : s.id)}
                            className={`mt-2 w-full py-2 rounded-lg text-xs font-bold ${on ? "bg-primary text-white" : "bg-surface border border-subtle text-on-surface"}`}>
                            {on ? "✓ Lieu choisi — Annuler" : s.kind === "PICKUP" ? "Retirer ma commande ici" : "Rejoindre la livraison ici"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {!selectedSpot && <p className="text-[11px] text-on-surface-variant">Ou choisissez la livraison à domicile ci-dessous.</p>}
                </div>
              )}

              {/* Delivery Mode & Location Section */}
              {!selectedSpot && (
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-on-surface">
                  Mode de localisation & livraison :
                </label>

                {/* Delivery Mode Selector */}
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-surface-elevated rounded-xl border border-subtle text-xs">
                  <button
                    type="button"
                    onClick={() => setDeliveryMode("EXACT_GPS")}
                    className={`py-2 px-1 rounded-lg text-center font-medium transition-all ${
                      deliveryMode === "EXACT_GPS"
                        ? "bg-primary text-white shadow-sm"
                        : "text-on-surface-variant hover:text-on-surface"
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
                        : "text-on-surface-variant hover:text-on-surface"
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
                        : "text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    GPS + Adresse ⭐
                  </button>
                </div>

                {/* GPS Capture sub-card */}
                {(deliveryMode === "EXACT_GPS" || deliveryMode === "GPS_AND_DESCRIPTION") && (
                  <div className="p-3 bg-surface-elevated/40 rounded-xl border border-subtle flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-on-surface flex items-center gap-1">
                        <Icon name="my_location" className="text-sm text-primary" />
                        <span>Coordonnées GPS exactes</span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant truncate">
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
                {locCheck && (locCheck.status === "MISMATCH" || locCheck.status === "OUT_OF_ZONE") && (
                  <div className="p-3 rounded-xl border border-red-400/40 bg-red-500/10 text-xs space-y-2" role="alert">
                    <p className="font-bold text-red-300">⚠️ Position et ville de livraison incohérentes</p>
                    <p className="text-on-surface">{locCheck.message || "Votre position actuelle semble distante de la ville choisie."}</p>
                    {locCheck.nearest && typeof locCheck.nearest === "object" && (locCheck.nearest.name || locCheck.nearest.display_label) && (
                      <button type="button" onClick={() => setDeliveryCity(locCheck.nearest.name || locCheck.nearest.display_label)}
                        className="w-full py-2 rounded-lg bg-primary text-white font-bold cursor-pointer transition-transform active:scale-[0.99]">
                        Passer à « {locCheck.nearest.display_label || locCheck.nearest.name} » {locCheck.nearest.distance_km != null ? `(${locCheck.nearest.distance_km} km)` : ""}
                      </button>
                    )}
                    <label className="flex items-start gap-2 text-on-surface-variant cursor-pointer">
                      <input type="checkbox" checked={locAck} onChange={(e) => setLocAck(e.target.checked)} className="mt-0.5" />
                      <span>Je confirme cette adresse malgré l'écart (le commerçant sera alerté).</span>
                    </label>
                  </div>
                )}
                {locCheck?.status === "UNVERIFIABLE" && (
                  <p className="text-[11px] text-on-surface-variant">La zone choisie n'a pas de GPS : votre position ne peut pas être vérifiée.</p>
                )}

                {(deliveryMode === "ADDRESS_DESCRIPTION" || deliveryMode === "GPS_AND_DESCRIPTION") && (
                  <div>
                    <label className="block text-[11px] font-medium text-on-surface-variant mb-1">
                      Repère et description d'accès (Bâtiment, porte, carrefour) :
                    </label>
                    <textarea
                      rows={2}
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Ex: Porte bleue à côté de la pharmacie, 1er étage..."
                      className="w-full text-xs p-2.5 rounded-lg bg-surface border border-subtle focus:border-primary focus:outline-none"
                    />
                  </div>
                )}
              </div>
              )}

              {/* CUSTOMER 5 MANDATORY FIELDS (Checkout Onboarding) */}
              <div className="p-4 bg-surface-elevated/40 rounded-xl border border-subtle space-y-3">
                <div className="flex items-center gap-2 text-on-surface font-bold text-xs pb-1 border-b border-subtle">
                  <Icon name="person" className="text-primary text-base" />
                  <span>Vos coordonnées de commande & livraison</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* 1. Nom & Prénom */}
                  <div>
                    <label className="block text-[11px] font-medium text-on-surface-variant mb-1">
                      1. Nom & Prénom <span className="text-primary">*</span>
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-lg bg-surface border border-subtle focus:border-primary focus:outline-none"
                      placeholder="Ex: Ousmane Ouédraogo"
                      required
                    />
                  </div>

                  {/* 2. Pays */}
                  <div>
                    <label className="block text-[11px] font-medium text-on-surface-variant mb-1">
                      2. Pays
                    </label>
                    <input
                      type="text"
                      value={customerCountry}
                      onChange={(e) => setCustomerCountry(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-lg bg-surface border border-subtle focus:border-primary focus:outline-none"
                      placeholder="Ex: Burkina Faso, Côte d'Ivoire..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* 3. Téléphone / WhatsApp */}
                  <div>
                    <label className="block text-[11px] font-medium text-on-surface-variant mb-1">
                      3. Téléphone (WhatsApp direct) <span className="text-primary">*</span>
                    </label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-lg bg-surface border border-subtle focus:border-primary focus:outline-none"
                      placeholder="Ex: +226 70 00 00 00"
                      required
                    />
                  </div>

                  {/* 4. Ville Principale */}
                  <div>
                    <label className="block text-[11px] font-medium text-on-surface-variant mb-1">
                      4. Ville Principale
                    </label>
                    <input
                      type="text"
                      value={customerCity}
                      onChange={(e) => {
                        setCustomerCity(e.target.value);
                        setDeliveryCity(e.target.value);
                      }}
                      className="w-full text-xs p-2.5 rounded-lg bg-surface border border-subtle focus:border-primary focus:outline-none"
                      placeholder="Ex: Ouagadougou, Bobo-Dioulasso, Abidjan..."
                      list="store-delivery-cities"
                    />
                    <datalist id="store-delivery-cities">
                      {cities.map((c) => <option key={c.id} value={c.name} />)}
                    </datalist>
                  </div>
                </div>

                {/* 5. Quartier / Repère de livraison */}
                <div>
                  <label className="block text-[11px] font-medium text-on-surface-variant mb-1">
                    5. Quartier / Repère de livraison précis
                  </label>
                  <input
                    type="text"
                    value={deliveryNeighborhood}
                    onChange={(e) => setDeliveryNeighborhood(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg bg-surface border border-subtle focus:border-primary focus:outline-none"
                    placeholder="Ex: Secteur 12, pharmacie en face, portail vert"
                  />
                </div>

                {/* Seamless Account Creation Checkbox */}
                {!customer && (
                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-primary/5 border border-primary/20 text-xs text-on-surface cursor-pointer hover:bg-primary/10 transition-colors">
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

              {/* Points fidélité : 1 pt = 1 % sur ce produit */}
              {isLoggedIn && loyaltySummary && maxTenths > 0 && (
                <div className="p-3 bg-surface-elevated/50 rounded-xl border border-subtle space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-on-surface flex items-center gap-1.5">
                      <Icon name="redeem" className="text-[15px] text-primary" />
                      <span>Utiliser mes points sur ce produit</span>
                    </span>
                    <span className="text-[11px] text-on-surface-variant">Solde : {fmtPt(Math.round(loyaltySummary.balance * 10))} pt</span>
                  </div>
                  {appliedCoupon ? (
                    <p className="text-[11px] text-on-surface-variant">Retirez le coupon pour utiliser vos points : les deux ne se cumulent pas.</p>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setLoyaltyTenths((t) => Math.max(0, t - 1))} disabled={loyaltyTenths <= 0}
                          className="w-9 h-9 rounded-lg border border-subtle font-bold text-on-surface disabled:opacity-40 cursor-pointer">−</button>
                        <div className="flex-1 text-center">
                          <span className="text-base font-bold text-on-surface tabular-nums">{fmtPt(loyaltyTenths)} pt</span>
                          <span className="block text-[10px] text-on-surface-variant">= {fmtPt(loyaltyTenths)} % du prix du produit</span>
                        </div>
                        <button type="button" onClick={() => setLoyaltyTenths((t) => Math.min(maxTenths, t + 1))} disabled={loyaltyTenths >= maxTenths}
                          className="w-9 h-9 rounded-lg border border-subtle font-bold text-on-surface disabled:opacity-40 cursor-pointer">+</button>
                        <button type="button" onClick={() => setLoyaltyTenths(maxTenths)}
                          className="px-2.5 h-9 rounded-lg bg-primary/10 text-primary border border-primary/20 text-[11px] font-bold cursor-pointer">Max</button>
                      </div>
                      <input type="range" min={0} max={maxTenths} step={1} value={loyaltyTenths}
                        onChange={(e) => setLoyaltyTenths(parseInt(e.target.value, 10) || 0)} className="w-full accent-primary" />
                      {loyaltyTenths > 0 && pointsDiscount > 0 && (
                        <p className="text-[11px] text-emerald-400 font-semibold">
                          ✓ -{pointsDiscount.toLocaleString()} {store?.currency || "FCFA"} sur une unité de « {product?.name} »
                          {quantity > 1 ? " (les autres unités restent au prix normal)" : ""}
                        </p>
                      )}
                      {loyaltyTenths > 0 && pointsDiscount <= 0 && (
                        <p className="text-[11px] text-rose-400">Ces points n'apportent aucune remise sur ce produit.</p>
                      )}
                      <p className="text-[10px] text-on-surface-variant">Maximum {fmtPt(maxTenths)} pt par utilisation. Les points sont rendus si la commande est annulée ou rejetée.</p>
                    </>
                  )}
                </div>
              )}

              {/* Remise boutique automatique */}
              {shopDiscount?.applicable && shopDiscountAmount > 0 && (
                <div className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${useShopDiscount ? "bg-emerald-500/10 border-emerald-500/30" : "bg-surface-elevated/50 border-subtle opacity-70"}`}>
                  <span className="font-semibold text-on-surface flex items-center gap-1.5">
                    <Icon name="sell" className="text-[15px] text-emerald-400" />
                    <span>{shopDiscount.name} : -{shopDiscount.percent}%</span>
                  </span>
                  <span className={useShopDiscount ? "font-bold text-emerald-400" : "text-on-surface-variant"}>
                    {useShopDiscount ? `-${shopDiscountAmount.toLocaleString()} ${store?.currency || "FCFA"}` : "Votre coupon est plus avantageux"}
                  </span>
                </div>
              )}

              {/* Promo Code / Coupon Section */}
              <div className="p-3 bg-surface-elevated/50 rounded-xl border border-subtle space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-on-surface flex items-center gap-1.5">
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
                        <p className="text-[10px] text-on-surface-variant">{appliedCoupon.title}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAppliedCoupon(null);
                        setCouponCode("");
                      }}
                      className="text-[11px] text-on-surface-variant hover:text-rose-400 underline cursor-pointer"
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
                      className="flex-1 h-9 px-3 rounded-lg bg-surface border border-subtle text-xs uppercase font-mono tracking-wider focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      disabled={!couponCode.trim() || validatingCoupon || loyaltyTenths > 0}
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
                {!appliedCoupon && myCoupons.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-semibold text-on-surface-variant">Mes bons disponibles</p>
                    <div className="flex flex-wrap gap-1.5">
                      {myCoupons.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          disabled={loyaltyTenths > 0 || validatingCoupon}
                          onClick={() => { setCouponCode(c.code); handleApplyCoupon(c.code); }}
                          className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20 text-[11px] font-mono font-bold disabled:opacity-40 cursor-pointer"
                        >
                          {c.code} · {c.discount_percent > 0 ? `-${c.discount_percent}%` : `-${Number(c.discount_amount).toLocaleString("fr-FR")} F`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {loyaltyTenths > 0 && !appliedCoupon && (
                  <p className="text-[10px] text-on-surface-variant">Vous utilisez vos points : remettez-les à 0 pour appliquer un coupon (les deux ne se cumulent pas).</p>
                )}
                {couponError && <p className="text-[11px] text-rose-400">{couponError}</p>}
              </div>

              {/* Order Breakdown / Totals */}
              <div className="p-3.5 bg-surface-elevated/70 rounded-xl border border-subtle space-y-1.5 text-xs">
                <div className="flex justify-between text-on-surface-variant">
                  <span className="truncate pr-2">
                    {product?.name} ({formatSalesQuantity(quantity, salesConfig.unitLabel, salesConfig.precision)})
                  </span>
                  <span className="font-semibold text-on-surface whitespace-nowrap">{subtotal.toLocaleString()} {store?.currency || "FCFA"}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-400 font-semibold">
                    <span>
                      Remises ({[
                        useShopDiscount ? `${shopDiscount.name} -${shopDiscount.percent}%` : appliedCoupon?.code,
                        pointsTenths > 0 && pointsDiscount > 0 ? `${fmtPt(pointsTenths)} pt` : null,
                      ].filter(Boolean).join(" + ") || "Fidélité"})
                    </span>
                    <span>-{discountAmount.toLocaleString()} {store?.currency || "FCFA"}</span>
                  </div>
                )}
                <div className="flex justify-between text-on-surface-variant">
                  <span>{selectedSpot ? (selectedSpot.kind === "PICKUP" ? "Retrait sur place" : `Livraison — ${selectedSpot.name}`) : `Frais de livraison (${deliveryCity})`}</span>
                  <span className="font-semibold text-on-surface">{deliveryFee.toLocaleString()} {store?.currency || "FCFA"}</span>
                </div>
                <div className="border-t border-subtle pt-1.5 flex justify-between font-bold text-sm text-on-surface">
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
                <p className="text-xs text-on-surface-variant max-w-sm mx-auto mt-1">
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
                  <span className="text-on-surface-variant">Total :</span>
                  <span className="font-bold text-primary">{createdOrder?.total_amount?.toLocaleString()} {createdOrder?.currency}</span>
                </div>
                {createdOrder?.items && createdOrder.items.length > 0 && (
                  <div className="text-on-surface-variant border-t border-slate-200 dark:border-slate-700/60 pt-1.5">
                    <span>Détails : </span>
                    <span className="text-on-surface font-medium">
                      {createdOrder.items.map((it) => `${it.product_name} • ${formatSalesQuantity(it.quantity, it.unit_label)}`).join(", ")}
                    </span>
                  </div>
                )}
                <div className="text-on-surface-variant">
                  <span>Livraison : </span>
                  <span className="text-on-surface font-medium">{createdOrder?.delivery?.delivery_address}</span>
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
                className="flex-1 py-2.5 px-4 text-xs font-semibold rounded-xl border border-subtle hover:bg-surface-elevated transition-colors"
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
                className="flex-1 py-3 px-4 text-xs font-semibold rounded-xl border border-subtle hover:bg-surface-elevated text-on-surface transition-colors cursor-pointer"
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
                  <span>{selectedSpot ? `${selectedSpot.kind === "PICKUP" ? "Retrait" : "Livraison"} : ${selectedSpot.name}${selectedSpot.hours ? ` (${selectedSpot.hours})` : ""}` : `${deliveryCity} ${deliveryAddress ? `(${deliveryAddress})` : ""}`}</span>
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
