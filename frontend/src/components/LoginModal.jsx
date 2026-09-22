import React, { useState } from "react";
import { loginOwner, resetOwnerCredentials } from "../api/client";

export default function LoginModal({ isOpen, onClose, onLoginSuccess, showToast }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  if (!isOpen) return null;

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
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[85] flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-fadeIn"
    >
      <div className="bg-surface-container rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-subtle relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-surface-card hover:bg-surface-container-highest border border-subtle text-slate-400 hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>

        {/* Top Header */}
        <div className="flex flex-col items-center text-center pt-2 pb-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mb-3 shadow-sm">
            <span className="material-symbols-outlined text-[24px]">admin_panel_settings</span>
          </div>
          <h2 className="text-base font-bold text-slate-100 tracking-tight">Espace Commerçant</h2>
          <p className="text-xs text-slate-400 font-normal mt-0.5">
            Accès sécurisé pour la gestion de votre boutique
          </p>
        </div>

        {errorMessage && (
          <div className="mb-3.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] shrink-0 text-rose-400">error</span>
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-[11px] text-slate-400 uppercase font-semibold block mb-1">
              Email ou Identifiant
            </label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-slate-500 text-[18px]">
                mail
              </span>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="vendeur@boutique.com"
                className="w-full h-11 pl-9 pr-3 rounded-xl bg-surface-card border border-subtle text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 uppercase font-semibold block mb-1">
              Mot de passe
            </label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-slate-500 text-[18px]">
                lock
              </span>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Votre mot de passe"
                className="w-full h-11 pl-9 pr-10 rounded-xl bg-surface-card border border-subtle text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40 font-mono"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 text-slate-400 hover:text-slate-200 p-1"
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
            className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-on-primary text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mt-2"
          >
            <span className="material-symbols-outlined text-[18px]">login</span>
            <span>{isLoading ? "Authentification..." : "Se Connecter"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
