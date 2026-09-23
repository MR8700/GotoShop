import React, { useState, useMemo } from "react";
import { changePassword } from "../api/client";

export default function ChangePasswordModal({ isMandatory = true, onClose, onSuccess, onLogout, showToast }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Compute all 7 rules live
  const checks = useMemo(() => {
    const p = newPassword || "";
    return [
      {
        key: "length",
        label: "Au moins 8 caractères",
        passed: p.length >= 8,
      },
      {
        key: "no_space",
        label: "Zéro espace (aucun espace)",
        passed: p.length > 0 && !/\s/.test(p),
      },
      {
        key: "uppercase",
        label: "Au moins 1 Majuscule (A-Z)",
        passed: /[A-Z]/.test(p),
      },
      {
        key: "lowercase",
        label: "Au moins 1 Minuscule (a-z)",
        passed: /[a-z]/.test(p),
      },
      {
        key: "number",
        label: "Au moins 1 Chiffre (0-9)",
        passed: /[0-9]/.test(p),
      },
      {
        key: "special",
        label: "Au moins 1 Caractère spécial (!@#$%...)",
        passed: /[!@#$%^&*(),.?":{}|<>\-_+=\[\]\\/;~`]/.test(p),
      },
      {
        key: "no_repeat",
        label: "Aucun caractère consécutif répété (pas de 'aa', '11')",
        passed: p.length > 0 && !(/(.)\1/.test(p)),
      },
    ];
  }, [newPassword]);

  const passedCount = checks.filter((c) => c.passed).length;
  const isAllPassed = passedCount === checks.length;
  const isMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit = currentPassword && isAllPassed && isMatch && !isSubmitting;

  // Strength label & color
  const strengthMeta = useMemo(() => {
    if (passedCount <= 2) return { label: "Trop faible", color: "bg-red-500", text: "text-red-400" };
    if (passedCount <= 4) return { label: "Moyen", color: "bg-amber-500", text: "text-amber-400" };
    if (passedCount < 7) return { label: "Presque fort", color: "bg-yellow-400", text: "text-yellow-300" };
    return { label: "Hyper-Sécurisé (Conforme)", color: "bg-secondary", text: "text-secondary" };
  }, [passedCount]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setErrorMessage("");
    setIsSubmitting(true);
    showToast("Sécurisation du compte en cours...");

    try {
      const res = await changePassword(currentPassword, newPassword, confirmPassword);
      showToast(res.message || "Mot de passe fort validé !");
      if (onSuccess) onSuccess();
    } catch (err) {
      setErrorMessage(err.message || "Erreur de changement de mot de passe");
      showToast(err.message || "Erreur de changement de mot de passe");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="bg-surface-container-high rounded-2xl p-5 max-w-md w-full shadow-2xl border border-primary/20 my-auto max-h-[95vh] overflow-y-auto">
        {/* Header with Security Badge */}
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px]">shield_lock</span>
            </div>
            <div>
              <h3 className="font-headline-sm text-base text-on-surface">Sécurité Obligatoire</h3>
              <p className="font-body-sm text-xs text-primary font-semibold">
                Nouveau Mot de Passe Fort
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-surface-container-highest text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
              title="Fermer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>

        {/* Informative Security Banner */}
        <div className="my-3 p-3 rounded-xl bg-primary/10 border border-primary/25 flex items-start gap-2.5">
          <span className="material-symbols-outlined text-primary text-[20px] shrink-0 mt-0.5">
            vpn_key_alert
          </span>
          <p className="font-body-sm text-xs text-on-surface-variant leading-relaxed">
            Pour protéger votre chiffre d'affaires et votre boutique, la personnalisation avec un mot de passe fort est <span className="text-on-surface font-bold">obligatoire</span> avant d'accéder à l'administration.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-3.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] shrink-0 text-rose-400">error</span>
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Mot de passe actuel */}
          <div>
            <label className="font-label-sm text-xs text-on-surface-variant uppercase font-bold block mb-1">
              Mot de passe actuel / temporaire
            </label>
            <div className="relative flex items-center">
              <input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Ex: AwaChic2026!"
                className="w-full h-11 pl-3 pr-10 rounded-lg bg-surface-container-lowest border border-outline-variant/30 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-2.5 text-on-surface-variant hover:text-on-surface p-1"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showCurrent ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
            <span className="text-[10px] text-on-surface-variant/80 mt-0.5 block">
              Entrez le mot de passe actuel de votre compte ou le mot de passe temporaire fourni.
            </span>
          </div>

          {/* Nouveau mot de passe fort */}
          <div>
            <label className="font-label-sm text-xs text-on-surface-variant uppercase font-bold block mb-1">
              Nouveau mot de passe fort
            </label>
            <div className="relative flex items-center">
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Ex: SikaTech#2026"
                className="w-full h-11 pl-3 pr-10 rounded-lg bg-surface-container-lowest border border-outline-variant/30 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                required
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-2.5 text-on-surface-variant hover:text-on-surface p-1"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showNew ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>

            {/* Strength Gauge Bar */}
            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-on-surface-variant font-medium">Niveau de sécurité :</span>
                <span className={`font-bold ${strengthMeta.text}`}>{strengthMeta.label} ({passedCount}/7)</span>
              </div>
              <div className="w-full bg-surface-container-lowest h-2 rounded-full overflow-hidden flex gap-1 p-0.5">
                {[...Array(7)].map((_, i) => (
                  <div
                    key={i}
                    className={`flex-1 h-full rounded-full transition-all duration-300 ${
                      i < passedCount ? strengthMeta.color : "bg-white/10"
                    }`}
                  ></div>
                ))}
              </div>
            </div>
          </div>

          {/* Interactive Rule Indicators (Voyants) */}
          <div className="p-3 rounded-xl bg-surface-container-lowest border border-white/5 space-y-1.5">
            <span className="font-label-sm text-[11px] text-on-surface-variant font-bold uppercase tracking-wider block mb-1">
              Voyants de conformité requis :
            </span>

            {checks.map((c) => (
              <div key={c.key} className="flex items-center justify-between text-xs py-0.5">
                <span className={c.passed ? "text-on-surface font-medium" : "text-on-surface-variant/70"}>
                  {c.label}
                </span>
                <span
                  className={`flex items-center justify-center w-5 h-5 rounded-full text-[13px] font-bold transition-all ${
                    c.passed
                      ? "bg-secondary text-surface scale-110 shadow-sm shadow-secondary/40"
                      : "bg-surface-container-high text-on-surface-variant/40"
                  }`}
                >
                  <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {c.passed ? "check" : "circle"}
                  </span>
                </span>
              </div>
            ))}
          </div>

          {/* Confirmation du mot de passe */}
          <div>
            <label className="font-label-sm text-xs text-on-surface-variant uppercase font-bold block mb-1">
              Confirmer le nouveau mot de passe
            </label>
            <div className="relative flex items-center">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Répétez le mot de passe"
                className={`w-full h-11 pl-3 pr-10 rounded-lg bg-surface-container-lowest border text-on-surface text-sm focus:outline-none focus:ring-2 font-mono ${
                  confirmPassword && !isMatch
                    ? "border-red-500/80 focus:ring-red-500"
                    : confirmPassword && isMatch
                    ? "border-secondary/80 focus:ring-secondary"
                    : "border-outline-variant/30 focus:ring-primary"
                }`}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-2.5 text-on-surface-variant hover:text-on-surface p-1"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showConfirm ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
            {confirmPassword && (
              <span className={`text-[11px] font-semibold mt-1 flex items-center gap-1 ${isMatch ? "text-secondary" : "text-red-400"}`}>
                <span className="material-symbols-outlined text-[13px]">
                  {isMatch ? "check_circle" : "cancel"}
                </span>
                {isMatch ? "Les mots de passe correspondent parfaitement" : "Les deux mots de passe sont différents"}
              </span>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!canSubmit}
            className={`w-full h-12 rounded-xl font-label-md text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${
              canSubmit
                ? "bg-primary hover:bg-primary-container text-on-primary shadow-primary/25 cursor-pointer active:scale-95"
                : "bg-surface-container-highest text-on-surface-variant/40 cursor-not-allowed"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">lock_reset</span>
            <span>{isSubmitting ? "Enregistrement sécurisé..." : "Valider et Déverrouiller la Boutique"}</span>
          </button>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="w-full h-9 rounded-xl text-on-surface-variant hover:text-red-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]">logout</span>
              <span>Se déconnecter / Quitter</span>
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
