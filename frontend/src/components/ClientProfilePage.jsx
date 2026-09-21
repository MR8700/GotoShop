import React, { useState } from "react";
import { updateCustomerProfile, getMediaUrl } from "../api/client";

export default function ClientProfilePage({
  customer,
  onUpdateCustomer,
  onLogoutCustomer,
  onOpenAuth,
  onOpenOwnerLogin,
  showToast,
}) {
  const [name, setName] = useState(customer?.name || "");
  const [phone, setPhone] = useState(customer?.phone || "");
  const [email, setEmail] = useState(customer?.email || "");
  const [city, setCity] = useState(customer?.city || "Abidjan");
  const [deliveryAddress, setDeliveryAddress] = useState(customer?.delivery_address || "");
  const [gpsCoordinates, setGpsCoordinates] = useState(customer?.gps_coordinates || "");
  const [gpsLocationUrl, setGpsLocationUrl] = useState(customer?.gps_location_url || "");
  const [preferredChannel, setPreferredChannel] = useState(customer?.preferred_channel || "WHATSAPP");
  const [notes, setNotes] = useState(customer?.notes || "");
  const [avatarPreview, setAvatarPreview] = useState(customer?.avatar_url || "");
  const [avatarData, setAvatarData] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto space-y-5 pt-12 pb-32">
        <div className="w-16 h-16 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shadow-lg">
          <span className="material-symbols-outlined text-[32px]">person</span>
        </div>
        <div className="space-y-2">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Votre Profil Client</h2>
          <p className="font-body-md text-on-surface-variant text-sm">
            Inscrivez-vous en 3 secondes pour préremplir automatiquement vos adresses de livraison et votre localisation GPS à chaque commande.
          </p>
        </div>
        <button
          onClick={onOpenAuth}
          className="w-full h-12 rounded-xl bg-primary-container text-on-primary-container font-label-lg font-bold shadow-md hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[20px]">flash_on</span>
          <span>Créer mon Profil (3s)</span>
        </button>

        <div className="pt-8 border-t border-white/10 w-full">
          <button
            onClick={onOpenOwnerLogin}
            className="text-xs text-secondary hover:underline flex items-center justify-center gap-1.5 mx-auto"
          >
            <span className="material-symbols-outlined text-[16px]">admin_panel_settings</span>
            <span>Accès Commerçante / Propriétaire</span>
          </button>
        </div>
      </div>
    );
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAvatarPreview(ev.target.result);
      setAvatarData(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleCaptureGPS = () => {
    if (!navigator.geolocation) {
      showToast("La géolocalisation n'est pas supportée par votre appareil");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(6);
        const lng = position.coords.longitude.toFixed(6);
        const coords = `${lat}, ${lng}`;
        const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;
        setGpsCoordinates(coords);
        setGpsLocationUrl(mapsUrl);
        setIsLocating(false);
        showToast("Position GPS capturée avec succès !");
      },
      (error) => {
        setIsLocating(false);
        showToast("Impossible d'accéder au GPS. Veuillez autoriser la localisation.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        name,
        phone,
        email: email || null,
        city,
        delivery_address: deliveryAddress || null,
        gps_coordinates: gpsCoordinates || null,
        gps_location_url: gpsLocationUrl || null,
        preferred_channel: preferredChannel,
        notes: notes || null,
      };
      if (avatarData) {
        payload.avatar_data = avatarData;
      }
      const updated = await updateCustomerProfile(payload);
      onUpdateCustomer(updated);
      setAvatarData(null);
      showToast("Profil client mis à jour avec succès !");
    } catch (err) {
      showToast(err.message || "Erreur de mise à jour");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col w-full gap-space-md max-w-lg mx-auto pb-32">
      <div className="flex items-center justify-between px-space-xs pt-1">
        <div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Mon Profil Client</h2>
          <p className="text-xs text-on-surface-variant">Gérez vos coordonnées et préférences de livraison</p>
        </div>
        <span className="px-2.5 py-0.5 rounded-full bg-secondary/15 text-secondary font-label-sm text-xs font-semibold">
          Client Vérifié
        </span>
      </div>

      <form onSubmit={handleSaveProfile} className="bg-surface-container rounded-2xl p-space-md shadow-md space-y-4">
        {/* Avatar Section */}
        <div className="flex items-center gap-4 p-3 rounded-xl bg-surface-container-high/60 border border-white/5">
          <div className="relative group shrink-0">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-primary-container text-on-primary-container flex items-center justify-center ring-2 ring-primary shadow-md">
              {avatarPreview ? (
                <img
                  src={avatarPreview.startsWith("data:") ? avatarPreview : getMediaUrl(avatarPreview)}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="material-symbols-outlined text-[32px]">person</span>
              )}
            </div>
            <label className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
              <span className="material-symbols-outlined text-[20px]">photo_camera</span>
              <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
            </label>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-on-surface text-sm">{name || "Votre Nom"}</p>
            <p className="text-xs text-secondary font-mono">{phone}</p>
            <label className="text-[11px] text-primary hover:underline cursor-pointer flex items-center gap-1 mt-1">
              <span className="material-symbols-outlined text-[14px]">upload</span>
              <span>Changer ma photo de profil</span>
              <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
            </label>
          </div>
        </div>

        {/* Identity Inputs */}
        <div className="space-y-3">
          <div>
            <label className="font-label-sm text-[11px] text-on-surface-variant uppercase font-bold block mb-1">
              Nom & Prénom
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-11 px-3 rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-label-sm text-[11px] text-on-surface-variant uppercase font-bold block mb-1">
                Numéro WhatsApp
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
            <div>
              <label className="font-label-sm text-[11px] text-on-surface-variant uppercase font-bold block mb-1">
                Ville Principale
              </label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="Cocody (Abidjan)">Cocody (Abidjan)</option>
                <option value="Marcory (Abidjan)">Marcory (Abidjan)</option>
                <option value="Yopougon (Abidjan)">Yopougon (Abidjan)</option>
                <option value="Plateau (Abidjan)">Plateau (Abidjan)</option>
                <option value="Ouagadougou (Centre)">Ouagadougou (Centre)</option>
                <option value="Ouaga 2000">Ouaga 2000</option>
                <option value="Bobo-Dioulasso">Bobo-Dioulasso</option>
                <option value="Autre">Autre Ville</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-label-sm text-[11px] text-on-surface-variant uppercase font-bold block mb-1">
              Adresse de Livraison / Quartier & Repère
            </label>
            <input
              type="text"
              placeholder="Ex: Angré 8ème Tranche, à côté de la pharmacie"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              className="w-full h-11 px-3 rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* GPS Saved Coordinates Card */}
        <div className="p-3.5 rounded-xl bg-surface-container-high/60 border border-primary/20 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-primary flex items-center gap-1.5 uppercase tracking-wider">
              <span className="material-symbols-outlined text-[16px]">pin_drop</span>
              Localisation GPS Mémorisée
            </span>
            <button
              type="button"
              onClick={handleCaptureGPS}
              disabled={isLocating}
              className="px-2.5 py-1 rounded-lg bg-primary-container text-on-primary-container text-[11px] font-bold hover:brightness-110 active:scale-95 flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[14px]">my_location</span>
              <span>{isLocating ? "Détection..." : "Activer GPS Actuel"}</span>
            </button>
          </div>

          {gpsCoordinates ? (
            <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-lowest text-xs">
              <span className="text-on-surface font-mono">{gpsCoordinates}</span>
              <a
                href={gpsLocationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-secondary hover:underline flex items-center gap-1 font-semibold"
              >
                <span>Voir Maps</span>
                <span className="material-symbols-outlined text-[14px]">open_in_new</span>
              </a>
            </div>
          ) : (
            <p className="text-[11px] text-on-surface-variant">
              Enregistrez votre position GPS une fois pour l'inclure en 1 clic dans toutes vos futures commandes de livraison express.
            </p>
          )}
        </div>

        {/* Notes for Courier */}
        <div>
          <label className="font-label-sm text-[11px] text-on-surface-variant uppercase font-bold block mb-1">
            Consignes pour le livreur moto
          </label>
          <textarea
            rows="2"
            placeholder="Ex: Appeler dès l'arrivée au portail bleu..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full p-3 rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Save button */}
        <button
          type="submit"
          disabled={isSaving}
          className="w-full h-12 rounded-xl bg-primary-container text-on-primary-container font-label-lg font-bold shadow-md hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[20px]">check</span>
          <span>{isSaving ? "Enregistrement..." : "Enregistrer mes Informations"}</span>
        </button>

        {/* Logout Client Button */}
        <button
          type="button"
          onClick={onLogoutCustomer}
          className="w-full h-10 rounded-xl bg-surface-container-high hover:bg-red-500/10 text-on-surface-variant hover:text-red-400 font-label-md font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">logout</span>
          <span>Déconnexion du compte client</span>
        </button>
      </form>

      {/* Switch to Owner Portal Card */}
      <div className="p-4 rounded-2xl bg-surface-container/60 border border-white/5 flex items-center justify-between text-xs">
        <div>
          <p className="font-bold text-on-surface">Espace Propriétaire / Commerçante</p>
          <p className="text-[11px] text-on-surface-variant">Accédez aux statistiques globales, stocks et arbitrages 24h.</p>
        </div>
        <button
          onClick={onOpenOwnerLogin}
          className="px-3 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-secondary font-bold flex items-center gap-1.5 shrink-0 transition-transform active:scale-95"
        >
          <span className="material-symbols-outlined text-[16px]">admin_panel_settings</span>
          <span>Connexion Admin</span>
        </button>
      </div>
    </div>
  );
}
