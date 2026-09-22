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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto"
    >
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header bar */}
        <div className="relative px-5 py-4 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-500 text-white flex items-center justify-between shadow-md flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center font-black text-xl shadow-inner">
              ⭐
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight leading-tight">
                {mode === "NEW_STORE"
                  ? "Ouvrir ma Boutique en Ligne"
                  : mode === "UPGRADE"
                  ? "Changer de Formule"
                  : "Renouveler mon Abonnement"}
              </h2>
              <p className="text-xs text-amber-100/90 font-medium">
                Paiement Mobile Money instantané par USSD & Activation directe
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center text-white text-lg font-bold transition-transform active:scale-95"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-slate-100 flex-grow">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-sm text-slate-400 font-medium">
                Chargement des formules et passerelles de paiement...
              </p>
            </div>
          ) : submitSuccess ? (
            /* SUCCESS CONFIRMATION SCREEN */
            <div className="text-center py-6 px-2 space-y-5 animate-fade-in">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-3xl mx-auto shadow-lg shadow-emerald-950">
                ✓
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-white">
                  Demande Transmise avec Succès !
                </h3>
                <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                  Merci <strong>{ownerName}</strong> ! Votre capture de paiement de{" "}
                  <span className="text-amber-400 font-bold">
                    {submittedData?.amount || activePlan?.price} {submittedData?.currency || "FCFA"}
                  </span>{" "}
                  a bien été reçue par notre équipe d'administration.
                </p>
              </div>

              {/* Status card */}
              <div className="bg-slate-800/90 border border-slate-700 p-4 rounded-2xl text-left space-y-3 max-w-md mx-auto">
                <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-700/60">
                  <span className="text-slate-400">Statut de la demande :</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">
                    ⏳ EN ATTENTE DE VÉRIFICATION
                  </span>
                </div>
                <div className="text-xs space-y-1 text-slate-300">
                  <p>
                    <strong>Boutique :</strong> {submittedData?.store_name || storeName}
                  </p>
                  <p>
                    <strong>Formule choisie :</strong> {submittedData?.plan_name || activePlan?.name}
                  </p>
                  <p>
                    <strong>Canal de contact :</strong> {ownerPhone} {ownerEmail ? `• ${ownerEmail}` : ""}
                  </p>
                </div>
                <div className="p-3 bg-slate-900/80 rounded-xl border border-amber-500/30 text-xs text-amber-200/90 leading-relaxed">
                  📲 <strong>Prochaine étape :</strong> L'administrateur valide votre reçu sous peu. Vos identifiants de connexion et le lien de votre vitrine vous seront automatiquement délivrés par <strong>WhatsApp</strong> et par <strong>Email</strong>.
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <a
                  href={`https://wa.me/22565711741?text=${encodeURIComponent(
                    `Bonjour GotoShop, je viens de soumettre ma demande d'abonnement pour la boutique "${storeName}". Nom: ${ownerName}, Montant: ${activePlan?.price} FCFA.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md flex items-center justify-center space-x-2 transition-all"
                >
                  <span>💬 Contacter le Support WhatsApp</span>
                </a>
                <button
                  onClick={onClose}
                  className="px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm transition-all"
                >
                  Fermer
                </button>
              </div>
            </div>
          ) : (
            /* MULTI-STEP SUBSCRIPTION FORM */
            <form onSubmit={handleSubmit} className="space-y-6">
              {errorMessage && (
                <div className="p-3.5 bg-rose-500/20 border border-rose-500/50 rounded-2xl text-xs font-semibold text-rose-200 flex items-center space-x-2">
                  <span>⚠️</span>
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* SECTION 1: CHOIX DU FORFAIT */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center space-x-1.5">
                    <span>1.</span>
                    <span>Choisissez votre Formule d'Abonnement</span>
                  </label>
                  <span className="text-[11px] text-slate-400 font-medium">
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
                        className={`relative rounded-2xl p-3.5 border transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? "bg-amber-500/10 border-amber-500 shadow-md shadow-amber-950/40 ring-2 ring-amber-500/30"
                            : "bg-slate-800/60 border-slate-700 hover:border-slate-600"
                        }`}
                      >
                        {p.is_popular && (
                          <div className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-[10px] font-black text-white uppercase tracking-wider shadow-sm">
                            ⭐ Recommandé
                          </div>
                        )}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-extrabold text-sm text-white">
                              {p.name.replace(/\(.*\)/, "").trim()}
                            </span>
                            <div
                              className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                isSelected
                                  ? "border-amber-400 bg-amber-500"
                                  : "border-slate-500"
                              }`}
                            >
                              {isSelected && (
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />
                              )}
                            </div>
                          </div>
                          <div className="text-xl font-black text-amber-400 my-1">
                            {p.price.toLocaleString("fr-FR")}{" "}
                            <span className="text-xs font-bold text-slate-300">
                              FCFA / mois
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-snug mb-3">
                            {p.description}
                          </p>
                        </div>

                        {/* Features bullet list */}
                        <ul className="space-y-1 text-[11px] text-slate-300 border-t border-slate-700/60 pt-2.5">
                          {features.slice(0, 3).map((f, idx) => (
                            <li key={idx} className="flex items-start space-x-1.5">
                              <span className="text-amber-400 font-bold">✓</span>
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
              <div className="space-y-3 border-t border-slate-800 pt-5">
                <label className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center space-x-1.5">
                  <span>2.</span>
                  <span>Informations de la Boutique & Gérant</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Nom de la boutique <span className="text-amber-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Awa Chic Mode, Kadi Cosmétiques..."
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Votre Nom complet <span className="text-amber-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Traoré Awa"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Numéro WhatsApp fonctionnel <span className="text-amber-400">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="+225 07 12 34 56 78"
                      value={ownerPhone}
                      onChange={(e) => setOwnerPhone(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Vos identifiants et alertes commandes y seront envoyés.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Adresse Email <span className="text-slate-400 font-normal">(Recommandé)</span>
                    </label>
                    <input
                      type="email"
                      placeholder="vendeur@gmail.com"
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: PAIEMENT USSD ORANGE / MOOV */}
              <div className="space-y-4 border-t border-slate-800 pt-5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center space-x-1.5">
                    <span>3.</span>
                    <span>Paiement Mobile Money par Code USSD</span>
                  </label>
                  <span className="text-xs font-black text-white px-2 py-0.5 rounded-lg bg-amber-500/20 border border-amber-500/30">
                    Montant : {activePlan?.price.toLocaleString("fr-FR")} FCFA
                  </span>
                </div>

                {/* Operator Selector Buttons with official colors and logos */}
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
                        className={`p-3 rounded-2xl border text-left transition-all flex items-center space-x-3 ${
                          isOpSelected
                            ? "ring-2 shadow-lg"
                            : "opacity-80 hover:opacity-100 bg-slate-800/80 border-slate-700"
                        }`}
                        style={{
                          backgroundColor: isOpSelected
                            ? isOrange
                              ? "#FF7900"
                              : isMoov
                              ? "#005BAA"
                              : "#0284c7"
                            : undefined,
                          borderColor: isOpSelected ? "#ffffff" : undefined,
                          color: isOpSelected ? "#ffffff" : "#f1f5f9",
                        }}
                      >
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 shadow-sm"
                          style={{
                            backgroundColor: isOpSelected
                              ? "rgba(255,255,255,0.2)"
                              : isOrange
                              ? "#FF7900"
                              : isMoov
                              ? "#005BAA"
                              : "#0284c7",
                            color: "#FFFFFF",
                          }}
                        >
                          {isOrange ? "OM" : isMoov ? "MOOV" : "WAVE"}
                        </div>
                        <div className="min-w-0">
                          <div className="font-extrabold text-xs truncate">
                            {opt.operator_name}
                          </div>
                          <div className="text-[10px] opacity-90 truncate">
                            {opt.merchant_number}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Dynamic USSD Action Panel */}
                {currentDialOption && (
                  <div className="bg-slate-800/90 border border-slate-700 p-4 rounded-2xl space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-semibold text-slate-400 block">
                          Code USSD généré pour {activePlan?.name} :
                        </span>
                        <span className="font-mono text-base sm:text-lg font-black tracking-wide text-amber-400 select-all">
                          {currentDialOption.ussd_code}
                        </span>
                      </div>

                      {/* Direct Dial & Copy buttons */}
                      <div className="flex items-center space-x-2">
                        {currentDialOption.ussd_code.startsWith("*") && (
                          <a
                            href={currentDialOption.tel_link}
                            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold shadow-md flex items-center space-x-1.5 transition-all"
                          >
                            <span>📞</span>
                            <span>Composer l'USSD</span>
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => copyToClipboard(currentDialOption.ussd_code)}
                          className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold flex items-center space-x-1 transition-all"
                        >
                          <span>{copiedCode ? "✓ Copié !" : "📋 Copier"}</span>
                        </button>
                      </div>
                    </div>

                    {/* Clear Notice Banner */}
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs leading-relaxed space-y-1">
                      <p className="font-bold flex items-center space-x-1.5">
                        <span>💡</span>
                        <span>Instruction de validation obligatoire :</span>
                      </p>
                      <p className="text-[11px] text-amber-100/90">
                        {currentDialOption.instructions ||
                          "Effectuez le paiement via le code USSD ci-dessus, puis chargez obligatoirement la capture d'écran du reçu SMS de confirmation ci-dessous."}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 4: CHARGER LA CAPTURE DU PAIEMENT */}
              <div className="space-y-3 border-t border-slate-800 pt-5">
                <label className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center space-x-1.5">
                  <span>4.</span>
                  <span>Capture d'écran du Paiement (Preuve Obligatoire)</span>
                </label>

                <div className="border-2 border-dashed border-slate-700 hover:border-amber-500 rounded-2xl p-4 text-center transition-all bg-slate-800/40">
                  {proofPreview ? (
                    <div className="space-y-3">
                      <div className="relative inline-block max-w-[200px] max-h-[220px] rounded-xl overflow-hidden border border-slate-600 shadow-md">
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
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-rose-600 text-white font-bold text-xs flex items-center justify-center shadow"
                          title="Supprimer cette capture"
                        >
                          ✕
                        </button>
                      </div>
                      <p className="text-xs font-semibold text-emerald-400 flex items-center justify-center space-x-1">
                        <span>✓ Capture d'écran prête</span>
                      </p>
                    </div>
                  ) : (
                    <label className="cursor-pointer block space-y-2 py-4">
                      <div className="w-12 h-12 rounded-2xl bg-slate-700/80 border border-slate-600 flex items-center justify-center text-2xl mx-auto text-amber-400">
                        📷
                      </div>
                      <div className="text-xs font-bold text-white">
                        Cliquez ici pour charger la capture d'écran du reçu
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Format photo PNG, JPG ou WEBP (SMS ou reçu Mobile Money)
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
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Référence de transaction ou remarque (Optionnel) :
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: ID Tx CI2609..., Payé depuis le 07080910..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="border-t border-slate-800 pt-4 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !proofData}
                  className={`px-6 py-3 rounded-2xl font-black text-sm shadow-xl flex items-center space-x-2 transition-all ${
                    isSubmitting || !proofData
                      ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-white shadow-amber-950/60 active:scale-98"
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Envoi en cours...</span>
                    </>
                  ) : (
                    <>
                      <span>Valider et Activer ma Boutique</span>
                      <span>➔</span>
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
