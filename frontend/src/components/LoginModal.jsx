import Icon from "./Icon";
import React, { useState } from "react";
import { loginOwner } from "../api/client";

export default function LoginModal({ isOpen, onClose, onLoginSuccess, onOpenRegisterStore, showToast }) {
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
      if (showToast) showToast(data.message || "Connexion réussie !");
      if (onLoginSuccess) {
        onLoginSuccess(data);
      }
    } catch (err) {
      setErrorMessage(err.message || "Identifiants invalides");
      if (showToast) showToast(err.message || "Identifiants invalides");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[85] flex items-center justify-center p-3 bg-black/60 backdrop-blur-md animate-fadeIn overflow-y-auto"
    >
      <div className="bg-surface-card rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-subtle relative my-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-surface-secondary hover:bg-surface-elevated border border-subtle text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer"
        >
          <Icon name="close" className="text-[18px]" />
        </button>

        {/* Top Header */}
        <div className="flex flex-col items-center text-center pt-1 pb-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mb-3 shadow-sm">
            <Icon name="storefront" className="text-[24px]" />
          </div>
          <h2 className="text-base font-bold text-on-surface tracking-tight">Espace Commerçant</h2>
          <p className="text-xs text-on-surface-variant font-normal mt-0.5">
            Gérez votre vitrine, commandes et discussions
          </p>
        </div>

        {errorMessage && (
          <div className="mb-3.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <Icon name="error" className="text-[16px] shrink-0 text-rose-400" />
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-[11px] text-on-surface-variant uppercase font-semibold block mb-1">
              Email ou Téléphone
            </label>
            <div className="relative flex items-center">
              <Icon name="mail" className="absolute left-3 text-on-surface-variant/60 text-[18px]" />
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Ex: awa@chictech.bf"
                className="w-full h-11 pl-9 pr-3 rounded-xl bg-surface-secondary border border-subtle text-on-surface placeholder:text-on-surface-variant/50 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] text-on-surface-variant uppercase font-semibold block mb-1">
              Mot de passe
            </label>
            <div className="relative flex items-center">
              <Icon name="lock" className="absolute left-3 text-on-surface-variant/60 text-[18px]" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Votre mot de passe"
                className="w-full h-11 pl-9 pr-10 rounded-xl bg-surface-secondary border border-subtle text-on-surface placeholder:text-on-surface-variant/50 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40 font-mono"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 text-on-surface-variant hover:text-on-surface p-1 cursor-pointer"
              >
                <Icon name={showPassword ? "visibility_off" : "visibility"} className="text-[18px]" />
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !identifier || !password}
            className="w-full h-11 rounded-xl bg-primary hover:brightness-105 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mt-2"
          >
            <Icon name="login" className="text-[18px]" />
            <span>{isLoading ? "Connexion en cours..." : "Accéder à ma Boutique"}</span>
          </button>
        </form>



        {/* Register CTA */}
        {onOpenRegisterStore && (
          <div className="mt-4 pt-3 border-t border-subtle/60 text-center">
            <p className="text-xs text-on-surface-variant mb-2">
              Pas encore de boutique enregistrée ?
            </p>
            <button
              type="button"
              onClick={() => {
                try {
                  if (onOpenRegisterStore) onOpenRegisterStore();
                } catch (e) {
                  console.error("onOpenRegisterStore error:", e);
                }
              }}
              className="w-full py-2.5 px-3 rounded-xl bg-secondary/15 hover:bg-secondary/25 border border-secondary/30 text-secondary text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Icon name="add_business" className="text-[16px]" />
              <span>Ouvrir ma boutique (14 jours gratuits)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
