import re
import os
import uuid
import base64
from typing import List, Optional
from sqlalchemy.orm import Session
from app.config import settings
from app.models.catalog import Category, Product, ProductVariant, ProductImage, SalesUnit, SalesProfile
from app.schemas.catalog import ProductCreateSchema, ProductUpdateSchema

def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    return re.sub(r'[-\s]+', '-', text)

def save_base64_media(data_uri: str, prefix: str = "prod") -> Optional[str]:
    if not data_uri:
        return None
    if not data_uri.startswith("data:"):
        return data_uri # already a path or url

    header, encoded = data_uri.split(",", 1)
    # determine extension
    ext = ".jpg"
    if "video/mp4" in header:
        ext = ".mp4"
    elif "application/pdf" in header:
        ext = ".pdf"
    elif "image/png" in header:
        ext = ".png"
    elif "image/webp" in header:
        ext = ".webp"

    filename = f"{prefix}_{uuid.uuid4().hex[:8]}{ext}"
    if prefix.startswith("avatar") or prefix.startswith("store"):
        subfolder = "store"
    elif prefix.startswith("proof"):
        subfolder = "proofs"
    elif ext == ".pdf":
        subfolder = "documents"
    else:
        subfolder = "products"

    file_bytes = base64.b64decode(encoded)
    mime_type = header.split(";")[0].replace("data:", "") if ";" in header else "application/octet-stream"

    # 1. If Supabase is configured, upload directly to Supabase Storage (Vercel serverless compatible)
    if settings.SUPABASE_URL and settings.SUPABASE_KEY:
        try:
            import urllib.request
            storage_path = f"{subfolder}/{filename}"
            upload_url = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/{settings.SUPABASE_BUCKET}/{storage_path}"
            req = urllib.request.Request(
                upload_url,
                data=file_bytes,
                headers={
                    "Authorization": f"Bearer {settings.SUPABASE_KEY}",
                    "Content-Type": mime_type,
                    "x-upsert": "true"
                },
                method="POST"
            )
            with urllib.request.urlopen(req) as resp:
                if resp.status in (200, 201):
                    return f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/public/{settings.SUPABASE_BUCKET}/{storage_path}"
        except Exception as e:
            print(f"[Supabase Storage] Upload notice: {e}. Falling back to local storage.")

    # 2. Local fallback storage
    target_dir = settings.MEDIA_DIR / subfolder
    os.makedirs(target_dir, exist_ok=True)
    target_path = target_dir / filename

    with open(target_path, "wb") as f:
        f.write(file_bytes)

    return f"/media/{subfolder}/{filename}"

