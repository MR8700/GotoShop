from sqlalchemy.orm import Session
from app.models.store import Store, TrustBadge, DeliveryCity
from app.schemas.store import StoreUpdateSchema
from typing import Optional
from app.services.catalog_service import save_base64_media

class StoreService:
    @staticmethod
    def get_default_store(db: Session) -> Optional[Store]:
        return db.query(Store).first()

    @staticmethod
    def extract_subdomain(host: Optional[str]) -> Optional[str]:
        if not host:
            return None
        hostname = host.split(":")[0].strip().lower()
        if not hostname or hostname in ["localhost", "127.0.0.1"]:
            return None
        if hostname.endswith(".localhost"):
            sub = hostname[:-len(".localhost")].strip(".")
            if sub and sub not in ["www", "admin", "superadmin", "api", "app"]:
                return sub
            return None
        parts = hostname.split(".")
        if len(parts) >= 3:
            sub = parts[0]
            if sub not in ["www", "admin", "superadmin", "api", "app"]:
                return sub
        return None

    @staticmethod
    def resolve_store(db: Session, slug: Optional[str] = None, host: Optional[str] = None) -> Optional[Store]:
        if slug:
            clean_slug = slug.strip().lower()
            store = db.query(Store).filter(Store.slug == clean_slug).first()
            if store:
                return store
            if clean_slug == "awa-chic":
                store = db.query(Store).filter(Store.slug == "awa-chic-tech").first()
                if store:
                    return store
            if clean_slug == "awa-chic-tech":
                store = db.query(Store).filter(Store.slug == "awa-chic").first()
                if store:
                    return store

        if host:
            hostname = host.split(":")[0].strip().lower()
            store = db.query(Store).filter(Store.custom_domain == hostname).first()
            if store:
                return store

        sub = StoreService.extract_subdomain(host)
        if sub:
            store = db.query(Store).filter(Store.slug == sub).first()
            if store:
                return store
            if sub == "awa-chic":
                store = db.query(Store).filter(Store.slug == "awa-chic-tech").first()
                if store:
                    return store

        return StoreService.get_default_store(db)

    @staticmethod
    def get_public_stores(db: Session):
        stores = db.query(Store).filter(Store.subscription_status != "SUSPENDED").all()
        result = []
        for s in stores:
            city_name = s.delivery_cities[0].name if s.delivery_cities else "Burkina Faso"
            prods_count = len(s.products) if s.products else 0
            result.append({
                "id": s.id,
                "name": s.name,
                "slug": s.slug,
                "tagline": s.tagline,
                "description": s.description,
                "owner_name": s.owner.full_name if s.owner else None,
                "owner_bio": s.owner_bio or (s.owner.bio if s.owner else None),
                "logo_url": s.logo_url,
                "avatar_url": s.avatar_url,
                "rating": s.rating or 4.9,
                "sales_count": s.sales_count or 0,
                "products_count": prods_count,
                "delivery_city": city_name,
                "primary_color": s.primary_color,
                "secondary_color": s.secondary_color,
                "subscription_status": s.subscription_status,
                "currency": s.currency or "FCFA",
                "is_verified": s.is_verified,
                "social_tunnel_badge": s.social_tunnel_badge or "WA/FB",
                "social_tunnel_label": s.social_tunnel_label or "Tunnel Social Actif",
            })
        return result

    @staticmethod
    def get_store_by_slug(db: Session, slug: str) -> Optional[Store]:
        return db.query(Store).filter(Store.slug == slug).first()

    @staticmethod
    def update_store(db: Session, store_id: str, data: StoreUpdateSchema) -> Optional[Store]:
        store = db.query(Store).filter(Store.id == store_id).first()
        if not store:
            return None
        update_data = data.model_dump(exclude_unset=True)

        if "avatar_data" in update_data and update_data["avatar_data"]:
            new_avatar_url = save_base64_media(update_data.pop("avatar_data"), prefix="avatar")
            if new_avatar_url:
                store.avatar_url = new_avatar_url

        for key, value in update_data.items():
            if hasattr(store, key):
                setattr(store, key, value)
        db.commit()
        db.refresh(store)
        return store

    @staticmethod
    def get_loyalty_tiers(db: Session, store_id: str):
        from app.models.store import LoyaltyTier
        return db.query(LoyaltyTier).filter(LoyaltyTier.store_id == store_id).order_by(LoyaltyTier.display_order, LoyaltyTier.min_points).all()

    @staticmethod
    def create_or_update_loyalty_tier(db: Session, store_id: str, tier_data, tier_id: Optional[str] = None):
        from app.models.store import LoyaltyTier
        if tier_id:
            tier = db.query(LoyaltyTier).filter(LoyaltyTier.id == tier_id, LoyaltyTier.store_id == store_id).first()
            if not tier:
                return None
        else:
            tier = LoyaltyTier(store_id=store_id)
            db.add(tier)

        data_dict = tier_data if isinstance(tier_data, dict) else tier_data.model_dump(exclude_unset=True)
        for k, v in data_dict.items():
            if hasattr(tier, k):
                setattr(tier, k, v)
        db.commit()
        db.refresh(tier)
        return tier

    @staticmethod
    def delete_loyalty_tier(db: Session, store_id: str, tier_id: str) -> bool:
        from app.models.store import LoyaltyTier
        tier = db.query(LoyaltyTier).filter(LoyaltyTier.id == tier_id, LoyaltyTier.store_id == store_id).first()
        if tier:
            db.delete(tier)
            db.commit()
            return True
        return False
