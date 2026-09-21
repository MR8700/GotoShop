"""
Database Automation & Initialization Script for GotoShop
Works with PostgreSQL (Neon, Supabase, Vercel Postgres) and SQLite fallback.
"""
import sys
import os
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app.config import settings
from app.database import engine, Base, SessionLocal
from app.seed.seeder import seed_database
from app.services.subscription_service import SubscriptionService
from app.models.store import Store

def init_and_migrate():
    print("=" * 60)
    print("  GotoShop Database Automation & Migration")
    print(f"  Target Database: {settings.DATABASE_URL.split('@')[-1] if '@' in settings.DATABASE_URL else settings.DATABASE_URL}")
    print("=" * 60)

    # 1. Create tables and indexes
    print("[1/3] Creating tables and automated indexes...")
    Base.metadata.create_all(bind=engine)
    print("      Tables and indexes created successfully.")

    # 2. Check and seed if empty
    print("[2/3] Checking initial store data...")
    db = SessionLocal()
    try:
        store_count = db.query(Store).count()
        if store_count == 0:
            print("      No store found. Running automated seeder...")
            seed_database()
            print("      Seeding complete.")
        else:
            print(f"      Database already initialized with {store_count} store(s).")

        # 3. Ensure SaaS subscription plans are seeded
        print("[3/3] Synchronizing subscription plans & default tiers...")
        SubscriptionService.seed_defaults(db)
        print("      Subscription plans synced.")
    finally:
        db.close()

    print("=" * 60)
    print("  Database is 100% ready for production deployment!")
    print("=" * 60)

if __name__ == "__main__":
    init_and_migrate()