class CatalogService:
    @staticmethod
    def get_categories(db: Session, store_id: str) -> List[Category]:
        categories = db.query(Category).filter(Category.store_id == store_id).order_by(Category.display_order.asc()).all()
        for cat in categories:
            cat.product_count = len(cat.products)
        return categories

    @staticmethod
    def get_products(db: Session, store_id: str, category_id: Optional[str] = None) -> List[Product]:
        query = db.query(Product).filter(Product.store_id == store_id, Product.is_published == True)
        if category_id:
            query = query.filter(Product.category_id == category_id)
        return query.order_by(Product.is_hero_deal.desc(), Product.display_order.asc()).all()

    @staticmethod
    def get_product_by_id(db: Session, product_id: str) -> Optional[Product]:
        return db.query(Product).filter(Product.id == product_id).first()

    @staticmethod
    def get_hero_product(db: Session, store_id: str) -> Optional[Product]:
        return db.query(Product).filter(Product.store_id == store_id, Product.is_hero_deal == True).first()

    @classmethod
    def create_product(cls, db: Session, req: ProductCreateSchema) -> Product:
        img_url = save_base64_media(req.image_data, prefix="img") if req.image_data else "/media/products/samsung_galaxy_a15.jpg"
        vid_url = save_base64_media(req.video_data, prefix="vid") if req.video_data else None
        pdf_url = save_base64_media(req.pdf_data, prefix="cat") if req.pdf_data else None

        slug = slugify(req.name) + "-" + uuid.uuid4().hex[:4]

        store_id = req.store_id
        if not store_id:
            from app.models.store import Store
            default_st = db.query(Store).first()
            store_id = default_st.id if default_st else "default-store"

        product = Product(
            store_id=store_id,
            category_id=req.category_id,
            name=req.name,
            slug=slug,
            description=req.description or req.short_description,
            short_description=req.short_description or (req.description[:100] if req.description else ""),
            price=req.price,
            old_price=req.old_price,
            stock=req.stock,
            stock_label=f"Stock: {req.stock}",
            badge_tag=req.badge_tag or "Nouveau",
            primary_image_url=img_url,
            video_url=vid_url,
            pdf_catalog_url=pdf_url,
            is_hero_deal=False,
            is_published=True,
            is_customizable=bool(req.is_customizable),
            customization_prompt=req.customization_prompt or "Précisez vos souhaits",
            customization_options=req.customization_options,
            display_order=0,
            sales_unit=req.sales_unit or "PIECE",
            sales_unit_label=req.sales_unit_label or "pièce",
            measurement_type=req.measurement_type or "COUNT",
            pricing_model=req.pricing_model or "FIXED_PER_UNIT",
            min_quantity=req.min_quantity if req.min_quantity is not None else 1.0,
            max_quantity=req.max_quantity if req.max_quantity is not None else 9999.0,
            quantity_step=req.quantity_step if req.quantity_step is not None else 1.0,
            quantity_precision=req.quantity_precision if req.quantity_precision is not None else 0,
            pack_size=req.pack_size if req.pack_size is not None else 1.0,
            allow_custom_measurements=bool(req.allow_custom_measurements),
            measurement_specs=req.measurement_specs,
        )
        db.add(product)
        db.commit()
        db.refresh(product)
        return product

    @classmethod
    def update_product(cls, db: Session, product_id: str, req: ProductUpdateSchema) -> Optional[Product]:
        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            return None

        update_data = req.model_dump(exclude_unset=True)
        if update_data.get("is_hero_deal") is True:
            db.query(Product).filter(Product.store_id == product.store_id, Product.id != product.id).update({"is_hero_deal": False})

        if "image_data" in update_data and update_data["image_data"]:
            product.primary_image_url = save_base64_media(update_data["image_data"], prefix="img")
        if "video_data" in update_data and update_data["video_data"]:
            product.video_url = save_base64_media(update_data["video_data"], prefix="vid")
        if "pdf_data" in update_data and update_data["pdf_data"]:
            product.pdf_catalog_url = save_base64_media(update_data["pdf_data"], prefix="cat")

        for key in [
            "name", "category_id", "price", "old_price", "stock", "description",
            "short_description", "badge_tag", "is_published", "is_customizable",
            "customization_prompt", "customization_options", "sales_unit",
            "sales_unit_label", "measurement_type", "pricing_model",
            "min_quantity", "max_quantity", "quantity_step", "quantity_precision",
            "pack_size", "allow_custom_measurements", "measurement_specs"
        ]:
            if key in update_data and update_data[key] is not None:
                setattr(product, key, update_data[key])
                if key == "stock":
                    unit_str = product.sales_unit_label or ""
                    product.stock_label = f"Stock: {update_data[key]} {unit_str}".strip()

        db.commit()
        db.refresh(product)
        return product

    @classmethod
    def delete_product(cls, db: Session, product_id: str, hard: bool = False) -> bool:
        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            return False
        
        from app.models.commerce import OrderIntent
        has_orders = db.query(OrderIntent).filter(OrderIntent.product_id == product_id).first() is not None

        if hard and not has_orders:
            db.delete(product)
        else:
            # Soft delete / unpublish from catalog
            product.is_published = False
        db.commit()
        return True

    @staticmethod
    def get_sales_units(db: Session, active_only: bool = True) -> List[SalesUnit]:
        query = db.query(SalesUnit)
        if active_only:
            query = query.filter(SalesUnit.active == True)
        return query.order_by(SalesUnit.is_system.desc(), SalesUnit.name.asc()).all()

    @staticmethod
    def get_sales_profiles(db: Session, domain: Optional[str] = None) -> List[SalesProfile]:
        query = db.query(SalesProfile)
        if domain:
            query = query.filter((SalesProfile.domain == domain) | (SalesProfile.domain == None))
        return query.order_by(SalesProfile.name.asc()).all()

    @staticmethod
    def seed_sales_units_and_profiles(db: Session):
        """Idempotently seed standard sales units and profiles into database."""
        # 1. Standard Units
        units_data = [
            {"code": "PIECE", "name": "Pièce", "symbol": "pièce", "measurement_type": "COUNT", "precision": 0, "default_step": 1.0, "default_min": 1.0, "domain_hint": "GENERAL_COMMERCE"},
            {"code": "PAGNE", "name": "Pagne", "symbol": "pagne", "measurement_type": "COUNT", "precision": 1, "default_step": 0.5, "default_min": 0.5, "domain_hint": "FASHION"},
            {"code": "METER", "name": "Mètre", "symbol": "m", "measurement_type": "LENGTH", "precision": 2, "default_step": 0.5, "default_min": 0.5, "domain_hint": "FASHION"},
            {"code": "CENTIMETER", "name": "Centimètre", "symbol": "cm", "measurement_type": "LENGTH", "precision": 0, "default_step": 1.0, "default_min": 10.0, "domain_hint": "FASHION"},
            {"code": "KILOGRAM", "name": "Kilogramme", "symbol": "kg", "measurement_type": "WEIGHT", "precision": 2, "default_step": 0.25, "default_min": 0.25, "domain_hint": "FOOD"},
            {"code": "GRAM", "name": "Gramme", "symbol": "g", "measurement_type": "WEIGHT", "precision": 0, "default_step": 50.0, "default_min": 50.0, "domain_hint": "FOOD"},
            {"code": "LITER", "name": "Litre", "symbol": "L", "measurement_type": "VOLUME", "precision": 1, "default_step": 0.5, "default_min": 0.5, "domain_hint": "FOOD"},
            {"code": "PAIR", "name": "Paire", "symbol": "paire", "measurement_type": "COUNT", "precision": 0, "default_step": 1.0, "default_min": 1.0, "domain_hint": "FASHION"},
            {"code": "HOUR", "name": "Heure", "symbol": "h", "measurement_type": "TIME", "precision": 0, "default_step": 1.0, "default_min": 1.0, "domain_hint": "SERVICE"},
            {"code": "DAY", "name": "Jour", "symbol": "j", "measurement_type": "TIME", "precision": 0, "default_step": 1.0, "default_min": 1.0, "domain_hint": "SERVICE"},
            {"code": "SESSION", "name": "Séance", "symbol": "séance", "measurement_type": "COUNT", "precision": 0, "default_step": 1.0, "default_min": 1.0, "domain_hint": "SERVICE"},
            {"code": "PACK", "name": "Lot", "symbol": "lot", "measurement_type": "COUNT", "precision": 0, "default_step": 1.0, "default_min": 1.0, "domain_hint": "GENERAL_COMMERCE"},
            {"code": "CARTON", "name": "Carton", "symbol": "carton", "measurement_type": "COUNT", "precision": 0, "default_step": 1.0, "default_min": 1.0, "domain_hint": "GENERAL_COMMERCE"},
            {"code": "ROLL", "name": "Rouleau", "symbol": "rouleau", "measurement_type": "COUNT", "precision": 0, "default_step": 1.0, "default_min": 1.0, "domain_hint": "FASHION"},
            {"code": "CUSTOM", "name": "Sur mesure", "symbol": "mesure", "measurement_type": "CUSTOM", "precision": 2, "default_step": 0.1, "default_min": 0.1, "domain_hint": None},
        ]

        for u in units_data:
            existing = db.query(SalesUnit).filter(SalesUnit.code == u["code"]).first()
            if not existing:
                unit = SalesUnit(
                    id=str(uuid.uuid4()),
                    code=u["code"],
                    name=u["name"],
                    symbol=u["symbol"],
                    measurement_type=u["measurement_type"],
                    precision=u["precision"],
                    default_step=u["default_step"],
                    default_min=u["default_min"],
                    active=True,
                    is_system=True,
                    domain_hint=u.get("domain_hint"),
                )
                db.add(unit)

        # 2. Standard Profiles
        profiles_data = [
            {"code": "PAGNE_DEMI", "name": "Pagne standard (demi-pagne autorisé)", "domain": "FASHION", "unit_code": "PAGNE", "unit_label": "pagne", "measurement_type": "COUNT", "pricing_model": "FIXED_PER_UNIT", "min_quantity": 0.5, "quantity_step": 0.5, "quantity_precision": 1},
            {"code": "PAGNE_ENTIER", "name": "Pagne entier (pas de fraction)", "domain": "FASHION", "unit_code": "PAGNE", "unit_label": "pagne", "measurement_type": "COUNT", "pricing_model": "FIXED_PER_UNIT", "min_quantity": 1.0, "quantity_step": 1.0, "quantity_precision": 0},
            {"code": "TISSU_METRE", "name": "Tissu au mètre (pas de 0,5 m)", "domain": "FASHION", "unit_code": "METER", "unit_label": "m", "measurement_type": "LENGTH", "pricing_model": "FIXED_PER_UNIT", "min_quantity": 0.5, "quantity_step": 0.5, "quantity_precision": 2},
            {"code": "TISSU_METRE_EXACT", "name": "Tissu mesure libre (pas 0,01 m)", "domain": "FASHION", "unit_code": "METER", "unit_label": "m", "measurement_type": "LENGTH", "pricing_model": "FIXED_PER_UNIT", "min_quantity": 0.25, "quantity_step": 0.01, "quantity_precision": 2},
            {"code": "CHAUSSURE_PAIRE", "name": "Chaussures à la paire", "domain": "FASHION", "unit_code": "PAIR", "unit_label": "paire", "measurement_type": "COUNT", "pricing_model": "FIXED_PER_UNIT", "min_quantity": 1.0, "quantity_step": 1.0, "quantity_precision": 0},
            {"code": "ELECTRONIQUE_PIECE", "name": "Appareil électronique à la pièce", "domain": "ELECTRONICS", "unit_code": "PIECE", "unit_label": "pièce", "measurement_type": "COUNT", "pricing_model": "FIXED_PER_UNIT", "min_quantity": 1.0, "quantity_step": 1.0, "quantity_precision": 0},
            {"code": "ALIMENT_POIDS", "name": "Alimentation au kilogramme (pas 0,25 kg)", "domain": "FOOD", "unit_code": "KILOGRAM", "unit_label": "kg", "measurement_type": "WEIGHT", "pricing_model": "FIXED_PER_UNIT", "min_quantity": 0.25, "quantity_step": 0.25, "quantity_precision": 2},
            {"code": "BOISSON_LITRE", "name": "Boisson au litre (pas 0,5 L)", "domain": "FOOD", "unit_code": "LITER", "unit_label": "L", "measurement_type": "VOLUME", "pricing_model": "FIXED_PER_UNIT", "min_quantity": 0.5, "quantity_step": 0.5, "quantity_precision": 1},
            {"code": "SERVICE_HEURE", "name": "Prestation à l'heure", "domain": "SERVICE", "unit_code": "HOUR", "unit_label": "h", "measurement_type": "TIME", "pricing_model": "FIXED_PER_UNIT", "min_quantity": 1.0, "quantity_step": 1.0, "quantity_precision": 0},
            {"code": "SERVICE_SEANCE", "name": "Prestation à la séance / forfait", "domain": "SERVICE", "unit_code": "SESSION", "unit_label": "séance", "measurement_type": "COUNT", "pricing_model": "FIXED_PER_UNIT", "min_quantity": 1.0, "quantity_step": 1.0, "quantity_precision": 0},
            {"code": "CARTON_GROS", "name": "Vente en gros au carton", "domain": "GENERAL_COMMERCE", "unit_code": "CARTON", "unit_label": "carton", "measurement_type": "COUNT", "pricing_model": "FIXED_PER_UNIT", "min_quantity": 1.0, "quantity_step": 1.0, "quantity_precision": 0},
            {"code": "SUR_MESURE_DEVIS", "name": "Confection sur mesure (devis)", "domain": None, "unit_code": "CUSTOM", "unit_label": "mesure", "measurement_type": "CUSTOM", "pricing_model": "CUSTOM_QUOTE", "min_quantity": 1.0, "quantity_step": 1.0, "quantity_precision": 0, "allow_custom_measurements": True},
        ]

        for p in profiles_data:
            existing = db.query(SalesProfile).filter(SalesProfile.code == p["code"]).first()
            if not existing:
                prof = SalesProfile(
                    id=str(uuid.uuid4()),
                    code=p["code"],
                    name=p["name"],
                    domain=p.get("domain"),
                    unit_code=p["unit_code"],
                    unit_label=p["unit_label"],
                    measurement_type=p["measurement_type"],
                    pricing_model=p["pricing_model"],
                    min_quantity=p["min_quantity"],
                    quantity_step=p["quantity_step"],
                    quantity_precision=p["quantity_precision"],
                    allow_custom_measurements=p.get("allow_custom_measurements", False),
                )
                db.add(prof)

        db.commit()

