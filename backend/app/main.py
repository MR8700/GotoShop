from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings
from app.database import engine, Base
from app.routers import store, catalog, channels, commerce, analytics, auth, customer, notifications, super_admin, subscription
from app.seed.seeder import seed_database
import os

from sqlalchemy import inspect, text
import uuid

# Create tables
Base.metadata.create_all(bind=engine)

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
                ]
                for col_name, col_type in cols_to_add:
                    if col_name not in store_cols:
                        conn.execute(text(f"ALTER TABLE stores ADD COLUMN {col_name} {col_type}"))

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

# Mount static media directory
if not os.path.exists(settings.MEDIA_DIR):
    os.makedirs(settings.MEDIA_DIR, exist_ok=True)

app.mount("/media", StaticFiles(directory=str(settings.MEDIA_DIR)), name="media")

# Include API routers
app.include_router(store.router, prefix=settings.API_V1_STR)
app.include_router(catalog.router, prefix=settings.API_V1_STR)
app.include_router(channels.router, prefix=settings.API_V1_STR)
app.include_router(commerce.router, prefix=settings.API_V1_STR)
app.include_router(analytics.router, prefix=settings.API_V1_STR)
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(customer.router, prefix=settings.API_V1_STR)
app.include_router(notifications.router, prefix=settings.API_V1_STR)
app.include_router(super_admin.router, prefix=settings.API_V1_STR)
app.include_router(subscription.router, prefix=settings.API_V1_STR)

@app.get("/health")
def health_check():
    return {"status": "ok", "project": settings.PROJECT_NAME, "storage": "database"}

# Serve frontend build if dist directory exists
FRONTEND_DIST = settings.MEDIA_DIR.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    from fastapi.responses import FileResponse

    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        file_path = FRONTEND_DIST / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(FRONTEND_DIST / "index.html")

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
    finally:
        db.close()

