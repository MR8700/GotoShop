import Icon from "./Icon";
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-surface-card border border-subtle p-6 shadow-dropdown space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-surface-secondary hover:bg-surface-elevated text-on-surface-variant hover:text-on-surface border border-subtle flex items-center justify-center transition-colors cursor-pointer"
          aria-label="Fermer"
        >
          <Icon name="close" className="text-[18px]" />
        </button>

        {/* Header */}
        <div className="text-center space-y-1 pt-1">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary mb-1">
            <Icon name="stars" className="text-[20px]" />
          </div>
          <h2 className="text-base sm:text-lg font-semibold text-on-surface">
            {mode === "register" ? "Compte Client Unique" : "Retrouver mes Commandes"}
          </h2>
          <p className="text-xs text-on-surface-variant max-w-xs mx-auto">
            {mode === "register"
              ? "Accédez à vos avantages, mémorisez vos adresses et suivez vos livraisons."
              : "Consultez l'historique de vos commandes sans mot de passe."}
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex rounded-xl bg-surface-secondary p-1 text-xs font-medium border border-subtle">
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError("");
            }}
            className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
              mode === "register"
                ? "bg-surface-card text-on-surface font-semibold shadow-sm border border-subtle"
                : "text-on-surface-variant hover:text-on-surface"
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
                ? "bg-surface-card text-on-surface font-semibold shadow-sm border border-subtle"
                : "text-on-surface-variant hover:text-on-surface"
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
              <label className="text-xs text-on-surface-variant font-medium block mb-1">
                Nom &amp; Prénom
              </label>
              <div className="relative">
                <Icon name="person" className="absolute left-3 top-2.5 text-[18px] text-on-surface-variant" />
                <input
                  type="text"
                  placeholder="Ex: Ibrahim Ouédraogo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 rounded-xl bg-surface-secondary border border-subtle text-on-surface placeholder:text-on-surface-variant/50 text-xs sm:text-sm focus:outline-none focus:border-strong transition-all"
                  required
                />
              </div>
            </div>
          )}

          {/* Country Selection */}
          <div>
            <label className="text-xs text-on-surface-variant font-medium block mb-1">
              Pays de résidence
            </label>
            <select
              value={selectedCountryCode}
              onChange={(e) => handleCountryChange(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-surface-secondary border border-subtle text-on-surface text-xs sm:text-sm focus:outline-none focus:border-strong transition-all"
            >
              {WEST_AFRICAN_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code} className="bg-surface-card text-on-surface">
                  {c.flag} {c.name} ({c.dial})
                </option>
              ))}
            </select>
          </div>

          {/* WhatsApp Phone */}
          <div>
            <label className="text-xs text-on-surface-variant font-medium block mb-1">
              Numéro WhatsApp / Téléphone
            </label>
            <div className="relative">
              <Icon name="phone_iphone" className="absolute left-3 top-2.5 text-[18px] text-on-surface-variant" />
              <input
                type="tel"
                placeholder={`Ex: ${currentCountry.dial} 70 12 34 56`}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-10 pl-9 pr-3 rounded-xl bg-surface-secondary border border-subtle text-on-surface placeholder:text-on-surface-variant/50 text-xs sm:text-sm focus:outline-none focus:border-strong transition-all"
                required
              />
            </div>
          </div>

          {mode === "register" && (
            <>
              {/* City */}
              <div>
                <label className="text-xs text-on-surface-variant font-medium block mb-1">
                  Ville Principale
                </label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-surface-secondary border border-subtle text-on-surface text-xs sm:text-sm focus:outline-none focus:border-strong transition-all"
                >
                  {currentCountry.cities.map((ct) => (
                    <option key={ct} value={ct} className="bg-surface-card text-on-surface">
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
                    className="w-full h-10 mt-2 px-3 rounded-xl bg-surface-secondary border border-subtle text-on-surface text-xs sm:text-sm focus:outline-none focus:border-strong transition-all"
                  />
                )}
              </div>

              {/* Free-text Locality */}
              <div>
                <label className="text-xs text-on-surface-variant font-medium block mb-1">
                  Quartier / Repère de livraison (champ libre)
                </label>
                <div className="relative">
                  <Icon name="pin_drop" className="absolute left-3 top-2.5 text-[18px] text-on-surface-variant" />
                  <input
                    type="text"
                    placeholder="Ex: Ouaga 2000, face pharmacie..."
                    value={locality}
                    onChange={(e) => setLocality(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 rounded-xl bg-surface-secondary border border-subtle text-on-surface placeholder:text-on-surface-variant/50 text-xs focus:outline-none focus:border-strong transition-all"
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
                  <Icon name="arrow_forward" className="text-[16px]" />
                </>
              ) : (
                <>
                  <span>Accéder à mes commandes</span>
                  <Icon name="login" className="text-[16px]" />
                </>
              )}
            </button>
          </div>
        </form>

        <div className="flex items-center justify-center gap-1 text-[11px] text-on-surface-variant/70 pt-1">
          <Icon name="lock" className="text-[14px]" />
          <span>Coordonnées protégées pour vos livraisons exclusives</span>
        </div>
      </div>
    </div>
  );
}
