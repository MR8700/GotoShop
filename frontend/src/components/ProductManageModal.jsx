import React, { useState, useRef } from "react";
import { getMediaUrl, updateProduct, deleteProduct } from "../api/client";

export default function ProductManageModal({
  product,
  categories = [],
  onClose,
  onProductUpdated,
  onProductDeleted,
  showToast,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(product?.name || "");
  const [categoryId, setCategoryId] = useState(product?.category_id || "");
  const [price, setPrice] = useState(product?.price || 0);
  const [oldPrice, setOldPrice] = useState(product?.old_price || "");
  const [stock, setStock] = useState(product?.stock ?? 5);
  const [description, setDescription] = useState(product?.description || "");
  const [shortDescription, setShortDescription] = useState(product?.short_description || "");
  const [badgeTag, setBadgeTag] = useState(product?.badge_tag || "");
  const [isHeroDeal, setIsHeroDeal] = useState(product?.is_hero_deal || false);
  const [imagePreview, setImagePreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fileInputRef = useRef(null);

  if (!product) return null;

  const handleImageFile = (file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast("L'image dépasse 10 Mo");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
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

        const resizedDataUrl = canvas.toDataURL("image/jpeg", 0.85);
        setImagePreview(resizedDataUrl);
        showToast("Nouvelle photo chargée et optimisée !");
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name,
        category_id: categoryId || null,
        price: parseInt(price, 10),
        old_price: oldPrice ? parseInt(oldPrice, 10) : null,
        stock: parseInt(stock, 10),
        description,
        short_description: shortDescription,
        badge_tag: badgeTag,
        is_hero_deal: isHeroDeal,
      };
      if (imagePreview) {
        payload.image_data = imagePreview;
      }

      const updated = await updateProduct(product.id, payload);
      showToast(`Produit "${updated.name}" mis à jour avec succès !`);
      if (onProductUpdated) onProductUpdated(updated);
      setIsEditing(false);
      onClose();
    } catch (err) {
      showToast(err.message || "Erreur de mise à jour");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!window.confirm(`Masquer le produit "${product.name}" de la vitrine ?`)) return;
    setDeleting(true);
    try {
      await deleteProduct(product.id, false);
      showToast(`"${product.name}" archivé et masqué de la vitrine.`);
      if (onProductDeleted) onProductDeleted(product.id);
      onClose();
    } catch (err) {
      showToast(err.message || "Erreur lors de l'archivage");
    } finally {
      setDeleting(false);
    }
  };

  const handleHardDelete = async () => {
    if (!window.confirm(`⚠️ SUPPRESSION DÉFINITIVE :\nÊtes-vous sûre de vouloir supprimer définitivement "${product.name}" de la base de données ? Cette action est irréversible.`)) {
      return;
    }
    setDeleting(true);
    try {
      await deleteProduct(product.id, true);
      showToast(`"${product.name}" supprimé définitivement de la base !`);
      if (onProductDeleted) onProductDeleted(product.id);
      onClose();
    } catch (err) {
      showToast(err.message || "Erreur de suppression");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-surface-container-high rounded-2xl p-5 max-w-md w-full shadow-2xl border border-white/10 my-auto max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-primary/20 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">edit_square</span>
            </span>
            <div>
              <h3 className="font-headline-sm text-base text-on-surface font-bold">
                {isEditing ? "Modifier le Produit" : "Gestion du Produit"}
              </h3>
              <p className="text-[11px] text-on-surface-variant">
                Espace Propriétaire • Awa Chic & Tech
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-container-highest text-on-surface flex items-center justify-center hover:bg-surface-bright transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {!isEditing ? (
          <div className="space-y-4 pt-4">
            {/* Product Image & Badges */}
            <div className="relative w-full h-52 rounded-xl overflow-hidden bg-surface-container-lowest shadow-md">
              <img
                src={getMediaUrl(product.primary_image_url)}
                alt={product.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "/media/products/samsung_galaxy_a15.jpg";
                }}
              />
              <span className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full bg-surface-container-lowest/80 backdrop-blur-md text-secondary font-label-sm text-xs font-bold uppercase">
                {product.badge_tag || "Catalogue"}
              </span>
              {product.is_hero_deal && (
                <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-primary text-surface font-label-sm text-[10px] font-bold uppercase shadow-sm">
                  ★ Produit Vedette
                </span>
              )}
              <span className="absolute bottom-2 right-2 rounded-lg bg-surface/90 backdrop-blur-md px-2.5 py-1 text-on-surface font-label-sm text-xs font-semibold">
                Stock: {product.stock}
              </span>
            </div>

            {/* Details */}
            <div>
              <h2 className="font-headline-sm text-lg text-on-surface font-bold leading-snug">
                {product.name}
              </h2>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="font-headline-md text-xl text-primary font-bold">
                  {product.price.toLocaleString("fr-FR")} {product.currency || "FCFA"}
                </span>
                {product.old_price && (
                  <span className="font-body-sm text-xs text-outline line-through">
                    {product.old_price.toLocaleString("fr-FR")} {product.currency || "FCFA"}
                  </span>
                )}
              </div>
              <p className="font-body-sm text-xs text-on-surface-variant mt-2 leading-relaxed">
                {product.description || product.short_description || "Aucune description renseignée."}
              </p>
            </div>

            {/* Performance Stats Strip */}
            <div className="grid grid-cols-3 gap-2 bg-surface-container p-3 rounded-xl border border-white/5">
              <div className="flex flex-col text-center">
                <span className="font-label-sm text-[10px] text-on-surface-variant uppercase">Ventes</span>
                <span className="font-headline-sm text-secondary font-bold text-sm">{product.sales_count}</span>
              </div>
              <div className="flex flex-col text-center">
                <span className="font-label-sm text-[10px] text-on-surface-variant uppercase">Discussions</span>
                <span className="font-headline-sm text-primary font-bold text-sm">{product.active_discussions_count}</span>
              </div>
              <div className="flex flex-col text-center">
                <span className="font-label-sm text-[10px] text-on-surface-variant uppercase">CA Récolté</span>
                <span className="font-headline-sm text-on-surface font-bold text-sm">
                  {(product.revenue || 0).toLocaleString("fr-FR")}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="w-full h-11 rounded-xl bg-primary text-surface font-label-md text-sm font-bold flex items-center justify-center gap-1.5 shadow-md active:scale-98 transition-all hover:brightness-110"
              >
                <span className="material-symbols-outlined text-[18px]">edit</span>
                <span>Modifier les Informations / Prix / Stock</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleArchive}
                  className="h-10 rounded-xl bg-surface-container-highest text-on-surface-variant hover:text-on-surface font-label-md text-xs font-bold flex items-center justify-center gap-1 active:scale-98 transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">visibility_off</span>
                  <span>Archiver / Masquer</span>
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleHardDelete}
                  className="h-10 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 font-label-md text-xs font-bold flex items-center justify-center gap-1 active:scale-98 transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">delete_forever</span>
                  <span>Supprimer Définitivement</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-3 pt-4">
            {/* Image Preview & Change Button */}
            <div>
              <label className="font-label-sm text-xs text-on-surface-variant uppercase font-bold block mb-1.5">
                Photo du Produit
              </label>
              <div className="flex items-center gap-3">
                <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-surface-container-lowest border border-white/10 shrink-0 shadow-inner">
                  <img
                    src={imagePreview || getMediaUrl(product.primary_image_url)}
                    alt="Aperçu"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageFile(e.target.files?.[0])}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-surface-container border border-outline-variant/30 text-on-surface font-label-md text-xs font-semibold hover:bg-surface-bright flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                    <span>Changer la photo</span>
                  </button>
                  <p className="text-[10px] text-on-surface-variant mt-1">
                    Format JPG ou PNG, compressé automatiquement
                  </p>
                </div>
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="font-label-sm text-xs text-on-surface-variant uppercase font-bold block mb-1">
                Nom du Produit *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-surface-container border border-outline-variant/30 text-on-surface focus:ring-2 focus:ring-primary font-body-md text-sm"
                required
              />
            </div>

            {/* Category Dropdown */}
            {categories && categories.length > 0 && (
              <div>
                <label className="font-label-sm text-xs text-on-surface-variant uppercase font-bold block mb-1">
                  Rayon / Catégorie
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-surface-container border border-outline-variant/30 text-on-surface focus:ring-2 focus:ring-primary font-body-md text-sm"
                >
                  <option value="">Sélectionner une catégorie</option>
                  {categories.filter((c) => c.slug !== "all").map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Prices */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-label-sm text-xs text-on-surface-variant uppercase font-bold block mb-1">
                  Prix Réel (FCFA) *
                </label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-surface-container border border-outline-variant/30 text-on-surface focus:ring-2 focus:ring-primary font-body-md text-sm"
                  required
                />
              </div>
              <div>
                <label className="font-label-sm text-xs text-on-surface-variant uppercase font-bold block mb-1">
                  Ancien Prix Barré
                </label>
                <input
                  type="number"
                  value={oldPrice}
                  onChange={(e) => setOldPrice(e.target.value)}
                  placeholder="Optionnel"
                  className="w-full h-10 px-3 rounded-lg bg-surface-container border border-outline-variant/30 text-on-surface focus:ring-2 focus:ring-primary font-body-md text-sm"
                />
              </div>
            </div>

            {/* Stock & Badge */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-label-sm text-xs text-on-surface-variant uppercase font-bold block mb-1">
                  Quantité en Stock *
                </label>
                <input
                  type="number"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-surface-container border border-outline-variant/30 text-on-surface focus:ring-2 focus:ring-primary font-body-md text-sm"
                  required
                />
              </div>
              <div>
                <label className="font-label-sm text-xs text-on-surface-variant uppercase font-bold block mb-1">
                  Badge Promo
                </label>
                <input
                  type="text"
                  value={badgeTag}
                  onChange={(e) => setBadgeTag(e.target.value)}
                  placeholder="Ex: Top Vente, Nouveau..."
                  className="w-full h-10 px-3 rounded-lg bg-surface-container border border-outline-variant/30 text-on-surface focus:ring-2 focus:ring-primary font-body-md text-sm"
                />
              </div>
            </div>

            {/* Short & Full Description */}
            <div>
              <label className="font-label-sm text-xs text-on-surface-variant uppercase font-bold block mb-1">
                Description Courte (1 ligne)
              </label>
              <input
                type="text"
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="Ex: Coton 100% hollandais véritable, coupe princesse..."
                className="w-full h-10 px-3 rounded-lg bg-surface-container border border-outline-variant/30 text-on-surface focus:ring-2 focus:ring-primary font-body-md text-sm"
              />
            </div>

            <div>
              <label className="font-label-sm text-xs text-on-surface-variant uppercase font-bold block mb-1">
                Description Complète
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Caractéristiques, tailles, conseils d'entretien..."
                className="w-full p-2.5 rounded-lg bg-surface-container border border-outline-variant/30 text-on-surface focus:ring-2 focus:ring-primary font-body-sm text-xs"
              />
            </div>

            {/* Toggle Hero Deal */}
            <label className="flex items-center gap-2 p-2 rounded-xl bg-surface-container border border-white/5 cursor-pointer">
              <input
                type="checkbox"
                checked={isHeroDeal}
                onChange={(e) => setIsHeroDeal(e.target.checked)}
                className="rounded text-primary focus:ring-primary h-4 w-4"
              />
              <span className="text-xs font-semibold text-on-surface">
                Définir comme Produit Vedette (Hero Deal) en haut de boutique
              </span>
            </label>

            {/* Form Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="h-11 rounded-xl bg-primary text-surface font-label-md text-sm font-bold flex items-center justify-center gap-1 shadow-md active:scale-95 transition-all hover:brightness-110"
              >
                <span className="material-symbols-outlined text-[18px]">save</span>
                <span>{saving ? "Sauvegarde..." : "Enregistrer"}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="h-11 rounded-xl bg-surface-container-highest text-on-surface-variant font-label-md text-sm hover:text-on-surface"
              >
                Annuler
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
