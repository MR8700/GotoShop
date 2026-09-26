import Icon from "./Icon";
import React, { useState } from "react";
import { loginOwner, resetOwnerCredentials, loginDemoOwner, loginSuperAdmin } from "../api/client";

export default function LoginModal({ isOpen, onClose, onLoginSuccess, onOpenRegisterStore, showToast }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
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

  const handleInstantDemoLogin = async (slug) => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      let data;
      if (slug === "superadmin") {
        data = await loginSuperAdmin("admin@gotoshop.com", "SuperAdmin2026!");
        if (showToast) showToast("Connecté en tant que Super-Administrateur !");
        if (onLoginSuccess) {
          onLoginSuccess({
            ...data,
            role: "superadmin",
            owner_name: "Super-Admin",
            store_slugs: ["superadmin"],
          });
        }
      } else {
        data = await loginDemoOwner(slug);
        if (showToast) showToast(data?.message || `Connecté à ${data?.owner_name || slug} !`);
        if (onLoginSuccess) {
          onLoginSuccess(data);
        }
      }
      onClose();
    } catch (err) {
      console.error("Demo login error:", err);
      setErrorMessage(err.message || "Erreur de connexion démo");
      if (showToast) showToast(err.message || "Erreur de connexion démo");
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFill = (email, pwd) => {
    setIdentifier(email);
    setPassword(pwd);
    setErrorMessage("");
  };

  const handleResetDemo = async () => {
    setIsResetting(true);
    setErrorMessage("");
    try {
      const res = await resetOwnerCredentials();
      setIdentifier(res.email || "mariam.kabore@fasodanfani.bf");
      setPassword(res.default_password || "FasoDanfani2026!");
      if (showToast) showToast(res.message || "Identifiants démo réinitialisés avec succès !");
    } catch (err) {
      setErrorMessage(err.message || "Erreur lors de la réinitialisation");
      if (showToast) showToast(err.message || "Erreur de réinitialisation");
    } finally {
      setIsResetting(false);
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

        {/* Instant 1-Click Test Admin Shortcut */}
        <div className="mt-4 pt-3 border-t border-subtle">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-primary flex items-center gap-1">
              <Icon name="bolt" className="text-[14px]" />
              <span>Accès 1-Clic Admin Test</span>
            </span>
            <span className="text-[10px] text-on-surface-variant">0 saisie requise</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleInstantDemoLogin("faso-danfani")}
              className="p-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 border border-primary/30 text-left transition-all cursor-pointer group disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-on-surface group-hover:text-primary block truncate">
                  Faso Danfani
                </span>
                <Icon name="arrow_forward" className="text-[14px] text-primary" />
              </div>
              <span className="text-[10px] text-on-surface-variant block truncate">
                Mariam Kaboré
              </span>
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleInstantDemoLogin("ouaga-tech")}
              className="p-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 border border-primary/30 text-left transition-all cursor-pointer group disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-on-surface group-hover:text-primary block truncate">
                  Ouaga Tech
                </span>
                <Icon name="arrow_forward" className="text-[14px] text-primary" />
              </div>
              <span className="text-[10px] text-on-surface-variant block truncate">
                Ousmane O.
              </span>
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleInstantDemoLogin("sya-bio-cosmetiques")}
              className="p-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 border border-primary/30 text-left transition-all cursor-pointer group disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-on-surface group-hover:text-primary block truncate">
                  Sya Bio
                </span>
                <Icon name="arrow_forward" className="text-[14px] text-primary" />
              </div>
              <span className="text-[10px] text-on-surface-variant block truncate">
                Fatoumata T.
              </span>
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleInstantDemoLogin("superadmin")}
              className="p-2.5 rounded-xl bg-secondary/15 hover:bg-secondary/25 border border-secondary/35 text-left transition-all cursor-pointer group disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-secondary block truncate">
                  SuperAdmin
                </span>
                <Icon name="shield" className="text-[14px] text-secondary" />
              </div>
              <span className="text-[10px] text-on-surface-variant block truncate">
                Plateforme
              </span>
            </button>
          </div>
        </div>

        {/* Demo Credentials Quick Fill */}
        <div className="mt-3 pt-2.5 border-t border-subtle/50">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wider">
              Identifiants de test pré-remplis
            </span>
            <button
              type="button"
              onClick={handleResetDemo}
              disabled={isResetting}
              className="text-[10px] text-primary hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
              title="Réinitialiser l'accès démo par défaut"
            >
              <Icon name="refresh" className="text-[12px]" />
              <span>{isResetting ? "Réinit..." : "Réinitialiser"}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => handleQuickFill("mariam.kabore@fasodanfani.bf", "FasoDanfani2026!")}
              className="px-2 py-1.5 rounded-lg bg-surface-secondary hover:bg-surface-elevated border border-subtle text-left transition-all cursor-pointer text-[10px]"
            >
              <span className="font-semibold text-on-surface block truncate">mariam.kabore@...</span>
              <span className="text-on-surface-variant/70 font-mono block">FasoDanfani2026!</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickFill("ousmane.ouedraogo@ouagatech.bf", "OuagaTech2026!")}
              className="px-2 py-1.5 rounded-lg bg-surface-secondary hover:bg-surface-elevated border border-subtle text-left transition-all cursor-pointer text-[10px]"
            >
              <span className="font-semibold text-on-surface block truncate">ousmane.o@...</span>
              <span className="text-on-surface-variant/70 font-mono block">OuagaTech2026!</span>
            </button>
          </div>
        </div>

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
