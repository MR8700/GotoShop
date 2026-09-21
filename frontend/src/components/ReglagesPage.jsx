import React, { useState, useEffect } from "react";
import {
  updateStore,
  updateChannel,
  getMediaUrl,
  fetchLoyaltyTiers,
  createLoyaltyTier,
  updateLoyaltyTier,
  deleteLoyaltyTier,
  fetchStoreSubscriptionStatus,
} from "../api/client";
import SubscriptionModal from "./SubscriptionModal";

const THEME_PRESETS = [
  { id: "KINETIC_AMBER", label: "Kinetic Amber (Défaut)", primary: "#ec761e", secondary: "#4edea3" },
  { id: "EMERAUDE_ROYALE", label: "Émeraude Royale", primary: "#10b981", secondary: "#3b82f6" },
  { id: "SAPHIR_LUXE", label: "Saphir Luxe", primary: "#3b82f6", secondary: "#f59e0b" },
  { id: "RUBIS_PASSION", label: "Rubis Passion", primary: "#ef4444", secondary: "#8b5cf6" },
  { id: "FUCHSIA_CHIC", label: "Fuchsia Chic", primary: "#ec4899", secondary: "#06b6d4" },
  { id: "AMETHYSTE_NOIR", label: "Améthyste Sombre", primary: "#8b5cf6", secondary: "#10b981" },
];

