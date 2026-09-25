import Icon from "./Icon";
import React, { useState, useEffect } from "react";
import {
  fetchSubscriptionPublicInfo,
  submitSubscriptionRequest,
  registerMerchantStore,
  getMediaUrl,
} from "../api/client";
import { FALLBACK_SUBSCRIPTION_PUBLIC_INFO } from "../api/fallbackData";
import { WEST_AFRICAN_COUNTRIES } from "../utils/locations";

const POPULAR_CATEGORIES = [
  "Mode & Tissus Danfani",
  "Téléphones & High-Tech",
  "Beauté & Cosmétiques Naturels",
  "Chaussures & Maroquinerie",
  "Bijoux, Parfums & Accessoires",
  "Alimentation & Produits Locaux",
  "Maison, Déco & Artisanat",
  "Autre Commerce & Services",
];

export default function SubscriptionModal({
  isOpen,
  onClose,
  mode = "NEW_STORE", // "NEW_STORE", "RENEWAL", "UPGRADE"
  initialStore = null,
  onSuccess,
}) {
  const [plans, setPlans] = useState(FALLBACK_SUBSCRIPTION_PUBLIC_INFO.plans);
  const [ussdConfigs, setUssdConfigs] = useState(FALLBACK_SUBSCRIPTION_PUBLIC_INFO.ussd_configs);
  const [plansWithUssd, setPlansWithUssd] = useState(FALLBACK_SUBSCRIPTION_PUBLIC_INFO.plans_with_ussd);
  const [loading, setLoading] = useState(false);

  // Onboarding track for NEW_STORE: "TRIAL" (14-day free trial immediate) or "PAID" (Mobile Money USSD plan)
  const [onboardingTrack, setOnboardingTrack] = useState("TRIAL");

  // Form State
  const [storeName, setStoreName] = useState(initialStore?.name || "");
  const [ownerName, setOwnerName] = useState(initialStore?.owner?.full_name || "");
  const [selectedCountryCode, setSelectedCountryCode] = useState("BF");
  const [city, setCity] = useState("Ouagadougou");
  const [customCity, setCustomCity] = useState("");
  const [locality, setLocality] = useState("");
  const [ownerPhone, setOwnerPhone] = useState(
    initialStore?.contact_whatsapp || initialStore?.owner?.phone_number || "+226 "
  );
  const [ownerEmail, setOwnerEmail] = useState(
    initialStore?.contact_email || initialStore?.owner?.email || ""
  );
  const [password, setPassword] = useState("");
  const [categoryName, setCategoryName] = useState("Mode & Tissus Danfani");
  const [tagline, setTagline] = useState("");
  const [notes, setNotes] = useState("");

  // Payment Selection
  const [selectedPlanCode, setSelectedPlanCode] = useState("STARTER");
  const [selectedOperator, setSelectedOperator] = useState("ORANGE");

  // Payment Proof
  const [proofPreview, setProofPreview] = useState(null);
  const [proofData, setProofData] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Store Logo (Facultatif mais très conseillé)
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoData, setLogoData] = useState(null);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const currentCountry =
    WEST_AFRICAN_COUNTRIES.find((c) => c.code === selectedCountryCode) ||
    WEST_AFRICAN_COUNTRIES[0];

  useEffect(() => {
    if (isOpen) {
      loadInfo();
      setSubmitSuccess(false);
      setErrorMessage("");
      setProofPreview(null);
      setProofData(null);
      setLogoPreview(null);
      setLogoData(null);
      setCopiedCode(false);
      setCopiedUrl(false);

      if (mode === "NEW_STORE") {
        setOnboardingTrack("TRIAL");
        if (!initialStore) {
          setStoreName("");
          setOwnerName("");
          setSelectedCountryCode("BF");
          setCity("Ouagadougou");
          setCustomCity("");
          setLocality("");
          setOwnerPhone("+226 ");
          setOwnerEmail("");
          setPassword("");
          setTagline("");
        }
      } else {
        setOnboardingTrack("PAID");
      }

      if (initialStore) {
        setStoreName(initialStore.name || "");
        setOwnerName(initialStore.owner?.full_name || "");
        setOwnerPhone(
          initialStore.contact_whatsapp ||
            initialStore.owner?.phone_number ||
            "+226 "
        );
        setOwnerEmail(
          initialStore.contact_email || initialStore.owner?.email || ""
        );
        if (initialStore.subscription_plan) {
          setSelectedPlanCode(initialStore.subscription_plan);
        }
      }
    }
  }, [isOpen, initialStore, mode]);

  const handleCountryChange = (code) => {
    setSelectedCountryCode(code);
    const country = WEST_AFRICAN_COUNTRIES.find((c) => c.code === code);
    if (country) {
      setCity(country.cities[0] || "Autre");
      setCustomCity("");
      // Update phone prefix if currently default or empty
      const prevDials = WEST_AFRICAN_COUNTRIES.map((c) => c.dial);
      const isJustDial =
        !ownerPhone.trim() ||
        prevDials.some((d) => ownerPhone.trim() === d || ownerPhone.trim() === d + " ");
      if (isJustDial) {
        setOwnerPhone(`${country.dial} `);
      }
    }
  };

  const loadInfo = async () => {
    try {
      const data = await fetchSubscriptionPublicInfo();
      if (data?.plans?.length) setPlans(data.plans);
      if (data?.ussd_configs?.length) setUssdConfigs(data.ussd_configs);
      if (data?.plans_with_ussd?.length) setPlansWithUssd(data.plans_with_ussd);

      const activePlans = data?.plans?.length
        ? data.plans
        : FALLBACK_SUBSCRIPTION_PUBLIC_INFO.plans;
      if (activePlans.length > 0 && !initialStore?.subscription_plan) {
        const pop = activePlans.find((p) => p.is_popular);
        setSelectedPlanCode(pop ? pop.code : activePlans[0].code);
      }
    } catch (e) {
      console.warn("Erreur chargement forfaits en ligne, utilisation des données sécurisées:", e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Selected Plan Object with bulletproof fallbacks
  const defaultFallbackPlanWithUssd = FALLBACK_SUBSCRIPTION_PUBLIC_INFO.plans_with_ussd[0];
  const currentPlanInfo =
    (plansWithUssd && plansWithUssd.length > 0 && plansWithUssd.find((p) => p?.plan?.code === selectedPlanCode)) ||
    (plansWithUssd && plansWithUssd.length > 0 && plansWithUssd[0]) ||
    defaultFallbackPlanWithUssd;

  const activePlan = currentPlanInfo?.plan || (plans && plans.length > 0 && plans[0]) || FALLBACK_SUBSCRIPTION_PUBLIC_INFO.plans[0];
  const activePlanPrice = Number(activePlan?.price || 1000);

  // Current dial option for the selected operator with bulletproof fallback
  const currentDialOption =
    currentPlanInfo?.payment_options?.find(
      (opt) => opt.operator_code === selectedOperator
    ) || currentPlanInfo?.payment_options?.[0] || defaultFallbackPlanWithUssd.payment_options[0];

  // Handle Screenshot compression and reading
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 900;
        const MAX_HEIGHT = 1600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const compressedUri = canvas.toDataURL("image/jpeg", 0.85);
        setProofPreview(compressedUri);
        setProofData(compressedUri);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleLogoFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_SIZE = 500;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const compressedUri = canvas.toDataURL("image/jpeg", 0.88);
        setLogoPreview(compressedUri);
        setLogoData(compressedUri);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const copyToClipboard = (text, type = "code") => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
    }
    if (type === "code") {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } else {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!storeName.trim()) {
      setErrorMessage("Veuillez renseigner le nom de votre boutique.");
      return;
    }
    if (!ownerName.trim()) {
      setErrorMessage("Veuillez renseigner le prénom et nom du gérant.");
      return;
    }
    if (!ownerPhone.trim() || ownerPhone.trim().length < 8) {
      setErrorMessage("Veuillez renseigner un numéro WhatsApp fonctionnel.");
      return;
    }

    setIsSubmitting(true);
    try {
      const effectiveCity =
        city === "Autre" ? customCity.trim() || "Autre ville" : city;

      if (mode === "NEW_STORE") {
        // Direct Store Registration Flow
        const payload = {
          store_name: storeName.trim(),
          owner_name: ownerName.trim(),
          owner_phone: ownerPhone.trim(),
          owner_email: ownerEmail.trim() || undefined,
          password: password.trim() || undefined,
          country: currentCountry.name,
          city: effectiveCity,
          locality: locality.trim() || undefined,
          category_name: categoryName,
          tagline: tagline.trim() || undefined,
          logo_data: logoData || undefined,
          plan_code: onboardingTrack === "TRIAL" ? "STARTER" : selectedPlanCode,
          operator_code: selectedOperator,
          payment_proof_data: proofData || undefined,
          notes: notes.trim() || (onboardingTrack === "PAID" ? `Souscription Mobile Money ${selectedOperator} - Formule ${selectedPlanCode}` : "TRIAL"),
        };

        const result = await registerMerchantStore(payload);
        setSubmittedData(result);
        setSubmitSuccess(true);
      } else {
        // Renewal / Upgrade Flow
        const payload = {
          request_type: mode,
          store_id: initialStore?.id || null,
          store_name: storeName.trim(),
          owner_name: ownerName.trim(),
          owner_email: ownerEmail.trim(),
          owner_phone: ownerPhone.trim(),
          plan_code: selectedPlanCode,
          operator_code: selectedOperator,
          payment_proof_data: proofData,
          notes: notes.trim(),
        };

        const result = await submitSubscriptionRequest(payload);
        setSubmittedData(result);
        setSubmitSuccess(true);
      }
    } catch (err) {
      setErrorMessage(
        err.message || "Une erreur est survenue lors de l'enregistrement."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinishAndEnterStore = (openAdmin = true) => {
    onClose();
    if (onSuccess) {
      onSuccess(submittedData, openAdmin);
    }
  };

  // Safe parse features
  const parseFeatures = (featStr) => {
    if (!featStr) return [];
    if (Array.isArray(featStr)) return featStr;
    try {
      const parsed = JSON.parse(featStr);
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === "string") return [parsed];
      return [];
    } catch {
      return typeof featStr === "string" ? featStr.split(",").map((s) => s.trim()) : [];
    }
  };

  const fullStorePublicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/?store=${submittedData?.slug || "maboutique"}`
      : `/?store=${submittedData?.slug || "maboutique"}`;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md overflow-y-auto"
    >
      <div className="relative w-full max-w-2xl bg-surface-card border border-subtle rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header bar */}
        <div className="px-5 py-4 bg-surface-secondary border-b border-subtle text-on-surface flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center flex-shrink-0">
              <Icon name={mode === "NEW_STORE" ? "add_business" : "workspace_premium"} className="text-[22px]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-on-surface tracking-tight leading-snug">
                  {mode === "NEW_STORE"
                    ? "Ouvrir ma Boutique en Ligne"
                    : mode === "UPGRADE"
                    ? "Changer de Formule"
                    : "Renouveler mon Abonnement"}
                </h2>
                {mode === "NEW_STORE" && (
                  <span className="hidden xs:inline-flex px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-semibold">
                    14 Jours Gratuits
                  </span>
                )}
              </div>
              <p className="text-xs text-on-surface-variant font-normal">
                {mode === "NEW_STORE"
                  ? "Vitrine WhatsApp immédiate • Multi-Boutiques & Vente Directe"
                  : "Validation directe et prolongation automatique de votre vitrine"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-surface-card hover:bg-surface-elevated border border-subtle flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
            aria-label="Fermer"
          >
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-on-surface flex-grow">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-xs text-on-surface-variant font-medium">
                Initialisation des options d'ouverture...
              </p>
            </div>
          ) : submitSuccess ? (
            /* SUCCESS CONFIRMATION SCREEN */
            <div className="text-center py-4 px-2 space-y-5 animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border-2 border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto shadow-md">
                <Icon name="hourglass_top" className="text-[36px] animate-pulse" />
              </div>

              <div className="space-y-3">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold text-xs mb-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  <span>Boutique en cours d'examen • Ouverture sous 24h</span>
                </div>
                <h3 className="text-xl font-bold text-on-surface tracking-tight">
                  Félicitations {ownerName} ! Votre boutique est enregistrée.
                </h3>
                
                {/* 24H Admin Validation Explainer Card */}
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-left space-y-2.5 max-w-lg mx-auto">
                  <div className="flex items-start gap-2.5">
                    <Icon name="verified_user" className="text-amber-500 text-lg shrink-0 mt-0.5" />
                    <p className="text-xs text-on-surface leading-relaxed">
                      <strong>Examen de sécurité en cours :</strong> Votre boutique est actuellement soumise à validation par un administrateur GotoShop.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Icon name="schedule" className="text-amber-500 text-lg shrink-0 mt-0.5" />
                    <p className="text-xs text-on-surface leading-relaxed">
                      Elle sera <strong>officiellement ouverte en moins de 24h</strong> à la fin des vérifications. Dès sa validation, elle apparaîtra parmi les boutiques publiques et sera mise en avant dans la section <strong>Boutiques Récentes ⚡</strong>.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Icon name="storefront" className="text-emerald-600 dark:text-emerald-400 text-lg shrink-0 mt-0.5" />
                    <p className="text-xs text-on-surface leading-relaxed">
                      <strong>Commencez dès maintenant :</strong> Vous avez déjà accès à votre espace commerçant pour ajouter vos produits, vos photos et configurer vos modes de livraison.
                    </p>
                  </div>
                </div>
              </div>

              {/* Public Store Link Card */}
              <div className="bg-surface-secondary border border-subtle p-4 rounded-xl text-left space-y-3 max-w-lg mx-auto">
                <div>
                  <label className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider block mb-1">
                    Lien unique d'accès à votre boutique :
                  </label>
                  <div className="flex items-center gap-2 bg-surface-card p-2 rounded-xl border border-subtle">
                    <Icon name="link" className="text-primary text-[18px]" />
                    <input
                      type="text"
                      readOnly
                      value={fullStorePublicUrl}
                      className="bg-transparent text-xs text-on-surface font-mono flex-grow outline-none truncate"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(fullStorePublicUrl, "url")}
                      className="px-3 py-1.5 rounded-lg bg-surface-secondary hover:bg-surface-elevated text-xs font-semibold text-on-surface border border-subtle flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <Icon name={copiedUrl ? "check" : "content_copy"} className="text-[14px]" />
                      <span>{copiedUrl ? "Copié !" : "Copier"}</span>
                    </button>
                  </div>
                </div>

                {/* Login credentials notice */}
                <div className="p-3 bg-surface-card/60 rounded-xl border border-subtle text-xs space-y-1.5">
                  <div className="font-semibold text-on-surface flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-primary">
                    <Icon name="vpn_key" className="text-[16px]" />
                    <span>Vos accès commerçant :</span>
                  </div>
                  <div className="text-[11px] text-on-surface-variant flex flex-col gap-0.5">
                    <div>
                      <strong>Identifiant :</strong> {ownerPhone}{" "}
                      {ownerEmail ? `(${ownerEmail})` : ""}
                    </div>
                    {submittedData?.temporary_password && (
                      <div>
                        <strong>Mot de passe :</strong>{" "}
                        <code className="bg-surface-secondary px-1.5 py-0.5 rounded text-primary font-mono font-bold">
                          {submittedData.temporary_password}
                        </code>
                      </div>
                    )}
                    <div className="text-[10px] text-on-surface-variant/70 mt-1">
                      Vous êtes déjà automatiquement connecté sur cet appareil.
                    </div>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2 max-w-lg mx-auto">
                <button
                  type="button"
                  onClick={() => handleFinishAndEnterStore(true)}
                  className="px-5 py-3 rounded-xl bg-primary hover:brightness-105 text-white font-bold text-xs shadow-md flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer"
                >
                  <Icon name="dashboard" className="text-[18px]" />
                  <span>Ouvrir mon Espace Commerçant 🚀</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleFinishAndEnterStore(false)}
                  className="px-4 py-3 rounded-xl bg-surface-secondary hover:bg-surface-elevated border border-subtle text-on-surface font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Icon name="storefront" className="text-[18px]" />
                  <span>Voir la vitrine client</span>
                </button>
              </div>
            </div>
          ) : (
            /* STORE ONBOARDING FORM */
            <form onSubmit={handleSubmit} className="space-y-6">
              {errorMessage && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-medium text-rose-300 flex items-center gap-2">
                  <Icon name="error" className="text-[18px] text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* IF NEW_STORE: TRACK SELECTION (FREE TRIAL VS PAID) */}
              {mode === "NEW_STORE" && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[11px] flex items-center justify-center font-bold">
                      1
                    </span>
                    <span>Formule d'Activation</span>
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Track 1: Free Trial (Immediate) */}
                    <div
                      onClick={() => setOnboardingTrack("TRIAL")}
                      className={`relative p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        onboardingTrack === "TRIAL"
                          ? "bg-primary/5 border-primary ring-1 ring-primary/40 shadow-sm"
                          : "bg-surface-card border-subtle hover:border-strong opacity-80"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-xs text-on-surface">
                              Essai Gratuit 14 Jours
                            </span>
                            <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 text-[10px] font-bold">
                              Gratuit
                            </span>
                          </div>
                          <p className="text-[11px] text-on-surface-variant mt-1 leading-snug">
                            Zéro carte, zéro paiement aujourd'hui. Boutique en ligne immédiatement active.
                          </p>
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                            onboardingTrack === "TRIAL"
                              ? "border-primary bg-primary"
                              : "border-subtle"
                          }`}
                        >
                          {onboardingTrack === "TRIAL" && (
                            <div className="w-1.5 h-1.5 rounded-full bg-surface" />
                          )}
                        </div>
                      </div>
                      <div className="text-[10px] text-primary font-semibold mt-2.5 flex items-center gap-1">
                        <Icon name="bolt" className="text-[13px]" />
                        <span>Activation en 1 clic</span>
                      </div>
                    </div>

                    {/* Track 2: Paid Subscription via USSD */}
                    <div
                      onClick={() => setOnboardingTrack("PAID")}
                      className={`relative p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        onboardingTrack === "PAID"
                          ? "bg-primary/5 border-primary ring-1 ring-primary/40 shadow-sm"
                          : "bg-surface-card border-subtle hover:border-strong opacity-80"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-xs text-on-surface">
                              Forfait Mobile Money
                            </span>
                            <span className="px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold">
                              Pro / Starter
                            </span>
                          </div>
                          <p className="text-[11px] text-on-surface-variant mt-1 leading-snug">
                            À partir de 1 000 FCFA/mois. Paiement Orange Money / Moov Money direct par code USSD.
                          </p>
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                            onboardingTrack === "PAID"
                              ? "border-primary bg-primary"
                              : "border-subtle"
                          }`}
                        >
                          {onboardingTrack === "PAID" && (
                            <div className="w-1.5 h-1.5 rounded-full bg-surface" />
                          )}
                        </div>
                      </div>
                      <div className="text-[10px] text-on-surface-variant font-medium mt-2.5 flex items-center gap-1">
                        <Icon name="verified" className="text-[13px]" />
                        <span>Badge Pro & Priorité</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION: BOUTIQUE & PROPRIÉTAIRE */}
              <div className="space-y-4">
                <label className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[11px] flex items-center justify-center font-bold">
                    {mode === "NEW_STORE" ? "2" : "1"}
                  </span>
                  <span>Identité & Coordonnées de la Boutique</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Store Logo (Facultatif mais très conseillé) */}
                  <div className="sm:col-span-2 p-3.5 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 hover:border-primary/50 transition-colors">
                    <div className="flex flex-col sm:flex-row items-center gap-3.5">
                      <div className="relative w-16 h-16 rounded-2xl bg-surface border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                        {logoPreview ? (
                          <img
                            src={logoPreview}
                            alt="Logo boutique"
                            className="w-full h-full object-cover rounded-xl"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-primary/70">
                            <Icon name="add_photo_alternate" className="text-2xl text-primary" />
                            <span className="text-[9px] font-bold mt-0.5 text-on-surface-variant">Logo</span>
                          </div>
                        )}
                        {logoPreview && (
                          <button
                            type="button"
                            onClick={() => {
                              setLogoPreview(null);
                              setLogoData(null);
                            }}
                            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center text-[11px] font-bold shadow cursor-pointer hover:bg-rose-600 transition-colors"
                            title="Supprimer le logo"
                          >
                            ×
                          </button>
                        )}
                      </div>

                      <div className="flex-1 text-center sm:text-left">
                        <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
                          <span className="text-xs font-bold text-on-surface">Logo officiel de votre boutique</span>
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                            Facultatif mais très fortement conseillé ⭐
                          </span>
                        </div>
                        <p className="text-[11px] text-on-surface-variant mt-0.5 leading-snug">
                          Avoir votre logo permet d'officialiser votre marque, inspire confiance aux clients et accélère la validation par l'admin.
                        </p>
                        <div className="mt-2 flex items-center justify-center sm:justify-start gap-2">
                          <label className="px-3 py-1.5 rounded-xl bg-surface hover:bg-surface-elevated text-xs font-semibold text-primary border border-primary/30 flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors active:scale-98">
                            <Icon name="upload" className="text-sm" />
                            <span>{logoPreview ? "Changer le logo" : "Importer votre logo (PNG / JPG)"}</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleLogoFileChange}
                            />
                          </label>
                          {logoPreview && (
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                              <Icon name="check_circle" className="text-sm" />
                              <span>Logo prêt</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Store Name */}
                  <div>
                    <label className="block text-xs font-medium text-on-surface-variant mb-1">
                      Nom de la boutique <span className="text-primary">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Faso Danfani & Élégance, Ouaga Tech..."
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-surface-secondary border border-subtle text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40"
                    />
                  </div>

                  {/* Owner Full Name */}
                  <div>
                    <label className="block text-xs font-medium text-on-surface-variant mb-1">
                      Nom complet du gérant <span className="text-primary">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Aminata Traoré"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-surface-secondary border border-subtle text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40"
                    />
                  </div>

                  {/* Country Selector */}
                  <div>
                    <label className="block text-xs font-medium text-on-surface-variant mb-1">
                      Pays d'implantation <span className="text-primary">*</span>
                    </label>
                    <select
                      value={selectedCountryCode}
                      onChange={(e) => handleCountryChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-surface-secondary border border-subtle text-xs text-on-surface focus:outline-none focus:border-primary cursor-pointer"
                    >
                      {WEST_AFRICAN_COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.name} ({c.dial})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* City Selector */}
                  <div>
                    <label className="block text-xs font-medium text-on-surface-variant mb-1">
                      Ville principale <span className="text-primary">*</span>
                    </label>
                    <select
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-surface-secondary border border-subtle text-xs text-on-surface focus:outline-none focus:border-primary cursor-pointer"
                    >
                      {currentCountry.cities.map((cty) => (
                        <option key={cty} value={cty}>
                          {cty}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Custom city input if "Autre" selected */}
                  {city === "Autre" && (
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-on-surface-variant mb-1">
                        Précisez votre ville :
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Koupéla, Dori, Fada..."
                        value={customCity}
                        onChange={(e) => setCustomCity(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-surface-secondary border border-subtle text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary"
                      />
                    </div>
                  )}

                  {/* Locality / Quartier */}
                  <div>
                    <label className="block text-xs font-medium text-on-surface-variant mb-1">
                      Quartier / Secteur / Rue :
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Ouaga 2000, Zogona, Belleville..."
                      value={locality}
                      onChange={(e) => setLocality(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-surface-secondary border border-subtle text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary"
                    />
                  </div>

                  {/* WhatsApp Number */}
                  <div>
                    <label className="block text-xs font-medium text-on-surface-variant mb-1">
                      Numéro WhatsApp professionnel <span className="text-primary">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder={`${currentCountry.dial} 70 00 00 00`}
                      value={ownerPhone}
                      onChange={(e) => setOwnerPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-surface-secondary border border-subtle text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40 font-mono"
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-xs font-medium text-on-surface-variant mb-1">
                      Secteur d'activité :
                    </label>
                    <select
                      value={categoryName}
                      onChange={(e) => setCategoryName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-surface-secondary border border-subtle text-xs text-on-surface focus:outline-none focus:border-primary cursor-pointer"
                    >
                      {POPULAR_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Email (Optional) */}
                  <div>
                    <label className="block text-xs font-medium text-on-surface-variant mb-1">
                      Email de contact / connexion <span className="text-on-surface-variant/60 font-normal">(Optionnel)</span>
                    </label>
                    <input
                      type="email"
                      placeholder="vendeur@gmail.com"
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-surface-secondary border border-subtle text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary"
                    />
                  </div>

                  {/* Password (Optional for Merchant) */}
                  {mode === "NEW_STORE" && (
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-on-surface-variant mb-1">
                        Mot de passe administrateur <span className="text-on-surface-variant/60 font-normal">(Optionnel - généré automatiquement si vide)</span>
                      </label>
                      <input
                        type="password"
                        placeholder="Ex: MonSuperMotDePasse2026!"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-surface-secondary border border-subtle text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* IF PAID TRACK OR RENEWAL/UPGRADE: PLAN & USSD DETAILS */}
              {(onboardingTrack === "PAID" || mode !== "NEW_STORE") && (
                <div className="space-y-4 border-t border-subtle pt-5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[11px] flex items-center justify-center font-bold">
                        {mode === "NEW_STORE" ? "3" : "2"}
                      </span>
                      <span>Formule d'Abonnement & Paiement USSD</span>
                    </label>
                    <span className="text-xs font-semibold text-on-surface px-2.5 py-1 rounded-lg bg-surface-secondary border border-subtle">
                      Montant : {activePlanPrice.toLocaleString("fr-FR")} FCFA
                    </span>
                  </div>

                  {/* Plan Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {plans.map((p) => {
                      const isSelected = selectedPlanCode === p.code;
                      const features = parseFeatures(p.features);
                      return (
                        <div
                          key={p.id}
                          onClick={() => setSelectedPlanCode(p.code)}
                          className={`relative rounded-xl p-3 border transition-all cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? "bg-primary/5 border-primary ring-1 ring-primary/40 shadow-sm"
                              : "bg-surface-card border-subtle hover:border-strong"
                          }`}
                        >
                          {p.is_popular && (
                            <div className="absolute -top-2.5 right-2 px-2 py-0.5 rounded-full bg-primary/20 border border-primary/30 text-[9px] font-semibold text-primary uppercase">
                              Populaire
                            </div>
                          )}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold text-xs text-on-surface">
                                {p.name.replace(/\(.*\)/, "").trim()}
                              </span>
                              <div
                                className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                                  isSelected
                                    ? "border-primary bg-primary"
                                    : "border-subtle"
                                }`}
                              >
                                {isSelected && (
                                  <div className="w-1.5 h-1.5 rounded-full bg-surface" />
                                )}
                              </div>
                            </div>
                            <div className="text-base font-bold text-on-surface my-0.5">
                              {Number(p?.price || 0).toLocaleString("fr-FR")}{" "}
                              <span className="text-[10px] font-normal text-on-surface-variant">
                                FCFA / mois
                              </span>
                            </div>
                            <p className="text-[10px] text-on-surface-variant leading-tight mb-2">
                              {p.description}
                            </p>
                          </div>

                          <ul className="space-y-1 text-[10px] text-on-surface-variant border-t border-subtle pt-2">
                            {features.slice(0, 2).map((f, idx) => (
                              <li key={idx} className="flex items-center gap-1">
                                <Icon name="check" className="text-[12px] text-primary shrink-0" />
                                <span className="truncate">{f}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>

                  {/* USSD Dial Block */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {currentPlanInfo?.payment_options?.map((opt) => {
                      const isOpSelected = selectedOperator === opt.operator_code;
                      const isOrange = opt.operator_code === "ORANGE";
                      const isMoov = opt.operator_code === "MOOV";
                      return (
                        <button
                          type="button"
                          key={opt.operator_code}
                          onClick={() => setSelectedOperator(opt.operator_code)}
                          className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2 cursor-pointer ${
                            isOpSelected
                              ? "bg-surface-elevated border-primary ring-1 ring-primary/40 shadow-sm"
                              : "bg-surface-card border-subtle hover:border-strong opacity-80"
                          }`}
                        >
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[10px] flex-shrink-0 text-white"
                            style={{
                              backgroundColor: isOrange
                                ? "#FF7900"
                                : isMoov
                                ? "#005BAA"
                                : "#0284c7",
                            }}
                          >
                            {isOrange ? "OM" : isMoov ? "MOOV" : "WAVE"}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-[11px] text-on-surface truncate">
                              {opt.operator_name}
                            </div>
                            <div className="text-[9px] text-on-surface-variant truncate">
                              {opt.merchant_number}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Dial Code Display */}
                  {currentDialOption && (
                    <div className="bg-surface-secondary border border-subtle p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div>
                        <span className="text-[10px] font-medium text-on-surface-variant block">
                          Code USSD pour {activePlan?.name || "votre formule"} :
                        </span>
                        <span className="font-mono text-sm font-bold text-primary select-all">
                          {currentDialOption.ussd_code}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {currentDialOption.ussd_code.startsWith("*") && (
                          <a
                            href={currentDialOption.tel_link}
                            className="px-3 py-1.5 rounded-lg bg-secondary hover:brightness-105 text-white text-[11px] font-semibold flex items-center gap-1 transition-colors"
                          >
                            <Icon name="call" className="text-[14px]" />
                            <span>Composer</span>
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => copyToClipboard(currentDialOption.ussd_code, "code")}
                          className="px-3 py-1.5 rounded-lg bg-surface-card hover:bg-surface-elevated border border-subtle text-on-surface text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Icon name={copiedCode ? "check" : "content_copy"} className="text-[14px]" />
                          <span>{copiedCode ? "Copié !" : "Copier"}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Optional Proof Upload */}
                  <div>
                    <label className="block text-[11px] font-medium text-on-surface-variant mb-1">
                      Capture d'écran du reçu Mobile Money{" "}
                      <span className="text-on-surface-variant/60 font-normal">
                        (Optionnel - vous pouvez aussi l'envoyer plus tard)
                      </span>
                    </label>

                    {proofPreview ? (
                      <div className="relative rounded-xl overflow-hidden border border-subtle bg-surface-secondary p-2 flex items-center gap-3">
                        <img
                          src={proofPreview}
                          alt="Preuve"
                          className="w-12 h-12 object-cover rounded-lg border border-subtle"
                        />
                        <div className="text-xs text-on-surface font-medium flex-grow">
                          Capture reçue attachée
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setProofPreview(null);
                            setProofData(null);
                          }}
                          className="p-1 rounded-lg text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                        >
                          <Icon name="delete" className="text-[18px]" />
                        </button>
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-subtle hover:border-primary/50 rounded-xl p-3 text-center cursor-pointer block bg-surface-card hover:bg-surface-secondary/40 transition-colors">
                        <Icon name="photo_camera" className="text-[20px] text-on-surface-variant mx-auto block mb-1" />
                        <div className="text-[11px] font-medium text-on-surface">
                          Cliquez pour charger la capture de confirmation Mobile Money
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>
              )}

              {/* Submit Button Bar */}
              <div className="border-t border-subtle pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-surface-secondary hover:bg-surface-elevated border border-subtle text-on-surface font-medium text-xs transition-colors cursor-pointer"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    !storeName.trim() ||
                    !ownerName.trim() ||
                    !ownerPhone.trim()
                  }
                  className={`px-5 py-2.5 rounded-xl font-semibold text-xs shadow-md flex items-center gap-2 transition-all cursor-pointer ${
                    isSubmitting ||
                    !storeName.trim() ||
                    !ownerName.trim() ||
                    !ownerPhone.trim()
                      ? "bg-surface-secondary text-on-surface-variant/40 border border-subtle cursor-not-allowed"
                      : "bg-primary hover:brightness-105 text-white active:scale-98"
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Création de votre boutique en cours...</span>
                    </>
                  ) : mode === "NEW_STORE" ? (
                    <>
                      <span>
                        {onboardingTrack === "TRIAL"
                          ? "Créer ma Boutique (14 Jours Gratuits) 🚀"
                          : "Activer ma Boutique avec Formule"}
                      </span>
                      <Icon name="arrow_forward" className="text-[16px]" />
                    </>
                  ) : (
                    <>
                      <span>Confirmer le Renouvellement</span>
                      <Icon name="check_circle" className="text-[16px]" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
