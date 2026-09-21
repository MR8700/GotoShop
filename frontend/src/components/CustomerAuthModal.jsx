import React, { useState } from "react";
import { customerQuickRegister, customerQuickLogin } from "../api/client";

export default function CustomerAuthModal({ isOpen, onClose, onSuccess, showToast }) {
  const [mode, setMode] = useState("register"); // "register" | "login"
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Abidjan");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "register") {
        if (!name.trim()) throw new Error("Veuillez renseigner votre prénom et nom.");
        if (!phone.trim()) throw new Error("Veuillez saisir votre numéro WhatsApp / Téléphone.");
        const res = await customerQuickRegister({ name, phone, city });
        showToast(`Bienvenue ${res.customer.name} ! Compte activé ⚡`);
        onSuccess(res.customer);
      } else {
        if (!phone.trim()) throw new Error("Veuillez saisir votre numéro de téléphone.");
        const res = await customerQuickLogin({ phone });
        showToast(`Ravi de vous revoir ${res.customer.name} !`);
        onSuccess(res.customer);
      }
      onClose();
    } catch (err) {
      setError(err.message || "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-sm rounded-2xl bg-surface-container-high border border-primary/20 p-6 shadow-2xl space-y-4">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-surface-container-highest text-on-surface-variant flex items-center justify-center hover:text-on-surface"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>

        {/* Modal Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-primary/15 text-primary mb-1">
            <span className="material-symbols-outlined text-[24px]">stars</span>
          </div>
          <h2 className="font-headline-sm text-lg font-bold text-on-surface">
            {mode === "register" ? "Espace Fidélité ✨" : "Retrouver mes Commandes"}
          </h2>
          <p className="font-body-sm text-xs text-on-surface-variant">
            {mode === "register"
              ? "Profitez de vos points fidélité et suivez vos colis en direct."
              : "Consultez l'état de vos commandes en 1 clic."}
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex rounded-xl bg-surface-container p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError("");
            }}
            className={`flex-1 py-2 rounded-lg tap-scale transition-all cursor-pointer ${
              mode === "register" ? "bg-primary text-on-primary shadow-sm font-bold" : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Nouveau Client
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError("");
            }}
            className={`flex-1 py-2 rounded-lg tap-scale transition-all cursor-pointer ${
              mode === "login" ? "bg-primary text-on-primary shadow-sm font-bold" : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Déjà Client
          </button>
        </div>

        {error && (
          <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-center">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "register" && (
            <div>
              <label className="font-label-sm text-[11px] text-on-surface-variant uppercase font-bold block mb-1">
                Nom &amp; Prénom
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-3 text-[18px] text-on-surface-variant">
                  person
                </span>
                <input
                  type="text"
                  placeholder="Ex: Kouamé Desiré"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-11 pl-9 pr-3 rounded-xl bg-surface-container border border-white/10 text-on-surface placeholder:text-on-surface-variant/40 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="font-label-sm text-[11px] text-on-surface-variant uppercase font-bold block mb-1">
              Numéro WhatsApp
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-3 text-[18px] text-secondary">
                phone_iphone
              </span>
              <input
                type="tel"
                placeholder="Ex: +225 07 12 34 56"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-11 pl-9 pr-3 rounded-xl bg-surface-container border border-white/10 text-on-surface placeholder:text-on-surface-variant/40 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
            </div>
          </div>

          {mode === "register" && (
            <div>
              <label className="font-label-sm text-[11px] text-on-surface-variant uppercase font-bold block mb-1">
                Ville Principale
              </label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-surface-container border border-white/10 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="Abidjan">Abidjan (Côte d'Ivoire)</option>
                <option value="Ouagadougou">Ouagadougou (Burkina Faso)</option>
                <option value="Bouaké">Bouaké (Côte d'Ivoire)</option>
                <option value="Bobo-Dioulasso">Bobo-Dioulasso (Burkina Faso)</option>
                <option value="Autre">Autre Localité</option>
              </select>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-primary text-on-primary font-label-lg text-sm font-bold shadow-md hover:brightness-105 tap-scale transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <span>Validation instantanée...</span>
              ) : mode === "register" ? (
                <>
                  <span>Activer mon Espace</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </>
              ) : (
                <>
                  <span>Accéder à mes Commandes</span>
                  <span className="material-symbols-outlined text-[18px]">login</span>
                </>
              )}
            </button>
          </div>
        </form>

        <p className="text-[11px] text-center text-on-surface-variant/70 leading-relaxed">
          🔒 Vos coordonnées sont protégées et servent uniquement à vos livraisons.
        </p>
      </div>
    </div>
  );
}
