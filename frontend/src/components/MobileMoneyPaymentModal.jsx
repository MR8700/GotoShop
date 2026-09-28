import React, { useState, useEffect, useRef } from "react";
import Icon from "./Icon";
import { payMobileMoneyOrder, requestOrderPaymentOtp } from "../api/client";

export default function MobileMoneyPaymentModal({
  order,
  isOpen,
  onClose,
  onSuccess,
  showToast,
  customer,
}) {
  // Always invoke all hooks at the top level
  const [step, setStep] = useState(1); // 1: Operator & Phone | 2: 6-digit OTP | 3: Receipt
  const [operator, setOperator] = useState("ORANGE_MONEY");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [simulatedCode, setSimulatedCode] = useState(null);
  const [countdown, setCountdown] = useState(300);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [receiptData, setReceiptData] = useState(null);

  const inputRefs = useRef([]);

  // Sync initial phone from customer / order
  useEffect(() => {
    if (order) {
      const p = customer?.phone || order.customer_phone || "";
      setPhoneNumber(p);
    }
  }, [order, customer]);

  // Countdown timer for OTP expiry
  useEffect(() => {
    let timer = null;
    if (step === 2 && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((c) => Math.max(0, c - 1));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [step, countdown]);

  // Resend cooldown timer
  useEffect(() => {
    let timer = null;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((c) => Math.max(0, c - 1));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [resendCooldown]);

  if (!isOpen || !order) return null;

  const totalAmount = order.total_amount || 0;
  const currency = "FCFA";

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const handleRequestOtp = async () => {
    const clean = phoneNumber.replace(/\D/g, "");
    if (clean.length < 8) {
      setPhoneError("Veuillez saisir un numéro valide (au moins 8 chiffres).");
      return;
    }
    setPhoneError("");
    setIsRequestingOtp(true);
    setOtpError("");

    try {
      const res = await requestOrderPaymentOtp(order.id, {
        phoneNumber,
        operator: operator === "MOOV_MONEY" ? "MOOV" : "ORANGE",
      });
      if (res.simulated_code) {
        setSimulatedCode(res.simulated_code);
      }
      setCountdown(300);
      setResendCooldown(25);
      setStep(2);
      setTimeout(() => {
        if (inputRefs.current[0]) inputRefs.current[0].focus();
      }, 100);
    } catch (err) {
      setPhoneError(err.message || "Erreur lors de l'envoi de l'OTP");
    } finally {
      setIsRequestingOtp(false);
    }
  };

  const handleDigitChange = (index, value) => {
    const char = value.slice(-1);
    if (char && !/^\d$/.test(char)) return;

    const next = [...otpDigits];
    next[index] = char;
    setOtpDigits(next);
    setOtpError("");

    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!paste) return;
    const next = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      next[i] = paste[i] || "";
    }
    setOtpDigits(next);
    const lastIdx = Math.min(paste.length, 5);
    inputRefs.current[lastIdx]?.focus();
  };

  const handleFillSimulatedCode = () => {
    if (!simulatedCode) return;
    const next = simulatedCode.split("").slice(0, 6);
    setOtpDigits(next);
    setOtpError("");
    if (inputRefs.current[5]) inputRefs.current[5].focus();
  };

  const handleConfirmPayment = async () => {
    const code = otpDigits.join("");
    if (code.length !== 6) {
      setOtpError("Veuillez saisir les 6 chiffres du code OTP.");
      return;
    }
    setOtpError("");
    setIsSubmitting(true);

    try {
      const res = await payMobileMoneyOrder(order.id, {
        operator: operator === "MOOV_MONEY" ? "MOOV" : "ORANGE",
        phoneNumber,
        otpCode: code,
        customerName: customer?.name || order.customer_name || "Client",
        isTestMode: true,
      });

      setReceiptData({
        orderId: order.id,
        orderNumber: order.order_number,
        amount: totalAmount,
        currency,
        operator: operator === "MOOV_MONEY" ? "Moov Money" : "Orange Money",
        phone: phoneNumber,
        transactionRef: res.transaction_reference || `TXN-${order.id.slice(-6).toUpperCase()}`,
        date: new Date().toLocaleString("fr-FR"),
      });
      setStep(3);
      if (onSuccess) onSuccess(res);
    } catch (err) {
      setOtpError(err.message || "Échec du paiement. Vérifiez le code OTP.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Icon name="smartphone" className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Paiement Mobile Money</h3>
              <p className="text-xs text-orange-100">LigdiCash • Passerelle Sécurisée</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        {/* Total Amount Badge */}
        <div className="bg-orange-50 dark:bg-orange-950/30 px-6 py-3 border-b border-orange-100 dark:border-orange-900/40 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Montant de la commande :
          </span>
          <span className="text-lg font-black text-orange-600 dark:text-orange-400">
            {totalAmount.toLocaleString("fr-FR")} {currency}
          </span>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* STEP 1: Operator & Phone */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">
                  1. Choisissez votre opérateur
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setOperator("ORANGE_MONEY")}
                    className={`p-3.5 rounded-2xl border-2 text-left flex flex-col items-center gap-2 transition-all ${
                      operator === "ORANGE_MONEY"
                        ? "border-orange-500 bg-orange-50/60 dark:bg-orange-950/40 shadow-sm"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-orange-500 text-white font-black flex items-center justify-center text-sm shadow">
                      OM
                    </div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Orange Money
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOperator("MOOV_MONEY")}
                    className={`p-3.5 rounded-2xl border-2 text-left flex flex-col items-center gap-2 transition-all ${
                      operator === "MOOV_MONEY"
                        ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 shadow-sm"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-black flex items-center justify-center text-sm shadow">
                      Moov
                    </div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Moov Money
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">
                  2. Numéro de téléphone de débit
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => {
                      setPhoneNumber(e.target.value);
                      setPhoneError("");
                    }}
                    placeholder="Ex: 70 12 34 56 ou +226..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                {phoneError && (
                  <p className="text-xs text-rose-500 font-medium mt-1.5">{phoneError}</p>
                )}
              </div>

              {/* Escrow assurance note */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-start gap-2.5">
                <Icon name="shield-check" className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  <strong className="text-slate-800 dark:text-slate-200">Garantie Séquestre GotoShop :</strong> Les fonds ne sont libérés au commerçant qu’une fois votre commande effectivement livrée.
                </p>
              </div>

              <button
                type="button"
                onClick={handleRequestOtp}
                disabled={isRequestingOtp}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 transition-all disabled:opacity-50"
              >
                {isRequestingOtp ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Envoi du code...
                  </>
                ) : (
                  <>
                    Recevoir le code de validation OTP
                    <Icon name="arrow-right" className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* STEP 2: 6-Digit OTP */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="text-center space-y-1">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Saisissez le code à 6 chiffres
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Envoyé au <span className="font-semibold text-slate-700 dark:text-slate-300">{phoneNumber}</span>
                </p>
              </div>

              {/* 6-box input */}
              <div className="flex justify-center gap-2" onPaste={handlePaste}>
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (inputRefs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    className="w-11 h-13 text-center text-xl font-black rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-sm transition-all"
                  />
                ))}
              </div>

              {otpError && (
                <p className="text-xs text-rose-500 text-center font-medium">{otpError}</p>
              )}

              {/* Simulation Helper (Dev/Demo mode) */}
              {simulatedCode && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center justify-between">
                  <div className="text-[11px] text-amber-800 dark:text-amber-200">
                    <span className="font-semibold">Code démo reçu : </span>
                    <span className="font-mono font-bold text-base tracking-widest">{simulatedCode}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleFillSimulatedCode}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors"
                  >
                    Remplir
                  </button>
                </div>
              )}

              {/* Countdown & Resend */}
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
                <span>
                  Expire dans :{" "}
                  <strong className={countdown < 60 ? "text-rose-600 font-bold" : "text-slate-700 dark:text-slate-300"}>
                    {formatTimer(countdown)}
                  </strong>
                </span>

                <button
                  type="button"
                  disabled={resendCooldown > 0 || isRequestingOtp}
                  onClick={handleRequestOtp}
                  className="text-orange-600 dark:text-orange-400 font-semibold hover:underline disabled:opacity-50"
                >
                  {resendCooldown > 0 ? `Renvoyer (${resendCooldown}s)` : "Renvoyer le code"}
                </button>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={handleConfirmPayment}
                  disabled={isSubmitting || otpDigits.join("").length !== 6}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Validation du paiement...
                    </>
                  ) : (
                    <>
                      <Icon name="check-circle" className="w-5 h-5" />
                      Confirmer le paiement ({totalAmount.toLocaleString("fr-FR")} {currency})
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-full py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  Changer de numéro ou d'opérateur
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Receipt / Success */}
          {step === 3 && receiptData && (
            <div className="space-y-5 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <Icon name="check" className="w-9 h-9 stroke-[3]" />
              </div>

              <div className="space-y-1">
                <h4 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  Paiement Confirmé avec Succès !
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Votre commande #{receiptData.orderNumber || receiptData.orderId.slice(-6)} est validée
                </p>
              </div>

              {/* Receipt card */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-left space-y-2.5 text-xs">
                <div className="flex justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500">Montant payé</span>
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                    {receiptData.amount.toLocaleString("fr-FR")} {receiptData.currency}
                  </span>
                </div>
                <div className="flex justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500">Opérateur</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {receiptData.operator}
                  </span>
                </div>
                <div className="flex justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500">Référence transaction</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {receiptData.transactionRef}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Date & heure</span>
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    {receiptData.date}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-200">
                🔒 <strong>Fonds sécurisés en séquestre :</strong> La préparation et la livraison sont immédiatement enclenchées.
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm hover:opacity-90 transition-opacity"
              >
                Terminer et voir la commande
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
