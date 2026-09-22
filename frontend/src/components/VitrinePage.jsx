import React, { useState, useEffect } from "react";
import { getMediaUrl } from "../api/client";
import ProductManageModal from "./ProductManageModal";
import NewProductModal from "./NewProductModal";

export default function VitrinePage({
  store,
  categories,
  products,
  selectedCategory,
  onSelectCategory,
  onOpenTunnel,
  cart,
  onAddToCart,
  onCheckoutCart,
  showToast,
  customer,
  mode = "client",
  onOpenCustomerAuth,
  onProductUpdated,
  onProductDeleted,
}) {
  const [selectedHeroColor, setSelectedHeroColor] = useState("Bleu Nuit");
  const [countdownSeconds, setCountdownSeconds] = useState(store?.flash_remaining_seconds || 15502);
  const [managedProduct, setManagedProduct] = useState(null);
  const [isNewProductOpen, setIsNewProductOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatCountdown = (secs) => {
    const h = String(Math.floor(secs / 3600)).padStart(2, "0");
    const m = String(Math.floor((secs % 3600) / 60)).padStart(2, "0");
    const s = String(secs % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  const heroProduct = selectedCategory
    ? products.find((p) => p.is_hero_deal)
    : (products.find((p) => p.is_hero_deal) || products[0]);
  const feedProducts = heroProduct
    ? products.filter((p) => p.id !== heroProduct.id)
    : products;

  const cartTotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto space-y-5 px-3 sm:px-4 pb-32">
      {/* Personalized Welcome Banner for Client */}
      {mode === "client" && customer && (
        <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-surface-container border border-subtle shadow-sm animate-fade-in">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-secondary/15 text-secondary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[18px]">verified_user</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-on-surface truncate">
                Ravi de vous revoir, {customer.name}
              </p>
              <p className="text-[11px] text-on-surface-variant truncate">
                Vos adresses et historiques sont synchronisés.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-secondary/10 border border-secondary/20 text-secondary text-[10px] font-semibold shrink-0">
            Membre VIP
          </span>
        </div>
      )}

      {mode === "client" && !customer && (
        <div
          onClick={onOpenCustomerAuth}
          className="flex items-center justify-between px-4 py-3 rounded-2xl bg-surface-container border border-subtle hover:border-strong transition-all cursor-pointer shadow-sm group active:scale-[0.99] animate-fade-in"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[18px]">bolt</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-on-surface group-hover:text-primary transition-colors truncate">
                Compte Client Unique
              </p>
              <p className="text-[11px] text-on-surface-variant truncate">
                Commandez en 1 clic sans mot de passe à mémoriser
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-xl bg-surface-secondary text-on-surface text-xs font-medium shrink-0 group-hover:bg-primary group-hover:text-white transition-all flex items-center gap-1 border border-subtle">
            <span>Se connecter</span>
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </span>
        </div>
      )}

      {mode === "owner" && (
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-surface-container border border-secondary/30 shadow-sm text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-xl bg-secondary/15 text-secondary flex items-center justify-center shrink-0 font-bold">
              <span className="material-symbols-outlined text-[18px]">tune</span>
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-on-surface truncate">
                Mode Gestion Commerçante
              </p>
              <p className="text-[11px] text-on-surface-variant truncate">
                Ajustez vos articles, stocks et visuels en direct
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsNewProductOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-primary hover:brightness-105 text-white text-xs font-semibold shrink-0 shadow-sm transition-all flex items-center gap-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Nouvel Article</span>
          </button>
        </div>
      )}

      {/* Flash Sale Pill (Subdued, high-end) */}
      {store?.is_flash_active && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-surface-container border border-primary/25 shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[16px]">timer</span>
            </div>
            <div className="min-w-0">
              <span className="text-xs font-semibold text-on-surface truncate block">
                {store?.flash_title || "Vente Flash Spéciale"}
              </span>
              <span className="text-[11px] text-on-surface-variant truncate block">
                {store?.flash_subtitle || "Ouagadougou & Abidjan • Expédition express"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-lg bg-surface-secondary border border-subtle">
            <span className="font-mono text-xs font-semibold text-primary tabular-nums">
              {formatCountdown(countdownSeconds)}
            </span>
          </div>
        </div>
      )}

      {/* Store Identity Card */}
      <section className="rounded-2xl bg-surface-container p-5 sm:p-6 border border-subtle shadow-card space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Store Logo with Verified Badge */}
            <div className="relative shrink-0">
              <img
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border border-subtle bg-surface"
                src={getMediaUrl(store?.logo_url) || "/media/store/logo.jpg"}
                alt={store?.name}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "/media/store/logo.jpg";
                }}
              />
              {store?.is_verified && (
                <span
                  className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-secondary text-white flex items-center justify-center text-[11px] font-bold shadow"
                  title="Commerçant certifié"
                >
                  <span className="material-symbols-outlined text-[11px]">check</span>
                </span>
              )}
            </div>

            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-on-surface tracking-tight truncate">
                {store?.name}
              </h1>
              <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-1">
                {store?.tagline || store?.description}
              </p>
              <div className="flex items-center gap-2 text-xs mt-1.5">
                <span className="flex items-center gap-1 text-amber-500 font-semibold">
                  <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    star
                  </span>
                  <span>{store?.rating || 4.9}</span>
                </span>
                <span className="text-on-surface-variant/40">•</span>
                <span className="text-on-surface-variant">
                  {store?.sales_count || 340} ventes conclues
                </span>
              </div>
            </div>
          </div>

          {/* Quick Direct WhatsApp Icon */}
          <button
            onClick={() => onOpenTunnel(heroProduct, "WHATSAPP")}
            aria-label="Contacter sur WhatsApp"
            className="w-10 h-10 rounded-xl bg-secondary/10 hover:bg-secondary/20 text-secondary border border-secondary/20 flex items-center justify-center transition-colors shrink-0"
            title="Ouvrir WhatsApp direct"
          >
            <span className="material-symbols-outlined text-[20px]">chat</span>
          </button>
        </div>

        {/* Owner Note / Bio */}
        {store?.owner_bio && (
          <div className="p-3 rounded-xl bg-surface-secondary/50 border-l-2 border-primary text-xs text-on-surface-secondary leading-relaxed italic">
            "{store.owner_bio}"
          </div>
        )}

        {/* Trust Badges */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-subtle">
          {store?.trust_badges?.map((badge, idx) => (
            <div key={idx} className="flex flex-col items-center justify-center p-2 rounded-xl bg-surface-secondary/40 text-center border border-subtle">
              <span className="material-symbols-outlined text-[17px] text-primary">
                {badge.icon_name}
              </span>
              <span className="text-[11px] font-medium text-on-surface-secondary mt-1 line-clamp-1">
                {badge.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Horizontal Category Navigation */}
      <nav className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar scroll-smooth">
        {categories.map((cat) => {
          const isActive = selectedCategory === cat.id || (!selectedCategory && cat.slug === "all");
          return (
            <button
              key={cat.id}
              onClick={() => {
                onSelectCategory(cat.slug === "all" ? null : cat.id);
                showToast(`Catégorie : ${cat.name}`);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? "bg-primary text-white font-semibold shadow-sm"
                  : "bg-surface-secondary text-on-surface-variant hover:text-on-surface border border-subtle"
              }`}
            >
              {cat.name}
            </button>
          );
        })}
      </nav>

      {/* Featured Hero Product Card */}
      {heroProduct && (
        <section className="relative overflow-hidden rounded-2xl bg-surface-card border border-subtle shadow-card p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="px-2.5 py-0.5 rounded-full bg-primary/15 text-primary font-semibold text-[11px] uppercase tracking-wide">
              {heroProduct.badge_tag || "Offre Vedette"}
            </span>
            <span className="flex items-center gap-1 text-secondary text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
              <span>{heroProduct.active_discussions_count} clients intéressés</span>
            </span>
          </div>

          {/* Product Image */}
          <div className="relative w-full h-56 sm:h-64 rounded-xl overflow-hidden bg-surface-secondary">
            <img
              className="w-full h-full object-cover"
              src={getMediaUrl(heroProduct.primary_image_url)}
              alt={heroProduct.name}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "/media/products/samsung_galaxy_a15.jpg";
              }}
            />
            <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-[11px] font-medium">
              Stock disponible
            </div>
            {heroProduct.guarantee_text && (
              <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-md text-white text-[11px]">
                {heroProduct.guarantee_text}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base sm:text-lg font-semibold text-on-surface">
                {heroProduct.name}
              </h2>
              <span className="text-[11px] font-medium text-on-surface-variant shrink-0">
                {heroProduct.stock_label || `Stock: ${heroProduct.stock}`}
              </span>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              {heroProduct.short_description || heroProduct.description}
            </p>

            {/* Color variants */}
            {heroProduct.variants && heroProduct.variants.length > 0 && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-on-surface-variant font-medium">Variante :</span>
                <div className="flex items-center gap-1.5">
                  {heroProduct.variants.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedHeroColor(v.name)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        selectedHeroColor === v.name
                          ? "bg-primary/15 text-primary border border-primary/30 font-semibold"
                          : "bg-surface-secondary text-on-surface-variant hover:text-on-surface border border-subtle"
                      }`}
                    >
                      {v.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Price */}
            <div className="flex items-baseline gap-2 pt-2">
              <span className="text-2xl font-bold text-on-surface tracking-tight">
                {heroProduct.price.toLocaleString("fr-FR")} {heroProduct.currency}
              </span>
              {heroProduct.old_price && (
                <span className="text-sm text-on-surface-variant/60 line-through">
                  {heroProduct.old_price.toLocaleString("fr-FR")} {heroProduct.currency}
                </span>
              )}
            </div>
          </div>

          {/* Action Button */}
          {mode === "owner" ? (
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setManagedProduct(heroProduct)}
                className="h-10 rounded-xl bg-surface-secondary hover:bg-surface-elevated text-on-surface border border-subtle text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">edit</span>
                <span>Gérer l'article</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Supprimer "${heroProduct.name}" ?`)) {
                    onProductDeleted?.(heroProduct.id);
                  }
                }}
                className="h-10 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                <span>Supprimer</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => onOpenTunnel(heroProduct, "WHATSAPP", selectedHeroColor)}
              className="w-full h-12 rounded-xl bg-primary hover:brightness-105 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.99] cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">shopping_bag</span>
              <span>Commander en direct sur WhatsApp</span>
            </button>
          )}
        </section>
      )}

      {/* Catalog Title Strip */}
      <div className="flex items-center justify-between pt-2 px-1">
        <h3 className="text-sm sm:text-base font-semibold text-on-surface">
          {selectedCategory ? "Articles de la sélection" : "Catalogue & Nouveautés"}
        </h3>
        {selectedCategory ? (
          <button
            onClick={() => onSelectCategory(null)}
            className="text-xs text-primary hover:underline font-medium flex items-center gap-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[14px]">refresh</span>
            <span>Toutes les catégories</span>
          </button>
        ) : (
          <span className="text-xs text-on-surface-variant">
            {products.length} article{products.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Products Feed */}
      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 rounded-2xl bg-surface-card border border-subtle text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-surface-secondary text-on-surface-variant flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">inventory_2</span>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-on-surface text-sm">Aucun article dans cette sélection</p>
            <p className="text-xs text-on-surface-variant max-w-xs">
              De nouveaux arrivages sont préparés en atelier par le commerçant.
            </p>
          </div>
          <button
            onClick={() => onSelectCategory(null)}
            className="px-4 py-2 rounded-xl bg-surface-secondary hover:bg-surface-elevated text-on-surface border border-subtle text-xs font-medium transition-colors cursor-pointer"
          >
            Voir tous les articles
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {feedProducts.map((p) => (
            <article
              key={p.id}
              className="group bg-surface-card rounded-2xl border border-subtle hover:border-strong overflow-hidden shadow-card transition-all duration-200 flex flex-col justify-between"
            >
              {/* Product Image */}
              <div className="relative w-full h-52 sm:h-56 bg-surface-secondary overflow-hidden">
                <img
                  className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                  src={getMediaUrl(p.primary_image_url)}
                  alt={p.name}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "/media/products/robe_ankara_reine_sika.jpg";
                  }}
                />
                {p.badge_tag && (
                  <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-white font-medium text-[10px] uppercase">
                    {p.badge_tag}
                  </span>
                )}
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-[11px] text-white">
                  <span>En stock : {p.stock}</span>
                  <span className="text-secondary font-medium">Paiement livraison</span>
                </div>
              </div>

              {/* Product Info */}
              <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                <div className="space-y-1">
                  <h4 className="font-semibold text-sm text-on-surface line-clamp-1">
                    {p.name}
                  </h4>
                  <p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">
                    {p.short_description || p.description}
                  </p>
                </div>

                <div className="flex items-baseline justify-between pt-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-base font-bold text-on-surface">
                      {p.price.toLocaleString("fr-FR")}
                    </span>
                    <span className="text-xs text-on-surface-variant font-medium">
                      {p.currency}
                    </span>
                  </div>

                  <button
                    onClick={() => onAddToCart(p)}
                    className="h-8 px-3 rounded-lg bg-surface-secondary hover:bg-surface-elevated text-on-surface text-xs font-medium border border-subtle transition-colors flex items-center gap-1 active:scale-95 cursor-pointer"
                    title="Ajouter au panier"
                  >
                    <span className="material-symbols-outlined text-[15px]">add</span>
                    <span>Ajouter</span>
                  </button>
                </div>

                {/* Direct Order Button */}
                {mode === "owner" ? (
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setManagedProduct(p)}
                      className="h-9 rounded-lg bg-surface-secondary hover:bg-surface-elevated text-on-surface text-xs font-medium border border-subtle flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">edit</span>
                      <span>Modifier</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Supprimer "${p.name}" ?`)) {
                          onProductDeleted?.(p.id);
                        }
                      }}
                      className="h-9 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-medium flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">delete</span>
                      <span>Supprimer</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => onOpenTunnel(p, "WHATSAPP")}
                    className="w-full h-10 rounded-xl bg-surface-secondary hover:bg-primary hover:text-white text-on-surface text-xs font-semibold border border-subtle transition-all flex items-center justify-center gap-1.5 active:scale-[0.99] cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">chat</span>
                    <span>Commander sur WhatsApp</span>
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Personal Contact Assistance Banner */}
      <section className="rounded-2xl bg-surface-card border border-subtle shadow-card p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-secondary/15 text-secondary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">support_agent</span>
          </div>
          <div>
            <h4 className="font-semibold text-sm text-on-surface">
              {store?.voice_note_title || "Besoin d'un conseil taille ou sur mesure ?"}
            </h4>
            <p className="text-xs text-on-surface-variant">
              {store?.voice_note_subtitle || "Échangez directement avec le commerçant en audio ou texte."}
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            showToast("Ouverture de la discussion avec le commerçant...");
            const msg = "Bonjour ! J'aimerais des conseils personnalisés pour ma commande.";
            const waNumber = store?.contact_whatsapp?.replace(/\D/g, "") || "22670123456";
            window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`, "_blank");
          }}
          className="w-full sm:w-auto h-10 px-4 rounded-xl bg-surface-secondary hover:bg-surface-elevated text-on-surface text-xs font-semibold border border-subtle transition-colors flex items-center justify-center gap-2 shrink-0 active:scale-95 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px] text-secondary">mic</span>
          <span>Poser une question en direct</span>
        </button>
      </section>

      {/* Floating Cart Drawer when items present */}
      {cartCount > 0 && (
        <aside className="fixed bottom-20 left-0 right-0 z-40 px-4 pointer-events-none transition-transform duration-300">
          <div className="pointer-events-auto mx-auto max-w-md rounded-2xl bg-surface-elevated/95 p-3.5 backdrop-blur-xl shadow-card-hover flex items-center justify-between gap-3 border border-subtle">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-bold shadow-sm shrink-0">
                <span className="material-symbols-outlined text-[20px]">shopping_bag</span>
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-secondary text-white text-[10px] font-bold flex items-center justify-center">
                  {cartCount}
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-on-surface-variant block">Total Panier</span>
                <span className="text-sm font-bold text-on-surface truncate block">
                  {cartTotal.toLocaleString("fr-FR")} {store?.currency || "FCFA"}
                </span>
              </div>
            </div>

            <button
              onClick={onCheckoutCart}
              className="h-10 px-4 rounded-xl bg-primary hover:brightness-105 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <span>Valider la commande</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        </aside>
      )}

      {/* Owner Product Management Modal */}
      {managedProduct && (
        <ProductManageModal
          product={managedProduct}
          categories={categories}
          onClose={() => setManagedProduct(null)}
          onProductUpdated={(updated) => {
            onProductUpdated?.(updated);
            setManagedProduct(null);
          }}
          onProductDeleted={(id) => {
            onProductDeleted?.(id);
            setManagedProduct(null);
          }}
          showToast={showToast}
        />
      )}

      {/* Owner New Product Modal */}
      {isNewProductOpen && (
        <NewProductModal
          store={store}
          categories={categories}
          onClose={() => setIsNewProductOpen(false)}
          onProductCreated={(newProd) => {
            onProductUpdated?.(newProd);
            setIsNewProductOpen(false);
          }}
          showToast={showToast}
        />
      )}
    </div>
  );
}