export default function ReglagesPage({ store, channels, onStoreUpdated, onChannelsUpdated, onOpenChangePassword, onLogout, showToast }) {
  const [name, setName] = useState(store?.name || "");
  const [tagline, setTagline] = useState(store?.tagline || "");
  const [currency, setCurrency] = useState(store?.currency || "FCFA");
  const [ownerBio, setOwnerBio] = useState(store?.owner_bio || "");
  const [avatarPreview, setAvatarPreview] = useState(store?.avatar_url || "");
  const [avatarData, setAvatarData] = useState(null);
  const [flashTitle, setFlashTitle] = useState(store?.flash_title || "");
  const [flashSubtitle, setFlashSubtitle] = useState(store?.flash_subtitle || "");
  const [isSaving, setIsSaving] = useState(false);

  // Theme & Colors state
  const [primaryColor, setPrimaryColor] = useState(store?.primary_color || "#ec761e");
  const [secondaryColor, setSecondaryColor] = useState(store?.secondary_color || "#4edea3");
  const [themePreset, setThemePreset] = useState(store?.theme_preset || "KINETIC_AMBER");
  const [isCustomThemeActive, setIsCustomThemeActive] = useState(Boolean(store?.is_custom_theme_active));
  const [isSavingTheme, setIsSavingTheme] = useState(false);

  // Loyalty Program state
  const [isLoyaltyActive, setIsLoyaltyActive] = useState(store?.is_loyalty_active !== false);
  const [loyaltySpendPerPoint, setLoyaltySpendPerPoint] = useState(store?.loyalty_spend_per_point || 1000);
  const [isSavingLoyaltyConfig, setIsSavingLoyaltyConfig] = useState(false);
  const [loyaltyTiers, setLoyaltyTiers] = useState([]);
  const [loadingTiers, setLoadingTiers] = useState(false);
  const [editingTier, setEditingTier] = useState(null);
  const [tierForm, setTierForm] = useState({
    name: "",
    min_points: 0,
    badge_label: "",
    perk_title: "",
    perk_description: "",
    discount_percent: 0,
    is_active: true,
  });
  const [isSavingTier, setIsSavingTier] = useState(false);

  // Channels state
  const [channelList, setChannelList] = useState(channels || []);
  const [editingChannel, setEditingChannel] = useState(null);
  const [editHandle, setEditHandle] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [isSavingChannel, setIsSavingChannel] = useState(false);

  // Load loyalty tiers from backend
  const loadTiers = async () => {
    if (!store?.id) return;
    setLoadingTiers(true);
    try {
      const tiers = await fetchLoyaltyTiers(store.id);
      setLoyaltyTiers(tiers || []);
    } catch {
      showToast("Erreur de chargement des paliers de fidélité");
    } finally {
      setLoadingTiers(false);
    }
  };

  // Subscription state
  const [subStatus, setSubStatus] = useState(null);
  const [loadingSubStatus, setLoadingSubStatus] = useState(false);
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [subModalMode, setSubModalMode] = useState("RENEWAL");

  const loadSubStatus = async () => {
    if (!store?.id) return;
    setLoadingSubStatus(true);
    try {
      const data = await fetchStoreSubscriptionStatus(store.id);
      setSubStatus(data);
    } catch {
      // Fallback on store props
      setSubStatus({
        subscription_plan: store?.subscription_plan || "STARTER",
        subscription_status: store?.subscription_status || "ACTIVE",
        subscription_expires_at: store?.subscription_expires_at,
        days_remaining: 30,
        is_active: true,
      });
    } finally {
      setLoadingSubStatus(false);
    }
  };

  useEffect(() => {
    loadTiers();
    loadSubStatus();
  }, [store?.id]);

  const handleAvatarFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const resized = canvas.toDataURL("image/jpeg", 0.88);
        setAvatarPreview(resized);
        setAvatarData(resized);
        showToast("Photo de profil sélectionnée (cliquez sur Enregistrer pour valider)");
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleToggleChannel = async (ch) => {
    const newStatus = !ch.is_active;
    try {
      const updated = await updateChannel(ch.id, { is_active: newStatus });
      const newList = channelList.map((c) => (c.id === ch.id ? updated : c));
      setChannelList(newList);
      if (onChannelsUpdated) onChannelsUpdated(newList);
      showToast(`Canal ${ch.display_title} : ${newStatus ? "Activé" : "Désactivé"}`);
    } catch (e) {
      showToast("Erreur de mise à jour du canal");
    }
  };

  const startEditChannel = (ch) => {
    setEditingChannel(ch);
    setEditHandle(ch.account_handle);
    setEditTitle(ch.display_title);
  };

  const handleSaveChannel = async (e) => {
    e.preventDefault();
    if (!editingChannel) return;
    setIsSavingChannel(true);
    try {
      const updated = await updateChannel(editingChannel.id, {
        account_handle: editHandle.trim(),
        display_title: editTitle.trim(),
      });
      const newList = channelList.map((c) => (c.id === editingChannel.id ? updated : c));
      setChannelList(newList);
      if (onChannelsUpdated) onChannelsUpdated(newList);
      showToast(`Paramètres enregistrés pour ${updated.display_title} !`);
      setEditingChannel(null);
    } catch (err) {
      showToast(err.message || "Erreur de sauvegarde du canal");
    } finally {
      setIsSavingChannel(false);
    }
  };

  const handleSaveStore = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        name,
        tagline,
        currency,
        owner_bio: ownerBio,
        flash_title: flashTitle,
        flash_subtitle: flashSubtitle,
      };
      if (avatarData) {
        payload.avatar_data = avatarData;
      }
      const updated = await updateStore(store.id, payload);
      if (onStoreUpdated) onStoreUpdated(updated);
      setAvatarData(null);
      showToast("Profil et boutique enregistrés avec succès !");
    } catch (err) {
      showToast(err.message || "Erreur de sauvegarde");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectThemePreset = (preset) => {
    setThemePreset(preset.id);
    setPrimaryColor(preset.primary);
    setSecondaryColor(preset.secondary);
    showToast(`Préréglage "${preset.label}" sélectionné`);
  };

  const handleSaveTheme = async () => {
    if (!store?.id) return;
    setIsSavingTheme(true);
    try {
      const updated = await updateStore(store.id, {
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        theme_preset: themePreset,
        is_custom_theme_active: isCustomThemeActive,
      });
      if (onStoreUpdated) onStoreUpdated(updated);
      showToast(
        isCustomThemeActive
          ? "🎨 Couleurs et thème appliqués à la boutique !"
          : "Thème par défaut restauré (couleurs personnalisées désactivées)"
      );
    } catch (err) {
      showToast(err.message || "Erreur de sauvegarde des couleurs");
    } finally {
      setIsSavingTheme(false);
    }
  };

  const handleSaveLoyaltyConfig = async () => {
    if (!store?.id) return;
    setIsSavingLoyaltyConfig(true);
    try {
      const updated = await updateStore(store.id, {
        is_loyalty_active: isLoyaltyActive,
        loyalty_spend_per_point: parseInt(loyaltySpendPerPoint) || 1000,
      });
      if (onStoreUpdated) onStoreUpdated(updated);
      showToast("⭐ Paramètres de fidélité enregistrés !");
    } catch (err) {
      showToast(err.message || "Erreur de sauvegarde de fidélité");
    } finally {
      setIsSavingLoyaltyConfig(false);
    }
  };

  const handleOpenTierModal = (tier = null) => {
    if (tier) {
      setEditingTier(tier);
      setTierForm({
        name: tier.name,
        min_points: tier.min_points,
        badge_label: tier.badge_label || "",
        perk_title: tier.perk_title || "",
        perk_description: tier.perk_description || "",
        discount_percent: tier.discount_percent || 0,
        is_active: tier.is_active !== false,
      });
    } else {
      setEditingTier("new");
      setTierForm({
        name: "",
        min_points: 100,
        badge_label: "",
        perk_title: "",
        perk_description: "",
        discount_percent: 5,
        is_active: true,
      });
    }
  };

  const handleSaveTier = async (e) => {
    e.preventDefault();
    if (!store?.id) return;
    setIsSavingTier(true);
    try {
      const payload = {
        name: tierForm.name.trim(),
        min_points: parseInt(tierForm.min_points) || 0,
        badge_label: tierForm.badge_label.trim() || null,
        perk_title: tierForm.perk_title.trim() || null,
        perk_description: tierForm.perk_description.trim() || null,
        discount_percent: parseInt(tierForm.discount_percent) || 0,
        is_active: tierForm.is_active,
      };

      if (editingTier && editingTier !== "new") {
        await updateLoyaltyTier(store.id, editingTier.id, payload);
        showToast(`Palier "${payload.name}" mis à jour !`);
      } else {
        await createLoyaltyTier(store.id, payload);
        showToast(`Nouveau palier "${payload.name}" créé !`);
      }
      setEditingTier(null);
      await loadTiers();
    } catch (err) {
      showToast(err.message || "Erreur de sauvegarde du palier");
    } finally {
      setIsSavingTier(false);
    }
  };

  const handleDeleteTier = async (tierId, tierName) => {
    if (!window.confirm(`Supprimer le palier de fidélité "${tierName}" ?`)) return;
    try {
      await deleteLoyaltyTier(store.id, tierId);
      showToast(`Palier "${tierName}" supprimé`);
      await loadTiers();
    } catch (err) {
      showToast(err.message || "Erreur de suppression");
    }
  };

  return (
    <div className="flex flex-col w-full gap-space-md max-w-lg mx-auto pb-32">
      <div className="flex items-center justify-between px-space-xs pt-1">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Configuration Boutique</h2>
        <span className="px-2.5 py-0.5 rounded-full bg-secondary/15 text-secondary font-label-sm text-label-sm uppercase font-semibold">
          Mono-Propriétaire
        </span>
      </div>

      <form onSubmit={handleSaveStore} className="bg-surface-container rounded-xl p-space-md shadow-md space-y-4">
        {/* Photo de profil & Bio Commerçante */}
        <div className="p-3.5 rounded-xl bg-surface-container-high/60 border border-primary/20 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-label-sm text-primary font-bold uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">account_circle</span>
              Profil de la Commerçante
            </span>
            <span className="font-label-sm text-label-sm text-secondary bg-secondary/15 px-2 py-0.5 rounded-full font-medium">
              Visible en Vitrine
            </span>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="relative group shrink-0">
              <img
                src={avatarPreview ? (avatarPreview.startsWith("data:") ? avatarPreview : getMediaUrl(avatarPreview)) : "/media/store/awa_portrait.jpg"}
                alt="Photo de profil"
                className="w-16 h-16 rounded-full object-cover ring-2 ring-primary shadow-md"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "/media/store/awa_portrait.jpg";
                }}
              />
              <label className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white rounded-full opacity-90 group-hover:opacity-100 cursor-pointer transition-opacity">
                <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                <span className="text-[9px] font-bold">Changer</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleAvatarFile(e.target.files[0])}
                />
              </label>
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-headline-sm text-sm text-on-surface">Photo de Profil</p>
              <p className="font-body-sm text-xs text-on-surface-variant leading-tight mt-0.5">
                Appuyez sur la caméra pour prendre une photo ou charger une image.
              </p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-label-sm text-label-sm text-on-surface-variant uppercase font-bold">
                Biographie Commerçante (Bio)
              </label>
              <span className="text-xs text-on-surface-variant font-mono">
                {ownerBio.length}/250
              </span>
            </div>
            <textarea
              value={ownerBio}
              maxLength={250}
              rows={3}
              onChange={(e) => setOwnerBio(e.target.value)}
              placeholder="Ex: Créatrice passionnée & experte Tech à Abidjan. Tous mes articles sont minutieusement inspectés avant expédition express."
              className="w-full p-2.5 rounded-lg bg-surface-container-high border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary font-body-sm resize-none"
            />
          </div>
        </div>

        <div>
          <label className="font-label-sm text-label-sm text-on-surface-variant uppercase font-bold block mb-1">
            Nom de la Boutique
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-12 px-3 rounded-lg bg-surface-container-high border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary font-body-md"
            required
          />
        </div>

        <div>
          <label className="font-label-sm text-label-sm text-on-surface-variant uppercase font-bold block mb-1">
            Slogan / Spécialité
          </label>
          <input
            type="text"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            className="w-full h-12 px-3 rounded-lg bg-surface-container-high border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary font-body-md"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase font-bold block mb-1">
              Devise
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full h-12 px-3 rounded-lg bg-surface-container-high border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary font-body-md"
            >
              <option value="FCFA">FCFA (XOF)</option>
              <option value="EUR">EUR (€)</option>
              <option value="USD">USD ($)</option>
            </select>
          </div>

          <div>
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase font-bold block mb-1">
              Statut Tunnel
            </label>
            <div className="h-12 px-3 rounded-lg bg-surface-container-lowest flex items-center justify-between text-secondary font-label-md">
              <span>WA / FB / TikTok</span>
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
            </div>
          </div>
        </div>

        <div>
          <label className="font-label-sm text-label-sm text-on-surface-variant uppercase font-bold block mb-1">
            Titre Vente Flash
          </label>
          <input
            type="text"
            value={flashTitle}
            onChange={(e) => setFlashTitle(e.target.value)}
            className="w-full h-12 px-3 rounded-lg bg-surface-container-high border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary font-body-md"
          />
        </div>

        <div>
          <label className="font-label-sm text-label-sm text-on-surface-variant uppercase font-bold block mb-1">
            Sous-titre Vente Flash
          </label>
          <input
            type="text"
            value={flashSubtitle}
            onChange={(e) => setFlashSubtitle(e.target.value)}
            className="w-full h-12 px-3 rounded-lg bg-surface-container-high border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary font-body-md"
          />
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="w-full h-12 rounded-xl bg-primary-container text-on-primary-container font-label-lg text-label-lg font-bold shadow-md hover:brightness-110 active:scale-98 transition-all"
        >
          {isSaving ? "Enregistrement..." : "Enregistrer les modifications"}
        </button>
      </form>

      {/* Section 2: Thème & Couleurs de la Boutique */}
      <section className="bg-surface-container rounded-xl p-space-md shadow-md space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">palette</span>
            <div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">Thème & Couleurs du Site</h3>
              <p className="font-body-sm text-xs text-on-surface-variant">
                Personnalisez les teintes principales de la vitrine selon votre image de marque.
              </p>
            </div>
          </div>

          {/* Activation switch */}
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={isCustomThemeActive}
              onChange={(e) => setIsCustomThemeActive(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>

        {/* Status notice */}
        <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
          isCustomThemeActive ? "bg-primary/10 border border-primary/20 text-on-surface" : "bg-surface-container-high text-on-surface-variant"
        }`}>
          <span className="material-symbols-outlined text-[16px] text-primary">
            {isCustomThemeActive ? "check_circle" : "toggle_off"}
          </span>
          <span>
            {isCustomThemeActive
              ? "Couleurs personnalisées actives et visibles par tous les visiteurs."
              : "Couleurs personnalisées désactivées (le site utilise la palette d'origine)."}
          </span>
        </div>

        {/* Preset Palettes */}
        <div className="space-y-2">
          <label className="font-label-sm text-xs text-on-surface-variant uppercase font-bold block">
            Palettes Prédéfinies
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {THEME_PRESETS.map((preset) => {
              const isSelected = themePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectThemePreset(preset)}
                  className={`p-2 rounded-xl border text-left flex items-center gap-2 transition-all ${
                    isSelected
                      ? "bg-surface-container-high border-primary shadow-sm"
                      : "bg-surface-container-high/40 border-white/5 hover:border-white/20"
                  }`}
                >
                  <div className="flex -space-x-1 shrink-0">
                    <span
                      className="w-4 h-4 rounded-full border border-black/40 inline-block shadow"
                      style={{ backgroundColor: preset.primary }}
                    />
                    <span
                      className="w-4 h-4 rounded-full border border-black/40 inline-block shadow"
                      style={{ backgroundColor: preset.secondary }}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-on-surface truncate">
                    {preset.label.split(" ")[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Color Inputs */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="space-y-1">
            <label className="font-label-sm text-[11px] text-on-surface-variant uppercase font-bold block">
              Couleur Primaire (Action)
            </label>
            <div className="flex items-center gap-2 p-1.5 rounded-lg bg-surface-container-high border border-outline-variant/30">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => {
                  setPrimaryColor(e.target.value);
                  setThemePreset("CUSTOM");
                }}
                className="w-8 h-8 rounded border-0 cursor-pointer bg-transparent"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => {
                  setPrimaryColor(e.target.value);
                  setThemePreset("CUSTOM");
                }}
                className="w-full bg-transparent font-mono text-xs text-on-surface focus:outline-none uppercase"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-label-sm text-[11px] text-on-surface-variant uppercase font-bold block">
              Couleur Secondaire (Succès)
            </label>
            <div className="flex items-center gap-2 p-1.5 rounded-lg bg-surface-container-high border border-outline-variant/30">
              <input
                type="color"
                value={secondaryColor}
                onChange={(e) => {
                  setSecondaryColor(e.target.value);
                  setThemePreset("CUSTOM");
                }}
                className="w-8 h-8 rounded border-0 cursor-pointer bg-transparent"
              />
              <input
                type="text"
                value={secondaryColor}
                onChange={(e) => {
                  setSecondaryColor(e.target.value);
                  setThemePreset("CUSTOM");
                }}
                className="w-full bg-transparent font-mono text-xs text-on-surface focus:outline-none uppercase"
              />
            </div>
          </div>
        </div>

        {/* Live Preview Card */}
        <div className="p-3 rounded-xl bg-surface-container-lowest border border-white/10 space-y-2">
          <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider block">
            Aperçu en direct
          </span>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg text-xs font-bold shadow text-white flex items-center gap-1.5"
              style={{ backgroundColor: primaryColor }}
            >
              <span className="material-symbols-outlined text-[15px]">shopping_bag</span>
              <span>Bouton Commander</span>
            </button>
            <span
              className="px-2.5 py-1 rounded-full text-xs font-bold"
              style={{ backgroundColor: `${secondaryColor}26`, color: secondaryColor }}
            >
              Badge 39 ventes
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveTheme}
          disabled={isSavingTheme}
          className="w-full h-11 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-xs font-bold border border-primary/30 flex items-center justify-center gap-2 transition-all active:scale-98"
        >
          <span className="material-symbols-outlined text-[16px] text-primary">save</span>
          <span>{isSavingTheme ? "Application du thème..." : "Appliquer & Enregistrer le Thème"}</span>
        </button>
      </section>

      {/* Section 3: Programme de Fidélité & Avantages Clients */}
      <section className="bg-surface-container rounded-xl p-space-md shadow-md space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[22px]">stars</span>
            <div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">Programme de Fidélité & Avantages</h3>
              <p className="font-body-sm text-xs text-on-surface-variant">
                Définissez les paliers, points et privilèges accordés à vos meilleurs acheteurs.
              </p>
            </div>
          </div>

          {/* Loyalty toggle switch */}
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={isLoyaltyActive}
              onChange={(e) => setIsLoyaltyActive(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-secondary"></div>
          </label>
        </div>

        {/* Spend per point rule */}
        <div className="p-3 rounded-xl bg-surface-container-high/60 border border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <label className="font-label-sm text-xs text-on-surface font-bold">
              Règle d'acquisition : Dépense pour 1 point
            </label>
            <span className="text-[11px] text-secondary font-semibold">1 pt cumulé</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="number"
                min="100"
                step="100"
                value={loyaltySpendPerPoint}
                onChange={(e) => setLoyaltySpendPerPoint(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-surface-container border border-outline-variant/30 text-on-surface font-headline-sm text-sm"
              />
              <span className="absolute right-3 top-2.5 text-xs text-on-surface-variant font-bold">
                {currency}
              </span>
            </div>

            <button
              type="button"
              onClick={handleSaveLoyaltyConfig}
              disabled={isSavingLoyaltyConfig}
              className="h-10 px-4 rounded-lg bg-secondary/15 hover:bg-secondary/25 text-secondary font-label-sm text-xs font-bold transition-all shrink-0"
            >
              {isSavingLoyaltyConfig ? "Sauvegarde..." : "Valider le ratio"}
            </button>
          </div>
          <p className="text-[11px] text-on-surface-variant">
            Exemple : Avec 1 000 {currency}, un achat de 25 000 {currency} crédite automatiquement 25 points au client dès confirmation.
          </p>
        </div>

        {/* Loyalty Tiers List */}
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between">
            <h4 className="font-headline-sm text-xs uppercase tracking-wider text-on-surface-variant font-bold">
              Paliers Définis & Avantages ({loyaltyTiers.length})
            </h4>
            <button
              type="button"
              onClick={() => handleOpenTierModal(null)}
              className="text-xs text-secondary hover:underline font-bold flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[15px]">add_circle</span>
              <span>Nouveau palier</span>
            </button>
          </div>

          {loadingTiers ? (
            <div className="py-4 text-center text-xs text-on-surface-variant">
              Chargement des paliers...
            </div>
          ) : loyaltyTiers.length === 0 ? (
            <div className="p-3 text-center text-xs text-on-surface-variant bg-surface-container-high rounded-xl">
              Aucun palier configuré. Cliquez sur "Nouveau palier" pour récompenser vos clients.
            </div>
          ) : (
            <div className="space-y-2">
              {loyaltyTiers.map((tier) => (
                <div
                  key={tier.id}
                  className={`p-3 rounded-xl bg-surface-container-high border transition-all ${
                    tier.is_active ? "border-white/5" : "border-white/5 opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-secondary text-[18px]">
                          workspace_premium
                        </span>
                        <span className="font-headline-sm text-sm font-bold text-on-surface">
                          {tier.name}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/15 text-secondary font-bold">
                          Dès {tier.min_points} pts
                        </span>
                        {!tier.is_active && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">
                            Inactif
                          </span>
                        )}
                      </div>

                      {tier.badge_label && (
                        <p className="text-[11px] text-on-surface-variant font-medium">
                          Badge : <span className="text-on-surface">{tier.badge_label}</span>
                        </p>
                      )}

                      <div className="pt-1 text-xs">
                        <p className="font-bold text-primary flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">redeem</span>
                          {tier.perk_title || "Avantage exclusif"}
                          {tier.discount_percent > 0 && (
                            <span className="text-secondary font-mono">(-{tier.discount_percent}%)</span>
                          )}
                        </p>
                        {tier.perk_description && (
                          <p className="text-[11px] text-on-surface-variant leading-tight mt-0.5">
                            {tier.perk_description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenTierModal(tier)}
                        className="w-8 h-8 rounded-lg bg-surface-container hover:bg-surface-container-highest text-primary flex items-center justify-center transition-colors"
                        title="Modifier"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTier(tier.id, tier.name)}
                        className="w-8 h-8 rounded-lg bg-surface-container hover:bg-red-500/20 text-on-surface-variant hover:text-red-400 flex items-center justify-center transition-colors"
                        title="Supprimer"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Social Channels Configuration */}
      <section className="bg-surface-container rounded-xl p-space-md shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">Canaux Conversationnels</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Paramétrez vos numéros et identifiants. (Ils sont masqués sur le site pour la confidentialité).
            </p>
          </div>
          <span className="material-symbols-outlined text-secondary">security</span>
        </div>

        <div className="space-y-2.5 pt-1">
          {channelList.map((ch) => (
            <div
              key={ch.id}
              className="p-3.5 rounded-xl bg-surface-container-high border border-white/5 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shadow-sm"
                    style={{ backgroundColor: `${ch.theme_color}26`, color: ch.theme_color }}
                  >
                    <span className="material-symbols-outlined text-[20px]">{ch.icon_name}</span>
                  </span>
                  <div>
                    <div className="font-headline-sm text-sm text-on-surface font-semibold flex items-center gap-1.5">
                      <span>{ch.display_title}</span>
                      {ch.channel_type === "SMS" && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-tertiary/20 text-tertiary">
                          Messagerie distincte
                        </span>
                      )}
                    </div>
                    <div className="font-body-sm text-xs text-on-surface-variant">
                      {ch.channel_type === "WHATSAPP"
                        ? "Numéro WhatsApp pour les commandes directes"
                        : ch.channel_type === "CALL"
                        ? "Numéro d'appel standard (voix)"
                        : ch.channel_type === "SMS"
                        ? "Numéro dédié aux SMS simples"
                        : ch.channel_type === "MESSENGER"
                        ? "Page ou lien Facebook Messenger"
                        : "Nom d'utilisateur ou lien profil TikTok"}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleChannel(ch)}
                  className={`px-3 py-1 rounded-full font-label-sm text-xs font-bold transition-all ${
                    ch.is_active
                      ? "bg-secondary/20 text-secondary"
                      : "bg-surface-container-highest text-on-surface-variant"
                  }`}
                >
                  {ch.is_active ? "Actif" : "Désactivé"}
                </button>
              </div>

              {/* Handle Value & Edit Trigger */}
              <div className="flex items-center justify-between bg-surface-container-lowest p-2 rounded-lg text-xs font-mono text-on-surface-variant">
                <div className="flex items-center gap-2 truncate">
                  <span className="material-symbols-outlined text-[15px] text-on-surface-variant">lock</span>
                  <span className="truncate">
                    {ch.account_handle ? ch.account_handle : "Non configuré"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => startEditChannel(ch)}
                  className="text-primary hover:underline font-label-sm font-bold flex items-center gap-1 flex-shrink-0"
                >
                  <span className="material-symbols-outlined text-[13px]">edit</span>
                  Modifier
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Mon Abonnement & Facturation */}
      <section className="bg-surface-container rounded-xl p-space-md shadow-md space-y-4 border border-amber-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-400 text-[24px]">verified</span>
            <div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">Mon Abonnement & Forfait</h3>
              <p className="font-body-sm text-xs text-on-surface-variant">
                Gestion de votre formule et paiements Mobile Money (Orange, Moov)
              </p>
            </div>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-black tracking-wide uppercase ${
            subStatus?.is_active
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
              : "bg-red-500/15 text-red-400 border border-red-500/30"
          }`}>
            {subStatus?.subscription_status === "ACTIVE"
              ? "● Formule Active"
              : subStatus?.subscription_status === "TRIAL"
              ? "● Essai Gratuit"
              : "● Expiré / Inactif"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3.5 bg-surface-container-high rounded-xl border border-white/5 space-y-1">
            <span className="text-[11px] font-semibold text-on-surface-variant block uppercase">
              Formule Actuelle
            </span>
            <div className="flex items-center gap-2">
              <span className="font-headline-sm text-base font-black text-amber-400">
                {subStatus?.subscription_plan === "STARTER"
                  ? "Formule Starter (1 000 FCFA)"
                  : subStatus?.subscription_plan === "VIP"
                  ? "Formule VIP Élite (5 000 FCFA)"
                  : "Formule Pro Vendeur (3 000 FCFA)"}
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant">
              Accès complet aux ventes WhatsApp et au tunnel d'achat instantané.
            </p>
          </div>

          <div className="p-3.5 bg-surface-container-high rounded-xl border border-white/5 space-y-1">
            <span className="text-[11px] font-semibold text-on-surface-variant block uppercase">
              Validité & Échéance
            </span>
            <div className="flex items-center gap-2">
              <span className="font-headline-sm text-base font-black text-on-surface">
                {subStatus?.days_remaining !== undefined ? `${subStatus.days_remaining} jours restants` : "30 jours restants"}
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant">
              {subStatus?.subscription_expires_at
                ? `Expire le ${new Date(subStatus.subscription_expires_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`
                : "Abonnement actif"}
            </p>
          </div>
        </div>

        {/* Action Buttons: Renouveler / Changer de Formule */}
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              setSubModalMode("RENEWAL");
              setIsSubModalOpen(true);
            }}
            className="flex-1 h-12 rounded-xl bg-gradient-to-r from-amber-600 via-orange-600 to-amber-500 hover:brightness-110 text-white font-label-md text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-transform active:scale-98"
          >
            <span className="material-symbols-outlined text-[18px]">autorenew</span>
            <span>Renouveler mon Abonnement (Orange / Moov)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSubModalMode("UPGRADE");
              setIsSubModalOpen(true);
            }}
            className="h-12 px-4 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-amber-300 font-label-md text-xs font-bold flex items-center justify-center gap-2 border border-amber-500/30 transition-transform active:scale-98"
          >
            <span className="material-symbols-outlined text-[18px]">upgrade</span>
            <span>Changer de Formule</span>
          </button>
        </div>
      </section>

      {/* Sécurité du Compte Commerçant */}
      <section className="bg-surface-container rounded-xl p-space-md shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">shield_lock</span>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">Sécurité du Compte Commerçante</h3>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-secondary/15 text-secondary font-label-sm text-label-sm font-semibold">
            Protégé
          </span>
        </div>

        <p className="font-body-sm text-xs text-on-surface-variant leading-relaxed">
          Votre accès d'administration est verrouillé par un mot de passe fort avec hachage cryptographique et protection anti-brute force.
        </p>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={onOpenChangePassword}
            className="h-11 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-sm text-xs font-bold flex items-center justify-center gap-1.5 transition-transform active:scale-95 border border-white/5"
          >
            <span className="material-symbols-outlined text-[16px] text-primary">key</span>
            <span>Changer mot de passe</span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="h-11 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 font-label-sm text-xs font-bold flex items-center justify-center gap-1.5 transition-transform active:scale-95 border border-red-500/20"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
            <span>Déconnexion</span>
          </button>
        </div>
      </section>

      {/* Edit Channel Modal */}
      {editingChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-surface-container-high rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-white/5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">
                Modifier {editingChannel.display_title}
              </h3>
              <button
                onClick={() => setEditingChannel(null)}
                className="w-7 h-7 rounded-full bg-surface-container text-on-surface flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveChannel} className="space-y-3">
              <div>
                <label className="font-label-sm text-xs text-on-surface-variant uppercase font-bold block mb-1">
                  Nom d'affichage
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg bg-surface-container border border-outline-variant/30 text-on-surface font-body-md"
                  required
                />
              </div>

              <div>
                <label className="font-label-sm text-xs text-on-surface-variant uppercase font-bold block mb-1">
                  {editingChannel.channel_type === "WHATSAPP"
                    ? "Numéro WhatsApp (avec indicatif pays, ex: +2250700000000)"
                    : editingChannel.channel_type === "CALL"
                    ? "Numéro d'appel téléphonique"
                    : editingChannel.channel_type === "SMS"
                    ? "Numéro de messagerie SMS (ex: +2250700445566)"
                    : editingChannel.channel_type === "MESSENGER"
                    ? "Page Facebook ou identifiant m.me"
                    : "Compte TikTok (@votre_boutique)"}
                </label>
                <input
                  type="text"
                  value={editHandle}
                  onChange={(e) => setEditHandle(e.target.value)}
                  placeholder={editingChannel.channel_type === "TIKTOK" ? "@maboutique" : "+2250700000000"}
                  className="w-full h-11 px-3 rounded-lg bg-surface-container border border-outline-variant/30 text-on-surface font-body-md font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSavingChannel}
                  className="h-11 rounded-xl bg-primary-container text-on-primary-container font-label-md text-label-md font-bold shadow-md"
                >
                  {isSavingChannel ? "Enregistrement..." : "Enregistrer"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingChannel(null)}
                  className="h-11 rounded-xl bg-surface-container-highest text-on-surface font-label-md text-label-md"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Loyalty Tier Modal */}
      {editingTier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-surface-container-high rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-white/5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
              <h3 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-secondary text-[20px]">stars</span>
                <span>{editingTier === "new" ? "Nouveau Palier de Fidélité" : "Modifier le Palier"}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingTier(null)}
                className="w-7 h-7 rounded-full bg-surface-container text-on-surface flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveTier} className="space-y-3">
              <div>
                <label className="font-label-sm text-xs text-on-surface-variant uppercase font-bold block mb-1">
                  Nom du palier
                </label>
                <input
                  type="text"
                  value={tierForm.name}
                  onChange={(e) => setTierForm({ ...tierForm, name: e.target.value })}
                  placeholder="Ex: Silver VIP, Diamant Royal..."
                  className="w-full h-11 px-3 rounded-lg bg-surface-container border border-outline-variant/30 text-on-surface font-body-md"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-label-sm text-xs text-on-surface-variant uppercase font-bold block mb-1">
                    Points requis
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={tierForm.min_points}
                    onChange={(e) => setTierForm({ ...tierForm, min_points: e.target.value })}
                    className="w-full h-11 px-3 rounded-lg bg-surface-container border border-outline-variant/30 text-on-surface font-body-md"
                    required
                  />
                </div>

                <div>
                  <label className="font-label-sm text-xs text-on-surface-variant uppercase font-bold block mb-1">
                    Remise directe (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={tierForm.discount_percent}
                    onChange={(e) => setTierForm({ ...tierForm, discount_percent: e.target.value })}
                    className="w-full h-11 px-3 rounded-lg bg-surface-container border border-outline-variant/30 text-on-surface font-body-md"
                  />
                </div>
              </div>

              <div>
                <label className="font-label-sm text-xs text-on-surface-variant uppercase font-bold block mb-1">
                  Libellé du badge client
                </label>
                <input
                  type="text"
                  value={tierForm.badge_label}
                  onChange={(e) => setTierForm({ ...tierForm, badge_label: e.target.value })}
                  placeholder="Ex: Membre Privilège Argent"
                  className="w-full h-11 px-3 rounded-lg bg-surface-container border border-outline-variant/30 text-on-surface font-body-md"
                />
              </div>

              <div>
                <label className="font-label-sm text-xs text-on-surface-variant uppercase font-bold block mb-1">
                  Titre de l'avantage
                </label>
                <input
                  type="text"
                  value={tierForm.perk_title}
                  onChange={(e) => setTierForm({ ...tierForm, perk_title: e.target.value })}
                  placeholder="Ex: Traitement prioritaire + Remise -10%"
                  className="w-full h-11 px-3 rounded-lg bg-surface-container border border-outline-variant/30 text-on-surface font-body-md"
                  required
                />
              </div>

              <div>
                <label className="font-label-sm text-xs text-on-surface-variant uppercase font-bold block mb-1">
                  Description détaillée de l'avantage
                </label>
                <textarea
                  rows={2}
                  value={tierForm.perk_description}
                  onChange={(e) => setTierForm({ ...tierForm, perk_description: e.target.value })}
                  placeholder="Ex: Vos commandes sont expédiées en priorité sous 1h avec un cadeau surprise inclus."
                  className="w-full p-2.5 rounded-lg bg-surface-container border border-outline-variant/30 text-on-surface font-body-sm text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="tier_is_active"
                  checked={tierForm.is_active}
                  onChange={(e) => setTierForm({ ...tierForm, is_active: e.target.checked })}
                  className="w-4 h-4 rounded border-outline-variant/40 bg-surface-container text-secondary focus:ring-secondary"
                />
                <label htmlFor="tier_is_active" className="text-xs text-on-surface font-medium cursor-pointer">
                  Activer ce palier dès maintenant pour les clients
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSavingTier}
                  className="h-11 rounded-xl bg-secondary text-on-secondary font-label-md text-label-md font-bold shadow-md hover:brightness-110 active:scale-98 transition-all"
                >
                  {isSavingTier ? "Enregistrement..." : "Enregistrer"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingTier(null)}
                  className="h-11 rounded-xl bg-surface-container-highest text-on-surface font-label-md text-label-md"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subscription Renewal / Upgrade Modal */}
      <SubscriptionModal
        isOpen={isSubModalOpen}
        onClose={() => setIsSubModalOpen(false)}
        mode={subModalMode}
        initialStore={store}
        onSuccess={() => {
          showToast("Demande d'abonnement transmise ! L'administrateur valide votre reçu.");
          loadSubStatus();
        }}
      />
    </div>
  );
}
