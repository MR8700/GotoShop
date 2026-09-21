import uuid
import hashlib
import re
import secrets
from datetime import datetime, timedelta
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.super_admin import SuperAdmin
from app.models.store import Store, Owner, DeliveryCity, TrustBadge, LoyaltyTier
from app.models.catalog import Category, Product
from app.models.channels import StoreChannel
from app.models.commerce import OrderIntent
from app.schemas.super_admin import (
    SuperAdminStoreCreateRequest,
    SuperAdminStoreStatusRequest,
    SuperAdminStoreItem,
    SuperAdminOverview
)

def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r'[àáâãäå]', 'a', text)
    text = re.sub(r'[èéêë]', 'e', text)
    text = re.sub(r'[ìíîï]', 'i', text)
    text = re.sub(r'[òóôõö]', 'o', text)
    text = re.sub(r'[ùúûü]', 'u', text)
    text = re.sub(r'[ç]', 'c', text)
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    text = re.sub(r'[\s_]+', '-', text)
    text = re.sub(r'-+', '-', text)
    return text.strip('-')

class SuperAdminService:
    @staticmethod
    def hash_password(password: str, salt: str) -> str:
        return hashlib.sha256((password + salt).encode('utf-8')).hexdigest()

    @staticmethod
    def verify_password(password: str, salt: str, password_hash: str) -> bool:
        return SuperAdminService.hash_password(password, salt) == password_hash

    @staticmethod
    def login(db: Session, email: str, password: str) -> Optional[dict]:
        admin = db.query(SuperAdmin).filter(SuperAdmin.email == email.strip().lower()).first()
        if not admin:
            return None
        if not SuperAdminService.verify_password(password, admin.password_salt, admin.password_hash):
            return None

        token = secrets.token_hex(32)
        admin.session_token = token
        admin.last_login_at = datetime.utcnow()
        db.commit()

        return {
            "success": True,
            "session_token": token,
            "admin": {
                "id": admin.id,
                "email": admin.email,
                "full_name": admin.full_name
            }
        }

    @staticmethod
    def get_admin_by_token(db: Session, token: str) -> Optional[SuperAdmin]:
        if not token:
            return None
        return db.query(SuperAdmin).filter(SuperAdmin.session_token == token).first()

    @staticmethod
    def get_overview(db: Session) -> SuperAdminOverview:
        total_stores = db.query(Store).count()
        active_stores = db.query(Store).filter(Store.subscription_status == "ACTIVE").count()
        trial_stores = db.query(Store).filter(Store.subscription_status == "TRIAL").count()
        suspended_stores = db.query(Store).filter(Store.subscription_status == "SUSPENDED").count()
        
        total_orders = db.query(OrderIntent).count()
        total_products = db.query(Product).count()

        # Sum of revenue from stores + confirmed orders
        revenue_sum = db.query(func.sum(Store.revenue)).scalar() or 0

        # Last 5 stores
        recent_stores_db = db.query(Store).order_by(Store.created_at.desc()).limit(5).all()
        recent_items = [SuperAdminService._store_to_item(db, s) for s in recent_stores_db]

        return SuperAdminOverview(
            total_stores_count=total_stores,
            active_stores_count=active_stores,
            trial_stores_count=trial_stores,
            suspended_stores_count=suspended_stores,
            total_orders_network=total_orders,
            total_gmv_network=revenue_sum,
            total_products_network=total_products,
            recent_stores=recent_items
        )

    @staticmethod
    def _store_to_item(db: Session, s: Store) -> SuperAdminStoreItem:
        owner = s.owner
        prod_count = db.query(Product).filter(Product.store_id == s.id).count()
        orders_count = db.query(OrderIntent).filter(OrderIntent.store_id == s.id).count()

        return SuperAdminStoreItem(
            id=s.id,
            name=s.name,
            slug=s.slug,
            tagline=s.tagline,
            logo_url=s.logo_url,
            avatar_url=s.avatar_url,
            currency=s.currency or "FCFA",
            primary_color=s.primary_color or "#ec761e",
            theme_preset=s.theme_preset or "kinetic_amber",
            rating=s.rating or 5.0,
            owner_id=owner.id if owner else "",
            owner_name=owner.full_name if owner else "Non défini",
            owner_email=owner.email if owner else "",
            owner_phone=owner.phone_number if owner else (s.contact_whatsapp or ""),
            subscription_status=s.subscription_status or "ACTIVE",
            subscription_plan=s.subscription_plan or "PRO",
            subscription_expires_at=s.subscription_expires_at,
            custom_domain=s.custom_domain,
            products_count=prod_count,
            orders_count=orders_count,
            total_revenue=s.revenue or 0,
            created_at=s.created_at or datetime.utcnow()
        )

    @staticmethod
    def list_all_stores(db: Session) -> List[SuperAdminStoreItem]:
        stores = db.query(Store).order_by(Store.created_at.desc()).all()
        return [SuperAdminService._store_to_item(db, s) for s in stores]

    @staticmethod
    def create_merchant_store(db: Session, data: SuperAdminStoreCreateRequest) -> SuperAdminStoreItem:
        # 1. Resolve unique slug
        base_slug = slugify(data.slug if data.slug else data.name)
        if not base_slug:
            base_slug = "boutique-" + secrets.token_hex(3)
        slug = base_slug
        counter = 1
        while db.query(Store).filter(Store.slug == slug).first() is not None:
            counter += 1
            slug = f"{base_slug}-{counter}"

        # 2. Check or create Owner
        owner = db.query(Owner).filter(Owner.email == data.owner_email.strip().lower()).first()
        if not owner:
            salt = secrets.token_hex(16)
            pwd = data.password or "Marchand2026!"
            hashed = SuperAdminService.hash_password(pwd, salt)
            owner = Owner(
                id=str(uuid.uuid4()),
                full_name=data.owner_name.strip(),
                email=data.owner_email.strip().lower(),
                phone_number=data.owner_phone.strip(),
                password_hash=hashed,
                password_salt=salt,
                must_change_password=True,
                session_token=secrets.token_hex(32)
            )
            db.add(owner)
            db.flush()

        # 3. Create Store
        expires_at = datetime.utcnow() + timedelta(days=data.trial_days or 30)
        status = "TRIAL" if (data.trial_days and data.trial_days > 0) else "ACTIVE"

        store = Store(
            id=str(uuid.uuid4()),
            owner_id=owner.id,
            name=data.name.strip(),
            slug=slug,
            tagline=data.tagline or f"Boutique officielle de {data.owner_name}",
            description=f"Bienvenue sur la vitrine officielle de {data.name}. Commandez directement par WhatsApp avec géolocalisation et livraison rapide.",
            owner_bio=f"Gérante et passionnée par la qualité et le service client chez {data.name}.",
            currency=data.currency or "FCFA",
            logo_url="/media/store/logo.jpg",
            avatar_url="/media/store/awa_portrait.jpg",
            rating=5.0,
            sales_count=0,
            revenue=0,
            is_verified=True,
            social_tunnel_badge="WA/DIRECT",
            social_tunnel_label="Tunnel Express Actif",
            primary_color=data.primary_color or "#ec761e",
            secondary_color="#4EBE9E",
            theme_preset=data.theme_preset or "kinetic_amber",
            is_custom_theme_active=True,
            is_loyalty_active=True,
            loyalty_spend_per_point=1000,
            subscription_status=status,
            subscription_plan=data.subscription_plan or "PRO",
            subscription_expires_at=expires_at,
            contact_whatsapp=data.owner_phone.strip(),
            contact_email=data.owner_email.strip().lower()
        )
        db.add(store)
        db.flush()

        # 4. Create default category
        cat_all = Category(
            id=str(uuid.uuid4()),
            store_id=store.id,
            name="Tout",
            slug=f"tout-{slug}",
            display_order=0
        )
        cat_new = Category(
            id=str(uuid.uuid4()),
            store_id=store.id,
            name="Nouveautés",
            slug=f"nouveautes-{slug}",
            display_order=1
        )
        db.add_all([cat_all, cat_new])
        db.flush()

        # Create 1 sample showcase product so the store has a ready-to-use vitrine
        welcome_prod = Product(
            id=str(uuid.uuid4()),
            store_id=store.id,
            category_id=cat_new.id,
            name=f"Collection Spéciale • {data.name}",
            slug=f"collection-speciale-{slug}",
            description=f"Découvrez notre produit phare sélectionné par {data.owner_name}. Finitions haut de gamme et livraison express.",
            short_description="Sélection exclusive haute qualité.",
            price=25000,
            old_price=35000,
            currency=data.currency or "FCFA",
            stock=8,
            stock_label="En stock (Livraison sous 2h)",
            is_hero_deal=True,
            badge_tag="Coup de Cœur",
            views_count=24,
            guarantee_text="Garantie Qualité Certifiée",
            primary_image_url="/media/products/samsung_galaxy_a15.jpg"
        )
        db.add(welcome_prod)

        # 5. Create default delivery cities
        city_name = data.delivery_city or "Abidjan (Cocody)"
        c1 = DeliveryCity(
            id=str(uuid.uuid4()),
            store_id=store.id,
            name=city_name,
            display_label=f"{city_name} (Livraison sous 2h)",
            is_default=True
        )
        c2 = DeliveryCity(
            id=str(uuid.uuid4()),
            store_id=store.id,
            name="Ouagadougou",
            display_label="Ouagadougou (Centre-ville)",
            is_default=False
        )
        db.add_all([c1, c2])

        # 6. Create default trust badges
        b1 = TrustBadge(
            id=str(uuid.uuid4()),
            store_id=store.id,
            icon_name="verified",
            label="Marchand Agréé & Certifié",
            badge_type="success",
            display_order=1
        )
        b2 = TrustBadge(
            id=str(uuid.uuid4()),
            store_id=store.id,
            icon_name="local_shipping",
            label="Livraison Express & Suivi GPS",
            badge_type="info",
            display_order=2
        )
        b3 = TrustBadge(
            id=str(uuid.uuid4()),
            store_id=store.id,
            icon_name="security",
            label="Paiement à la Livraison Garanti",
            badge_type="warning",
            display_order=3
        )
        db.add_all([b1, b2, b3])

        # 7. Create default channels (WhatsApp, Call, SMS)
        clean_phone = re.sub(r'[^0-9]', '', data.owner_phone)
        ch_wa = StoreChannel(
            id=str(uuid.uuid4()),
            store_id=store.id,
            channel_type="WHATSAPP",
            display_title="WhatsApp Direct",
            badge_text="RECOMMANDÉ",
            account_handle=clean_phone or "2250700000000",
            subtitle="Commande directe & géolocalisation",
            icon_name="chat",
            theme_color="#25D366",
            is_recommended=True,
            display_order=1,
            is_active=True
        )
        ch_call = StoreChannel(
            id=str(uuid.uuid4()),
            store_id=store.id,
            channel_type="CALL",
            display_title="Appel Direct",
            account_handle=data.owner_phone or "+2250700000000",
            subtitle="Contact direct par téléphone",
            icon_name="call",
            theme_color="#3B82F6",
            is_recommended=False,
            display_order=2,
            is_active=True
        )
        ch_sms = StoreChannel(
            id=str(uuid.uuid4()),
            store_id=store.id,
            channel_type="SMS",
            display_title="SMS Direct",
            account_handle=data.owner_phone or "+2250700000000",
            subtitle="Commande rapide par message",
            icon_name="sms",
            theme_color="#8B5CF6",
            is_recommended=False,
            display_order=3,
            is_active=True
        )
        db.add_all([ch_wa, ch_call, ch_sms])

        # 8. Create loyalty tiers
        t_bronze = LoyaltyTier(
            id=str(uuid.uuid4()),
            store_id=store.id,
            name="Bronze",
            min_points=0,
            badge_label="Niveau Découverte",
            perk_title="Conseils VIP Personnalisés",
            perk_description="Accompagnement direct par WhatsApp pour vos commandes.",
            discount_percent=0,
            is_active=True,
            display_order=1
        )
        t_silver = LoyaltyTier(
            id=str(uuid.uuid4()),
            store_id=store.id,
            name="Silver VIP",
            min_points=50,
            badge_label="Client Privilégié",
            perk_title="Livraison Express Prioritaire",
            perk_description="Traitement prioritaire en tête de liste.",
            discount_percent=5,
            is_active=True,
            display_order=2
        )
        t_gold = LoyaltyTier(
            id=str(uuid.uuid4()),
            store_id=store.id,
            name="Gold Élite",
            min_points=150,
            badge_label="Club Élite VIP",
            perk_title="Remise Permanente 10% & Ventes Privées",
            perk_description="10% de réduction automatique sur tout le catalogue.",
            discount_percent=10,
            is_active=True,
            display_order=3
        )
        db.add_all([t_bronze, t_silver, t_gold])

        db.commit()
        db.refresh(store)
        return SuperAdminService._store_to_item(db, store)

    @staticmethod
    def update_store_status(db: Session, store_id: str, data: SuperAdminStoreStatusRequest) -> Optional[SuperAdminStoreItem]:
        store = db.query(Store).filter(Store.id == store_id).first()
        if not store:
            return None
        
        if data.subscription_status:
            store.subscription_status = data.subscription_status
        if data.subscription_plan:
            store.subscription_plan = data.subscription_plan
        if data.extend_days and data.extend_days > 0:
            current_expiry = store.subscription_expires_at or datetime.utcnow()
            if current_expiry < datetime.utcnow():
                current_expiry = datetime.utcnow()
            store.subscription_expires_at = current_expiry + timedelta(days=data.extend_days)
            if store.subscription_status == "EXPIRED":
                store.subscription_status = "ACTIVE"

        db.commit()
        db.refresh(store)
        return SuperAdminService._store_to_item(db, store)

    @staticmethod
    def impersonate_store(db: Session, store_id: str) -> Optional[dict]:
        store = db.query(Store).filter(Store.id == store_id).first()
        if not store:
            return None
        owner = store.owner
        if not owner:
            return None
        
        token = secrets.token_hex(32)
        owner.session_token = token
        db.commit()

        return {
            "success": True,
            "session_token": token,
            "owner_name": owner.full_name,
            "owner_email": owner.email,
            "store_id": store.id,
            "store_slug": store.slug,
            "store_name": store.name
        }

    @staticmethod
    def delete_store(db: Session, store_id: str) -> bool:
        store = db.query(Store).filter(Store.id == store_id).first()
        if not store:
            return False
        # Protect main demo store
        if store.slug in ["awa-chic-tech", "awa-chic"]:
            raise ValueError("Impossible de supprimer la boutique de démonstration principale.")
        db.delete(store)
        db.commit()
        return True
