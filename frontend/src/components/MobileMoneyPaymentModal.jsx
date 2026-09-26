import React, { useState, useId } from "react";
import Icon from "./Icon";
import { payMobileMoneyOrder } from "../api/client";

export default function MobileMoneyPaymentModal({
  order,
  isOpen,
  onClose,
  onSuccess,
  showToast,
  customer,
}) {
  if (!isOpen || !order) return null;

  // Language state: 'fr' | 'en'
  const [lang, setLang] = useState("fr");

  // Step state: 1 (Choose Operator) | 2 (Enter Phone & OTP)
  const [step, setStep] = useState(1);

  // Selected operator: "ORANGE_MONEY" | "MOOV_MONEY" | "LIGDICASH"
  const [operator, setOperator] = useState(null);
  const [operatorError, setOperatorError] = useState(false);

  // Phone number state
  const initialPhone = customer?.phone || order.customer_phone || "";
  const [phoneNumber, setPhoneNumber] = useState(initialPhone);
  const [phoneError, setPhoneError] = useState("");

  // OTP Code state (6 digits strict)
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");

  // Banners / Alerts dismiss state
  const [dismissOperatorInfo, setDismissOperatorInfo] = useState(false);
  const [dismissUssdInfo, setDismissUssdInfo] = useState(false);
  const [dismissAmountInfo, setDismissAmountInfo] = useState(false);

  // Submitting state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState("");

  const totalAmount = order.total_amount || 0;
  const currency = "Francs"; // Conforme à l'affichage LigdiCash (ex: "100 Francs")
  const DEMO_OTP = "749201";

  // Deterministic or persistent transaction ID matching screenshots (e.g. P2812330811615)
  const rawTx = order.order_number || order.reference_code || order.id || "2812330811615";
  const cleanTx = rawTx.toString().replace(/\D/g, "");
  const transactionId = `P${cleanTx.padEnd(13, "0").slice(0, 13) || "2812330811615"}`;

  // USSD instructions based on operator
  const getUssdCode = () => {
    if (operator === "MOOV_MONEY") {
      return `*555*6*${totalAmount}#`;
    }
    return `*144*4*6*${totalAmount}#`;
  };

  const validatePhone = (val) => {
    const digits = val.replace(/\D/g, "");
    if (digits.length < 8) {
      setPhoneError(
        lang === "fr"
          ? "Le numéro doit comporter au moins 8 chiffres (sans indicatif)"
          : "Phone number must have at least 8 digits"
      );
      return false;
    }
    setPhoneError("");
    return true;
  };

  const validateOtp = (val) => {
    const clean = val.trim();
    if (!/^\d{6}$/.test(clean)) {
      setOtpError(
        lang === "fr"
          ? "Le code OTP doit être composé d'exactement 6 chiffres"
          : "OTP code must be exactly 6 digits"
      );
      return false;
    }
    setOtpError("");
    return true;
  };

  const handleNextStep = () => {
    if (!operator) {
      setOperatorError(true);
      return;
    }
    setOperatorError(false);
    setStep(2);
  };

  const handleFillDemoOtp = () => {
    setOtpCode(DEMO_OTP);
    setOtpError("");
    if (!phoneNumber.trim()) {
      setPhoneNumber("70123456");
      setPhoneError("");
    }
  };

  const handleProcessPayment = async (e) => {
    e.preventDefault();
    setGeneralError("");

    const isPhoneValid = validatePhone(phoneNumber);
    const isOtpValid = validateOtp(otpCode);

    if (!isPhoneValid || !isOtpValid) {
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await payMobileMoneyOrder(order.id, {
        operator: operator === "LIGDICASH" ? "ORANGE_MONEY" : operator,
        phoneNumber,
        otpCode,
        customerName: customer?.name || order.customer_name || "Client GotoShop",
        isTestMode: true,
      });

      const opName =
        operator === "ORANGE_MONEY"
          ? "Orange Money"
          : operator === "MOOV_MONEY"
          ? "Moov Money"
          : "LigdiCash";

      showToast?.(`Paiement validé avec succès (${opName}) !`);
      if (onSuccess) {
        onSuccess(res);
      }
      onClose();
    } catch (err) {
      const msg = err.message || "Erreur lors du traitement du paiement";
      setGeneralError(msg);
      showToast?.(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-sm sm:max-w-md bg-white text-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-100 font-sans max-h-[95vh]">
        {/* Close Button top-right */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
          title="Fermer"
        >
          <Icon name="close" className="text-[18px]" />
        </button>

        {/* Top Error Alert Banner if user clicked Suivant without choosing */}
        {step === 1 && operatorError && (
          <div className="bg-[#e53e3e] text-white px-4 py-2.5 flex items-center justify-between text-xs font-medium animate-fadeIn">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 bg-white rounded-xs shrink-0" />
              <span>{lang === "fr" ? "Choisissez un opérateur svp" : "Please select an operator"}</span>
            </div>
            <button
              type="button"
              onClick={() => setOperatorError(false)}
              className="text-white hover:text-slate-200 text-base font-bold px-1 cursor-pointer"
            >
              ×
            </button>
          </div>
        )}

        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* Language Selector: Anglais | 🇫🇷 Français */}
          <div className="flex justify-center pt-1">
            <div className="inline-flex rounded-md border border-slate-200 overflow-hidden bg-white text-xs shadow-2xs">
              <button
                type="button"
                onClick={() => setLang("en")}
                className={`px-5 py-1.5 transition-colors cursor-pointer font-medium ${
                  lang === "en" ? "bg-slate-100 text-slate-900 font-bold" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                Anglais
              </button>
              <button
                type="button"
                onClick={() => setLang("fr")}
                className={`px-5 py-1.5 flex items-center gap-1.5 transition-colors cursor-pointer font-medium border-l border-slate-200 ${
                  lang === "fr" ? "bg-slate-100 text-slate-900 font-bold" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span>🇫🇷</span>
                <span>Français</span>
              </button>
            </div>
          </div>

          {/* Red Transaction ID Badge */}
          <div className="flex justify-center">
            <span className="inline-block bg-[#d9534f] text-white font-mono text-[11px] sm:text-xs font-bold px-4 py-1 rounded-md shadow-2xs tracking-wide">
              Transaction ID : {transactionId}
            </span>
          </div>

          {/* STEP 1: OPERATOR SELECTION */}
          {step === 1 && (
            <div className="space-y-4 animate-fadeIn">
              {/* Info Alert Box */}
              {!dismissOperatorInfo && (
                <div className="bg-[#f8f9fa] border border-[#e9ecef] rounded-lg p-3 text-xs text-slate-600 relative flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full border border-slate-400 flex items-center justify-center text-slate-600 font-bold text-[11px] shrink-0 mt-0.5">
                    !
                  </div>
                  <div className="flex-1 pr-4 leading-relaxed">
                    <p className="font-medium text-slate-700">
                      {lang === "fr" ? "Veuillez bien choisir un opérateur svp." : "Please select an operator."}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {lang === "fr"
                        ? "Pour le faire, vous devez cliquer sur le logo dudit opérateur"
                        : "To do so, please click on the operator logo"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDismissOperatorInfo(true)}
                    className="text-slate-400 hover:text-slate-600 text-sm font-bold absolute top-2 right-2 cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* 3 Operator Cards Grid */}
              <div className="grid grid-cols-3 gap-2.5 pt-1">
                {/* 1. Compte LigdiCash */}
                <button
                  type="button"
                  onClick={() => {
                    setOperator("LIGDICASH");
                    setOperatorError(false);
                  }}
                  className={`flex flex-col items-center justify-between rounded-xl border transition-all cursor-pointer overflow-hidden p-2 text-center h-28 sm:h-32 ${
                    operator === "LIGDICASH"
                      ? "border-emerald-600 ring-2 ring-emerald-500/30 bg-emerald-50/30 shadow-xs"
                      : "border-slate-200 bg-[#f8f9fa] hover:border-slate-300"
                  }`}
                >
                  <div className="w-full flex-1 flex items-center justify-center p-1">
                    <img
                      src="/media/payments/ligdicash.svg"
                      alt="LigdiCash"
                      className="max-h-12 w-auto object-contain"
                    />
                  </div>
                  <div className="w-full pt-1 border-t border-slate-100">
                    <span className="text-[10px] sm:text-[11px] font-medium text-slate-600 block leading-tight">
                      Compte
                    </span>
                    <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 block leading-tight">
                      ligdicash ™
                    </span>
                  </div>
                </button>

                {/* 2. Orange Burkina */}
                <button
                  type="button"
                  onClick={() => {
                    setOperator("ORANGE_MONEY");
                    setOperatorError(false);
                  }}
                  className={`flex flex-col items-center justify-between rounded-xl border transition-all cursor-pointer overflow-hidden p-2 text-center h-28 sm:h-32 ${
                    operator === "ORANGE_MONEY"
                      ? "border-orange-500 ring-2 ring-orange-500/30 bg-orange-50/30 shadow-xs"
                      : "border-slate-200 bg-[#f8f9fa] hover:border-slate-300"
                  }`}
                >
                  <div className="w-full flex-1 flex items-center justify-center p-1">
                    <img
                      src="/orangeMoney.png"
                      alt="Orange Money Burkina"
                      className="max-h-12 w-auto object-contain"
                    />
                  </div>
                  <div className="w-full pt-1 border-t border-slate-100">
                    <span className="text-[10px] sm:text-[11px] font-bold text-slate-800 block uppercase tracking-tight">
                      Orange
                    </span>
                    <span className="text-[9px] sm:text-[10px] font-medium text-slate-500 block uppercase tracking-tight">
                      Burkina
                    </span>
                  </div>
                </button>

                {/* 3. Moov Africa Burkina */}
                <button
                  type="button"
                  onClick={() => {
                    setOperator("MOOV_MONEY");
                    setOperatorError(false);
                  }}
                  className={`flex flex-col items-center justify-between rounded-xl border transition-all cursor-pointer overflow-hidden p-2 text-center h-28 sm:h-32 ${
                    operator === "MOOV_MONEY"
                      ? "border-blue-600 ring-2 ring-blue-500/30 bg-blue-50/30 shadow-xs"
                      : "border-slate-200 bg-[#f8f9fa] hover:border-slate-300"
                  }`}
                >
                  <div className="w-full flex-1 flex items-center justify-center p-1">
                    <img
                      src="/MoovMoney.png"
                      alt="Moov Africa Burkina"
                      className="max-h-12 w-auto object-contain"
                    />
                  </div>
                  <div className="w-full pt-1 border-t border-slate-100">
                    <span className="text-[10px] sm:text-[11px] font-bold text-slate-800 block uppercase tracking-tight">
                      Moov Africa
                    </span>
                    <span className="text-[9px] sm:text-[10px] font-medium text-slate-500 block uppercase tracking-tight">
                      Burkina
                    </span>
                  </div>
                </button>
              </div>

              {/* Navigation Action */}
              <div className="pt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="bg-[#00a65a] hover:bg-[#008d4c] active:scale-98 text-white font-medium text-xs sm:text-sm px-6 py-2.5 rounded-md shadow-xs transition-all cursor-pointer"
                >
                  {lang === "fr" ? "Suivant" : "Next"}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: ENTER PHONE & OTP */}
          {step === 2 && (
            <form onSubmit={handleProcessPayment} className="space-y-3.5 animate-fadeIn">
              {/* Alert 1: USSD Instructions */}
              {!dismissUssdInfo && (
                <div className="bg-[#f8f9fa] border border-[#e9ecef] rounded-lg p-3 text-xs text-slate-700 relative flex items-start gap-2.5">
                  <Icon name="warning" className="text-[#333] text-[18px] shrink-0 mt-0.5" />
                  <div className="flex-1 pr-4 leading-relaxed">
                    <span>{lang === "fr" ? "Composez " : "Dial "}</span>
                    <strong className="text-[#e11d48] font-mono font-bold text-sm tracking-wide">
                      {getUssdCode()}
                    </strong>
                    <span>
                      {lang === "fr"
                        ? " sur votre portable. Puis saisissez votre numéro de paiement et le code OTP reçu dans les champs ci-dessous"
                        : " on your phone. Then enter your payment number and the OTP code received in the fields below"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDismissUssdInfo(true)}
                    className="text-slate-400 hover:text-slate-600 text-sm font-bold absolute top-2 right-2 cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Alert 2: Amount to Pay */}
              {!dismissAmountInfo && (
                <div className="bg-[#f8f9fa] border border-[#e9ecef] rounded-lg p-3 text-xs text-slate-700 relative flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon name="warning" className="text-[#333] text-[18px] shrink-0" />
                    <span className="font-medium">
                      {lang === "fr" ? "Montant à payer : " : "Amount to pay: "}
                    </span>
                    <span className="text-[#e11d48] font-bold text-sm">
                      {totalAmount.toLocaleString("fr-FR")} {currency}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDismissAmountInfo(true)}
                    className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* General Error Message */}
              {generalError && (
                <div className="p-2.5 bg-red-50 border border-red-300 rounded-lg text-red-600 text-xs flex items-center gap-2">
                  <Icon name="error" className="text-[16px] shrink-0" />
                  <span>{generalError}</span>
                </div>
              )}

              {/* Phone Input Field */}
              <div className="space-y-1">
                <label className="text-xs text-slate-800 font-medium block">
                  {lang === "fr"
                    ? "Numéro de téléphone (sans indicatif)"
                    : "Phone number (without country code)"}
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPhoneNumber(val);
                    if (phoneError) validatePhone(val);
                  }}
                  placeholder="Ex: 70 12 34 56"
                  className={`w-full h-11 px-3 rounded-lg bg-white border text-sm text-slate-800 font-mono transition-colors focus:outline-none ${
                    phoneError
                      ? "border-red-500 focus:border-red-500"
                      : "border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500"
                  }`}
                  required
                />
                {phoneError && <p className="text-[11px] text-red-500 mt-0.5">{phoneError}</p>}
              </div>

              {/* OTP Code Field */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <label className="text-slate-800 font-medium">
                    {lang === "fr" ? "Code OTP Tapez " : "OTP Code Dial "}
                    <span className="text-[#e11d48] font-mono font-bold">{getUssdCode()}</span>
                  </label>
                </div>
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setOtpCode(val);
                    if (otpError && val.length === 6) setOtpError("");
                  }}
                  placeholder="Ex: 749201"
                  className={`w-full h-11 px-3 rounded-lg bg-white border text-base font-mono tracking-widest text-slate-800 transition-colors focus:outline-none ${
                    otpError
                      ? "border-red-500 focus:border-red-500"
                      : "border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500"
                  }`}
                  required
                />
                {otpError && <p className="text-[11px] text-red-500 mt-0.5">{otpError}</p>}

                {/* Simulation helper chip */}
                <div className="pt-1 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Code reçu par SMS de l'opérateur</span>
                  <button
                    type="button"
                    onClick={handleFillDemoOtp}
                    className="text-emerald-700 hover:text-emerald-800 font-medium underline cursor-pointer"
                  >
                    OTP de test ({DEMO_OTP})
                  </button>
                </div>
              </div>

              {/* Action Buttons: Précédent & Payer */}
              <div className="pt-3 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="bg-[#00a65a] hover:bg-[#008d4c] text-white font-medium text-xs sm:text-sm px-5 py-2.5 rounded-md transition-all cursor-pointer"
                >
                  {lang === "fr" ? "Précédent" : "Previous"}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[#00a65a] hover:bg-[#008d4c] active:scale-98 text-white font-medium text-xs sm:text-sm px-6 py-2.5 rounded-md shadow-xs transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Icon name="sync" className="animate-spin text-[16px]" />
                      <span>{lang === "fr" ? "Traitement..." : "Processing..."}</span>
                    </>
                  ) : (
                    <span>{lang === "fr" ? "Payer" : "Pay"}</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Pagination Indicator Dots */}
          <div className="pt-2 flex justify-center items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                step === 1 ? "bg-[#00a65a]" : "bg-emerald-200"
              }`}
            />
            <span
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                step === 2 ? "bg-[#00a65a]" : "bg-emerald-200"
              }`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
