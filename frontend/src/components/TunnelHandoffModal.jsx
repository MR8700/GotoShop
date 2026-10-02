import Icon from "./Icon";
import React, { useState, useEffect } from "react";
import {
  getMediaUrl,
  createConversationalOrder,
  cancelConversationalOrder,
  saveLocalGuestOrder,
  getCustomerToken,
  setCustomerToken,
  customerQuickRegister,
} from "../api/client";
import { sendNativeNotification, requestNotificationPermission } from "../utils/nativeNotifications";
import CustomerAuthModal from "./CustomerAuthModal";

export default function TunnelHandoffModal({
  store,
  cart = [],
  product = null,
  customer,
  onUpdateCartQuantity,
  onRemoveFromCart,
  onUpdateCartCustomization,
  onClearCart,
  onClose,
  showToast,
  onOrderCreated,
  onOpenCustomerAuth,
  onCustomerAuthenticated,
  onNavigateToOrders,
  onOpenChat,
}) {
  // If cart is empty but single product passed, construct an editable working items array
  const [items, setItems] = useState(() => {
    if (cart && cart.length > 0) {
      return cart.map((c) => ({
        id: c.id || c.product_id,
        product_id: c.product_id || c.id,
        name: c.name || "Article",
        unit_price: Number(c.price) || 0,
        quantity: Number(c.quantity) || 1,
        unit: c.unit || "PIECE",
        unit_label: c.unit_label || "pièce",
        primary_image_url: c.primary_image_url || null,
        selected_color: c.selected_color || (c.variants && c.variants[0]?.name) || "Standard",
        customization_text: c.customization_text || "",
      }));
    }
    if (product) {
      return [
        {
          id: product.id,
          product_id: product.id,
          name: product.name,
          unit_price: Number(product.price) || 0,
          quantity: 1,
          unit: product.sales_unit || "PIECE",
          unit_label: product.sales_unit_label || "pièce",
          primary_image_url: product.primary_image_url || null,
          selected_color: (product.variants && product.variants[0]?.name) || "Standard",
          customization_text: "",
        },
      ];
    }
    return [];
  });

  // Delivery & location state
  const cities = store?.delivery_cities?.length
    ? store.delivery_cities
    : [
        { id: "1", name: "Ouagadougou", display_label: "Ouagadougou" },
        { id: "2", name: "Bobo-Dioulasso", display_label: "Bobo-Dioulasso" },
        { id: "3", name: "Koudougou", display_label: "Koudougou" },
        { id: "4", name: "Autre Ville", display_label: "Autre Ville" },
      ];

  const [selectedCity, setSelectedCity] = useState(
    customer?.city || store?.city || "Ouagadougou"
  );
  const [customLocality, setCustomLocality] = useState(
    customer?.delivery_address || customer?.delivery_neighborhood || ""
  );
  const [deliveryNotes, setDeliveryNotes] = useState("");

  // Customer contact info
  const [customerName, setCustomerName] = useState(customer?.name || "");
  const [customerPhone, setCustomerPhone] = useState(customer?.phone || "");

  // GPS Location state
  const [wantSendGps, setWantSendGps] = useState(Boolean(customer?.gps_coordinates));
  const [isLocating, setIsLocating] = useState(false);
  const [latitude, setLatitude] = useState(
    customer?.gps_coordinates ? parseFloat(customer.gps_coordinates.split(",")[0]) : null
  );
  const [longitude, setLongitude] = useState(
    customer?.gps_coordinates ? parseFloat(customer.gps_coordinates.split(",")[1]) : null
  );
  const [locationAccuracy, setLocationAccuracy] = useState(null);

  // Submission & Post-order state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancellingOrder, setIsCancellingOrder] = useState(false);
  const [createdOrder, setCreatedOrder] = useState(null);

  // Compulsory customer authentication state before ordering
  const [accountPromptOpen, setAccountPromptOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Synchronize internal items with cart when cart prop changes externally
  useEffect(() => {
    if (cart && cart.length > 0 && !createdOrder) {
      setItems(
        cart.map((c) => ({
          id: c.id || c.product_id,
          product_id: c.product_id || c.id,
          name: c.name || "Article",
          unit_price: Number(c.price) || 0,
          quantity: Number(c.quantity) || 1,
          unit: c.unit || "PIECE",
          unit_label: c.unit_label || "pièce",
          primary_image_url: c.primary_image_url || null,
          selected_color: c.selected_color || (c.variants && c.variants[0]?.name) || "Standard",
          customization_text: c.customization_text || "",
        }))
      );
    }
  }, [cart]);

  // Request native notification permission on mount
  useEffect(() => {
    requestNotificationPermission().catch(() => {});
  }, []);

  // Sync customer prop with local form fields
  useEffect(() => {
    if (customer?.name) setCustomerName(customer.name);
    if (customer?.phone) setCustomerPhone(customer.phone);
    if (customer?.city) setSelectedCity(customer.city);
    if (customer?.delivery_address || customer?.delivery_neighborhood) {
      setCustomLocality(customer.delivery_address || customer.delivery_neighborhood);
    }
  }, [customer]);

  const handleUpdateItemQuantity = (index, delta) => {
    setItems((prev) => {
      const updated = [...prev];
      const target = updated[index];
      const nextQty = Math.max(1, target.quantity + delta);
      updated[index] = { ...target, quantity: nextQty };
      return updated;
    });
    const item = items[index];
    if (item && onUpdateCartQuantity) {
      onUpdateCartQuantity(item.id, delta);
    }
  };

  const handleRemoveItem = (index) => {
    const item = items[index];
    if (item && onRemoveFromCart) {
      onRemoveFromCart(item.id);
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
    showToast?.("Article retiré du panier");
  };

  const handleUpdateCustomization = (index, text) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], customization_text: text };
      return updated;
    });
    const item = items[index];
    if (item && onUpdateCartCustomization) {
      onUpdateCartCustomization(item.id, text);
    }
  };

  const handleCancelCartDirectly = () => {
    if (window.confirm("Êtes-vous sûr de vouloir vider et annuler votre panier ?")) {
      if (onClearCart) onClearCart();
      setItems([]);
      showToast?.("Panier vidé et annulé");
      onClose?.();
    }
  };

  const handleCaptureLocation = () => {
    if (!navigator.geolocation) {
      showToast?.("La géolocalisation n'est pas supportée par votre appareil");
      return;
    }
    setIsLocating(true);
    showToast?.("Recherche de votre position GPS exacte...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = parseFloat(position.coords.latitude.toFixed(5));
        const lng = parseFloat(position.coords.longitude.toFixed(5));
        const acc = parseFloat(position.coords.accuracy.toFixed(1));
        setLatitude(lat);
        setLongitude(lng);
        setLocationAccuracy(acc);
        setWantSendGps(true);
        setIsLocating(false);
        showToast?.("Position GPS capturée avec succès !");
      },
      (error) => {
        setIsLocating(false);
        let errorMsg = "Impossible d'obtenir la position GPS";
        if (error.code === 1) errorMsg = "Veuillez autoriser l'accès GPS pour partager votre position";
        else if (error.code === 2) errorMsg = "Signal GPS indisponible";
        else if (error.code === 3) errorMsg = "Délai GPS dépassé";
        showToast?.(errorMsg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleClearLocation = () => {
    setLatitude(null);
    setLongitude(null);
    setLocationAccuracy(null);
    setWantSendGps(false);
    showToast?.("Position GPS retirée");
  };

  // Pricing calculations
  const subtotal = items.reduce((sum, it) => sum + it.unit_price * it.quantity, 0);
  const wantedCity = String(selectedCity || "").trim().toLowerCase();
  const cityFee = cities.find(
    (c) => c.delivery_fee != null && [c.name, c.display_label].some((n) => String(n || "").trim().toLowerCase() === wantedCity)
  )?.delivery_fee;
  const deliveryFee = cityFee ?? (store?.delivery_fee !== undefined ? store.delivery_fee : 500);
  const totalAmount = subtotal + deliveryFee;
  const currency = store?.currency || "FCFA";

  // Execute order submission with authenticated customer
  const executeOrderSubmission = async (activeCustomer = null, activeToken = null) => {
    setIsSubmitting(true);
    showToast?.("Validation de votre commande sur GotoShop...");

    try {
      const resolvedStoreId = store?.id || store?.slug || "faso-danfani";
      const resolvedStoreSlug = store?.slug || (typeof store?.id === "string" && !store.id.startsWith("store-") ? store.id : "faso-danfani");
      const resolvedStoreName = store?.name || "Faso Danfani & Élégance";
      const targetCustomer = activeCustomer || customer;
      const targetToken = activeToken || (targetCustomer && targetCustomer.session_token) || getCustomerToken();

      const payload = {
        store_id: resolvedStoreId,
        store_slug: resolvedStoreSlug,
        store_name: resolvedStoreName,
        items: items.map((it) => ({
          product_id: it.product_id || it.id,
          product_name: it.name || it.product_name || "Produit",
          quantity: Number(it.quantity) || 1,
          unit_price: it.unit_price !== undefined ? Number(it.unit_price) : (Number(it.price) || 0),
          unit: it.unit || "PIECE",
          unit_label: it.unit_label || "pièce",
          variant_name: it.selected_color || it.variant_name || null,
          customization_text: it.customization_text || null,
        })),
        delivery: {
          delivery_mode: wantSendGps && latitude && longitude ? "GPS_AND_DESCRIPTION" : "ADDRESS_DESCRIPTION",
          delivery_city: selectedCity,
          delivery_address: customLocality || selectedCity,
          latitude: wantSendGps && latitude ? latitude : null,
          longitude: wantSendGps && longitude ? longitude : null,
          location_accuracy: wantSendGps ? locationAccuracy : null,
          delivery_notes: deliveryNotes || null,
        },
        customer_name: targetCustomer?.name || customerName.trim() || "Client GotoShop",
        customer_phone: targetCustomer?.phone || customerPhone.trim() || null,
        customer_id: targetCustomer?.id && !targetCustomer.id.startsWith("cust-local-") ? targetCustomer.id : null,
        customer_token: targetToken,
        delivery_fee: deliveryFee,
        notes: deliveryNotes || null,
        city: selectedCity,
        delivery_neighborhood: customLocality || null,
        register_account: true,
      };

      const orderResult = await createConversationalOrder(payload);

      if (orderResult.customer_token) {
        setCustomerToken(orderResult.customer_token);
      }
      if (orderResult.customer && onCustomerAuthenticated) {
        onCustomerAuthenticated(orderResult.customer);
      }

      // Persist in local guest orders for offline tracking
      saveLocalGuestOrder({
        id: orderResult.id,
        order_number: orderResult.order_number || orderResult.reference_code,
        reference_code: orderResult.order_number || orderResult.reference_code,
        store_id: orderResult.store_id || resolvedStoreId,
        store_slug: orderResult.store_slug || resolvedStoreSlug,
        store_name: orderResult.store_name || resolvedStoreName,
        product_name: items.map((it) => it.name).join(", "),
        product_image_url: items[0]?.primary_image_url || null,
        items: items,
        quantity: items.reduce((acc, it) => acc + it.quantity, 0),
        delivery_city: selectedCity,
        total_amount: orderResult.total_amount || totalAmount,
        currency: currency,
        status: orderResult.status || "PENDING_SELLER_ACCEPTANCE",
        client_status: "PENDING",
        conversation_id: orderResult.conversation_id,
        access_token: orderResult.access_token || null, // preuve de propriété pour annuler / archiver cette commande
        created_at: orderResult.created_at || new Date().toISOString(),
      });

      // Clear the local cart
      if (onClearCart) onClearCart();

      // Trigger native notification on device (status bar / lock screen)
      sendNativeNotification(`📦 Commande #${orderResult.order_number} en attente`, {
        body: `Votre commande de ${orderResult.total_amount?.toLocaleString("fr-FR")} ${currency} a été transmise à ${store?.name || "la boutique"}.`,
        tag: `order-${orderResult.id}`,
        url: window.location.origin,
      });

      const successMessage = orderResult._isResilient
        ? `Commande #${orderResult.order_number} enregistrée en mode direct sécurisé ! Redirection...`
        : `Commande #${orderResult.order_number} validée et transmise avec succès ! Redirection...`;
      showToast?.(successMessage);
      if (onOrderCreated) onOrderCreated(orderResult);
      if (onNavigateToOrders) onNavigateToOrders();
      onClose?.();
    } catch (err) {
      showToast?.(err.message || "Erreur lors de la validation de la commande");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle direct order creation on GotoShop (100% on platform, with mandatory field controls)
  const handleConfirmOrder = async () => {
    if (items.length === 0) {
      showToast?.("Votre panier est vide. Ajoutez au moins un article.");
      return;
    }

    const trimmedName = (customer?.name || customerName || "").trim();
    const trimmedPhone = (customer?.phone || customerPhone || "").trim();
    const digits = trimmedPhone.replace(/\D/g, "");

    // Validation of mandatory delivery fields
    if (!trimmedName || trimmedName.length < 2) {
      showToast?.("Veuillez renseigner votre nom complet pour la livraison.");
      return;
    }

    if (!trimmedPhone || digits.length < 8) {
      showToast?.("Veuillez renseigner un numéro de téléphone valide (au moins 8 chiffres, ex: 65 71 17 41).");
      return;
    }

    if (!selectedCity?.trim()) {
      showToast?.("Veuillez sélectionner votre ville de livraison.");
      return;
    }

    // MANDATORY ACCOUNT CHECK:
    // If not authenticated, activate account or suggest prompt
    if (!customer) {
      setAccountPromptOpen(true);
      return;
    }

    // Already authenticated: proceed directly
    await executeOrderSubmission(customer);
  };

  const handleAcceptDirectAccount = async () => {
    setAccountPromptOpen(false);
    setIsSubmitting(true);
    try {
      showToast?.("Activation de votre compte client...");
      const fullCity = customLocality?.trim() ? `${selectedCity} (${customLocality.trim()})` : selectedCity;
      const res = await customerQuickRegister({
        name: customerName.trim(),
        phone: customerPhone.trim(),
        city: fullCity,
        country: store?.country || "Burkina Faso",
        locality: customLocality?.trim() || "",
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

  // Handle direct pending order cancellation
  const handleCancelPendingOrder = async () => {
    if (!createdOrder) return;
    if (!window.confirm("Êtes-vous sûr de vouloir annuler cette commande ?")) return;

    setIsCancellingOrder(true);
    showToast?.("Annulation de la commande en cours...");
    try {
      const targetId = createdOrder.id || createdOrder.order_number || createdOrder.reference_code;
      const res = await cancelConversationalOrder(targetId, "Annulé par le client directement", "Client", {
        customer_token: createdOrder.access_token || getCustomerToken() || undefined,
        customer_id: createdOrder.customer?.id,
      });
      setCreatedOrder((prev) => ({ ...prev, ...res, status: "CANCELLED" }));
      showToast?.(`Commande #${res.order_number || targetId} annulée avec succès.`);

      sendNativeNotification(`❌ Commande #${res.order_number || targetId} annulée`, {
        body: `Votre commande a bien été annulée.`,
        tag: `order-cancel-${targetId}`,
      });
    } catch (err) {
      showToast?.(err.message || "Erreur lors de l'annulation de la commande");
    } finally {
      setIsCancellingOrder(false);
    }
  };

  // =========================================================================
  // VIEW: ORDER SUCCESS / PENDING STATUS
  // =========================================================================
  if (createdOrder) {
    const isCancelled = createdOrder.status === "CANCELLED";
    const isAccepted = createdOrder.status === "ACCEPTED";
    const isPending = createdOrder.status === "PENDING_SELLER_ACCEPTANCE";

    return (
      <div className="flex flex-col w-full max-w-lg mx-auto pb-safe space-y-4 pt-4 pb-24 text-center animate-fade-in">
        {/* Status Icon */}
        <div
          className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center border shadow-sm ${
            isCancelled
              ? "bg-rose-500/15 text-rose-500 border-rose-500/30"
              : isAccepted
              ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
              : "bg-amber-500/15 text-amber-500 border-amber-500/30 animate-pulse"
          }`}
        >
          <Icon
            name={isCancelled ? "cancel" : isAccepted ? "check_circle" : "hourglass_top"}
            className="text-[34px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          />
        </div>

        {/* Title & Status */}
        <div className="space-y-1.5 px-4">
          <span className="font-mono text-xs font-bold text-on-surface-variant bg-surface-secondary px-3 py-1 rounded-full border border-subtle">
            COMMANDE #{createdOrder.order_number}
          </span>
          <h2 className="text-xl font-bold text-on-surface pt-1 tracking-tight">
            {isCancelled
              ? "Commande Annulée"
              : isAccepted
              ? "Commande Acceptée par le Vendeur !"
              : "Commande en attente de validation"}
          </h2>
          <p className="text-xs text-on-surface-variant max-w-xs mx-auto leading-relaxed">
            {isCancelled
              ? "Cette commande a été annulée. Aucun prélèvement ne sera effectué."
              : isAccepted
              ? "Le vendeur a validé votre commande. Vous pouvez échanger directement dans la messagerie intégrée."
              : `Votre commande a été transmise à ${store?.name || "la boutique"}. Vous recevrez une alerte dès son acceptation.`}
          </p>
        </div>

        {/* Items Summary in Post-Order Screen */}
        <div className="rounded-2xl bg-surface-card p-4 text-left border border-subtle shadow-card space-y-3 mx-2">
          <div className="flex items-center justify-between border-b border-subtle pb-2">
            <span className="text-xs font-bold text-on-surface uppercase tracking-wide">
              Détails des articles ({items.length})
            </span>
            <span className="text-xs font-bold text-primary">
              {createdOrder.total_amount?.toLocaleString("fr-FR")} {currency}
            </span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {items.map((it, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-subtle/50 last:border-0">
                <div className="min-w-0 flex-1 pr-2">
                  <p className="font-semibold text-on-surface truncate">{it.name}</p>
                  <p className="text-[11px] text-on-surface-variant">
                    {it.quantity} {it.unit_label} × {it.unit_price?.toLocaleString("fr-FR")} {currency}
                    {it.customization_text && (
                      <span className="block text-primary text-[10px] italic">
                        Note: {it.customization_text}
                      </span>
                    )}
                  </p>
                </div>
                <span className="font-bold text-on-surface shrink-0">
                  {(it.quantity * it.unit_price).toLocaleString("fr-FR")} {currency}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-subtle flex items-center justify-between text-xs text-on-surface-variant">
            <span>Mode de règlement :</span>
            <span className="font-semibold text-on-surface">Paiement direct sur GotoShop</span>
          </div>
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span>Destination de livraison :</span>
            <span className="font-semibold text-on-surface">{selectedCity} {customLocality ? `(${customLocality})` : ""}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5 px-3 pt-1">
          {createdOrder.conversation_id && (
            <button
              type="button"
              onClick={() => {
                if (onOpenChat) onOpenChat(createdOrder.conversation_id);
                onClose?.();
              }}
              className="w-full h-11 rounded-xl bg-primary hover:brightness-105 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Icon name="forum" className="text-[18px]" />
              <span>Ouvrir la discussion avec le vendeur</span>
            </button>
          )}

          {/* Direct Cancel Button while Pending */}
          {isPending && (
            <button
              type="button"
              disabled={isCancellingOrder}
              onClick={handleCancelPendingOrder}
              className="w-full h-10 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-xs font-bold flex items-center justify-center gap-2 border border-rose-500/30 transition-all cursor-pointer"
            >
              <Icon name="close" className="text-[16px]" />
              <span>{isCancellingOrder ? "Annulation en cours..." : "Annuler directement cette commande"}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (onNavigateToOrders) onNavigateToOrders();
              onClose?.();
            }}
            className="w-full h-10 rounded-xl bg-surface-secondary hover:bg-surface-elevated text-on-surface text-xs font-semibold flex items-center justify-center gap-2 border border-subtle transition-colors cursor-pointer"
          >
            <Icon name="receipt_long" className="text-[16px]" />
            <span>Suivre mes commandes</span>
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

  // =========================================================================
  // VIEW: EDIT & VALIDATE MULTI-PRODUCT CART TUNNEL
  // =========================================================================
  return (
    <div className="flex flex-col w-full max-w-lg mx-auto pb-safe space-y-4 pt-2 pb-24 animate-fade-in">
      {/* Top Header */}
      <div className="flex items-center justify-between px-1">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
        >
          <Icon name="arrow_back" className="text-[16px]" />
          <span>Continuer mes achats</span>
        </button>

        {items.length > 0 && (
          <button
            onClick={handleCancelCartDirectly}
            className="flex items-center gap-1 text-xs text-rose-500 hover:text-rose-600 font-semibold transition-colors cursor-pointer"
          >
            <Icon name="delete_sweep" className="text-[16px]" />
            <span>Vider / Annuler</span>
          </button>
        )}
      </div>

      {/* Cart Items Review Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
            <Icon name="shopping_cart" className="text-primary text-[18px]" />
            <span>Articles de votre commande ({items.length})</span>
          </h2>
          <span className="text-xs font-bold text-primary">
            {subtotal.toLocaleString("fr-FR")} {currency}
          </span>
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl bg-surface-card p-8 border border-subtle text-center space-y-3">
            <Icon name="remove_shopping_cart" className="text-[36px] text-on-surface-variant mx-auto" />
            <p className="text-sm font-semibold text-on-surface">Votre panier est vide</p>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold"
            >
              Parcourir les produits
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((it, idx) => (
              <div
                key={it.id || idx}
                className="rounded-2xl bg-surface-card p-3.5 border border-subtle shadow-card space-y-3"
              >
                {/* Product row */}
                <div className="flex items-start gap-3">
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-surface-secondary border border-subtle">
                    <img
                      className="w-full h-full object-cover"
                      src={getMediaUrl(it.primary_image_url)}
                      alt={it.name}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "/media/products/samsung_galaxy_a15.jpg";
                      }}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-xs sm:text-sm font-bold text-on-surface truncate">
                        {it.name}
                      </h3>
                      <button
                        onClick={() => handleRemoveItem(idx)}
                        className="text-on-surface-variant hover:text-rose-500 transition-colors p-1"
                        title="Supprimer cet article"
                      >
                        <Icon name="delete" className="text-[16px]" />
                      </button>
                    </div>

                    <p className="text-xs text-primary font-bold mt-0.5">
                      {it.unit_price.toLocaleString("fr-FR")} {currency}
                      <span className="text-[10px] text-on-surface-variant font-normal"> / {it.unit_label}</span>
                    </p>

                    {/* Stepper & Subtotal */}
                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-subtle/60">
                      <div className="flex items-center gap-2 bg-surface-secondary rounded-lg p-0.5 border border-subtle">
                        <button
                          type="button"
                          onClick={() => handleUpdateItemQuantity(idx, -1)}
                          className="w-6 h-6 rounded flex items-center justify-center bg-surface-card text-on-surface hover:bg-surface-elevated active:scale-95 transition-all cursor-pointer"
                        >
                          <Icon name="remove" className="text-[13px]" />
                        </button>
                        <span className="text-xs font-bold text-on-surface px-1 min-w-[20px] text-center">
                          {it.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateItemQuantity(idx, 1)}
                          className="w-6 h-6 rounded flex items-center justify-center bg-surface-card text-on-surface hover:bg-surface-elevated active:scale-95 transition-all cursor-pointer"
                        >
                          <Icon name="add" className="text-[13px]" />
                        </button>
                      </div>

                      <span className="text-xs font-bold text-on-surface">
                        Total: {(it.unit_price * it.quantity).toLocaleString("fr-FR")} {currency}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Per-item Personalization Input */}
                <div className="pt-2 border-t border-subtle/60">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon name="edit" className="text-[13px] text-primary" />
                    <label className="text-[11px] font-semibold text-on-surface-variant">
                      Personnalisation (taille, couleur, mesure ou note spéciale) :
                    </label>
                  </div>
                  <input
                    type="text"
                    placeholder="Ex: Taille XL, motif bleu, sans piment, gravure..."
                    value={it.customization_text}
                    onChange={(e) => handleUpdateCustomization(idx, e.target.value)}
                    className="w-full h-8 px-2.5 rounded-lg bg-surface-secondary border border-subtle text-on-surface placeholder:text-on-surface-variant/50 text-[11px] focus:outline-none focus:border-strong transition-all"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <>
          {/* Customer Identification */}
          {customer ? (
            <div className="bg-surface-card rounded-2xl p-4 border border-subtle shadow-card space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                  <Icon name="verified_user" className="text-secondary text-[17px]" />
                  <span>Compte Client Connecté</span>
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  Connecté 🟢
                </span>
              </div>
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-secondary/70 border border-subtle text-xs">
                <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                  {customer.name ? customer.name.charAt(0).toUpperCase() : "C"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-on-surface truncate">{customer.name}</p>
                  <p className="text-[11px] text-on-surface-variant truncate">{customer.phone}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-surface-card rounded-2xl p-4 border border-primary/20 shadow-card space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                  <Icon name="person" className="text-primary text-[17px]" />
                  <span>Vos coordonnées de livraison</span>
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  Compte requis pour commander
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                Renseignez votre nom et numéro WhatsApp. Votre compte sera activé automatiquement pour vous permettre de suivre votre commande.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-semibold text-on-surface-variant block mb-1">
                    Votre Nom complet *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Awa Traoré"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl bg-surface-secondary border border-subtle text-on-surface text-xs focus:outline-none focus:border-strong"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-on-surface-variant block mb-1">
                    Numéro WhatsApp / Téléphone *
                  </label>
                  <input
                    type="tel"
                    placeholder="Ex: 70 12 34 56"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl bg-surface-secondary border border-subtle text-on-surface text-xs focus:outline-none focus:border-strong"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Delivery & GPS Section */}
          <div className="bg-surface-card rounded-2xl p-4 border border-subtle shadow-card space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                <Icon name="local_shipping" className="text-primary text-[17px]" />
                <span>Adresse &amp; Géolocalisation</span>
              </h3>
              <span className="text-[11px] font-semibold text-secondary">
                Frais: {deliveryFee.toLocaleString("fr-FR")} {currency}
              </span>
            </div>

            {/* City Selection */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-on-surface-variant">Ville de livraison</label>
              <div className="grid grid-cols-4 gap-1.5">
                {cities.map((city) => (
                  <button
                    key={city.id}
                    type="button"
                    onClick={() => setSelectedCity(city.name)}
                    className={`py-2 px-1 rounded-xl text-center text-xs font-medium transition-all cursor-pointer ${
                      selectedCity === city.name
                        ? "bg-primary/15 text-primary font-bold border border-primary/30"
                        : "bg-surface-secondary text-on-surface-variant hover:text-on-surface border border-subtle"
                    }`}
                  >
                    {city.display_label || city.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Quartier / Repère text field */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-on-surface-variant">
                Quartier, rue ou repère exact
              </label>
              <input
                type="text"
                placeholder="Ex: Kossodo, près de l'école, Zone 4..."
                value={customLocality}
                onChange={(e) => setCustomLocality(e.target.value)}
                className="w-full h-9 px-3 rounded-xl bg-surface-secondary border border-subtle text-on-surface placeholder:text-on-surface-variant/50 text-xs focus:outline-none focus:border-strong transition-all"
              />
            </div>

            {/* Notes for courier */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-on-surface-variant">
                Instructions particulières pour le livreur (optionnel)
              </label>
              <input
                type="text"
                placeholder="Ex: Portail bleu, appeler avant d'arriver..."
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                className="w-full h-9 px-3 rounded-xl bg-surface-secondary border border-subtle text-on-surface placeholder:text-on-surface-variant/50 text-xs focus:outline-none focus:border-strong transition-all"
              />
            </div>

            {/* GPS Location Toggle */}
            <div className="pt-2 border-t border-subtle space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon name="pin_drop" className="text-primary text-[18px]" />
                  <div>
                    <span className="text-xs font-semibold text-on-surface block">
                      Ma position GPS actuelle
                    </span>
                    <span className="text-[10px] text-on-surface-variant">
                      {wantSendGps && latitude ? "Coordonnées capturées avec succès" : "Aide le coursier à vous trouver sans hésiter"}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCaptureLocation}
                  disabled={isLocating}
                  className="px-3 py-1.5 rounded-xl bg-secondary/15 hover:bg-secondary/25 text-secondary text-xs font-bold flex items-center gap-1.5 transition-all border border-secondary/30 active:scale-95 cursor-pointer"
                >
                  <Icon name={isLocating ? "progress_activity" : "my_location"} className={`text-[15px] ${isLocating ? "animate-spin" : ""}`} />
                  <span>{isLocating ? "Recherche GPS..." : "Capturer GPS"}</span>
                </button>
              </div>

              {wantSendGps && latitude && longitude && (
                <div className="p-2.5 rounded-xl bg-secondary/10 border border-secondary/20 flex items-center justify-between text-xs text-secondary">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon name="check_circle" className="text-[17px] shrink-0" />
                    <span className="truncate">Position: {latitude}, {longitude} ({locationAccuracy ? `±${locationAccuracy}m` : "précis"})</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearLocation}
                    className="text-on-surface-variant hover:text-on-surface cursor-pointer p-1"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Order Summary & Breakdown */}
          <div className="bg-surface-card rounded-2xl p-4 border border-subtle shadow-card space-y-2">
            <div className="flex items-center justify-between text-xs text-on-surface-variant">
              <span>Sous-total articles ({items.length})</span>
              <span className="font-semibold text-on-surface">{subtotal.toLocaleString("fr-FR")} {currency}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-on-surface-variant">
              <span>Frais de livraison</span>
              <span className="font-semibold text-on-surface">{deliveryFee.toLocaleString("fr-FR")} {currency}</span>
            </div>
            <div className="flex items-center justify-between text-sm font-bold text-on-surface pt-2 border-t border-subtle">
              <span>Total à régler</span>
              <span className="text-primary text-base tabular-nums">{totalAmount.toLocaleString("fr-FR")} {currency}</span>
            </div>
          </div>

          {/* Sticky Bottom Actions */}
          <div className="sticky bottom-2 z-20 pt-2 space-y-2">
            <div className="p-2 rounded-2xl bg-surface/95 backdrop-blur-xl border border-subtle shadow-card-hover space-y-2">
              <button
                type="button"
                onClick={handleConfirmOrder}
                disabled={isSubmitting}
                className="w-full h-12 rounded-xl bg-primary hover:brightness-105 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.99] cursor-pointer"
              >
                <Icon name="lock" className="text-[18px]" />
                <span>{isSubmitting ? "Enregistrement en cours..." : "Confirmer ma commande sur GotoShop"}</span>
              </button>

              <div className="flex items-center justify-between px-2 text-[10px] text-on-surface-variant">
                <span>🛡️ Paiement sécurisé sur la plateforme</span>
                <span>💬 Suivi &amp; chat direct</span>
              </div>
            </div>
          </div>
        </>
      )}

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
                  <span>{selectedCity} {customLocality ? `(${customLocality})` : ""}</span>
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
          city: selectedCity,
          locality: customLocality,
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
