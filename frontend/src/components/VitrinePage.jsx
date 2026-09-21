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
    <div className="flex flex-col w-full gap-space-md max-w-lg mx-auto pb-32">
      {/* Personalized Welcome Banner for Client / Owner */}
      {mode === "client" && customer && (
        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-surface-container border border-secondary/20 shadow-sm animate-fade-in">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-secondary/15 text-secondary text-sm font-bold">
              ✨
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-on-surface truncate">
                Ravi de vous revoir, {customer.name}
              </p>
              <p className="text-[11px] text-on-surface-variant truncate">
                Merci pour votre fidélité ! Vos avantages sont actifs.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-secondary/15 text-secondary text-[10px] font-bold shrink-0">
            Membre VIP
          </span>
        </div>
      )}

      {mode === "client" && !customer && (
        <div
          onClick={onOpenCustomerAuth}
          className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-surface-container border border-white/5 hover:border-primary/30 transition-all cursor-pointer shadow-sm group active:scale-[0.98] tap-scale animate-fade-in"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary text-xs font-bold">
              ⭐
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-on-surface truncate group-hover:text-primary transition-colors">
                Club Privilège Awa
              </p>
              <p className="text-[11px] text-on-surface-variant truncate">
                Points fidélité & livraison GPS en 1 clic
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-primary text-surface text-[10px] font-bold shrink-0 shadow-sm flex items-center gap-0.5">
            <span>Activer</span>
            <span className="material-symbols-outlined text-[12px]">chevron_right</span>
          </span>
        </div>
      )}

      {mode === "owner" && (
        <div className="flex items-center justify-between p-3 rounded-2xl bg-surface-container border border-primary/20 shadow-md text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-surface shadow-sm">
              <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-on-surface truncate">
                Gestion Vitrine & Articles
              </p>
              <p className="text-[11px] text-on-surface-variant truncate">
                Modifiez vos produits et ajustez les stocks
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsNewProductOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-primary text-surface font-label-md text-xs font-bold shrink-0 shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Nouveau</span>
          </button>
        </div>
      )}

      {/* Sticky/Floating Top Flash Promo Pill */}
      {store?.is_flash_active && (
        <div className="sticky top-16 z-30 w-full animate-fade-in">
          <div className="flex items-center justify-between gap-2 rounded-2xl bg-surface-container/95 border border-primary/25 px-3.5 py-2 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary text-sm font-bold">
                ⚡
              </span>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-primary truncate">
                  {store?.flash_title || "Vente Flash Express"}
                </span>
                <span className="text-[11px] text-on-surface-variant truncate">
                  {store?.flash_subtitle || "Ouaga & Abidjan • Envoi sous 2h chrono"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0 bg-surface-container-highest/80 px-2.5 py-1 rounded-xl">
              <span className="material-symbols-outlined text-primary text-[14px]">timer</span>
              <span className="font-mono text-xs font-bold text-primary tabular-nums">
                {formatCountdown(countdownSeconds)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Merchant Identity & Trust Badge Card */}
      <section className="rounded-xl bg-surface-container p-space-md shadow-md">
        <div className="flex items-start justify-between gap-space-sm">
          <div className="flex gap-space-sm items-center">
            {/* Dual Identity: Boutique Brand Logo + Certified Merchant Avatar */}
            <div className="relative flex-shrink-0">
              <img
                className="w-16 h-16 rounded-2xl object-cover shadow-lg border-2 border-primary/40 bg-surface-container-highest"
                src={getMediaUrl(store?.logo_url) || "/media/store/logo.jpg"}
                alt={`Logo ${store?.name}`}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "/media/store/logo.jpg";
                }}
              />
              <div
                className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full border-2 border-surface overflow-hidden shadow-md bg-surface-container-high"
                title="Awa - Gérante Certifiée"
              >
                <img
                  className="w-full h-full object-cover"
                  src={getMediaUrl(store?.avatar_url) || "/media/store/awa_portrait.jpg"}
                  alt="Awa Gérante"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "/media/store/awa_portrait.jpg";
                  }}
                />
              </div>
              <span className="absolute -top-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full bg-secondary text-surface text-[9px] font-bold shadow">
                <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  verified
                </span>
              </span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                <h1 className="font-headline-sm text-headline-sm text-on-surface">{store?.name}</h1>
                {store?.is_verified && (
                  <span className="material-symbols-outlined text-secondary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    verified
                  </span>
                )}
              </div>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                {store?.tagline}
              </span>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="flex items-center text-amber-400 font-label-md text-label-md font-bold">
                  ★ {store?.rating || 4.9}
                </span>
                <span className="text-on-surface-variant font-label-sm text-label-sm">
                  • {store?.sales_count || 342} commandes conclues
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onOpenTunnel(heroProduct, "WHATSAPP")}
            aria-label="WhatsApp Contact"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-highest text-secondary hover:scale-105 active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-[20px]">chat</span>
          </button>
        </div>

        {/* Owner Bio Presentation */}
        {store?.owner_bio && (
          <div className="mt-3 p-2.5 rounded-lg bg-surface-container-low border-l-2 border-primary/70 flex items-start gap-2">
            <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>
              format_quote
            </span>
            <p className="font-body-sm text-xs text-on-surface-variant italic leading-relaxed">
              "{store.owner_bio}"
            </p>
          </div>
        )}

        {/* Trust Badges Strip */}
        <div className="mt-space-sm grid grid-cols-3 gap-space-xs pt-space-xs">
          {store?.trust_badges?.map((badge, idx) => (
            <div key={idx} className="flex flex-col items-center rounded-lg bg-surface-container-low py-2 px-1 text-center">
              <span className={`material-symbols-outlined text-[16px] text-${badge.badge_type}`}>
                {badge.icon_name}
              </span>
              <span className="font-label-sm text-[10px] text-on-surface font-semibold mt-0.5">
                {badge.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Horizontal Scrollable Category Pills */}
      <nav className="relative -mx-margin px-margin flex items-center gap-2 overflow-x-auto pb-2 scroll-smooth no-scrollbar touch-pan-x">
        {categories.map((cat) => {
          const isActive = selectedCategory === cat.id || (!selectedCategory && cat.slug === "all");
          return (
            <button
              key={cat.id}
              onClick={() => {
                onSelectCategory(cat.slug === "all" ? null : cat.id);
                showToast(`Catégorie : ${cat.name}`);
              }}
              className={`flex-shrink-0 px-4 py-2 rounded-full font-label-md text-xs sm:text-sm font-semibold transition-all duration-150 active:scale-95 cursor-pointer whitespace-nowrap ${
                isActive
                  ? "bg-primary-container text-on-primary-container shadow-md font-bold ring-1 ring-primary/40"
                  : "bg-surface-container hover:bg-surface-container-high text-on-surface"
              }`}
            >
              {cat.name}
            </button>
          );
        })}
      </nav>

      {/* Featured Hero Deal Card: Samsung Galaxy A15 */}
      {heroProduct && (
        <section className="relative overflow-hidden rounded-xl bg-surface-container p-space-md shadow-xl">
          <div className="absolute -top-12 -right-12 h-44 w-44 rounded-full bg-primary-container/20 blur-3xl pointer-events-none"></div>
          <div className="relative flex flex-col gap-space-sm">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary-container font-label-sm text-label-sm uppercase tracking-wider font-bold">
                {heroProduct.badge_tag || "Top Vente High-Tech"}
              </span>
              <div className="flex items-center gap-1 text-secondary font-label-sm text-label-sm">
                <span className="material-symbols-outlined text-[14px]">forum</span>
                <span>{heroProduct.active_discussions_count} en discussion active</span>
              </div>
            </div>

            <div className="relative w-full h-56 rounded-lg overflow-hidden bg-surface-container-lowest">
              <img
                className="w-full h-full object-cover"
                src={getMediaUrl(heroProduct.primary_image_url)}
                alt={heroProduct.name}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "/media/products/samsung_galaxy_a15.jpg";
                }}
              />
              <div className="absolute top-2 left-2 rounded-full bg-surface-container-lowest/80 backdrop-blur-md px-2.5 py-1 text-on-surface font-label-sm text-label-sm flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
                Stock Abidjan & Ouaga
              </div>
              <div className="absolute bottom-2 right-2 rounded-lg bg-surface/90 backdrop-blur-md px-2 py-1 text-on-surface font-label-sm text-[11px] font-semibold">
                {heroProduct.guarantee_text || "Garantie 12 Mois"}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  {heroProduct.name}
                </h2>
                <span className="rounded-full bg-error-container/25 text-error font-label-sm text-[10px] px-2 py-0.5 uppercase font-bold">
                  {heroProduct.stock_label || `Plus que ${heroProduct.stock} en stock !`}
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {heroProduct.short_description || heroProduct.description}
              </p>

              {/* Variants Chips */}
              {heroProduct.variants && heroProduct.variants.length > 0 && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-label-sm text-on-surface-variant text-[11px]">Coloris :</span>
                  {heroProduct.variants.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedHeroColor(v.name)}
                      className={`px-2 py-0.5 rounded-md font-label-sm text-[11px] font-medium active:scale-95 transition-all ${
                        selectedHeroColor === v.name
                          ? "bg-surface-container-highest text-on-surface font-bold ring-1 ring-primary/40"
                          : "bg-surface-container-low text-on-surface-variant"
                      }`}
                    >
                      {v.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Pricing with Discount */}
              <div className="flex items-baseline gap-2 mt-2">
                <span className="font-headline-lg-mobile text-headline-lg-mobile text-primary font-bold">
                  {heroProduct.price.toLocaleString("fr-FR")} {heroProduct.currency}
                </span>
                {heroProduct.old_price && (
                  <span className="font-body-sm text-body-sm text-outline line-through">
                    {heroProduct.old_price.toLocaleString("fr-FR")} {heroProduct.currency}
                  </span>
                )}
                {heroProduct.old_price && (
                  <span className="rounded-full bg-secondary/15 text-secondary font-label-sm text-[10px] px-1.5 py-0.2 font-bold">
                    -{Math.round(((heroProduct.old_price - heroProduct.price) / heroProduct.old_price) * 100)}%
                  </span>
                )}
              </div>
            </div>

            {/* Owner vs Client Action */}
            {mode === "owner" ? (
              <div className="grid grid-cols-2 gap-2 mt-space-xs">
                <button
                  type="button"
                  onClick={() => setManagedProduct(heroProduct)}
                  className="h-12 rounded-xl bg-primary text-surface font-label-md text-sm font-bold flex items-center justify-center gap-1.5 shadow-md hover:brightness-110 active:scale-98 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                  <span>Gérer ce Produit</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Supprimer définitivement "${heroProduct.name}" de la boutique ?`)) {
                      onProductDeleted?.(heroProduct.id);
                    }
                  }}
                  className="h-12 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 font-label-md text-sm font-bold flex items-center justify-center gap-1.5 hover:bg-red-500/25 active:scale-98 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                  <span>Supprimer</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => onOpenTunnel(heroProduct, "WHATSAPP", selectedHeroColor)}
                className="mt-space-xs flex items-center justify-between w-full h-14 px-space-md rounded-xl bg-primary-container text-on-primary-container font-label-lg text-label-lg shadow-lg hover:brightness-110 active:scale-98 transition-all"
              >
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[22px]">shopping_bag</span>
                  <span>Commander sur WhatsApp</span>
                </span>
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </button>
            )}
          </div>
        </section>
      )}

      {/* Feed Title Strip */}
      <div className="flex items-center justify-between pt-space-xs">
        <div className="flex items-center gap-2">
          <h3 className="font-headline-sm text-sm sm:text-base font-bold text-on-surface">
            {selectedCategory ? "Articles Sélectionnés" : "Coups de Cœur d'Awa"}
          </h3>
          <span className="flex h-2 w-2 rounded-full bg-secondary"></span>
        </div>
        {selectedCategory ? (
          <button
            onClick={() => onSelectCategory(null)}
            className="font-label-sm text-xs text-primary font-bold hover:underline flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">refresh</span>
            <span>Toutes les catégories</span>
          </button>
        ) : products.length > 0 ? (
          <span className="font-label-sm text-xs text-on-surface-variant font-medium">
            {products.length} article(s)
          </span>
        ) : null}
      </div>

      {/* Product Grid / Feed Cards or Friendly Empty State */}
      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-6 sm:p-8 rounded-2xl bg-surface-container border border-white/5 text-center my-2 shadow-sm space-y-3">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary/15 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[26px]">
              {selectedCategory ? "inventory_2" : "sentiment_satisfied"}
            </span>
          </div>

          <div className="space-y-1">
            <h4 className="font-headline-sm text-sm sm:text-base text-on-surface font-bold">
              {selectedCategory ? "Collection bientôt disponible" : "Merci pour votre fidélité ! ✨"}
            </h4>
            <p className="font-body-sm text-xs text-on-surface-variant max-w-xs mx-auto leading-relaxed">
              {selectedCategory
                ? "Les articles de cette sélection sont actuellement en cours de réapprovisionnement express par Awa."
                : "Notre catalogue en ligne est en cours de mise à jour avec de nouveaux arrivages vérifiés."}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2 pt-1 w-full max-w-xs">
            {selectedCategory ? (
              <button
                onClick={() => onSelectCategory(null)}
                className="w-full h-11 px-4 rounded-xl bg-primary text-surface font-label-md text-xs font-bold shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">apps</span>
                <span>Voir les autres collections</span>
              </button>
            ) : null}

            <button
              onClick={() => {
                showToast("Ouverture de la discussion avec Awa...");
                const msg = selectedCategory
                  ? "Bonjour Awa ! Avez-vous des articles disponibles dans cette catégorie ?"
                  : "Bonjour Awa ! J'aimerais savoir quels sont vos prochains arrivages en boutique.";
                window.open("https://wa.me/2250700000000?text=" + encodeURIComponent(msg), "_blank");
              }}
              className="w-full h-11 px-4 rounded-xl bg-secondary/15 hover:bg-secondary/25 text-secondary border border-secondary/30 font-label-md text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">chat</span>
              <span>Demander à Awa sur WhatsApp</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-space-md">
          {feedProducts.map((p) => (
          <article key={p.id} className="relative overflow-hidden rounded-xl bg-surface-container shadow-md flex flex-col">
            <div className="relative w-full h-64 bg-surface-container-low">
              <img
                className="w-full h-full object-cover"
                src={getMediaUrl(p.primary_image_url)}
                alt={p.name}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "/media/products/robe_ankara_reine_sika.jpg";
                }}
              />
              <div className="absolute top-3 left-3 flex flex-col gap-1">
                <span className="px-2 py-0.5 rounded-full bg-surface-container-lowest/80 backdrop-blur-md text-secondary font-label-sm text-label-sm font-bold uppercase">
                  {p.badge_tag || "Création Originale"}
                </span>
              </div>
              <button
                aria-label="Ajouter aux favoris"
                onClick={() => showToast(`Ajouté aux favoris : ${p.name}`)}
                className="absolute top-3 right-3 h-8 w-8 rounded-full bg-surface-container-lowest/70 backdrop-blur-md text-on-surface flex items-center justify-center hover:text-error active:scale-90 transition-transform"
              >
                <span className="material-symbols-outlined text-[18px]">favorite</span>
              </button>
              {/* Social Proof Floating Pill */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-lg bg-surface/85 backdrop-blur-md px-3 py-1.5 text-on-surface">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-secondary text-[16px]">chat_bubble</span>
                  <span className="font-label-sm text-label-sm">{p.active_discussions_count} personnes discutent de cet article</span>
                </div>
                <span className="font-label-sm text-error font-bold">{p.stock_label || `Reste ${p.stock}`}</span>
              </div>
            </div>

            <div className="p-space-md flex flex-col gap-space-xs">
              <div>
                <h4 className="font-headline-sm text-headline-sm text-on-surface">{p.name}</h4>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  {p.short_description || p.description}
                </p>
              </div>

              {/* Price & Action */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex flex-col">
                  <span className="font-headline-md text-headline-md text-on-surface font-bold">
                    {p.price.toLocaleString("fr-FR")} {p.currency}
                  </span>
                  {p.old_price && (
                    <span className="font-body-sm text-[11px] text-outline line-through">
                      {p.old_price.toLocaleString("fr-FR")} {p.currency}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => onAddToCart(p)}
                  className="add-to-cart-btn px-4 py-2 rounded-lg bg-surface-container-highest text-secondary hover:bg-secondary hover:text-on-secondary font-label-md text-label-md font-bold transition-all active:scale-95 flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  Ajouter
                </button>
              </div>

              {mode === "owner" ? (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setManagedProduct(p)}
                    className="h-11 rounded-xl bg-primary text-surface font-label-md text-xs font-bold flex items-center justify-center gap-1 shadow-md hover:brightness-110 active:scale-98 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                    <span>Modifier</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Supprimer définitivement "${p.name}" de la boutique ?`)) {
                        onProductDeleted?.(p.id);
                      }
                    }}
                    className="h-11 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 font-label-md text-xs font-bold flex items-center justify-center gap-1 hover:bg-red-500/25 active:scale-98 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                    <span>Supprimer</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => onOpenTunnel(p, "WHATSAPP")}
                  className="mt-2 flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-secondary-container text-on-secondary font-label-lg text-label-lg font-bold shadow-md hover:brightness-105 active:scale-98 transition-all"
                >
                  <span className="material-symbols-outlined text-[20px]">send</span>
                  <span>Discuter / Commander direct</span>
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      )}

      {/* Conversational Guarantee & Delivery Banner */}
      <section className="rounded-2xl bg-surface-container border border-white/5 p-4 shadow-sm mt-4 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-secondary/15 text-secondary">
            <span className="material-symbols-outlined text-[22px]">support_agent</span>
          </div>
          <div className="flex flex-col min-w-0">
            <h4 className="font-headline-sm text-sm font-bold text-on-surface truncate">
              {store?.voice_note_title || "Besoin d'un conseil ?"}
            </h4>
            <p className="font-body-sm text-xs text-on-surface-variant">
              {store?.voice_note_subtitle || "Discutez en direct ou envoyez une note vocale."}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            showToast("Ouverture de l'audio WhatsApp avec Awa...");
            window.open("https://wa.me/2250700000000?text=" + encodeURIComponent("Bonjour Awa ! J'aimerais des conseils personnalisés pour une commande sur mesure."), "_blank");
          }}
          className="flex items-center justify-center gap-2 h-11 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-secondary font-label-md text-xs font-bold tap-scale transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">mic</span>
          <span>Envoyer une note vocale à Awa</span>
        </button>
      </section>

      {/* Floating Sticky Thumb Bar */}
      {cartCount > 0 && (
        <aside className="fixed bottom-20 left-0 right-0 z-40 px-margin pointer-events-none transition-transform duration-300">
          <div className="pointer-events-auto mx-auto max-w-md rounded-2xl bg-surface-container-highest/95 p-3 backdrop-blur-xl shadow-2xl flex items-center justify-between gap-space-sm border border-white/5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary-container text-on-primary-container font-bold shadow-md">
                <span className="material-symbols-outlined text-[22px]">shopping_bag</span>
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-on-secondary text-[10px] font-bold">
                  {cartCount}
                </span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-label-sm text-[11px] text-on-surface-variant">Panier Actuel</span>
                <span className="font-headline-sm text-[16px] text-on-surface font-bold truncate">
                  {cartTotal.toLocaleString("fr-FR")} {store?.currency || "FCFA"}
                </span>
              </div>
            </div>
            <button
              onClick={onCheckoutCart}
              className="flex-shrink-0 h-11 px-4 rounded-xl bg-primary text-on-primary font-label-md text-xs font-bold flex items-center gap-1.5 shadow-md tap-scale transition-transform hover:brightness-105 cursor-pointer"
            >
              <span>Finaliser</span>
              <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
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
