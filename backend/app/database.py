import os
from pathlib import Path
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import NullPool
from app.config import settings

def init_engine():
    db_url = settings.DATABASE_URL
    is_vercel = bool(os.getenv("VERCEL"))
    
    # 1. If PostgreSQL configured (Supabase, Neon, Railway, etc.)
    if "sqlite" not in db_url:
        try:
            connect_args = {"connect_timeout": 5}
            if "localhost" not in db_url and "127.0.0.1" not in db_url:
                if "sslmode" not in db_url:
                    connect_args["sslmode"] = "require"

            # In Serverless environments, use NullPool to avoid stale connections
            pool_kwargs = {"poolclass": NullPool} if is_vercel else {
                "pool_pre_ping": True,
                "pool_size": 5,
                "max_overflow": 10,
                "pool_recycle": 300
            }

            candidate_engine = create_engine(
                db_url,
                connect_args=connect_args,
                **pool_kwargs
            )
            # Verify connectivity
            with candidate_engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print(f"[Database] Successfully connected to remote PostgreSQL ({db_url.split('@')[-1] if '@' in db_url else 'postgres'})")
            return candidate_engine, db_url
        except Exception as e_remote:
            print(f"[Database] Warning: Remote PostgreSQL connection failed: {e_remote}")
            print("[Database] Activating high-resilience SQLite fallback for continuous service...")
            fallback_db = Path("/tmp") / "conversastore.db" if is_vercel else settings.DB_PATH
            fallback_url = f"sqlite:///{fallback_db}"
            fallback_engine = create_engine(fallback_url, connect_args={"check_same_thread": False})
            return fallback_engine, fallback_url

    # 2. SQLite
    candidate_engine = create_engine(
        db_url,
        connect_args={"check_same_thread": False}
    )
    return candidate_engine, db_url

engine, ACTIVE_DATABASE_URL = init_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

try:
    from app.migrations import run_migrations
    run_migrations(engine)
except Exception as e_mig:
    print("[Database] Auto-migration notice:", e_mig)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
