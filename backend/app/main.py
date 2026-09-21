from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings
from app.database import engine, Base
from app.routers import store, catalog, channels, commerce, analytics, auth, customer, notifications, super_admin, subscription
from app.seed.seeder import seed_database
import os

# Create tables
Base.metadata.create_all(bind=engine)

def run_migrations():
    try:
        import sqlite3
        db_path = str(settings.DATABASE_URL).replace("sqlite:///", "")
        if os.path.exists(db_path):
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            cur.execute("PRAGMA table_info(stores)")
            store_cols = [r[1] for r in cur.fetchall()]
            if "owner_bio" not in store_cols:
                cur.execute("ALTER TABLE stores ADD COLUMN owner_bio TEXT")
            if "primary_color" not in store_cols:
                cur.execute("ALTER TABLE stores ADD COLUMN primary_color VARCHAR(20) DEFAULT '#ec761e'")
            if "secondary_color" not in store_cols:
                cur.execute("ALTER TABLE stores ADD COLUMN secondary_color VARCHAR(20) DEFAULT '#4EBE9E'")
            if "theme_preset" not in store_cols:
                cur.execute("ALTER TABLE stores ADD COLUMN theme_preset VARCHAR(50) DEFAULT 'kinetic_amber'")
            if "is_custom_theme_active" not in store_cols:
                cur.execute("ALTER TABLE stores ADD COLUMN is_custom_theme_active BOOLEAN DEFAULT 1")
            if "is_loyalty_active" not in store_cols:
                cur.execute("ALTER TABLE stores ADD COLUMN is_loyalty_active BOOLEAN DEFAULT 1")
            if "loyalty_spend_per_point" not in store_cols:
                cur.execute("ALTER TABLE stores ADD COLUMN loyalty_spend_per_point INTEGER DEFAULT 1000")
            if "subscription_status" not in store_cols:
                cur.execute("ALTER TABLE stores ADD COLUMN subscription_status VARCHAR(30) DEFAULT 'ACTIVE'")
            if "subscription_plan" not in store_cols:
                cur.execute("ALTER TABLE stores ADD COLUMN subscription_plan VARCHAR(30) DEFAULT 'PRO'")
            if "subscription_expires_at" not in store_cols:
                cur.execute("ALTER TABLE stores ADD COLUMN subscription_expires_at DATETIME")
            if "custom_domain" not in store_cols:
                cur.execute("ALTER TABLE stores ADD COLUMN custom_domain VARCHAR(150)")
            if "contact_whatsapp" not in store_cols:
                cur.execute("ALTER TABLE stores ADD COLUMN contact_whatsapp VARCHAR(30)")
            if "contact_email" not in store_cols:
                cur.execute("ALTER TABLE stores ADD COLUMN contact_email VARCHAR(100)")
            
            cur.execute("PRAGMA table_info(owners)")
            owner_cols = [r[1] for r in cur.fetchall()]
            if "bio" not in owner_cols:
                cur.execute("ALTER TABLE owners ADD COLUMN bio TEXT")
            if "password_hash" not in owner_cols:
                cur.execute("ALTER TABLE owners ADD COLUMN password_hash VARCHAR(255)")
            if "password_salt" not in owner_cols:
                cur.execute("ALTER TABLE owners ADD COLUMN password_salt VARCHAR(64)")
            if "must_change_password" not in owner_cols:
                cur.execute("ALTER TABLE owners ADD COLUMN must_change_password BOOLEAN DEFAULT 1")
            if "session_token" not in owner_cols:
                cur.execute("ALTER TABLE owners ADD COLUMN session_token VARCHAR(128)")
            if "failed_login_attempts" not in owner_cols:
                cur.execute("ALTER TABLE owners ADD COLUMN failed_login_attempts INTEGER DEFAULT 0")
            if "locked_until" not in owner_cols:
                cur.execute("ALTER TABLE owners ADD COLUMN locked_until DATETIME")
            if "last_login_at" not in owner_cols:
                cur.execute("ALTER TABLE owners ADD COLUMN last_login_at DATETIME")

            cur.execute("PRAGMA table_info(order_intents)")
            intent_cols = [r[1] for r in cur.fetchall()]
            if "customer_location_url" not in intent_cols:
                cur.execute("ALTER TABLE order_intents ADD COLUMN customer_location_url VARCHAR(500)")
            if "customer_coordinates" not in intent_cols:
                cur.execute("ALTER TABLE order_intents ADD COLUMN customer_coordinates VARCHAR(100)")
            if "customer_id" not in intent_cols:
                cur.execute("ALTER TABLE order_intents ADD COLUMN customer_id VARCHAR(36)")
            if "client_status" not in intent_cols:
                cur.execute("ALTER TABLE order_intents ADD COLUMN client_status VARCHAR(50) DEFAULT 'PENDING'")
            if "client_feedback" not in intent_cols:
                cur.execute("ALTER TABLE order_intents ADD COLUMN client_feedback VARCHAR(255)")
            if "client_satisfaction_rating" not in intent_cols:
                cur.execute("ALTER TABLE order_intents ADD COLUMN client_satisfaction_rating INTEGER")
            if "client_action_at" not in intent_cols:
                cur.execute("ALTER TABLE order_intents ADD COLUMN client_action_at DATETIME")
            if "coherence_status" not in intent_cols:
                cur.execute("ALTER TABLE order_intents ADD COLUMN coherence_status VARCHAR(50) DEFAULT 'HARMONIZED_PENDING'")
            if "coherence_notes" not in intent_cols:
                cur.execute("ALTER TABLE order_intents ADD COLUMN coherence_notes VARCHAR(255)")

            # Check if customers table has at least one customer
            cur.execute("SELECT count(*) FROM customers")
            cust_count = cur.fetchone()[0]
            if cust_count == 0:
                cur.execute("SELECT id FROM stores LIMIT 1")
                store_row = cur.fetchone()
                store_id = store_row[0] if store_row else "default-store"
                demo_cust_id = "cust-demo-kouame"
                cur.execute("""
                    INSERT INTO customers (id, store_id, name, phone, city, delivery_address, gps_coordinates, gps_location_url, preferred_channel, session_token, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                """, (
                    demo_cust_id,
                    store_id,
                    "Kouamé Desiré",
                    "+22507123456",
                    "Cocody (Abidjan)",
                    "Angré 8ème Tranche, Résidence les Palmiers",
                    "5.3599, -3.9920",
                    "https://maps.google.com/?q=5.3599,-3.9920",
                    "WHATSAPP",
                    "token_demo_kouame_2026"
                ))
                # Link matching past orders
                cur.execute("UPDATE order_intents SET customer_id = ? WHERE customer_name LIKE '%Kouamé%' OR customer_phone LIKE '%07123456%'", (demo_cust_id,))

            # Check if loyalty_tiers table has at least one tier
            cur.execute("SELECT count(*) FROM loyalty_tiers")
            tiers_count = cur.fetchone()[0]
            if tiers_count == 0:
                cur.execute("SELECT id FROM stores LIMIT 1")
                store_row = cur.fetchone()
                store_id = store_row[0] if store_row else "default-store"
                default_tiers = [
                    (
                        "tier-bronze",
                        store_id,
                        "Bronze",
                        0,
                        "Niveau Découverte",
                        "Conseils VIP d'Awa",
                        "Accès direct par audio ou vidéo WhatsApp pour vous guider sur les tailles et modèles.",
                        0,
                        1,
                        1,
                    ),
                    (
                        "tier-silver",
                        store_id,
                        "Silver VIP",
                        50,
                        "Client Privilégié",
                        "Livraison Express Prioritaire (-2h)",
                        "Traitement en tête de file pour une livraison en moins de 2h chrono sur Ouaga et Abidjan.",
                        5,
                        1,
                        2,
                    ),
                    (
                        "tier-gold",
                        store_id,
                        "Gold Élite",
                        150,
                        "Club Élite VIP",
                        "Remise Permanente 10% & Ventes Privées",
                        "10% de réduction automatique sur tout le catalogue et accès prioritaire aux arrivages exclusifs.",
                        10,
                        1,
                        3,
                    ),
                ]
                cur.executemany("""
                    INSERT INTO loyalty_tiers (id, store_id, name, min_points, badge_label, perk_title, perk_description, discount_percent, is_active, display_order, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                """, default_tiers)

            # Super Admins table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS super_admins (
                    id VARCHAR(36) PRIMARY KEY,
                    email VARCHAR(100) UNIQUE NOT NULL,
                    full_name VARCHAR(100) NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    password_salt VARCHAR(64) NOT NULL,
                    session_token VARCHAR(128),
                    created_at DATETIME,
                    last_login_at DATETIME
                )
            """)
            cur.execute("SELECT count(*) FROM super_admins WHERE email = 'admin@conversastore.com'")
            if cur.fetchone()[0] == 0:
                import hashlib, uuid
                salt = "sa_salt_2026_super"
                pwd_hash = hashlib.sha256(("SuperAdmin2026!" + salt).encode("utf-8")).hexdigest()
                cur.execute("""
                    INSERT INTO super_admins (id, email, full_name, password_hash, password_salt, created_at)
                    VALUES (?, ?, ?, ?, ?, datetime('now'))
                """, (str(uuid.uuid4()), "admin@conversastore.com", "Super Administrateur ConversaStore", pwd_hash, salt))

            conn.commit()
            conn.close()
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

