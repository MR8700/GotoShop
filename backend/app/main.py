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

_DB_INITIALIZED = False

def ensure_database_initialized():
    global _DB_INITIALIZED
    if _DB_INITIALIZED:
        return
    flag_file = Path("/tmp/.gotoshop_db_ready") if os.getenv("VERCEL") else None
    if flag_file and flag_file.exists():
        _DB_INITIALIZED = True
        return

    try:
        from app.database import engine, Base
        import app.models
        Base.metadata.create_all(bind=engine)

        from app.migrations import run_migrations
        run_migrations(engine)

        from app.seed.seeder import seed_database
        seed_database()

        if flag_file:
            try:
                flag_file.write_text("ok")
            except Exception:
                pass
        _DB_INITIALIZED = True
        print("[Database] Schema, migrations, and seeds initialized successfully.")
    except Exception as e:
        print("[Database] Lazy initialization notice:", e)

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

