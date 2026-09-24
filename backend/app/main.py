from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings
from app.database import engine, Base, get_db, ACTIVE_DATABASE_URL
from fastapi import Depends
from app.routers import store, catalog, channels, commerce, analytics, auth, customer, notifications, super_admin, subscription, orders, chat, calls, media, store_subscriptions, store_qr
import app.models  # Ensures all models (Order, Chat, Payment, Media, Call, etc.) are registered
from app.seed.seeder import seed_database
import os

from sqlalchemy import inspect, text
import uuid

# Create tables safely
try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    print("Notice: table creation skipped or handled:", e)

def run_migrations():
    try:
        inspector = inspect(engine)
        table_names = inspector.get_table_names()
        
        # 1. Ensure dynamic columns exist (PostgreSQL & SQLite compatible)
        with engine.begin() as conn:
            if "stores" in table_names:
                store_cols = [c["name"] for c in inspector.get_columns("stores")]
                cols_to_add = [
                    ("owner_bio", "TEXT"),
                    ("primary_color", "VARCHAR(20) DEFAULT '#ec761e'"),
                    ("secondary_color", "VARCHAR(20) DEFAULT '#4EBE9E'"),
                    ("theme_preset", "VARCHAR(50) DEFAULT 'kinetic_amber'"),
                    ("is_custom_theme_active", "BOOLEAN DEFAULT TRUE"),
                    ("is_loyalty_active", "BOOLEAN DEFAULT TRUE"),
                    ("loyalty_spend_per_point", "INTEGER DEFAULT 1000"),
                    ("subscription_status", "VARCHAR(30) DEFAULT 'ACTIVE'"),
                    ("subscription_plan", "VARCHAR(30) DEFAULT 'PRO'"),
                    ("subscription_expires_at", "TIMESTAMP"),
                    ("custom_domain", "VARCHAR(150)"),
                    ("contact_whatsapp", "VARCHAR(30)"),
                    ("contact_email", "VARCHAR(100)"),
                    ("voice_note_subtitle", "VARCHAR(200) DEFAULT 'Écouter les conseils taille & qualité'"),
                    ("show_ratings_publicly", "BOOLEAN DEFAULT TRUE"),
                    ("show_sales_count_publicly", "BOOLEAN DEFAULT TRUE"),
                    ("show_reviews_publicly", "BOOLEAN DEFAULT TRUE"),
                    ("activity_type", "VARCHAR(50) DEFAULT 'GENERAL_COMMERCE'"),
                    ("capabilities", "TEXT"),
                    ("country", "VARCHAR(100) DEFAULT 'Burkina Faso'"),
                    ("city", "VARCHAR(100) DEFAULT 'Ouagadougou'"),
                    ("business_preferences", "TEXT"),
                    ("notification_profile", "TEXT"),
                    ("commerce_profile", "TEXT"),
                    ("communication_profile", "TEXT"),
                    ("qr_code_svg", "TEXT"),
                    ("followers_count", "INTEGER DEFAULT 0"),
                ]
                for col_name, col_type in cols_to_add:
                    if col_name not in store_cols:
                        conn.execute(text(f"ALTER TABLE stores ADD COLUMN {col_name} {col_type}"))

            if "customers" in table_names:
                cust_cols = [c["name"] for c in inspector.get_columns("customers")]
                cust_cols_to_add = [
                    ("country", "VARCHAR(100) DEFAULT 'Burkina Faso'"),
                    ("delivery_neighborhood", "VARCHAR(255)"),
                    ("notification_preferences", "TEXT"),
                ]
                for col_name, col_type in cust_cols_to_add:
                    if col_name not in cust_cols:
                        conn.execute(text(f"ALTER TABLE customers ADD COLUMN {col_name} {col_type}"))

            if "owners" in table_names:
                owner_cols = [c["name"] for c in inspector.get_columns("owners")]
                cols_to_add = [
                    ("bio", "TEXT"),
                    ("password_hash", "VARCHAR(255)"),
                    ("password_salt", "VARCHAR(64)"),
                    ("must_change_password", "BOOLEAN DEFAULT TRUE"),
                    ("session_token", "VARCHAR(128)"),
                    ("failed_login_attempts", "INTEGER DEFAULT 0"),
                    ("locked_until", "TIMESTAMP"),
                    ("last_login_at", "TIMESTAMP"),
                ]
                for col_name, col_type in cols_to_add:
                    if col_name not in owner_cols:
                        conn.execute(text(f"ALTER TABLE owners ADD COLUMN {col_name} {col_type}"))

            if "order_intents" in table_names:
                intent_cols = [c["name"] for c in inspector.get_columns("order_intents")]
                cols_to_add = [
                    ("customer_location_url", "VARCHAR(500)"),
                    ("customer_coordinates", "VARCHAR(100)"),
                    ("customer_id", "VARCHAR(36)"),
                    ("client_status", "VARCHAR(50) DEFAULT 'PENDING'"),
                    ("client_feedback", "VARCHAR(255)"),
                    ("client_satisfaction_rating", "INTEGER"),
                    ("client_action_at", "TIMESTAMP"),
                    ("coherence_status", "VARCHAR(50) DEFAULT 'HARMONIZED_PENDING'"),
                    ("coherence_notes", "VARCHAR(255)"),
                ]
                for col_name, col_type in cols_to_add:
                    if col_name not in intent_cols:
                        conn.execute(text(f"ALTER TABLE order_intents ADD COLUMN {col_name} {col_type}"))

            if "delivery_cities" in table_names:
                city_cols = [c["name"] for c in inspector.get_columns("delivery_cities")]
                if "display_order" not in city_cols:
                    conn.execute(text("ALTER TABLE delivery_cities ADD COLUMN display_order INTEGER DEFAULT 0"))

            if "products" in table_names:
                prod_cols = [c["name"] for c in inspector.get_columns("products")]
                cols_to_add = [
                    ("is_customizable", "BOOLEAN DEFAULT FALSE"),
                    ("customization_prompt", "VARCHAR(150) DEFAULT 'Précisez vos souhaits'"),
                    ("customization_options", "TEXT"),
                    ("sales_unit", "VARCHAR(50) DEFAULT 'PIECE'"),
                    ("sales_unit_label", "VARCHAR(50) DEFAULT 'pièce'"),
                    ("measurement_type", "VARCHAR(50) DEFAULT 'COUNT'"),
                    ("pricing_model", "VARCHAR(50) DEFAULT 'FIXED_PER_UNIT'"),
                    ("min_quantity", "FLOAT DEFAULT 1.0"),
                    ("max_quantity", "FLOAT DEFAULT 9999.0"),
                    ("quantity_step", "FLOAT DEFAULT 1.0"),
                    ("quantity_precision", "INTEGER DEFAULT 0"),
                    ("pack_size", "FLOAT DEFAULT 1.0"),
                    ("allow_custom_measurements", "BOOLEAN DEFAULT FALSE"),
                    ("measurement_specs", "TEXT"),
                ]
                for col_name, col_type in cols_to_add:
                    if col_name not in prod_cols:
                        conn.execute(text(f"ALTER TABLE products ADD COLUMN {col_name} {col_type}"))

            if "order_items" in table_names:
                item_cols = [c["name"] for c in inspector.get_columns("order_items")]
                item_cols_to_add = [
                    ("unit", "VARCHAR(50) DEFAULT 'PIECE'"),
                    ("unit_label", "VARCHAR(50) DEFAULT 'pièce'"),
                    ("pricing_model", "VARCHAR(50) DEFAULT 'FIXED_PER_UNIT'"),
                    ("measurements", "TEXT"),
                    ("sales_config_snapshot", "TEXT"),
                ]
                for col_name, col_type in item_cols_to_add:
                    if col_name not in item_cols:
                        conn.execute(text(f"ALTER TABLE order_items ADD COLUMN {col_name} {col_type}"))

        # 2. Seed default data if empty using ORM (pure Python/SQLAlchemy, 100% DB-agnostic)
        from app.database import SessionLocal
        from app.models.customer import Customer
        from app.models.store import Store, LoyaltyTier
        from app.models.commerce import OrderIntent
        from app.models.super_admin import SuperAdmin

        db = SessionLocal()
        try:
            # Seed demo customer if none exist
            if db.query(Customer).count() == 0:
                first_store = db.query(Store).first()
                store_id = first_store.id if first_store else "default-store"
                demo_cust = Customer(
                    id="cust-demo-kouame",
                    store_id=store_id,
                    name="Kouamé Desiré",
                    phone="+22507123456",
                    city="Cocody (Abidjan)",
                    delivery_address="Angré 8ème Tranche, Résidence les Palmiers",
                    gps_coordinates="5.3599, -3.9920",
                    gps_location_url="https://maps.google.com/?q=5.3599,-3.9920",
                    preferred_channel="WHATSAPP",
                    session_token="token_demo_kouame_2026"
                )
                db.add(demo_cust)
                # Link matching past orders
                db.query(OrderIntent).filter(
                    (OrderIntent.customer_name.ilike("%Kouamé%")) | (OrderIntent.customer_phone.ilike("%07123456%"))
                ).update({"customer_id": demo_cust.id}, synchronize_session=False)
                db.commit()

            # Seed default loyalty tiers if none exist
            if db.query(LoyaltyTier).count() == 0:
                first_store = db.query(Store).first()
                store_id = first_store.id if first_store else "default-store"
                default_tiers = [
                    LoyaltyTier(
                        id="tier-bronze",
                        store_id=store_id,
                        name="Bronze",
                        min_points=0,
                        badge_label="Niveau Découverte",
                        perk_title="Conseils VIP d'Awa",
                        perk_description="Accès direct par audio ou vidéo WhatsApp pour vous guider sur les tailles et modèles.",
                        discount_percent=0,
                        is_active=True,
                        display_order=1,
                    ),
                    LoyaltyTier(
                        id="tier-silver",
                        store_id=store_id,
                        name="Silver VIP",
                        min_points=50,
                        badge_label="Client Privilégié",
                        perk_title="Livraison Express Prioritaire (-2h)",
                        perk_description="Traitement en tête de file pour une livraison en moins de 2h chrono sur Ouaga et Abidjan.",
                        discount_percent=5,
                        is_active=True,
                        display_order=2,
                    ),
                    LoyaltyTier(
                        id="tier-gold",
                        store_id=store_id,
                        name="Gold Élite",
                        min_points=150,
                        badge_label="Club Élite VIP",
                        perk_title="Remise Permanente 10% & Ventes Privées",
                        perk_description="10% de réduction automatique sur tout le catalogue et accès prioritaire aux arrivages exclusifs.",
                        discount_percent=10,
                        is_active=True,
                        display_order=3,
                    ),
                ]
                db.add_all(default_tiers)
                db.commit()

            # Ensure SuperAdmin and the 3 real Burkinabè boutiques exist
            seed_database()
        finally:
            db.close()
    except Exception as e:
        print("Migration notice:", e)

