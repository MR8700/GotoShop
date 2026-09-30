"""Publicité de produit : un produit se partage sur n'importe quel réseau via un lien tracé (un par produit et par réseau).

Entonnoir mesuré par lien :
  clics (visiteurs uniques) → vues du produit → intentions (clic « commander » / ajout panier) → commandes → achats (payés) + chiffre d'affaires.

Les vues et intentions viennent d'événements envoyés par la page (dédoublonnés par visiteur, 30 min).
Les commandes et achats ne sont PAS des compteurs : ils sont recalculés depuis les vraies commandes (Order.share_code,
OrderIntent.share_code), donc jamais faussés par un rejeu d'événement. Le chiffre d'affaires ne compte que les lignes du
produit promu.
"""
import html
import json
import re
import secrets
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.analytics import ProductShareLink, TrackingEvent
from app.models.catalog import Product
from app.models.commerce import OrderIntent
from app.models.order import Order, OrderItem
from app.models.store import Store
from app.core.clock import utcnow

# Réseaux proposés (« other » couvre tout autre réseau ou canal : e-mail, forum, affiche, bouche à oreille…).
NETWORKS: Dict[str, Dict[str, str]] = {
    "whatsapp": {"label": "WhatsApp", "color": "#25D366"},
    "facebook": {"label": "Facebook", "color": "#1877F2"},
    "instagram": {"label": "Instagram", "color": "#E1306C"},
    "tiktok": {"label": "TikTok", "color": "#FE2C55"},
    "telegram": {"label": "Telegram", "color": "#229ED9"},
    "x": {"label": "X (Twitter)", "color": "#111111"},
    "snapchat": {"label": "Snapchat", "color": "#FFFC00"},
    "linkedin": {"label": "LinkedIn", "color": "#0A66C2"},
    "sms": {"label": "SMS", "color": "#10b981"},
    "email": {"label": "E-mail", "color": "#6366f1"},
    "qr": {"label": "QR Code / affiche", "color": "#f59e0b"},
    "other": {"label": "Autre réseau", "color": "#94a3b8"},
}
EVENTS = {"CLICK": "SHARE_CLICK", "VIEW": "SHARE_VIEW", "INTENT": "SHARE_INTENT"}
DEDUPE_MINUTES = 30
_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"
_VISITOR_RE = re.compile(r"^[A-Za-z0-9_\-]{8,64}$")
_CODE_RE = re.compile(r"^[a-z0-9]{6,20}$")
_LOST = ("CANCELLED", "ANNULEE", "REJECTED")
_LOST_INTENT = ("NOT_SOLD", "CANCELLED", "REJECTED")


def _new_code(db: Session) -> str:
    for _ in range(20):
        code = "".join(secrets.choice(_ALPHABET) for _ in range(8))
        if not db.query(ProductShareLink.id).filter(ProductShareLink.code == code).first():
            return code
    raise ValueError("Impossible de générer un code de partage.")


