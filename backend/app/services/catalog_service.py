import re
import os
import uuid
import base64
from typing import List, Optional
from sqlalchemy.orm import Session
from app.config import settings
from app.models.catalog import Category, Product, ProductVariant, ProductImage
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
            customization_prompt=req.customization_prompt or "Décris ton plat",
            customization_options=req.customization_options,
            display_order=0,
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

        for key in ["name", "category_id", "price", "old_price", "stock", "description", "short_description", "badge_tag", "is_published"]:
            if key in update_data and update_data[key] is not None:
                setattr(product, key, update_data[key])
                if key == "stock":
                    product.stock_label = f"Stock: {update_data[key]}"

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