run_migrations()

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="ConversaStore Mobile Engine API - 100% DB Driven Conversational Commerce",
    version="1.0.0"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static media directory safely
try:
    if not os.path.exists(settings.MEDIA_DIR):
        os.makedirs(settings.MEDIA_DIR, exist_ok=True)
    app.mount("/media", StaticFiles(directory=str(settings.MEDIA_DIR)), name="media")
except Exception as e_media:
    print("Notice: Static media directory mount skipped or handled:", e_media)

# Include API routers (both under /api and root for Vercel serverless compatibility)
all_routers = [
    store.router,
    catalog.router,
    channels.router,
    commerce.router,
    analytics.router,
    auth.router,
    customer.router,
    notifications.router,
    super_admin.router,
    subscription.router,
    orders.router,
    chat.router,
    calls.router,
    media.router,
    store_subscriptions.router,
    store_qr.router,
]
for r in all_routers:
    app.include_router(r, prefix=settings.API_V1_STR)
    app.include_router(r, prefix="")

@app.get("/health")
@app.get("/api/health")
def health_check():
    return {"status": "ok", "project": settings.PROJECT_NAME, "storage": "database"}

@app.get("/diag")
@app.get("/api/diag")
def server_diagnostics(db = Depends(get_db)):
    from app.models.store import Store
    from app.models.catalog import Product
    from app.models.order import Order
    
    store_count = 0
    product_count = 0
    order_count = 0
    db_err = None
    try:
        store_count = db.query(Store).count()
        product_count = db.query(Product).count()
        order_count = db.query(Order).count()
    except Exception as e:
        db_err = str(e)

    return {
        "status": "HEALTHY" if not db_err else "DB_DEGRADED",
        "database_type": "sqlite" if "sqlite" in ACTIVE_DATABASE_URL else "postgresql",
        "active_database": ACTIVE_DATABASE_URL.split("@")[-1] if "@" in ACTIVE_DATABASE_URL else "sqlite",
        "db_error": db_err,
        "stores_count": store_count,
        "products_count": product_count,
        "orders_count": order_count,
        "is_vercel": bool(os.getenv("VERCEL")),
        "media_dir": str(settings.MEDIA_DIR),
        "media_exists": os.path.exists(settings.MEDIA_DIR),
    }