class ShareAdService:
    # ------------------------------------------------------------------ liens
    @staticmethod
    def normalize_network(network: Optional[str]) -> str:
        n = str(network or "other").strip().lower()
        aliases = {"twitter": "x", "wa": "whatsapp", "fb": "facebook", "insta": "instagram", "tg": "telegram"}
        n = aliases.get(n, n)
        return n if n in NETWORKS else "other"

    @staticmethod
    def link_to_dict(link: ProductShareLink) -> Dict[str, Any]:
        meta = NETWORKS.get(link.network, NETWORKS["other"])
        return {
            "id": link.id, "code": link.code, "product_id": link.product_id, "network": link.network,
            "network_label": meta["label"], "color": meta["color"], "is_active": bool(link.is_active),
            "created_at": link.created_at.isoformat() if link.created_at else None,
        }

    @classmethod
    def get_or_create_link(cls, db: Session, store_id: str, product_id: str, network: str) -> ProductShareLink:
        product = db.query(Product).filter(Product.id == product_id, Product.store_id == store_id).first()
        if not product:
            raise ValueError("Produit introuvable dans cette boutique.")
        net = cls.normalize_network(network)
        link = db.query(ProductShareLink).filter(
            ProductShareLink.store_id == store_id, ProductShareLink.product_id == product_id,
            ProductShareLink.network == net,
        ).first()
        if link:
            if not link.is_active:
                link.is_active = True
                db.commit()
            return link
        link = ProductShareLink(store_id=store_id, product_id=product_id, network=net, code=_new_code(db))
        db.add(link)
        db.commit()
        db.refresh(link)
        return link

    @staticmethod
    def valid_code(db: Session, store_id: str, code: Optional[str]) -> Optional[str]:
        """Le code n'est accepté que s'il appartient à cette boutique et est actif (sinon None, sans erreur)."""
        c = str(code or "").strip().lower()
        if not _CODE_RE.match(c):
            return None
        row = db.query(ProductShareLink.code).filter(
            ProductShareLink.code == c, ProductShareLink.store_id == store_id, ProductShareLink.is_active == True  # noqa: E712
        ).first()
        return row[0] if row else None

    @staticmethod
    def resolve(db: Session, code: str) -> Optional[Dict[str, Any]]:
        c = str(code or "").strip().lower()
        if not _CODE_RE.match(c):
            return None
        link = db.query(ProductShareLink).filter(ProductShareLink.code == c, ProductShareLink.is_active == True).first()  # noqa: E712
        if not link:
            return None
        store = db.query(Store).filter(Store.id == link.store_id).first()
        product = db.query(Product).filter(Product.id == link.product_id).first()
        if not store or not product:
            return None
        return {"code": link.code, "network": link.network, "store_id": store.id, "store_slug": store.slug,
                "product_id": product.id, "product_slug": product.slug, "product_name": product.name}

    # -------------------------------------------------------------- événements
    @classmethod
    def record_event(cls, db: Session, code: str, event: str, visitor_id: str) -> Dict[str, Any]:
        ev = EVENTS.get(str(event or "").upper())
        if not ev:
            raise ValueError("Événement inconnu.")
        if not _VISITOR_RE.match(str(visitor_id or "")):
            raise ValueError("Visiteur invalide.")
        info = cls.resolve(db, code)
        if not info:
            return {"recorded": False, "reason": "unknown_code"}
        since = utcnow() - timedelta(minutes=DEDUPE_MINUTES)
        dup = db.query(TrackingEvent.id).filter(
            TrackingEvent.share_code == info["code"], TrackingEvent.event_type == ev,
            TrackingEvent.visitor_id == visitor_id, TrackingEvent.created_at >= since,
        ).first()
        if dup:
            return {"recorded": False, "reason": "duplicate"}
        db.add(TrackingEvent(
            store_id=info["store_id"], product_id=info["product_id"], event_type=ev, source=info["network"],
            share_code=info["code"], visitor_id=visitor_id,
        ))
        db.commit()
        return {"recorded": True}

    # ------------------------------------------------------------- statistiques
    @classmethod
    def stats(cls, db: Session, store_id: str, product_id: Optional[str] = None, days: Optional[int] = None) -> Dict[str, Any]:
        q = db.query(ProductShareLink).filter(ProductShareLink.store_id == store_id)
        if product_id:
            q = q.filter(ProductShareLink.product_id == product_id)
        links = q.all()
        since = utcnow() - timedelta(days=int(days)) if days else None
        codes = [l.code for l in links]
        rows: Dict[str, Dict[str, Any]] = {
            l.code: {"clicks": 0, "views": 0, "intents": 0, "orders": 0, "purchases": 0, "revenue": 0} for l in links
        }
        if codes:
            # événements : visiteurs uniques par type
            eq = db.query(TrackingEvent.share_code, TrackingEvent.event_type,
                          func.count(func.distinct(TrackingEvent.visitor_id))).filter(
                TrackingEvent.share_code.in_(codes), TrackingEvent.event_type.in_(list(EVENTS.values())))
            if since:
                eq = eq.filter(TrackingEvent.created_at >= since)
            key = {"SHARE_CLICK": "clicks", "SHARE_VIEW": "views", "SHARE_INTENT": "intents"}
            for code, et, n in eq.group_by(TrackingEvent.share_code, TrackingEvent.event_type).all():
                rows[code][key[et]] = int(n)

            prod_by_code = {l.code: l.product_id for l in links}
            # commandes de la plateforme
            oq = db.query(Order).filter(Order.share_code.in_(codes), ~Order.status.in_(_LOST))
            if since:
                oq = oq.filter(Order.created_at >= since)
            for o in oq.all():
                r = rows[o.share_code]
                r["orders"] += 1
                if o.payment_status == "PAYMENT_CONFIRMED":
                    r["purchases"] += 1
                    r["revenue"] += int(db.query(func.coalesce(func.sum(OrderItem.total_price), 0)).filter(
                        OrderItem.order_id == o.id, OrderItem.product_id == prod_by_code[o.share_code]).scalar() or 0)
            # intentions de commande (canaux WhatsApp / Messenger…)
            iq = db.query(OrderIntent).filter(OrderIntent.share_code.in_(codes), ~OrderIntent.status.in_(_LOST_INTENT))
            if since:
                iq = iq.filter(OrderIntent.created_at >= since)
            for it in iq.all():
                r = rows[it.share_code]
                r["orders"] += 1
                if it.status == "SOLD":
                    r["purchases"] += 1
                    r["revenue"] += int(it.total_amount or 0)
            for r in rows.values():  # une commande suppose une intention et une vue : l'entonnoir reste cohérent
                r["intents"] = max(r["intents"], r["orders"])
                r["views"] = max(r["views"], r["intents"])
                r["clicks"] = max(r["clicks"], r["views"])

        def pct(a: int, b: int) -> float:
            return round(a * 100.0 / b, 1) if b else 0.0

        prods = {p.id: p for p in db.query(Product).filter(Product.id.in_([l.product_id for l in links] or [""])).all()}
        out_links: List[Dict[str, Any]] = []
        for l in links:
            r = rows[l.code]
            p = prods.get(l.product_id)
            out_links.append({**cls.link_to_dict(l), **r,
                              "product_name": p.name if p else None,
                              "conversion_rate": pct(r["purchases"], r["views"] or r["clicks"]),
                              "order_rate": pct(r["orders"], r["views"] or r["clicks"])})
        keys = ("clicks", "views", "intents", "orders", "purchases", "revenue")
        totals = {k: sum(x[k] for x in out_links) for k in keys}
        totals["conversion_rate"] = pct(totals["purchases"], totals["views"] or totals["clicks"])
        by_net: Dict[str, Dict[str, Any]] = {}
        for x in out_links:
            n = by_net.setdefault(x["network"], {"network": x["network"], "network_label": x["network_label"],
                                                 "color": x["color"], **{k: 0 for k in keys}})
            for k in keys:
                n[k] += x[k]
        by_product: Dict[str, Dict[str, Any]] = {}
        for x in out_links:
            b = by_product.setdefault(x["product_id"], {"product_id": x["product_id"], "product_name": x["product_name"],
                                                        **{k: 0 for k in keys}})
            for k in keys:
                b[k] += x[k]
        return {
            "days": days, "currency": (db.query(Store.currency).filter(Store.id == store_id).scalar() or "FCFA"),
            "totals": totals,
            "networks": sorted(by_net.values(), key=lambda n: (-n["purchases"], -n["orders"], -n["views"])),
            "products": sorted(by_product.values(), key=lambda n: (-n["purchases"], -n["orders"], -n["views"])),
            "links": out_links,
        }

    # -------------------------------------------------------- page d'aperçu (OG)
    @classmethod
    def og_page(cls, db: Session, code: str, origin: str) -> Optional[str]:
        """Page HTML minimale lue par WhatsApp / Facebook / Telegram… (aperçu image + titre + prix), puis redirection
        vers la boutique. Le clic n'est PAS compté ici (les robots de prévisualisation ne sont pas des visiteurs) : c'est la
        boutique qui l'enregistre."""
        info = cls.resolve(db, code)
        if not info:
            return None
        product = db.query(Product).filter(Product.id == info["product_id"]).first()
        store = db.query(Store).filter(Store.id == info["store_id"]).first()
        e = html.escape
        img = product.primary_image_url or getattr(store, "logo_url", None) or ""
        if img and not img.startswith(("http://", "https://")):
            img = origin.rstrip("/") + "/" + img.lstrip("/")
        price = f"{int(product.price or 0):,}".replace(",", " ") + f" {product.currency or 'FCFA'}"
        title = f"{product.name} — {price}"
        desc = (product.short_description or product.description or f"Commandez chez {store.name}")[:200]
        target = f"{origin.rstrip('/')}/?store={info['store_slug']}&c={info['code']}&src={info['network']}"
        js_target = json.dumps(target).replace("<", "\\u003c")
        return (
            "<!doctype html><html lang=\"fr\"><head><meta charset=\"utf-8\">"
            f"<title>{e(title)}</title>"
            "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
            f"<meta property=\"og:type\" content=\"product\"><meta property=\"og:title\" content=\"{e(title)}\">"
            f"<meta property=\"og:description\" content=\"{e(desc)}\"><meta property=\"og:site_name\" content=\"{e(store.name)}\">"
            + (f"<meta property=\"og:image\" content=\"{e(img)}\">" if img else "")
            + f"<meta property=\"og:url\" content=\"{e(target)}\">"
            "<meta name=\"twitter:card\" content=\"summary_large_image\">"
            f"<meta name=\"twitter:title\" content=\"{e(title)}\"><meta name=\"twitter:description\" content=\"{e(desc)}\">"
            + (f"<meta name=\"twitter:image\" content=\"{e(img)}\">" if img else "")
            + f"<meta http-equiv=\"refresh\" content=\"0;url={e(target)}\">"
            "</head><body>"
            f"<p><a href=\"{e(target)}\">Voir {e(product.name)}</a></p>"
            f"<script>location.replace({js_target});</script>"
            "</body></html>"
        )
