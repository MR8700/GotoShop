import React, { useState } from "react";
import { customerQuickRegister, customerQuickLogin } from "../api/client";
import { WEST_AFRICAN_COUNTRIES } from "../utils/locations";

export default function CustomerAuthModal({ isOpen, onClose, onSuccess, showToast }) {
  const [mode, setMode] = useState("register"); // "register" | "login"
  const [name, setName] = useState("");
  const [selectedCountryCode, setSelectedCountryCode] = useState("BF");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Ouagadougou");
  const [customCity, setCustomCity] = useState("");
  const [locality, setLocality] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const currentCountry = WEST_AFRICAN_COUNTRIES.find((c) => c.code === selectedCountryCode) || WEST_AFRICAN_COUNTRIES[0];

  const handleCountryChange = (code) => {
    setSelectedCountryCode(code);
    const country = WEST_AFRICAN_COUNTRIES.find((c) => c.code === code);
    if (country) {
      setCity(country.cities[0] || "Autre");
      setCustomCity("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "register") {
        if (!name.trim()) throw new Error("Veuillez renseigner votre prénom et nom.");
        if (!phone.trim()) throw new Error("Veuillez saisir votre numéro WhatsApp.");

        const effectiveCity = city === "Autre" ? (customCity.trim() || "Autre ville") : city;
        const fullAddress = locality.trim() ? `${effectiveCity} (${locality.trim()})` : effectiveCity;

        const res = await customerQuickRegister({
          name: name.trim(),
          phone: phone.trim(),
          city: fullAddress,
          country: currentCountry.name,
          locality: locality.trim(),
        });
        showToast(`Bienvenue ${res.customer.name} ! Compte activé.`);
        onSuccess(res.customer);
      } else {
        if (!phone.trim()) throw new Error("Veuillez saisir votre numéro de téléphone.");
        const res = await customerQuickLogin({ phone: phone.trim() });
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
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-surface-container border border-white/[0.08] p-6 shadow-dropdown space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          aria-label="Fermer"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>

        {/* Header */}
        <div className="text-center space-y-1 pt-1">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary mb-1">
            <span className="material-symbols-outlined text-[20px]">stars</span>
          </div>
          <h2 className="text-base sm:text-lg font-semibold text-white">
            {mode === "register" ? "Compte Client Unique" : "Retrouver mes Commandes"}
          </h2>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            {mode === "register"
              ? "Accédez à vos avantages, mémorisez vos adresses et suivez vos livraisons."
              : "Consultez l'historique de vos commandes sans mot de passe."}
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex rounded-xl bg-surface p-1 text-xs font-medium border border-white/[0.06]">
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError("");
            }}
            className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
              mode === "register"
                ? "bg-white text-slate-900 font-semibold shadow-sm"
                : "text-slate-400 hover:text-white"
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
            className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
              mode === "login"
                ? "bg-white text-slate-900 font-semibold shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Déjà Client
          </button>
        </div>

        {error && (
          <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === "register" && (
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1">
                Nom &amp; Prénom
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-slate-400">
                  person
                </span>
                <input
                  type="text"
                  placeholder="Ex: Ibrahim Ouédraogo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 rounded-xl bg-surface border border-white/[0.08] text-white placeholder:text-slate-500 text-xs sm:text-sm focus:outline-none focus:border-white/20 transition-all"
                  required
                />
              </div>
            </div>
          )}

          {/* Country Selection */}
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1">
              Pays de résidence
            </label>
            <select
              value={selectedCountryCode}
              onChange={(e) => handleCountryChange(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-surface border border-white/[0.08] text-white text-xs sm:text-sm focus:outline-none focus:border-white/20 transition-all"
            >
              {WEST_AFRICAN_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code} className="bg-surface text-white">
                  {c.flag} {c.name} ({c.dial})
                </option>
              ))}
            </select>
          </div>

          {/* WhatsApp Phone */}
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1">
              Numéro WhatsApp / Téléphone
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-slate-400">
                phone_iphone
              </span>
              <input
                type="tel"
                placeholder={`Ex: ${currentCountry.dial} 70 12 34 56`}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-10 pl-9 pr-3 rounded-xl bg-surface border border-white/[0.08] text-white placeholder:text-slate-500 text-xs sm:text-sm focus:outline-none focus:border-white/20 transition-all"
                required
              />
            </div>
          </div>

          {mode === "register" && (
            <>
              {/* City */}
              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">
                  Ville Principale
                </label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-surface border border-white/[0.08] text-white text-xs sm:text-sm focus:outline-none focus:border-white/20 transition-all"
                >
                  {currentCountry.cities.map((ct) => (
                    <option key={ct} value={ct} className="bg-surface text-white">
                      {ct}
                    </option>
                  ))}
                </select>
                {city === "Autre" && (
                  <input
                    type="text"
                    placeholder="Précisez votre ville..."
                    value={customCity}
                    onChange={(e) => setCustomCity(e.target.value)}
                    className="w-full h-10 mt-2 px-3 rounded-xl bg-surface border border-white/[0.08] text-white text-xs sm:text-sm focus:outline-none focus:border-white/20 transition-all"
                  />
                )}
              </div>

              {/* Free-text Locality */}
              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">
                  Quartier / Repère de livraison (champ libre)
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-slate-400">
                    pin_drop
                  </span>
                  <input
                    type="text"
                    placeholder="Ex: Ouaga 2000, face pharmacie..."
                    value={locality}
                    onChange={(e) => setLocality(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 rounded-xl bg-surface border border-white/[0.08] text-white placeholder:text-slate-500 text-xs focus:outline-none focus:border-white/20 transition-all"
                  />
                </div>
              </div>
            </>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-primary hover:brightness-105 text-white text-xs sm:text-sm font-semibold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              {loading ? (
                <span>Vérification...</span>
              ) : mode === "register" ? (
                <>
                  <span>Créer mon compte</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </>
              ) : (
                <>
                  <span>Accéder à mes commandes</span>
                  <span className="material-symbols-outlined text-[16px]">login</span>
                </>
              )}
            </button>
          </div>
        </form>

        <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500 pt-1">
          <span className="material-symbols-outlined text-[14px]">lock</span>
          <span>Coordonnées protégées pour vos livraisons exclusives</span>
        </div>
      </div>
    </div>
  );
}
