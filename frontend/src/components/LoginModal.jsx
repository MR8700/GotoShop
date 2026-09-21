import React, { useState } from "react";
import { loginOwner, resetOwnerCredentials } from "../api/client";

export default function LoginModal({ isOpen, onClose, onLoginSuccess, showToast }) {
  const [identifier, setIdentifier] = useState("awa@chictech.bf");
  const [password, setPassword] = useState("AwaChic2026!");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  if (!isOpen) return null;

  const handleAutoFill = () => {
    setIdentifier("awa@chictech.bf");
    setPassword("AwaChic2026!");
    setErrorMessage("");
    showToast("Identifiants initiaux pré-remplis !");
  };

  const handleResetCredentials = async () => {
    try {
      setIsLoading(true);
      await resetOwnerCredentials();
      setIdentifier("awa@chictech.bf");
      setPassword("AwaChic2026!");
      setErrorMessage("");
      showToast("Compte déverrouillé et réinitialisé à AwaChic2026! ✅");
    } catch (err) {
      showToast(err.message || "Erreur de réinitialisation");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setIsLoading(true);

    try {
      const data = await loginOwner(identifier.trim(), password);
      showToast(data.message || "Connexion réussie !");
      if (onLoginSuccess) {
        onLoginSuccess(data);
      }
    } catch (err) {
      setErrorMessage(err.message || "Erreur de connexion");
      showToast(err.message || "Identifiants invalides");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm">
      <div className="bg-surface-container-high rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-white/10 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-surface-container-highest text-on-surface-variant flex items-center justify-center hover:text-on-surface"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>

        {/* Top Header */}
        <div className="flex flex-col items-center text-center pt-2 pb-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/20 text-primary flex items-center justify-center mb-2 shadow-inner">
            <span className="material-symbols-outlined text-[28px]">admin_panel_settings</span>
          </div>
          <h2 className="font-headline-sm text-lg text-on-surface font-bold">Espace Commerçante</h2>
          <p className="font-body-sm text-xs text-on-surface-variant mt-0.5">
            Accès sécurisé réservé à la propriétaire de la boutique
          </p>
        </div>

        {/* Predefined credentials banner */}
        <div className="mb-4 p-2.5 rounded-xl bg-secondary/10 border border-secondary/25 text-left">
          <div className="flex items-center justify-between gap-1.5 text-secondary font-label-sm text-xs font-bold mb-1">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px]">info</span>
              Identifiants initiaux pré-configurés :
            </span>
            <button
              type="button"
              onClick={handleAutoFill}
              className="text-[10px] uppercase font-bold text-primary hover:underline cursor-pointer bg-primary/10 px-2 py-0.5 rounded-full"
            >
              Remplir
            </button>
          </div>
          <div className="text-[11px] font-mono text-on-surface-variant space-y-0.5">
            <div>Email : <span className="text-on-surface font-semibold">awa@chictech.bf</span></div>
            <div>MDP temporaire : <span className="text-primary font-bold">AwaChic2026!</span></div>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-3 p-2.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-xs flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] shrink-0">error</span>
              <span className="flex-1">{errorMessage}</span>
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleResetCredentials}
                disabled={isLoading}
                className="text-[11px] font-bold text-secondary hover:underline cursor-pointer flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">lock_reset</span>
                Réinitialiser le compte à AwaChic2026!
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="font-label-sm text-xs text-on-surface-variant uppercase font-bold block mb-1">
              Email ou Identifiant
            </label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-on-surface-variant text-[18px]">
                mail
              </span>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="vendeur@boutique.com"
                className="w-full h-11 pl-9 pr-3 rounded-lg bg-surface-container-lowest border border-outline-variant/30 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary font-body-md"
                required
              />
            </div>
          </div>

          <div>
            <label className="font-label-sm text-xs text-on-surface-variant uppercase font-bold block mb-1">
              Mot de passe
            </label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-on-surface-variant text-[18px]">
                lock
              </span>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Votre mot de passe"
                className="w-full h-11 pl-9 pr-10 rounded-lg bg-surface-container-lowest border border-outline-variant/30 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 text-on-surface-variant hover:text-on-surface p-1"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showPassword ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !identifier || !password}
            className="w-full h-11 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-md text-sm font-bold flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-md shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mt-2"
          >
            <span className="material-symbols-outlined text-[18px]">login</span>
            <span>{isLoading ? "Authentification..." : "Se Connecter"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
