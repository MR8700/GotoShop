import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DB_PATH = BASE_DIR / "backend" / "conversastore.db"

# Serverless (Vercel) uses /tmp for all write operations
if os.getenv("VERCEL"):
    MEDIA_DIR = Path("/tmp/media")
    try:
        MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    except Exception:
        pass
else:
    MEDIA_DIR = BASE_DIR / "media"


def get_database_url() -> str:
    # 1. Supabase direct or pooler database URL
    supabase_db = os.getenv("SUPABASE_DB_URL")
    if supabase_db:
        if supabase_db.startswith("postgres://"):
            return supabase_db.replace("postgres://", "postgresql://", 1)
        return supabase_db

    # 2. Standard PostgreSQL environment variables (Vercel, Neon, Supabase, Railway)
    db_url = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL") or os.getenv("POSTGRES_PRISMA_URL")
    
    # 3. Individual variables
    if not db_url and os.getenv("POSTGRES_HOST"):
        user = os.getenv("POSTGRES_USER", "postgres")
        password = os.getenv("POSTGRES_PASSWORD", "")
        host = os.getenv("POSTGRES_HOST", "localhost")
        port = os.getenv("POSTGRES_PORT", "5432")
        db = os.getenv("POSTGRES_DB", "gotoshop")
        auth = f"{user}:{password}@" if password else f"{user}@"
        db_url = f"postgresql://{auth}{host}:{port}/{db}"
    
    # 4. Default to SQLite for local development or Vercel serverless fallback
    if not db_url:
        target_db = DB_PATH
        if os.getenv("VERCEL"):
            tmp_db = Path("/tmp") / "conversastore.db"
            if not tmp_db.exists() and DB_PATH.exists():
                try:
                    import shutil
                    shutil.copy2(str(DB_PATH), str(tmp_db))
                except Exception as e:
                    print("Notice: could not copy bundled db to /tmp:", e)
            target_db = tmp_db
        db_url = f"sqlite:///{target_db}"

    # Normalize postgres:// to postgresql:// for SQLAlchemy 2.0+
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    return db_url


class Settings:
    PROJECT_NAME: str = "ConversaStore Mobile Engine"
    API_V1_STR: str = "/api"
    DATABASE_URL: str = get_database_url()
    MEDIA_DIR: Path = MEDIA_DIR
    BASE_DIR: Path = BASE_DIR
    DB_PATH: Path = DB_PATH
    BASE_URL: str = os.getenv("BASE_URL", "http://localhost:8000")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
    
    # Supabase Integration (PostgreSQL + Cloud Storage for Vercel Serverless)
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "") or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    SUPABASE_BUCKET: str = os.getenv("SUPABASE_BUCKET", "media")


settings = Settings()
