import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
MEDIA_DIR = BASE_DIR / "media"
DB_PATH = BASE_DIR / "backend" / "conversastore.db"

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
    
    # 4. Default to SQLite for local development if no PostgreSQL/Supabase config is provided
    if not db_url:
        db_url = f"sqlite:///{DB_PATH}"

    # Normalize postgres:// to postgresql:// for SQLAlchemy 2.0+
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    return db_url

class Settings:
    PROJECT_NAME: str = "ConversaStore Mobile Engine"
    API_V1_STR: str = "/api"
    DATABASE_URL: str = get_database_url()
    MEDIA_DIR: Path = MEDIA_DIR
    BASE_URL: str = os.getenv("BASE_URL", "http://localhost:8000")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
    
    # Supabase Integration (PostgreSQL + Cloud Storage for Vercel Serverless)
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "") or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    SUPABASE_BUCKET: str = os.getenv("SUPABASE_BUCKET", "media")

settings = Settings()
