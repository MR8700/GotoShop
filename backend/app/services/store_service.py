import uuid
import secrets
import hashlib
import re
from datetime import datetime, timedelta
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_
from app.models.store import Store, Owner, TrustBadge, DeliveryCity, LoyaltyTier
from app.models.catalog import Category, Product
from app.models.subscription import SubscriptionRequest
from app.schemas.store import (
    StoreUpdateSchema,
    StoreRegisterRequest,
    StoreRegisterResponse,
    StoreOwnerBriefSchema,
)
from app.services.catalog_service import save_base64_media
from app.core.security import hash_password

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
            raw_val = str(slug).strip()
            clean_slug = raw_val.lower()

            # 1. Direct ID match (UUID or stored string ID)
            store = db.query(Store).filter(Store.id == raw_val).first()
            if store:
                return store

            # 2. Direct slug match
            store = db.query(Store).filter(Store.slug == clean_slug).first()
            if store:
                return store

            # 3. Known aliases
            if clean_slug in ["awa-chic", "chic-tech", "awa-chic-tech"]:
                store = db.query(Store).filter(Store.slug.in_(["awa-chic-tech", "awa-chic"])).first()
                if store:
                    return store

            # 4. Fallback ID normalization (e.g. 'store-faso-danfani-01' -> 'faso-danfani')
            if clean_slug.startswith("store-"):
                candidate = clean_slug[6:] # strip 'store-'
                parts = candidate.rsplit("-", 1)
                if len(parts) == 2 and parts[1].isdigit():
                    candidate = parts[0]
                store = db.query(Store).filter(Store.slug == candidate).first()
                if store:
                    return store
                try:
                    from app.seed.stores_data import seed_single_store_by_slug
                    store = seed_single_store_by_slug(db, candidate)
                    if store:
                        return store
                except Exception:
                    pass
            
            # 5. Check authentic stores catalog and auto-seed if requested
            try:
                from app.seed.stores_data import seed_single_store_by_slug
                store = seed_single_store_by_slug(db, clean_slug)
                if store:
                    return store
            except Exception as e_seed:
                print(f"Notice on auto-seeding store {clean_slug}: {e_seed}")

            # An explicit slug was requested but does not exist -> return None (404)
            return None

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
            return None

        # Return default store only if no specific slug or host was requested
        return StoreService.get_default_store(db)

    @staticmethod
    def get_public_stores(db: Session):
        stores = db.query(Store).filter(Store.subscription_status != "SUSPENDED").all()
        result = []
        existing_slugs = set()
        for s in stores:
            city_name = s.delivery_cities[0].name if s.delivery_cities else "Burkina Faso"
            prods_count = len(s.products) if s.products else 0
            existing_slugs.add(s.slug)
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

        try:
            from app.seed.stores_data import get_predefined_stores
            for st in get_predefined_stores():
                slug = st.get("slug")
                if slug and slug not in existing_slugs:
                    existing_slugs.add(slug)
                    result.append(st)
        except Exception as e_cat:
            print(f"Notice on public stores catalog: {e_cat}")

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

    @staticmethod
    def get_store_reviews(db: Session, store_id: str):
        from app.models.commerce import OrderIntent
        store = StoreService.resolve_store(db, slug=store_id)
        if not store:
            store = StoreService.get_default_store(db)
        if not store:
            return []

        intents = db.query(OrderIntent).filter(
            OrderIntent.store_id == store.id,
            or_(
                OrderIntent.client_satisfaction_rating.isnot(None),
                OrderIntent.client_feedback.isnot(None)
            )
        ).order_by(desc(OrderIntent.created_at)).limit(10).all()

        reviews = []
        for it in intents:
            reviews.append({
                "id": it.id,
                "customer_name": it.customer_name or "Client vérifié",
                "rating": it.client_satisfaction_rating or 5,
                "feedback": it.client_feedback or "Commande reçue rapidement et conforme !",
                "product_name": it.product.name if it.product else "Commande vérifiée",
                "delivery_city": it.delivery_city or "Ouagadougou",
                "created_at": (it.client_action_at or it.created_at).isoformat() if (it.client_action_at or it.created_at) else None
            })

        if len(reviews) < 3:
            defaults = [
                {
                    "id": f"rev-seed-1-{store.id}",
                    "customer_name": "Aminata O.",
                    "rating": 5,
                    "feedback": f"Superbe expérience chez {store.name} ! Produit d'excellente qualité et livraison ponctuelle.",
                    "product_name": "Achat vérifié",
                    "delivery_city": "Cité Kossodo",
                    "created_at": "Hier à 14:20"
                },
                {
                    "id": f"rev-seed-2-{store.id}",
                    "customer_name": "Karim S.",
                    "rating": 5,
                    "feedback": "Vendeur très réactif sur le chat intégré, suivi au top et paiement sans stress à la livraison.",
                    "product_name": "Achat vérifié",
                    "delivery_city": "Ouaga 2000",
                    "created_at": "Il y a 3 jours"
                },
                {
                    "id": f"rev-seed-3-{store.id}",
                    "customer_name": "Mariam D.",
                    "rating": 5,
                    "feedback": "C'est la troisième fois que je commande ici, toujours un service impeccable et chaleureux.",
                    "product_name": "Achat vérifié",
                    "delivery_city": "Kassodo Campus",
                    "created_at": "La semaine dernière"
                }
            ]
            for d in defaults:
                if len(reviews) < 3:
                    reviews.append(d)

        return reviews

    @staticmethod
    def register_store(db: Session, data: StoreRegisterRequest) -> StoreRegisterResponse:
        # Validate inputs
        if not data.store_name or not data.store_name.strip():
            raise ValueError("Le nom de la boutique est obligatoire.")
        if not data.owner_name or not data.owner_name.strip():
            raise ValueError("Le nom du commerçant / gérant est obligatoire.")
        if not data.owner_phone or not data.owner_phone.strip():
            raise ValueError("Le numéro WhatsApp est obligatoire.")

        # 1. Resolve unique slug
        base_slug = slugify(data.store_name)
        if not base_slug:
            base_slug = "boutique-" + secrets.token_hex(3)
        slug = base_slug
        counter = 1
        while db.query(Store).filter(Store.slug == slug).first() is not None:
            counter += 1
            slug = f"{base_slug}-{counter}"

        # 2. Check or create Owner
        owner_email = data.owner_email.strip().lower() if data.owner_email else ""
        if not owner_email:
            owner_email = f"{slug}@gotoshop.bf"

        owner = db.query(Owner).filter(Owner.email == owner_email).first()
        temp_pwd = None
        must_change = False
        if data.password and len(data.password.strip()) >= 6:
            pwd_to_use = data.password.strip()
            hashed, salt = hash_password(pwd_to_use)
            must_change = False
        else:
            temp_pwd = f"GotoShop!{secrets.token_hex(3)}"
            pwd_to_use = temp_pwd
            hashed, salt = hash_password(pwd_to_use)
            must_change = True

        session_token = secrets.token_hex(32)

        if not owner:
            owner = Owner(
                id=str(uuid.uuid4()),
                full_name=data.owner_name.strip(),
                email=owner_email,
                phone_number=data.owner_phone.strip(),
                password_hash=hashed,
                password_salt=salt,
                must_change_password=must_change,
                session_token=session_token,
                last_login_at=datetime.utcnow()
            )
            db.add(owner)
            db.flush()
        else:
            # Update phone & session token so the user is directly authenticated
            owner.session_token = session_token
            owner.phone_number = data.owner_phone.strip()
            owner.last_login_at = datetime.utcnow()
            if data.password and len(data.password.strip()) >= 6:
                owner.password_hash = hashed
                owner.password_salt = salt
                owner.must_change_password = False
            db.flush()

        # 3. Location info
        eff_city = data.city.strip() if data.city and data.city.strip() and data.city != "Autre" else "Ouagadougou"
        eff_country = data.country.strip() if data.country and data.country.strip() else "Burkina Faso"
        locality_str = data.locality.strip() if data.locality and data.locality.strip() else ""
        city_display = f"{eff_city} ({locality_str})" if locality_str else eff_city

        # 4. Create Store
        trial_days = 14
        expires_at = datetime.utcnow() + timedelta(days=trial_days)

        tagline = data.tagline.strip() if data.tagline else f"Boutique officielle de {data.owner_name} • {city_display}"
        cat_name = data.category_name.strip() if data.category_name else "Mode & Accessoires"

        store = Store(
            id=str(uuid.uuid4()),
            owner_id=owner.id,
            name=data.store_name.strip(),
            slug=slug,
            tagline=tagline,
            description=f"Bienvenue chez {data.store_name} à {city_display}, {eff_country}. Spécialiste {cat_name}. Commandez directement par WhatsApp avec géolocalisation et paiement à la livraison.",
            owner_bio=f"Gérant(e) et responsable chez {data.store_name}. Service client et qualité garantis.",
            currency="FCFA",
            logo_url="/media/store/logo.jpg",
            avatar_url="/media/store/awa_portrait.jpg",
            rating=5.0,
            sales_count=0,
            revenue=0,
            is_verified=True,
            social_tunnel_badge="WA/DIRECT",
            social_tunnel_label="Tunnel Express Actif",
            primary_color="#ec761e",
            secondary_color="#4EBE9E",
            theme_preset="kinetic_amber",
            is_custom_theme_active=True,
            is_loyalty_active=True,
            loyalty_spend_per_point=1000,
            subscription_status="TRIAL",
            subscription_plan=data.plan_code or "STARTER",
            subscription_expires_at=expires_at,
            contact_whatsapp=data.owner_phone.strip(),
            contact_email=owner.email
        )
        db.add(store)
        db.flush()

        # 5. Create default categories
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
        categories_to_add = [cat_all, cat_new]

        if cat_name not in ["Tout", "Nouveautés"]:
            cat_custom = Category(
                id=str(uuid.uuid4()),
                store_id=store.id,
                name=cat_name,
                slug=f"{slugify(cat_name)}-{slug}",
                display_order=2
            )
            categories_to_add.append(cat_custom)
            target_cat_id = cat_custom.id
        else:
            target_cat_id = cat_new.id

        db.add_all(categories_to_add)
        db.flush()

        # 6. Create default showcase product
        welcome_prod = Product(
            id=str(uuid.uuid4()),
            store_id=store.id,
            category_id=target_cat_id,
            name=f"Collection Spéciale • {data.store_name}",
            slug=f"collection-speciale-{slug}",
            description=f"Article vedette sélectionné par {data.owner_name} pour le lancement de la boutique {data.store_name}. Finitions soignées, disponible immédiatement à {city_display}.",
            short_description="Article sélectionné haute qualité.",
            price=15000,
            old_price=20000,
            currency="FCFA",
            stock=15,
            stock_label="En stock (Livraison sous 2h)",
            is_hero_deal=True,
            badge_tag="Lancement",
            views_count=32,
            guarantee_text="Qualité Certifiée • Paiement à la Réception",
            primary_image_url="/media/products/samsung_galaxy_a15.jpg"
        )
        db.add(welcome_prod)

        # 7. Create default delivery cities
        c1 = DeliveryCity(
            id=str(uuid.uuid4()),
            store_id=store.id,
            name=city_display,
            display_label=f"{city_display} (Livraison sous 2h)",
            is_default=True
        )
        c2 = DeliveryCity(
            id=str(uuid.uuid4()),
            store_id=store.id,
            name=f"Expédition Nationale ({eff_country})",
            display_label=f"Toutes régions ({eff_country})",
            is_default=False
        )
        db.add_all([c1, c2])

        # 8. Create trust badges
        b1 = TrustBadge(
            id=str(uuid.uuid4()),
            store_id=store.id,
            icon_name="verified",
            label="Commerçant Vérifié GotoShop",
            badge_type="success",
            display_order=1
        )
        b2 = TrustBadge(
            id=str(uuid.uuid4()),
            store_id=store.id,
            icon_name="local_shipping",
            label="Livraison Express & Suivi",
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

        # 9. Handle optional payment proof & audit record
        if data.payment_proof_data:
            proof_url = save_base64_media(data.payment_proof_data, prefix="proof") or data.payment_proof_data
            sub_req = SubscriptionRequest(
                id=str(uuid.uuid4()),
                request_type="NEW_STORE",
                store_id=store.id,
                store_name=store.name,
                owner_name=owner.full_name,
                owner_email=owner.email,
                owner_phone=owner.phone_number,
                plan_code=data.plan_code or "STARTER",
                plan_name=f"Formule {data.plan_code or 'STARTER'}",
                amount=1000,
                currency="FCFA",
                duration_days=30,
                operator_code=data.operator_code or "ORANGE",
                payment_proof_url=proof_url,
                status="PENDING",
                notes=data.notes,
                created_store_id=store.id
            )
            db.add(sub_req)

        db.commit()
        db.refresh(store)
        db.refresh(owner)

        return StoreRegisterResponse(
            success=True,
            message="Félicitations ! Votre boutique a été créée et activée avec succès.",
            store_id=store.id,
            store_name=store.name,
            slug=store.slug,
            store_url=f"?store={store.slug}",
            access_token=session_token,
            owner=StoreOwnerBriefSchema(
                id=owner.id,
                full_name=owner.full_name,
                email=owner.email,
                phone_number=owner.phone_number
            ),
            temporary_password=temp_pwd or (data.password if data.password else None),
            must_change_password=must_change,
            subscription_status=store.subscription_status,
            trial_days=trial_days
        )
