import os
from pathlib import Path
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import NullPool
from app.config import settings

def get_sqlite_engine():
    is_vercel = bool(os.getenv("VERCEL"))
    fallback_db = Path("/tmp") / "conversastore.db" if is_vercel else settings.DB_PATH
    fallback_url = f"sqlite:///{fallback_db}"
    return create_engine(fallback_url, connect_args={"check_same_thread": False}), fallback_url

def init_engine():
    db_url = settings.DATABASE_URL
    is_vercel = bool(os.getenv("VERCEL"))
    
    # 1. If PostgreSQL configured (Supabase, Neon, Railway, etc.)
    if "sqlite" not in db_url:
        try:
            connect_args = {
                "connect_timeout": 3,
            }
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
            # NEVER connect at module import time! Return candidate engine immediately.
            return candidate_engine, db_url
        except Exception as e_remote:
            print(f"[Database] PostgreSQL config error: {e_remote}, using SQLite fallback")
            return get_sqlite_engine()

    # 2. SQLite
    candidate_engine = create_engine(
        db_url,
        connect_args={"check_same_thread": False}
    )
    return candidate_engine, db_url

engine, ACTIVE_DATABASE_URL = init_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    global engine, ACTIVE_DATABASE_URL, SessionLocal

    try:
        from app.main import ensure_database_initialized
        ensure_database_initialized()
    except Exception as e_init:
        print("[Database] Lazy initialization notice:", e_init)

    try:
        db = SessionLocal()
        # Verify connection can execute a query
        db.execute(text("SELECT 1"))
    except Exception as e_conn:
        if "sqlite" not in ACTIVE_DATABASE_URL:
            print(f"[Database] Remote PostgreSQL unavailable: {e_conn}. Activating instant SQLite fallback...")
            engine, ACTIVE_DATABASE_URL = get_sqlite_engine()
            SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
            try:
                from app.main import ensure_database_initialized
                ensure_database_initialized(force=True)
            except Exception:
                pass
            db = SessionLocal()
        else:
            raise e_conn

    try:
        yield db
    finally:
        db.close()
