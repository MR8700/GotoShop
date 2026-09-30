import React, { useState, useEffect, useCallback } from "react";
import Icon from "./Icon";
import {
  getMediaUrl,
  fetchStoreStatus,
  sendOwnerHeartbeat,
  setStoreOpen,
} from "../api/client";

const FALLBACK_LOGO = "/media/store/logo.jpg";
const HEARTBEAT_MS = 30000; // owner ping
const STATUS_POLL_MS = 30000; // client refresh

function initialsOf(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

/** Round profile photo (customer or owner) with graceful initials fallback. */
function RoundAvatar({ src, label, onClick, isGuest }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const showImg = src && !failed;
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden ring-4 ring-surface-container shadow-xl flex items-center justify-center ${
        showImg
          ? "bg-surface-secondary"
          : isGuest
          ? "bg-surface-secondary border-2 border-dashed border-primary/50 text-primary"
          : "bg-primary text-white"
      } ${onClick ? "cursor-pointer active:scale-95 transition-transform" : ""}`}
      aria-label={label}
      title={label}
    >
      {showImg ? (
        <img
          src={getMediaUrl(src)}
          alt={label}
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : isGuest ? (
        <Icon name="person" className="text-[44px]" />
      ) : (
        <span className="text-2xl font-extrabold tracking-wide select-none">{label}</span>
      )}
    </Wrapper>
  );
}

export default function StoreHeader({
  store,
  mode = "client",
  isCurrentStoreOwner = false,
  customer,
  channels = [],
  onOpenQrModal,
  onOpenChat,
  onOpenCustomerAuth,
  showToast,
  isSubscribed = false,
  followersCount = 0,
  onToggleSubscribe,
}) {
  const isOwnerView = mode === "owner" && isCurrentStoreOwner;

  // ---- Live presence -------------------------------------------------------
  const [isOpen, setIsOpen] = useState(store?.is_open !== false);
  const [ownerOnline, setOwnerOnline] = useState(!!store?.is_owner_online);
  const [busy, setBusy] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    setIsOpen(store?.is_open !== false);
    setOwnerOnline(!!store?.is_owner_online);
    setLogoFailed(false);
  }, [store?.id, store?.is_open, store?.is_owner_online, store?.logo_url]);

  const applyStatus = useCallback((s) => {
    if (!s) return;
    if (typeof s.is_open === "boolean") setIsOpen(s.is_open);
    if (typeof s.is_owner_online === "boolean") setOwnerOnline(s.is_owner_online);
  }, []);

  // Owner: heartbeat while the shop is open and this screen is mounted.
  useEffect(() => {
    if (!isOwnerView || !store?.id || !isOpen) return undefined;
    let cancelled = false;
    const ping = () =>
      sendOwnerHeartbeat(store.id)
        .then((s) => !cancelled && applyStatus(s))
        .catch(() => {});
    setOwnerOnline(true); // the owner is here right now
    ping();
    const t = setInterval(ping, HEARTBEAT_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [isOwnerView, store?.id, isOpen, applyStatus]);

  // Clients: refresh the status regularly.
  useEffect(() => {
    if (isOwnerView || !store?.id) return undefined;
    let cancelled = false;
    const poll = () =>
      fetchStoreStatus(store.id)
        .then((s) => !cancelled && applyStatus(s))
        .catch(() => {});
    poll();
    const t = setInterval(poll, STATUS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [isOwnerView, store?.id, applyStatus]);

  const handleToggleOpen = async () => {
    if (busy) return;
    const next = !isOpen;
    setBusy(true);
    setIsOpen(next); // optimistic
    setOwnerOnline(next);
    try {
      const res = await setStoreOpen(store.id, next);
      applyStatus(res);
      showToast?.(next ? "Boutique ouverte : vos clients vous voient en ligne" : "Boutique fermée");
    } catch (e) {
      setIsOpen(!next);
      setOwnerOnline(!next);
      showToast?.(e.message || "Impossible de changer l'état de la boutique");
    } finally {
      setBusy(false);
    }
  };

  const online = isOpen && ownerOnline;
  const statusView = online
    ? { label: "Boutique ouverte", sub: "En ligne", tone: "green" }
    : isOpen
    ? { label: "Boutique ouverte", sub: "Vendeur hors ligne", tone: "amber" }
    : { label: "Boutique fermée", sub: "Revenez bientôt", tone: "slate" };

  const toneClasses = {
    green: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    amber: "bg-amber-500/12 text-amber-600 dark:text-amber-400 border-amber-500/30",
    slate: "bg-slate-500/12 text-slate-600 dark:text-slate-300 border-slate-500/30",
  }[statusView.tone];
  const dotClasses = {
    green: "bg-emerald-500",
    amber: "bg-amber-500",
    slate: "bg-slate-400",
  }[statusView.tone];

  // ---- Identity ------------------------------------------------------------
  const logoSrc = !logoFailed && store?.logo_url ? getMediaUrl(store.logo_url) : FALLBACK_LOGO;
  const primary = store?.primary_color || "#ec761e";
  const secondary = store?.secondary_color || "#4EBE9E";
  const city = store?.city || store?.delivery_city?.split("(")[0]?.trim();

  // Profile photo on the cover: customer when visiting, owner in his own shop.
  const avatarSrc = isOwnerView ? store?.avatar_url : customer?.avatar_url;
  const avatarLabel = isOwnerView
    ? initialsOf(store?.owner_name || store?.name)
    : customer
    ? initialsOf(customer.name)
    : "Invité";
  const firstName = customer?.name?.trim()?.split(/\s+/)[0];

  const whatsapp = (store?.contact_whatsapp || "").replace(/\D/g, "");
  const otherChannels = Array.isArray(channels)
    ? channels.filter((c) => c.is_active !== false && c.channel_type !== "WHATSAPP")
    : [];

  return (
    <section className="rounded-3xl overflow-hidden bg-surface-container border border-subtle shadow-card animate-fade-in">
      {/* ===== Cover: store logo as cover photo ===== */}
      <div
        className="relative h-44 sm:h-56 overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
      >
        <img
          src={logoSrc}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover scale-125 blur-2xl opacity-60"
          onError={() => setLogoFailed(true)}
        />
        <img
          src={logoSrc}
          alt={`Couverture ${store?.name || "boutique"}`}
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setLogoFailed(true)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/35" />

        {/* "You are in this shop" chip */}
        <div className="absolute top-3 left-3 max-w-[calc(100%-4.25rem)] flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/45 backdrop-blur-md border border-white/20 text-white text-[11px] font-semibold truncate">
          <Icon name={isOwnerView ? "storefront" : "door_open"} className="text-[15px] shrink-0" />
          <span className="truncate">{isOwnerView ? "Vous êtes dans votre boutique" : "Vous êtes dans la boutique"}</span>
        </div>

        {onOpenQrModal && (
          <button
            onClick={onOpenQrModal}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/45 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-black/60 transition-colors cursor-pointer"
            title="QR code et supports d'impression"
            aria-label="QR Code"
          >
            <Icon name="qr_code_2" className="text-[19px]" />
          </button>
        )}

        {city && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/45 backdrop-blur-md border border-white/20 text-white text-[11px] font-medium">
            <Icon name="location_on" className="text-[14px]" />
            <span>{city}</span>
          </div>
        )}
      </div>

      {/* ===== Identity ===== */}
      <div className="relative px-4 sm:px-6 pb-5">
        {/* Round photo overlapping the cover */}
        <div className="absolute -top-12 sm:-top-14 left-4 sm:left-6">
          <div className="relative">
            <RoundAvatar
              src={avatarSrc}
              label={avatarLabel}
              isGuest={!isOwnerView && !customer}
              onClick={!isOwnerView && !customer ? onOpenCustomerAuth : undefined}
            />
            <span
              className={`absolute bottom-1 right-1 w-5 h-5 rounded-full ring-[3px] ring-surface-container ${dotClasses} ${
                online ? "animate-pulse" : ""
              }`}
              title={`${statusView.label} · ${statusView.sub}`}
            />
          </div>
        </div>

        {/* Top-right action (follow / open-close) */}
        <div className="flex justify-end pt-3 min-h-[3.25rem]">
          {isOwnerView ? (
            <button
              onClick={handleToggleOpen}
              disabled={busy}
              className={`h-9 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer active:scale-95 disabled:opacity-60 ${
                isOpen
                  ? "bg-surface-secondary text-on-surface border-subtle hover:bg-surface-elevated"
                  : "bg-primary text-white border-primary shadow-sm"
              }`}
            >
              <Icon name={isOpen ? "lock" : "lock_open"} className="text-[16px]" />
              <span>{isOpen ? "Fermer la boutique" : "Ouvrir la boutique"}</span>
            </button>
          ) : (
            <button
              onClick={onToggleSubscribe}
              className={`h-9 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                isSubscribed
                  ? "bg-secondary/15 text-secondary border-secondary/30"
                  : "bg-surface-secondary hover:bg-surface-elevated text-on-surface border-subtle"
              }`}
              title={isSubscribed ? "Vous suivez cette boutique" : "S'abonner aux nouveautés"}
            >
              <Icon name={isSubscribed ? "notifications_active" : "notifications_none"} className="text-[16px]" />
              <span>{isSubscribed ? "Suivi" : "Suivre"}</span>
              {followersCount > 0 && <span className="opacity-70 text-[10px]">({followersCount})</span>}
            </button>
          )}
        </div>

        {/* Name + verified */}
        <div className="mt-7 sm:mt-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
            {isOwnerView
              ? "Espace commerçant"
              : customer
              ? `Bienvenue ${firstName}, vous êtes chez`
              : "Bienvenue chez"}
          </p>
          <h1 className="flex items-center gap-2 text-xl sm:text-2xl font-extrabold text-on-surface tracking-tight leading-tight">
            <span className="truncate">{store?.name}</span>
            {store?.is_verified && (
              <span
                className="shrink-0 w-5 h-5 rounded-full bg-secondary text-white flex items-center justify-center"
                title="Commerçant certifié GotoShop"
              >
                <Icon name="check" className="text-[13px]" aria-hidden="true" />
              </span>
            )}
          </h1>
          {(store?.tagline || store?.description) && (
            <p className="text-sm text-on-surface-variant mt-1 line-clamp-2">
              {store?.tagline || store?.description}
            </p>
          )}
        </div>

        {/* Status pill */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold ${toneClasses}`}
            role="status"
          >
            <span className={`w-2 h-2 rounded-full ${dotClasses} ${online ? "animate-pulse" : ""}`} />
            <span>{statusView.label}</span>
            <span className="opacity-60">•</span>
            <span className="font-semibold">{statusView.sub}</span>
          </span>
        </div>

        {/* Rating / sales / followers */}
        {(store?.show_ratings_publicly !== false || store?.show_sales_count_publicly !== false) && (
          <div className="grid grid-cols-3 gap-2 mt-4">
            {store?.show_ratings_publicly !== false && (
              <div className="rounded-2xl bg-surface-secondary border border-subtle py-2.5 text-center">
                <p className="flex items-center justify-center gap-1 text-base font-extrabold text-amber-500 tabular-nums">
                  <Icon name="star" className="text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }} />
                  {(store?.rating ?? 0) > 0 ? store.rating : "Nouveau"}
                </p>
                <p className="text-[10px] text-on-surface-variant font-medium">
                  {(store?.rating ?? 0) > 0 ? "Note clients" : "Pas encore noté"}
                </p>
              </div>
            )}
            {store?.show_sales_count_publicly !== false && (
              <div className="rounded-2xl bg-surface-secondary border border-subtle py-2.5 text-center">
                <p className="text-base font-extrabold text-on-surface tabular-nums">{store?.sales_count ?? 0}</p>
                <p className="text-[10px] text-on-surface-variant font-medium">Ventes conclues</p>
              </div>
            )}
            <div className="rounded-2xl bg-surface-secondary border border-subtle py-2.5 text-center">
              <p className="text-base font-extrabold text-on-surface tabular-nums">{followersCount}</p>
              <p className="text-[10px] text-on-surface-variant font-medium">Abonnés</p>
            </div>
          </div>
        )}

        {/* Owner bio */}
        {store?.owner_bio && (
          <div className="mt-4 p-3.5 rounded-2xl bg-surface-secondary border border-subtle border-l-4 border-l-primary text-xs text-on-surface leading-relaxed flex items-start gap-2.5">
            <Icon name="format_quote" className="text-primary text-[18px] shrink-0 mt-0.5" aria-hidden="true" />
            <span className="italic">{store.owner_bio}</span>
          </div>
        )}

        {/* Owner view: what customers currently see */}
        {isOwnerView && (
          <div className="mt-4 p-3.5 rounded-2xl bg-primary/8 border border-primary/25 text-xs text-on-surface flex items-start gap-2.5">
            <Icon name="visibility" className="text-primary text-[18px] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              {isOpen
                ? "Vos clients voient « Boutique ouverte • En ligne » tant que vous restez connecté. Fermez la boutique pour afficher « Boutique fermée »."
                : "Votre boutique est fermée : les clients voient « Boutique fermée ». Touchez « Ouvrir la boutique » pour reprendre les commandes."}
            </p>
          </div>
        )}

        {/* Live channels (clients only) */}
        {!isOwnerView && (
          <div className="mt-4 pt-4 border-t border-subtle space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${dotClasses} ${online ? "animate-pulse" : ""}`} />
                Discuter avec le vendeur
              </span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${toneClasses}`}>
                {online ? "Vendeur en ligne" : isOpen ? "Réponse différée" : "Boutique fermée"}
              </span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
              {onOpenChat && (
                <button
                  type="button"
                  onClick={() => onOpenChat(null)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-primary hover:brightness-105 text-white text-xs font-bold shadow-xs transition-all shrink-0 cursor-pointer active:scale-95"
                  title="Poser une question directement au commerçant"
                >
                  <Icon name="forum" className="text-[18px]" />
                  <span>Poser une question</span>
                </button>
              )}

              {whatsapp && (
                <a
                  href={`https://wa.me/${whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/30 text-xs font-semibold text-[#128C7E] dark:text-[#25D366] transition-all shrink-0 cursor-pointer"
                  title="Discuter sur WhatsApp"
                >
                  <Icon name="chat" className="text-[18px] text-[#25D366]" />
                  <span>WhatsApp</span>
                </a>
              )}

              {otherChannels.map((chan, idx) => {
                const isMessenger = chan.channel_type === "MESSENGER";
                const isTiktok = chan.channel_type === "TIKTOK";
                const href = isMessenger
                  ? `https://m.me/${chan.account_handle}`
                  : isTiktok
                  ? `https://www.tiktok.com/@${chan.account_handle?.replace("@", "")}`
                  : `tel:${chan.account_handle}`;
                return (
                  <a
                    key={chan.id || idx}
                    href={href}
                    target={isMessenger || isTiktok ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-secondary hover:bg-surface-elevated border border-subtle text-xs font-semibold text-on-surface transition-all shrink-0 cursor-pointer"
                    title={chan.subtitle || chan.display_title}
                  >
                    <Icon
                      name={chan.icon_name || (isMessenger ? "forum" : isTiktok ? "smart_display" : "call")}
                      className="text-[18px]"
                      style={{ color: chan.theme_color || "var(--color-primary)" }}
                    />
                    <span>{chan.display_title || chan.channel_type}</span>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* Trust badges */}
        {store?.trust_badges?.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-subtle">
            {store.trust_badges.map((badge, idx) => (
              <div
                key={idx}
                className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-surface-secondary text-center border border-subtle"
              >
                <Icon name={badge.icon_name} className="text-[18px] text-primary" aria-hidden="true" />
                <span className="text-[11px] font-semibold text-on-surface mt-1 line-clamp-1">{badge.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
