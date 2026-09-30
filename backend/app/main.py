from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings
from app.database import engine, Base, get_db, ACTIVE_DATABASE_URL
from fastapi import Depends
from app.routers import store, catalog, channels, commerce, analytics, auth, customer, notifications, super_admin, subscription, orders, chat, calls, media, store_subscriptions, store_qr, loyalty, wallet, passkeys
import app.models  # Ensures all models (Order, Chat, Payment, Media, Call, etc.) are registered
from app.seed.seeder import seed_database
import os
from pathlib import Path

from sqlalchemy import inspect, text
import uuid

_DB_INITIALIZED = False

def ensure_database_initialized(force: bool = False):
    global _DB_INITIALIZED
    if _DB_INITIALIZED and not force:
        return
    flag_file = Path("/tmp/.gotoshop_db_ready") if os.getenv("VERCEL") else None
    if flag_file and flag_file.exists() and not force:
        _DB_INITIALIZED = True
        return

    try:
        import app.database as db_mod
        from sqlalchemy.orm import sessionmaker

        # Test if active engine is reachable; if not, switch to SQLite immediately
        try:
            with db_mod.engine.connect() as conn:
                conn.execute(text("SELECT 1"))
        except Exception as e_unreachable:
            if "sqlite" not in db_mod.ACTIVE_DATABASE_URL:
                print(f"[Database] Remote database unreachable: {e_unreachable}. Activating instant SQLite fallback...")
                db_mod.engine, db_mod.ACTIVE_DATABASE_URL = db_mod.get_sqlite_engine()
                db_mod.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_mod.engine)

        from app.database import engine, Base
        import app.models
        Base.metadata.create_all(bind=engine)

        from app.migrations import run_migrations
        run_migrations(engine)

        if settings.SEED_DEMO_DATA:
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
        print("[Database] Safe initialization notice:", e)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="ConversaStore Mobile Engine API - 100% DB Driven Conversational Commerce",
    version="1.0.0"
)

# CORS Middleware
def _cors_origins():
    origins = {o.strip().rstrip("/") for o in settings.CORS_ORIGINS.split(",") if o.strip()}
    if settings.FRONTEND_URL:
        origins.add(settings.FRONTEND_URL.rstrip("/"))
    if settings.BASE_URL:
        origins.add(settings.BASE_URL.rstrip("/"))
    if settings.APP_ENV != "production":
        origins.update({"http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:8000", "http://127.0.0.1:8000", "http://localhost:3000"})
    return sorted(origins)


@app.middleware("http")
async def _security_headers(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/media"):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers.setdefault("Content-Security-Policy", "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox")
        ctype = response.headers.get("content-type", "")
        if not (ctype.startswith(("image/", "audio/", "video/")) or ctype == "application/pdf"):
            response.headers["Content-Disposition"] = "attachment"
    return response


from app.core.customer_session import CustomerSessionMiddleware
app.add_middleware(CustomerSessionMiddleware)  # ajouté avant CORS : CORS reste la couche la plus externe
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static media directory safely
try:
    if not os.path.exists(settings.MEDIA_DIR):
        os.makedirs(settings.MEDIA_DIR, exist_ok=True)
    app.mount("/media", StaticFiles(directory=str(settings.MEDIA_DIR), check_dir=False), name="media")
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
    loyalty.router,
    wallet.router,
    passkeys.router,
]
for r in all_routers:
    app.include_router(r, prefix=settings.API_V1_STR)
    # Le montage à la racine ne sert qu'à Vercel (le chemin réécrit peut perdre le préfixe /api) ;
    # ailleurs il doublerait la surface d'attaque et masquerait des routes du frontend SPA.
    if os.getenv("VERCEL"):
        app.include_router(r, prefix="", include_in_schema=False)

@app.get("/")
@app.get("/api")
@app.get("/api/index.py")
def api_root():
    return {
        "status": "ok",
        "message": "GotoShop Mobile Engine API is live and healthy",
        "project": settings.PROJECT_NAME,
        "active_db": ACTIVE_DATABASE_URL.split("@")[-1] if "@" in ACTIVE_DATABASE_URL else "sqlite",
    }

@app.get("/health")
@app.get("/api/health")
@app.get("/api/index.py/health")
def health_check():
    return {
        "status": "ok",
        "project": settings.PROJECT_NAME,
        "storage": "database",
        "active_db": ACTIVE_DATABASE_URL.split("@")[-1] if "@" in ACTIVE_DATABASE_URL else "sqlite",
    }

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
                if full_path == "api" or full_path.startswith("api/"):
                    from fastapi.responses import JSONResponse
                    return JSONResponse({"detail": "Not Found"}, status_code=404)
                file_path = FRONTEND_DIST / full_path
                if file_path.exists() and file_path.is_file():
                    return FileResponse(file_path)
                return FileResponse(FRONTEND_DIST / "index.html")
        except Exception as e_front:
            print("Notice: frontend dist mount skipped:", e_front)

