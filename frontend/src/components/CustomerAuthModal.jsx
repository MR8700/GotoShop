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
        if (!phone.trim()) throw new Error("Veuillez saisir votre numéro WhatsApp / Téléphone.");

        const effectiveCity = city === "Autre" ? (customCity.trim() || "Autre ville") : city;
        const fullAddress = locality.trim() ? `${effectiveCity} (${locality.trim()})` : effectiveCity;

        const res = await customerQuickRegister({
          name: name.trim(),
          phone: phone.trim(),
          city: fullAddress,
          country: currentCountry.name,
          locality: locality.trim(),
        });
        showToast(`Bienvenue ${res.customer.name} ! Compte activé ⚡`);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md rounded-3xl bg-surface-container-high border border-primary/20 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
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
            {mode === "register" ? "Espace Fidélité & Livraison ✨" : "Retrouver mes Commandes"}
          </h2>
          <p className="font-body-sm text-xs text-on-surface-variant">
            {mode === "register"
              ? "Accédez à vos avantages, réductions et suivez vos colis en direct."
              : "Consultez l'état de vos commandes en 1 clic sans mot de passe."}
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
                Nom &amp; Prénom *
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-3 text-[18px] text-on-surface-variant">
                  person
                </span>
                <input
                  type="text"
                  placeholder="Ex: Ibrahim Ouédraogo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-11 pl-9 pr-3 rounded-xl bg-surface-container border border-white/10 text-on-surface placeholder:text-on-surface-variant/40 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
            </div>
          )}

          {/* Country Selection */}
          <div>
            <label className="font-label-sm text-[11px] text-on-surface-variant uppercase font-bold block mb-1">
              Pays de résidence
            </label>
            <select
              value={selectedCountryCode}
              onChange={(e) => handleCountryChange(e.target.value)}
              className="w-full h-11 px-3 rounded-xl bg-surface-container border border-white/10 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {WEST_AFRICAN_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name} ({c.dial})
                </option>
              ))}
            </select>
          </div>

          {/* WhatsApp Phone */}
          <div>
            <label className="font-label-sm text-[11px] text-on-surface-variant uppercase font-bold block mb-1">
              Numéro WhatsApp / Téléphone *
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-3 text-[18px] text-secondary">
                phone_iphone
              </span>
              <input
                type="tel"
                placeholder={`Ex: ${currentCountry.dial} 70 12 34 56`}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-11 pl-9 pr-3 rounded-xl bg-surface-container border border-white/10 text-on-surface placeholder:text-on-surface-variant/40 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
            </div>
          </div>

          {mode === "register" && (
            <>
              {/* City */}
              <div>
                <label className="font-label-sm text-[11px] text-on-surface-variant uppercase font-bold block mb-1">
                  Ville Principale
                </label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-surface-container border border-white/10 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {currentCountry.cities.map((ct) => (
                    <option key={ct} value={ct}>
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
                    className="w-full h-11 mt-2 px-3 rounded-xl bg-surface-container border border-white/10 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                )}
              </div>

              {/* Free-text Locality / Neighborhood */}
              <div>
                <label className="font-label-sm text-[11px] text-on-surface-variant uppercase font-bold block mb-1">
                  Quartier / Repère de livraison (Champ libre)
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-3 text-[18px] text-primary">
                    pin_drop
                  </span>
                  <input
                    type="text"
                    placeholder="Ex: Ouaga 2000, Dassasgho face pharmacie, Zone 4..."
                    value={locality}
                    onChange={(e) => setLocality(e.target.value)}
                    className="w-full h-11 pl-9 pr-3 rounded-xl bg-surface-container border border-white/10 text-on-surface placeholder:text-on-surface-variant/40 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <p className="text-[10px] text-on-surface-variant mt-1">
                  Permet au livreur moto de trouver directement votre porte sans vous faire perdre de temps.
                </p>
              </div>
            </>
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
