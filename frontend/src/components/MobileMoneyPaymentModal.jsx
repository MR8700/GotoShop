import React, { useState } from "react";
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

  // Selected operator: "ORANGE_MONEY" | "MOOV_MONEY"
  const [operator, setOperator] = useState("ORANGE_MONEY");

  // Phone number state with initial customer phone fallback
  const initialPhone = customer?.phone || order.customer_phone || "";
  const [phoneNumber, setPhoneNumber] = useState(initialPhone);
  const [phoneError, setPhoneError] = useState("");

  // OTP Code state (6 digits strict)
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [showOtp, setShowOtp] = useState(false);

  // Test mode flag and helper
  const [isTestMode, setIsTestMode] = useState(true);
  const DEMO_OTP = "749201";

  // Submitting state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState("");

  const totalAmount = order.total_amount || 0;
  const currency = order.currency || "FCFA";

  const validatePhone = (val) => {
    const digits = val.replace(/\D/g, "");
    if (digits.length < 8) {
      setPhoneError("Le numéro doit comporter au moins 8 chiffres (ex: 70 12 34 56)");
      return false;
    }
    setPhoneError("");
    return true;
  };

  const validateOtp = (val) => {
    const clean = val.trim();
    if (!/^\d{6}$/.test(clean)) {
      setOtpError("Le code OTP doit être composé d'exactement 6 chiffres");
      return false;
    }
    setOtpError("");
    return true;
  };

  const handlePhoneChange = (e) => {
    const val = e.target.value;
    setPhoneNumber(val);
    if (phoneError) validatePhone(val);
  };

  const handleOtpChange = (e) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
    setOtpCode(val);
    if (otpError && val.length === 6) {
      setOtpError("");
    }
  };

  const handleFillDemoCredentials = () => {
    if (!phoneNumber.trim()) {
      setPhoneNumber("70 12 34 56");
    }
    setOtpCode(DEMO_OTP);
    setPhoneError("");
    setOtpError("");
    setGeneralError("");
    showToast?.("🧪 Identifiants et OTP de test (749201) insérés en 1 clic !");
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
        operator,
        phoneNumber,
        otpCode,
        customerName: customer?.name || order.customer_name || "Client GotoShop",
        isTestMode,
      });

      showToast?.(`🎉 Paiement validé avec succès (${operator === "ORANGE_MONEY" ? "Orange Money" : "Moov Money"}) !`);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-surface border-2 border-slate-300 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-foreground max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-subtle bg-surface-elevated flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-bold">
              <Icon name="payments" className="text-[20px]" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-on-surface flex items-center gap-1.5">
                <span>Règlement Mobile Money</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30">
                  LigdiCash API
                </span>
              </h3>
              <p className="text-[11px] text-on-surface-variant">
                Commande #{order.order_number || order.reference_code || order.id?.substring(0, 8)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-secondary transition-colors cursor-pointer"
          >
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <form onSubmit={handleProcessPayment} className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Order Summary Strip */}
          <div className="p-3 rounded-xl bg-surface-secondary border border-subtle flex items-center justify-between">
            <span className="text-xs text-on-surface-variant font-medium">Montant total à solder :</span>
            <span className="text-base font-bold text-primary tabular-nums">
              {totalAmount.toLocaleString("fr-FR")} {currency}
            </span>
          </div>

          {/* Delivery Guarantee Pill */}
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2.5 text-xs text-emerald-600 dark:text-emerald-400">
            <Icon name="electric_moped" className="text-[20px] shrink-0" />
            <span className="leading-tight font-medium">
              <strong>Livraison express garantie :</strong> Votre colis est expédié et livré sous <strong>45 min à 2h</strong> dès confirmation du paiement.
            </span>
          </div>

          {/* Error Message if any */}
          {generalError && (
            <div className="p-3 bg-red-500/10 border border-red-500/40 rounded-xl text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <Icon name="error" className="text-[18px] shrink-0" />
              <span>{generalError}</span>
            </div>
          )}

          {/* Operator Selector with Official Logos */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-on-surface block">
              Choisissez votre opérateur Mobile Money :
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {/* Orange Money */}
              <button
                type="button"
                onClick={() => setOperator("ORANGE_MONEY")}
                className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all cursor-pointer ${
                  operator === "ORANGE_MONEY"
                    ? "border-orange-500 bg-orange-500/10 ring-2 ring-orange-500/20 shadow-xs"
                    : "border-subtle bg-surface-secondary hover:border-slate-400 dark:hover:border-slate-600"
                }`}
              >
                <div className="w-16 h-10 flex items-center justify-center overflow-hidden rounded-lg bg-white p-1 shadow-2xs">
                  <img
                    src="/media/payments/orange_money.png"
                    alt="Orange Money"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div className="text-center">
                  <span className="text-xs font-bold text-on-surface block">Orange Money</span>
                  <span className="text-[10px] text-orange-600 dark:text-orange-400 font-semibold">Burkina Faso</span>
                </div>
              </button>

              {/* Moov Money */}
              <button
                type="button"
                onClick={() => setOperator("MOOV_MONEY")}
                className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all cursor-pointer ${
                  operator === "MOOV_MONEY"
                    ? "border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/20 shadow-xs"
                    : "border-subtle bg-surface-secondary hover:border-slate-400 dark:hover:border-slate-600"
                }`}
              >
                <div className="w-16 h-10 flex items-center justify-center overflow-hidden rounded-lg bg-white p-1 shadow-2xs">
                  <img
                    src="/media/payments/moov_money.png"
                    alt="Moov Money"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div className="text-center">
                  <span className="text-xs font-bold text-on-surface block">Moov Money</span>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">Burkina Faso</span>
                </div>
              </button>
            </div>
          </div>

          {/* Test Mode Interactive Helper Box */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <Icon name="science" className="text-[16px]" />
                Mode Test Démonstration
              </span>
              <span className="text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 font-mono px-2 py-0.5 rounded-full font-bold">
                OTP Suggéré : {DEMO_OTP}
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              Pour tester sans débit réel, utilisez votre numéro ou insérez l'OTP de démo en 1 clic :
            </p>
            <button
              type="button"
              onClick={handleFillDemoCredentials}
              className="w-full py-1.5 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-amber-500/30"
            >
              <Icon name="content_copy" className="text-[14px]" />
              <span>📋 Copier / Insérer l'OTP de test ({DEMO_OTP})</span>
            </button>
          </div>

          {/* Phone Number Input */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-on-surface flex items-center justify-between">
              <span>Numéro de téléphone {operator === "ORANGE_MONEY" ? "Orange" : "Moov"} :</span>
              <span className="text-[10px] text-on-surface-variant font-normal">8 chiffres minimum</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
                <Icon name="phone" className="text-[18px]" />
              </div>
              <input
                type="tel"
                value={phoneNumber}
                onChange={handlePhoneChange}
                placeholder="Ex: 70 12 34 56 ou +226 ..."
                className={`w-full h-11 pl-10 pr-3 rounded-xl bg-surface-secondary border text-xs font-mono transition-colors focus:outline-none ${
                  phoneError
                    ? "border-red-500 focus:border-red-500"
                    : "border-subtle focus:border-primary"
                }`}
                required
              />
            </div>
            {phoneError && (
              <p className="text-[11px] text-red-500 flex items-center gap-1 mt-0.5">
                <Icon name="warning" className="text-[14px]" />
                <span>{phoneError}</span>
              </p>
            )}
          </div>

          {/* Secure 6-Digit OTP Code Input */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-on-surface flex items-center justify-between">
              <span>Code secret OTP (6 chiffres) :</span>
              <span className="text-[10px] text-primary font-semibold">Champ sécurisé</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
                <Icon name="lock" className="text-[18px]" />
              </div>
              <input
                type={showOtp ? "text" : "password"}
                maxLength={6}
                value={otpCode}
                onChange={handleOtpChange}
                placeholder="Ex: 749201"
                className={`w-full h-11 pl-10 pr-10 rounded-xl bg-surface-secondary border text-sm font-mono tracking-widest transition-colors focus:outline-none ${
                  otpError
                    ? "border-red-500 focus:border-red-500"
                    : "border-subtle focus:border-primary"
                }`}
                required
              />
              <button
                type="button"
                onClick={() => setShowOtp(!showOtp)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-on-surface-variant hover:text-on-surface cursor-pointer"
                title={showOtp ? "Masquer" : "Afficher"}
              >
                <Icon name={showOtp ? "visibility_off" : "visibility"} className="text-[18px]" />
              </button>
            </div>
            {otpError && (
              <p className="text-[11px] text-red-500 flex items-center gap-1 mt-0.5">
                <Icon name="warning" className="text-[14px]" />
                <span>{otpError}</span>
              </p>
            )}
            <p className="text-[10px] text-on-surface-variant">
              Reçu par SMS de votre opérateur (ou généré via #144# / *166#).
            </p>
          </div>

          {/* Security Badge */}
          <div className="pt-1 flex items-center justify-center gap-2 text-[10px] text-on-surface-variant opacity-80">
            <Icon name="verified_user" className="text-[14px] text-emerald-500" />
            <span>Chiffrement SSL 256-bit • Transaction garantie par LigdiCash</span>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 rounded-xl bg-surface-secondary hover:bg-surface-elevated text-on-surface text-xs font-semibold border border-subtle transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex-[2] h-11 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-98 cursor-pointer ${
                operator === "ORANGE_MONEY"
                  ? "bg-orange-600 hover:bg-orange-500"
                  : "bg-blue-600 hover:bg-blue-500"
              }`}
            >
              {isSubmitting ? (
                <>
                  <Icon name="sync" className="animate-spin text-[16px]" />
                  <span>Validation LigdiCash...</span>
                </>
              ) : (
                <>
                  <Icon name="check" className="text-[18px]" />
                  <span>Payer {totalAmount.toLocaleString("fr-FR")} {currency}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
