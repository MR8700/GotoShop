import React, { useState, useEffect } from "react";
import {
  fetchSubscriptionPublicInfo,
  submitSubscriptionRequest,
  getMediaUrl,
} from "../api/client";
import { FALLBACK_SUBSCRIPTION_PUBLIC_INFO } from "../api/fallbackData";

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

  // Form State
  const [selectedPlanCode, setSelectedPlanCode] = useState("STARTER");
  const [selectedOperator, setSelectedOperator] = useState("ORANGE");
  const [storeName, setStoreName] = useState(initialStore?.name || "");
  const [ownerName, setOwnerName] = useState(initialStore?.owner?.full_name || "");
  const [ownerPhone, setOwnerPhone] = useState(initialStore?.contact_whatsapp || initialStore?.owner?.phone_number || "+225 ");
  const [ownerEmail, setOwnerEmail] = useState(initialStore?.contact_email || initialStore?.owner?.email || "");
  const [notes, setNotes] = useState("");

  // Payment Proof
  const [proofPreview, setProofPreview] = useState(null);
  const [proofData, setProofData] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (isOpen) {
      loadInfo();
      setSubmitSuccess(false);
      setErrorMessage("");
      setProofPreview(null);
      setProofData(null);
      if (initialStore) {
        setStoreName(initialStore.name || "");
        setOwnerName(initialStore.owner?.full_name || "");
        setOwnerPhone(initialStore.contact_whatsapp || initialStore.owner?.phone_number || "+225 ");
        setOwnerEmail(initialStore.contact_email || initialStore.owner?.email || "");
        if (initialStore.subscription_plan) {
          setSelectedPlanCode(initialStore.subscription_plan);
        }
      }
    }
  }, [isOpen, initialStore]);

  const loadInfo = async () => {
    try {
      const data = await fetchSubscriptionPublicInfo();
      if (data?.plans?.length) setPlans(data.plans);
      if (data?.ussd_configs?.length) setUssdConfigs(data.ussd_configs);
      if (data?.plans_with_ussd?.length) setPlansWithUssd(data.plans_with_ussd);

      const activePlans = data?.plans?.length ? data.plans : FALLBACK_SUBSCRIPTION_PUBLIC_INFO.plans;
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

  // Selected Plan Object
  const currentPlanInfo = plansWithUssd.find(
    (p) => p.plan.code === selectedPlanCode
  ) || plansWithUssd[0];
  const activePlan = currentPlanInfo?.plan;

  // Current dial option for the selected operator
  const currentDialOption = currentPlanInfo?.payment_options?.find(
    (opt) => opt.operator_code === selectedOperator
  ) || currentPlanInfo?.payment_options?.[0];

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

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!storeName.trim() || !ownerName.trim()) {
      setErrorMessage("Veuillez renseigner le nom de la boutique et votre nom.");
      return;
    }

    if (!ownerPhone.trim() && !ownerEmail.trim()) {
      setErrorMessage("Veuillez renseigner un Email ou un numéro WhatsApp fonctionnel.");
      return;
    }

    if (!proofData) {
      setErrorMessage("Veuillez charger la capture d'écran du paiement USSD.");
      return;
    }

    setIsSubmitting(true);
    try {
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
      if (onSuccess) onSuccess(result);
    } catch (err) {
      setErrorMessage(err.message || "Une erreur est survenue lors de l'envoi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Safe parse features
  const parseFeatures = (featStr) => {
    if (!featStr) return [];
    try {
      return JSON.parse(featStr);
    } catch {
      return featStr.split(",").map((s) => s.trim());
    }
  };

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
              <span className="material-symbols-outlined text-[22px]">workspace_premium</span>
            </div>
            <div>
              <h2 className="text-base font-semibold text-on-surface tracking-tight leading-snug">
                {mode === "NEW_STORE"
                  ? "Ouvrir ma Boutique en Ligne"
                  : mode === "UPGRADE"
                  ? "Changer de Formule"
                  : "Renouveler mon Abonnement"}
              </h2>
              <p className="text-xs text-on-surface-variant font-normal">
                Paiement Mobile Money par USSD & validation directe
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-surface-card hover:bg-surface-elevated border border-subtle flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
            aria-label="Fermer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-on-surface flex-grow">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-xs text-on-surface-variant font-medium">
                Chargement des formules et passerelles de paiement...
              </p>
            </div>
          ) : submitSuccess ? (
            /* SUCCESS CONFIRMATION SCREEN */
            <div className="text-center py-6 px-2 space-y-5 animate-fade-in">
              <div className="w-14 h-14 rounded-2xl bg-secondary/15 border border-secondary/30 text-secondary flex items-center justify-center mx-auto shadow-md">
                <span className="material-symbols-outlined text-[32px]">check_circle</span>
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-on-surface tracking-tight">
                  Demande transmise avec succès
                </h3>
                <p className="text-xs text-on-surface-variant max-w-md mx-auto leading-relaxed">
                  Merci <strong className="text-on-surface">{ownerName}</strong>. Votre capture de paiement de{" "}
                  <span className="text-primary font-bold">
                    {submittedData?.amount || activePlan?.price} {submittedData?.currency || "FCFA"}
                  </span>{" "}
                  a bien été reçue par notre équipe d'administration.
                </p>
              </div>

              {/* Status card */}
              <div className="bg-surface-secondary border border-subtle p-4 rounded-xl text-left space-y-3 max-w-md mx-auto">
                <div className="flex justify-between items-center text-xs pb-2.5 border-b border-subtle">
                  <span className="text-on-surface-variant font-medium">Statut de la demande :</span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 font-medium text-[11px]">
                    <span className="material-symbols-outlined text-[13px]">schedule</span>
                    En attente de vérification
                  </span>
                </div>
                <div className="text-xs space-y-1.5 text-on-surface-variant">
                  <p>
                    <span className="text-on-surface-variant/70">Boutique :</span> {submittedData?.store_name || storeName}
                  </p>
                  <p>
                    <span className="text-on-surface-variant/70">Formule choisie :</span> {submittedData?.plan_name || activePlan?.name}
                  </p>
                  <p>
                    <span className="text-on-surface-variant/70">Canal de contact :</span> {ownerPhone} {ownerEmail ? `• ${ownerEmail}` : ""}
                  </p>
                </div>
                <div className="p-3 bg-surface-card rounded-lg border border-subtle text-xs text-on-surface-variant leading-relaxed flex items-start gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5">verified</span>
                  <div>
                    <strong className="text-on-surface">Prochaine étape :</strong> L'administrateur valide votre reçu sous peu. Vos identifiants de connexion et le lien de votre vitrine vous seront automatiquement délivrés par WhatsApp et par Email.
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-2.5 justify-center pt-2">
                <a
                  href={`https://wa.me/22565711741?text=${encodeURIComponent(
                    `Bonjour GotoShop, je viens de soumettre ma demande d'abonnement pour la boutique "${storeName}". Nom: ${ownerName}, Montant: ${activePlan?.price} FCFA.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 rounded-xl bg-secondary hover:brightness-105 text-white font-semibold text-xs shadow-md flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">chat</span>
                  <span>Contacter le Support WhatsApp</span>
                </a>
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-surface-secondary hover:bg-surface-elevated border border-subtle text-on-surface font-medium text-xs transition-colors cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </div>
          ) : (
            /* MULTI-STEP SUBSCRIPTION FORM */
            <form onSubmit={handleSubmit} className="space-y-6">
              {errorMessage && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-medium text-rose-300 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-rose-400">error</span>
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* SECTION 1: CHOIX DU FORFAIT */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[11px] flex items-center justify-center font-bold">1</span>
                    <span>Choisissez votre Formule d'Abonnement</span>
                  </label>
                  <span className="text-[11px] text-on-surface-variant font-normal">
                    Durée : 30 jours
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {plans.map((p) => {
                    const isSelected = selectedPlanCode === p.code;
                    const features = parseFeatures(p.features);
                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedPlanCode(p.code)}
                        className={`relative rounded-xl p-4 border transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? "bg-primary/5 border-primary ring-1 ring-primary/40 shadow-sm"
                            : "bg-surface-card border-subtle hover:border-strong"
                        }`}
                      >
                        {p.is_popular && (
                          <div className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-primary/20 border border-primary/30 text-[10px] font-semibold text-primary uppercase tracking-wider">
                            Recommandé
                          </div>
                        )}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-semibold text-sm text-on-surface">
                              {p.name.replace(/\(.*\)/, "").trim()}
                            </span>
                            <div
                              className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
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
                          <div className="text-lg font-bold text-on-surface my-1">
                            {p.price.toLocaleString("fr-FR")}{" "}
                            <span className="text-xs font-normal text-on-surface-variant">
                              FCFA / mois
                            </span>
                          </div>
                          <p className="text-[11px] text-on-surface-variant leading-snug mb-3 font-normal">
                            {p.description}
                          </p>
                        </div>

                        {/* Features bullet list */}
                        <ul className="space-y-1.5 text-[11px] text-on-surface-variant border-t border-subtle pt-3">
                          {features.slice(0, 3).map((f, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="material-symbols-outlined text-[14px] text-primary shrink-0 mt-0.5">check</span>
                              <span className="line-clamp-1">{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 2: COORDONNÉES DE LA BOUTIQUE */}
              <div className="space-y-3 border-t border-subtle pt-5">
                <label className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[11px] flex items-center justify-center font-bold">2</span>
                  <span>Informations de la Boutique & Gérant</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-on-surface-variant mb-1">
                      Nom de la boutique <span className="text-primary">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Awa Chic Mode, Faso Tech..."
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-surface-secondary border border-subtle text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-on-surface-variant mb-1">
                      Votre nom complet <span className="text-primary">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Traoré Awa"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-surface-secondary border border-subtle text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-on-surface-variant mb-1">
                      Numéro WhatsApp fonctionnel <span className="text-primary">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="+226 70 00 00 00"
                      value={ownerPhone}
                      onChange={(e) => setOwnerPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-surface-secondary border border-subtle text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40"
                    />
                    <p className="text-[10px] text-on-surface-variant/70 mt-1">
                      Vos identifiants et alertes commandes y seront envoyés.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-on-surface-variant mb-1">
                      Adresse Email <span className="text-on-surface-variant/60 font-normal">(Recommandé)</span>
                    </label>
                    <input
                      type="email"
                      placeholder="vendeur@gmail.com"
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-surface-secondary border border-subtle text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: PAIEMENT USSD ORANGE / MOOV / WAVE */}
              <div className="space-y-4 border-t border-subtle pt-5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[11px] flex items-center justify-center font-bold">3</span>
                    <span>Paiement Mobile Money par Code USSD</span>
                  </label>
                  <span className="text-xs font-semibold text-on-surface px-2.5 py-1 rounded-lg bg-surface-secondary border border-subtle">
                    Montant : {activePlan?.price.toLocaleString("fr-FR")} FCFA
                  </span>
                </div>

                {/* Operator Selector Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {currentPlanInfo?.payment_options?.map((opt) => {
                    const isOpSelected = selectedOperator === opt.operator_code;
                    const isOrange = opt.operator_code === "ORANGE";
                    const isMoov = opt.operator_code === "MOOV";
                    return (
                      <button
                        type="button"
                        key={opt.operator_code}
                        onClick={() => setSelectedOperator(opt.operator_code)}
                        className={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
                          isOpSelected
                            ? "bg-surface-elevated border-primary ring-1 ring-primary/40 shadow-sm"
                            : "bg-surface-card border-subtle hover:border-strong opacity-80 hover:opacity-100"
                        }`}
                      >
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-sm text-white"
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
                          <div className="font-semibold text-xs text-on-surface truncate">
                            {opt.operator_name}
                          </div>
                          <div className="text-[10px] text-on-surface-variant truncate">
                            {opt.merchant_number}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Dynamic USSD Action Panel */}
                {currentDialOption && (
                  <div className="bg-surface-secondary border border-subtle p-4 rounded-xl space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-[11px] font-medium text-on-surface-variant block">
                          Code USSD généré pour {activePlan?.name} :
                        </span>
                        <span className="font-mono text-base sm:text-lg font-bold tracking-wide text-primary select-all">
                          {currentDialOption.ussd_code}
                        </span>
                      </div>

                      {/* Direct Dial & Copy buttons */}
                      <div className="flex items-center gap-2">
                        {currentDialOption.ussd_code.startsWith("*") && (
                          <a
                            href={currentDialOption.tel_link}
                            className="px-3.5 py-2 rounded-xl bg-secondary hover:brightness-105 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">call</span>
                            <span>Composer l'USSD</span>
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => copyToClipboard(currentDialOption.ussd_code)}
                          className="px-3 py-2 rounded-xl bg-surface-card hover:bg-surface-elevated border border-subtle text-on-surface text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[15px]">
                            {copiedCode ? "check" : "content_copy"}
                          </span>
                          <span>{copiedCode ? "Copié !" : "Copier"}</span>
                        </button>
                      </div>
                    </div>

                    {/* Clear Notice Banner */}
                    <div className="p-3 rounded-lg bg-surface-card border border-subtle text-xs text-on-surface-variant leading-relaxed flex items-start gap-2">
                      <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5">info</span>
                      <div>
                        <span className="font-semibold text-on-surface">Instruction de validation : </span>
                        <span className="text-on-surface-variant">
                          {currentDialOption.instructions ||
                            "Effectuez le paiement via le code USSD ci-dessus, puis chargez la capture d'écran du reçu SMS de confirmation ci-dessous."}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 4: CHARGER LA CAPTURE DU PAIEMENT */}
              <div className="space-y-3 border-t border-subtle pt-5">
                <label className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[11px] flex items-center justify-center font-bold">4</span>
                  <span>Capture d'écran du Paiement (Preuve Obligatoire)</span>
                </label>

                <div className="border-2 border-dashed border-subtle hover:border-primary rounded-xl p-4 text-center transition-colors bg-surface-secondary/40">
                  {proofPreview ? (
                    <div className="space-y-3">
                      <div className="relative inline-block max-w-[200px] max-h-[220px] rounded-xl overflow-hidden border border-subtle shadow-md">
                        <img
                          src={proofPreview}
                          alt="Capture Reçu de Paiement"
                          className="w-full h-auto object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setProofPreview(null);
                            setProofData(null);
                          }}
                          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-rose-600/90 text-white flex items-center justify-center shadow cursor-pointer"
                          title="Supprimer cette capture"
                        >
                          <span className="material-symbols-outlined text-[14px]">close</span>
                        </button>
                      </div>
                      <p className="text-xs font-medium text-secondary flex items-center justify-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        <span>Capture d'écran prête</span>
                      </p>
                    </div>
                  ) : (
                    <label className="cursor-pointer block space-y-2 py-3">
                      <div className="w-11 h-11 rounded-xl bg-surface-secondary border border-subtle flex items-center justify-center text-on-surface-variant mx-auto">
                        <span className="material-symbols-outlined text-[24px]">photo_camera</span>
                      </div>
                      <div className="text-xs font-medium text-on-surface">
                        Cliquez ici pour charger la capture d'écran du reçu
                      </div>
                      <p className="text-[11px] text-on-surface-variant font-normal">
                        Format photo PNG, JPG ou WEBP (SMS ou notification Mobile Money)
                      </p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-on-surface-variant mb-1">
                    Référence de transaction ou remarque (Optionnel) :
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: ID Tx BF2609..., Payé depuis le 70000000..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-secondary border border-subtle text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Submit Button */}
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
                  disabled={isSubmitting || !proofData}
                  className={`px-5 py-2.5 rounded-xl font-semibold text-xs shadow-md flex items-center gap-2 transition-all cursor-pointer ${
                    isSubmitting || !proofData
                      ? "bg-surface-secondary text-on-surface-variant/40 border border-subtle cursor-not-allowed"
                      : "bg-primary hover:brightness-105 text-white active:scale-98"
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Envoi en cours...</span>
                    </>
                  ) : (
                    <>
                      <span>Valider et Activer ma Boutique</span>
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
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
