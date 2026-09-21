import React, { useState, useRef } from "react";
import { createProduct } from "../api/client";

export default function NewProductModal({ store, categories, onClose, onProductCreated, showToast }) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState(categories[1]?.id || categories[0]?.id || "");
  const [price, setPrice] = useState("");
  const [oldPrice, setOldPrice] = useState("");
  const [stock, setStock] = useState(5);
  const [description, setDescription] = useState("");
  const [badgeTag, setBadgeTag] = useState("Nouveau");

  // Media files
  const [imagePreview, setImagePreview] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [pdfName, setPdfName] = useState(null);
  const [pdfData, setPdfData] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const pdfInputRef = useRef(null);

  // Handle image resizing via HTML5 Canvas
  const processImageFile = (file) => {
    if (!file) return;
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

        // Convert to compressed jpeg data url
        const resizedDataUrl = canvas.toDataURL("image/jpeg", 0.85);
        setImagePreview(resizedDataUrl);
        showToast("Image optimisée et chargée !");
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleVideoFile = (file) => {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      showToast("La vidéo dépasse 25 Mo");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setVideoPreview(e.target.result);
      showToast("Vidéo du produit ajoutée !");
    };
    reader.readAsDataURL(file);
  };

  const handlePdfFile = (file) => {
    if (!file) return;
    setPdfName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      setPdfData(e.target.result);
      showToast(`Catalogue PDF joint : ${file.name}`);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !price) {
      showToast("Veuillez renseigner au moins le nom et le prix");
      return;
    }
    setIsSubmitting(true);
    showToast("Création du produit en base de données...");

    try {
      const payload = {
        store_id: store.id,
        name: name.trim(),
        category_id: categoryId || null,
        price: parseInt(price, 10),
        old_price: oldPrice ? parseInt(oldPrice, 10) : null,
        stock: parseInt(stock, 10) || 1,
        description: description.trim(),
        short_description: description.trim().substring(0, 100),
        badge_tag: badgeTag,
        image_data: imagePreview || null,
        video_data: videoPreview || null,
        pdf_data: pdfData || null,
      };

      const newProd = await createProduct(payload);
      showToast(`Produit "${newProd.name}" créé avec succès !`);
      if (onProductCreated) onProductCreated(newProd);
      onClose();
    } catch (err) {
      showToast(err.message || "Erreur de création");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-surface-container-high rounded-2xl p-5 max-w-md w-full shadow-2xl border border-white/5 my-auto max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">add_a_photo</span>
            </span>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">Nouveau Produit</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-container-highest text-on-surface flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          {/* Photo capture & upload */}
          <div className="space-y-2">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase font-bold block">
              Photo du Produit (Instantanée ou Galerie)
            </label>

            {imagePreview ? (
              <div className="relative w-full h-48 rounded-xl overflow-hidden bg-surface-container-lowest border border-white/10">
                <img src={imagePreview} alt="Aperçu" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImagePreview(null)}
                  className="absolute top-2 right-2 bg-error text-on-error p-1.5 rounded-full shadow-md"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="h-24 rounded-xl border border-dashed border-primary/50 bg-primary-container/10 text-primary flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform"
                >
                  <span className="material-symbols-outlined text-[26px]">photo_camera</span>
                  <span className="font-label-sm text-xs font-bold">Prendre Photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-24 rounded-xl border border-dashed border-outline/50 bg-surface-container text-on-surface flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform"
                >
                  <span className="material-symbols-outlined text-[26px]">photo_library</span>
                  <span className="font-label-sm text-xs font-bold">Importer Galerie</span>
                </button>
              </div>
            )}

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => processImageFile(e.target.files?.[0])}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => processImageFile(e.target.files?.[0])}
            />
          </div>

          {/* Video & PDF attachments */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-label-sm text-xs text-on-surface-variant uppercase font-bold block mb-1">
                Vidéo Démo (Optionnel)
              </label>
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                className={`w-full h-11 rounded-lg border flex items-center justify-center gap-1.5 text-xs font-semibold px-2 ${
                  videoPreview
                    ? "border-secondary text-secondary bg-secondary/10"
                    : "border-outline-variant/40 bg-surface-container text-on-surface-variant"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {videoPreview ? "check_circle" : "videocam"}
                </span>
                <span className="truncate">{videoPreview ? "Vidéo prête" : "Ajouter vidéo"}</span>
              </button>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => handleVideoFile(e.target.files?.[0])}
              />
            </div>

            <div>
              <label className="font-label-sm text-xs text-on-surface-variant uppercase font-bold block mb-1">
                Catalogue PDF (Optionnel)
              </label>
              <button
                type="button"
                onClick={() => pdfInputRef.current?.click()}
                className={`w-full h-11 rounded-lg border flex items-center justify-center gap-1.5 text-xs font-semibold px-2 ${
                  pdfData
                    ? "border-secondary text-secondary bg-secondary/10"
                    : "border-outline-variant/40 bg-surface-container text-on-surface-variant"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {pdfData ? "check_circle" : "picture_as_pdf"}
                </span>
                <span className="truncate">{pdfName || "Joindre PDF"}</span>
              </button>
              <input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => handlePdfFile(e.target.files?.[0])}
              />
            </div>
          </div>

          {/* Form fields */}
          <div>
            <label className="font-label-sm text-xs text-on-surface-variant uppercase font-bold block mb-1">
              Nom du Produit *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Robe Wax Royale, Montre connectée..."
              className="w-full h-11 px-3 rounded-lg bg-surface-container border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary font-body-md"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-label-sm text-xs text-on-surface-variant uppercase font-bold block mb-1">
                Prix (FCFA) *
              </label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="ex: 25000"
                className="w-full h-11 px-3 rounded-lg bg-surface-container border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary font-body-md"
                required
              />
            </div>
            <div>
              <label className="font-label-sm text-xs text-on-surface-variant uppercase font-bold block mb-1">
                Ancien Prix (Barré)
              </label>
              <input
                type="number"
                value={oldPrice}
                onChange={(e) => setOldPrice(e.target.value)}
                placeholder="ex: 30000"
                className="w-full h-11 px-3 rounded-lg bg-surface-container border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary font-body-md"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-label-sm text-xs text-on-surface-variant uppercase font-bold block mb-1">
                Catégorie
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full h-11 px-2 rounded-lg bg-surface-container border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary font-body-sm"
              >
                {categories.filter(c => c.slug !== 'all').map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-label-sm text-xs text-on-surface-variant uppercase font-bold block mb-1">
                Stock Initial
              </label>
              <input
                type="number"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full h-11 px-3 rounded-lg bg-surface-container border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary font-body-md"
              />
            </div>
          </div>

          <div>
            <label className="font-label-sm text-xs text-on-surface-variant uppercase font-bold block mb-1">
              Description &amp; Caractéristiques
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Détails du produit, tailles, matière..."
              className="w-full p-3 rounded-lg bg-surface-container border border-outline-variant/30 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary font-body-sm"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-13 py-3 rounded-xl bg-primary-container text-on-primary-container font-label-lg text-label-lg font-bold shadow-lg hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[20px]">check</span>
            <span>{isSubmitting ? "Enregistrement..." : "Publier le produit en base"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
