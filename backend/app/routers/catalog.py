from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Header, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.catalog_service import CatalogService
from app.services.store_service import StoreService
from app.schemas.catalog import CategorySchema, ProductSchema, ProductCreateSchema, ProductUpdateSchema

router = APIRouter(prefix="/catalog", tags=["Catalog"])

@router.get("/categories", response_model=List[CategorySchema])
def list_categories(
    request: Request,
    store_slug: Optional[str] = Query(None, alias="store"),
    x_store_slug: Optional[str] = Header(None, alias="X-Store-Slug"),
    db: Session = Depends(get_db)
):
    slug = x_store_slug or store_slug
    host = request.headers.get("host") if request else None
    store = StoreService.resolve_store(db, slug=slug, host=host)
    if not store:
        return []
    return CatalogService.get_categories(db, store.id)

@router.get("/products", response_model=List[ProductSchema])
def list_products(
    request: Request,
    category_id: Optional[str] = Query(None),
    store_slug: Optional[str] = Query(None, alias="store"),
    x_store_slug: Optional[str] = Header(None, alias="X-Store-Slug"),
    db: Session = Depends(get_db)
):
    slug = x_store_slug or store_slug
    host = request.headers.get("host") if request else None
    store = StoreService.resolve_store(db, slug=slug, host=host)
    if not store:
        return []
    return CatalogService.get_products(db, store.id, category_id)

@router.get("/products/hero", response_model=ProductSchema)
def get_hero_product(
    request: Request,
    store_slug: Optional[str] = Query(None, alias="store"),
    x_store_slug: Optional[str] = Header(None, alias="X-Store-Slug"),
    db: Session = Depends(get_db)
):
    slug = x_store_slug or store_slug
    host = request.headers.get("host") if request else None
    store = StoreService.resolve_store(db, slug=slug, host=host)
    if not store:
        raise HTTPException(status_code=404, detail="Boutique non trouvée")
    product = CatalogService.get_hero_product(db, store.id)
    if not product:
        raise HTTPException(status_code=404, detail="Produit vedette non trouvé")
    return product

@router.get("/products/{product_id}", response_model=ProductSchema)
def get_product(product_id: str, db: Session = Depends(get_db)):
    product = CatalogService.get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    return product

@router.post("/products", response_model=ProductSchema)
def create_product(req: ProductCreateSchema, db: Session = Depends(get_db)):
    try:
        product = CatalogService.create_product(db, req)
        return product
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/products/{product_id}", response_model=ProductSchema)
def update_product(product_id: str, req: ProductUpdateSchema, db: Session = Depends(get_db)):
    product = CatalogService.update_product(db, product_id, req)
    if not product:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    return product

@router.delete("/products/{product_id}")
def delete_product(product_id: str, hard: bool = Query(False), db: Session = Depends(get_db)):
    success = CatalogService.delete_product(db, product_id, hard=hard)
    if not success:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    return {"success": True, "message": "Produit supprimé ou archivé avec succès"}
