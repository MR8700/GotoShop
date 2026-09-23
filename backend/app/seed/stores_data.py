import os
import json
import uuid
import secrets
from typing import Optional, List, Dict
from sqlalchemy.orm import Session
from app.core.security import hash_password
from app.models import (
    Owner, Store, TrustBadge, DeliveryCity, LoyaltyTier,
    Category, Product, StoreChannel
)

_STORES_CACHE = None

def get_predefined_stores() -> List[Dict]:
    global _STORES_CACHE
    if _STORES_CACHE is not None:
        return _STORES_CACHE
    json_path = os.path.join(os.path.dirname(__file__), "stores100.json")
    if os.path.exists(json_path):
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                _STORES_CACHE = json.load(f)
                return _STORES_CACHE
        except Exception as e:
            print(f"Error loading stores100.json: {e}")
    _STORES_CACHE = []
    return _STORES_CACHE

def get_store_data_by_slug(slug: str) -> Optional[Dict]:
    clean = slug.strip().lower()
    for s in get_predefined_stores():
        if s.get("slug", "").strip().lower() == clean:
            return s
    return None

def seed_single_store_by_slug(db: Session, slug: str) -> Optional[Store]:
    """Dynamically seeds an authentic store if requested and not yet persisted in SQLite."""
    clean_slug = slug.strip().lower()
    existing = db.query(Store).filter(Store.slug == clean_slug).first()
    if existing:
        return existing

    data = get_store_data_by_slug(clean_slug)
    if not data:
        return None

    try:
        # 1. Owner
        owner_email = f"{clean_slug}@gotoshop.bf"
        owner = db.query(Owner).filter(Owner.email == owner_email).first()
        if not owner:
            pwd_hash, salt = hash_password("GotoShop!2026")
            owner = Owner(
                id=str(uuid.uuid4()),
                full_name=data.get("owner_name") or f"Gérant {data.get('name')}",
                email=owner_email,
                phone_number="+22670000000",
                bio=data.get("owner_bio") or f"Gérant officiel de la boutique {data.get('name')}.",
                password_hash=pwd_hash,
                password_salt=salt,
                must_change_password=False
            )
            db.add(owner)
            db.flush()

        # 2. Store
        city_display = data.get("delivery_city") or "Ouagadougou"
        store = Store(
            id=data.get("id") or str(uuid.uuid4()),
            owner_id=owner.id,
            name=data.get("name") or clean_slug,
            slug=clean_slug,
            tagline=data.get("tagline") or f"Boutique officielle {data.get('name')}",
            description=data.get("description") or f"Bienvenue chez {data.get('name')} à {city_display}. Commandez directement par WhatsApp avec paiement à la livraison.",
            owner_bio=data.get("owner_bio") or f"Gérant(e) chez {data.get('name')}.",
            currency=data.get("currency") or "FCFA",
            logo_url=data.get("logo_url") or "/media/store/logo.jpg",
            avatar_url=data.get("avatar_url") or "/media/store/awa_portrait.jpg",
            rating=float(data.get("rating") or 4.9),
            sales_count=int(data.get("sales_count") or 120),
            revenue=int(data.get("sales_count") or 120) * 12500,
            is_verified=bool(data.get("is_verified", True)),
            social_tunnel_badge=data.get("social_tunnel_badge") or "WA/DIRECT",
            social_tunnel_label=data.get("social_tunnel_label") or "Tunnel Social Actif",
            primary_color=data.get("primary_color") or "#ec761e",
            secondary_color=data.get("secondary_color") or "#10b981",
            theme_preset="custom",
            is_custom_theme_active=True,
            is_loyalty_active=True,
            loyalty_spend_per_point=1000,
            subscription_status="ACTIVE",
            subscription_plan="PRO",
            contact_whatsapp="+22670000000",
            contact_email=owner.email
        )
        db.add(store)
        db.flush()

        # 3. Badges
        db.add_all([
            TrustBadge(store_id=store.id, icon_name="verified", label="Commerçant Vérifié GotoShop", badge_type="primary", display_order=1),
            TrustBadge(store_id=store.id, icon_name="local_shipping", label="Paiement à la Livraison", badge_type="secondary", display_order=2),
            TrustBadge(store_id=store.id, icon_name="chat", label="WhatsApp Direct", badge_type="secondary-fixed", display_order=3),
        ])

        # 4. Delivery cities
        db.add_all([
            DeliveryCity(store_id=store.id, name=city_display, display_label=f"📍 {city_display.split('(')[0].strip()}", is_default=True, display_order=1),
            DeliveryCity(store_id=store.id, name="Bobo-Dioulasso", display_label="Bobo", is_default=False, display_order=2),
            DeliveryCity(store_id=store.id, name="Expédition Sous-Régionale", display_label="Sous-Région", is_default=False, display_order=3),
        ])

        # 5. Categories
        cat_all = Category(store_id=store.id, name="Tout", slug="all", display_order=0)
        cat_spec = Category(store_id=store.id, name="Spécialités de la Maison", slug="specialites", display_order=1)
        cat_promo = Category(store_id=store.id, name="Promotions & Nouveautés", slug="promos", display_order=2)
        db.add_all([cat_all, cat_spec, cat_promo])
        db.flush()

        # 6. Hero Product & sample items
        category_type = data.get("category", "GENERAL").upper()
        if category_type == "FOOD":
            p1_name = f"Spécialité Dégustation {store.name}"
            p1_desc = f"Préparation artisanale fraîche du jour chez {store.name}. Ingrédients nobles du terroir, portion généreuse et assaisonnement soigné."
            p1_price = 3500
            p2_name = "Formule Duo Gourmande"
            p2_desc = "Deux portions complètes avec boissons fraîches locales incluses."
            p2_price = 6000
        elif category_type == "FASHION":
            p1_name = f"Création Prestige {store.name}"
            p1_desc = f"Pièce maîtresse confectionnée avec passion chez {store.name}. Finitions soignées, tissu noble et coupe élégante."
            p1_price = 25000
            p2_name = "Ensemble Contemporain"
            p2_desc = "Tenue moderne confectionnée selon les règles de l'artisanat ouest-africain."
            p2_price = 18000
        elif category_type == "TECH":
            p1_name = f"Pack High-Tech Pro {store.name}"
            p1_desc = f"Équipement garanti 12 mois sélectionné par {store.name}. Haute performance et fiabilité certifiée."
            p1_price = 45000
            p2_name = "Accessoire Haute Fidélité"
            p2_desc = "Qualité acoustique et autonomie longue durée."
            p2_price = 15000
        elif category_type == "BEAUTY":
            p1_name = f"Coffret Soin Éclat Naturel {store.name}"
            p1_desc = f"Formulation 100% naturelle et biologique chez {store.name}. Nourrit, protège et sublime la peau et les cheveux."
            p1_price = 8500
            p2_name = "Savon Surgras & Baume Pur"
            p2_desc = "Soin purifiant sans additif chimique formulé avec les beurres du terroir."
            p2_price = 4500
        else:
            p1_name = f"Sélection Vedette {store.name}"
            p1_desc = f"Produit phare recommandé par {store.name}. Qualité certifiée et satisfaction garantie."
            p1_price = 12000
            p2_name = "Pack Découverte Exclusive"
            p2_desc = "Le meilleur de notre sélection disponible immédiatement."
            p2_price = 8000

        p1 = Product(
            store_id=store.id,
            category_id=cat_spec.id,
            name=p1_name,
            slug=f"hero-{clean_slug}",
            description=p1_desc,
            short_description=p1_desc[:120],
            price=p1_price,
            old_price=int(p1_price * 1.25),
            currency=store.currency,
            stock=15,
            stock_label="Disponible en stock",
            is_hero_deal=True,
            badge_tag="Offre Vedette",
            active_discussions_count=18,
            views_count=520,
            sales_count=35,
            revenue=35 * p1_price,
            guarantee_text="100% Authentique",
            primary_image_url=data.get("logo_url") or "/media/products/pagne_wax_authentique.jpg",
            display_order=0
        )
        p2 = Product(
            store_id=store.id,
            category_id=cat_promo.id,
            name=p2_name,
            slug=f"promo-{clean_slug}",
            description=p2_desc,
            short_description=p2_desc[:120],
            price=p2_price,
            currency=store.currency,
            stock=20,
            stock_label="En stock",
            is_hero_deal=False,
            badge_tag="Populaire",
            active_discussions_count=10,
            views_count=340,
            sales_count=22,
            revenue=22 * p2_price,
            guarantee_text="Garantie Satisfaction",
            primary_image_url=data.get("logo_url") or "/media/products/coffret_parure_ecouteurs.jpg",
            display_order=1
        )
        db.add_all([p1, p2])

        # 7. Channels
        db.add_all([
            StoreChannel(store_id=store.id, channel_type="WHATSAPP", display_title="WhatsApp Direct", account_handle="+22670000000", is_recommended=True, is_active=True, display_order=1),
            StoreChannel(store_id=store.id, channel_type="CALL", display_title="Appel Direct Vendeur", account_handle="+22670000000", is_recommended=False, is_active=True, display_order=2),
        ])

        # 8. Loyalty Tiers
        db.add_all([
            LoyaltyTier(store_id=store.id, name="Client Découverte", min_points=0, badge_label="Membre", perk_title="Conseils Vendeur Direct", perk_description="Assistance personnalisée par WhatsApp.", discount_percent=0, is_active=True, display_order=1),
            LoyaltyTier(store_id=store.id, name="Client Privilège", min_points=50, badge_label="Privilège", perk_title="5% de Remise Permanente", perk_description="Remise automatique sur toute commande.", discount_percent=5, is_active=True, display_order=2),
        ])

        db.commit()
        db.refresh(store)
        return store
    except Exception as e:
        db.rollback()
        print(f"Error auto-seeding store {slug}: {e}")
        return None