# Serve frontend build if dist directory exists AND not on Vercel
# (On Vercel, static files and SPA routing are handled natively by Vercel CDN)
if not os.getenv("VERCEL"):
    FRONTEND_DIST = settings.BASE_DIR / "frontend" / "dist"
    if FRONTEND_DIST.exists() and (FRONTEND_DIST / "assets").is_dir():
        from fastapi.responses import FileResponse
        try:
            app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

            @app.get("/{full_path:path}")
            async def serve_frontend(full_path: str):
                file_path = FRONTEND_DIST / full_path
                if file_path.exists() and file_path.is_file():
                    return FileResponse(file_path)
                return FileResponse(FRONTEND_DIST / "index.html")
        except Exception as e_front:
            print("Notice: frontend dist mount skipped:", e_front)

@app.on_event("startup")
def startup_event():
    # If store table is empty, seed automatically
    from app.database import SessionLocal
    from app.models.store import Store
    from app.services.subscription_service import SubscriptionService
    db = SessionLocal()
    try:
        count = db.query(Store).count()
        if count == 0:
            print("No store found in database. Running automatic seeder...")
            seed_database()
        else:
            print(f"Database ready with {count} store(s).")
        SubscriptionService.seed_defaults(db)
        from app.services.catalog_service import CatalogService
        CatalogService.seed_sales_units_and_profiles(db)
    finally:
        db.close()

