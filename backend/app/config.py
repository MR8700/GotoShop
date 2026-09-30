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
    CARD_SIGNING_KEY: str = os.getenv("CARD_SIGNING_KEY", "")
    # Pas de secret public par défaut : en production (hors SQLite) OTP_SECRET doit être défini ;
    # à défaut un secret aléatoire propre au processus est généré (les OTP ne survivent pas à un redémarrage).
    OTP_SECRET: str = os.getenv("OTP_SECRET") or (
        "gotoshop-dev-only-otp-secret" if "sqlite" in get_database_url() else __import__("secrets").token_hex(32)
    )
    # Environnement : "dev" (SQLite local) ou "production". Le seed de démonstration n'a lieu qu'en dev
    # (ou si SEED_DEMO_DATA=1).
    APP_ENV: str = os.getenv("APP_ENV", "dev" if "sqlite" in get_database_url() else "production").lower()
    SEED_DEMO_DATA: bool = os.getenv("SEED_DEMO_DATA", "true" if "sqlite" in get_database_url() else "false").lower() in ("true", "1", "yes")
    # Origines autorisées (CORS), séparées par des virgules ; FRONTEND_URL et localhost (dev) sont ajoutés.
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "")
    # Simulateur actif par défaut seulement en local (SQLite) ; en production (PostgreSQL) il faut l'activer explicitement.
    PAYMENT_SIMULATOR: bool = os.getenv("PAYMENT_SIMULATOR", "true" if "sqlite" in get_database_url() else "false").lower() in ("true", "1", "yes")
    # Accès de démonstration (mots de passe maîtres, alias "demo"/"admin", /auth/demo-login, jetons demo_owner_token_<slug>) :
    # contournent l'authentification -> désactivés par défaut. ALLOW_DEMO_ACCESS=1 uniquement en développement local.
    ALLOW_DEMO_ACCESS: bool = os.getenv("ALLOW_DEMO_ACCESS", "false").lower() in ("true", "1", "yes")
    # Si activé, la connexion / inscription par téléphone exige un code OTP (POST /customer/login/otp/request).
    REQUIRE_LOGIN_OTP: bool = os.getenv("REQUIRE_LOGIN_OTP", "false").lower() in ("true", "1", "yes")
    # --- Authentification sans mot de passe (Passkeys / WebAuthn) ---
    # PASSWORD_AUTH_ENABLED : les COMMERÇANTS (Owner) se connectent encore par mot de passe ; laissé à true tant qu'ils
    # n'ont pas de Passkey, puis à passer à false (POST /auth/login et /auth/change-password répondent alors 403).
    PASSWORD_AUTH_ENABLED: bool = os.getenv("PASSWORD_AUTH_ENABLED", "true").lower() in ("true", "1", "yes")
    PASSKEY_ENABLED: bool = os.getenv("PASSKEY_ENABLED", "true").lower() in ("true", "1", "yes")
    RECOVERY_CODES_ENABLED: bool = os.getenv("RECOVERY_CODES_ENABLED", "true").lower() in ("true", "1", "yes")
    INITIAL_PHONE_VERIFICATION_REQUIRED: bool = os.getenv("INITIAL_PHONE_VERIFICATION_REQUIRED", "false").lower() in ("true", "1", "yes")
    OTP_REQUIRED_FOR_NEW_DEVICE: bool = os.getenv("OTP_REQUIRED_FOR_NEW_DEVICE", "false").lower() in ("true", "1", "yes")
    OTP_REQUIRED_FOR_ACCOUNT_RECOVERY: bool = os.getenv("OTP_REQUIRED_FOR_ACCOUNT_RECOVERY", "false").lower() in ("true", "1", "yes")
    # RP ID = domaine (sans schéma ni port) ; origines = URL exactes du frontend (séparées par des virgules).
    PASSKEY_RP_ID: str = os.getenv("PASSKEY_RP_ID", "")
    PASSKEY_RP_NAME: str = os.getenv("PASSKEY_RP_NAME", "GotoShop")
    PASSKEY_ORIGINS: str = os.getenv("PASSKEY_ORIGINS", "")
    PASSKEY_CHALLENGE_TTL_SECONDS: int = int(os.getenv("PASSKEY_CHALLENGE_TTL_SECONDS", "300"))
    # Plafond appliqué au frais de livraison envoyé par le client quand la ville n'a pas de tarif configuré.
    MAX_UNCONFIGURED_DELIVERY_FEE: int = int(os.getenv("MAX_UNCONFIGURED_DELIVERY_FEE", "5000"))
    # Envoi des codes OTP : "simulator" (aucun SMS, code renvoyé seulement si PAYMENT_SIMULATOR), "webhook" ou "twilio".
    SMS_PROVIDER: str = os.getenv("SMS_PROVIDER", "simulator").lower()
    SMS_WEBHOOK_URL: str = os.getenv("SMS_WEBHOOK_URL", "")
    SMS_WEBHOOK_TOKEN: str = os.getenv("SMS_WEBHOOK_TOKEN", "")
    TWILIO_ACCOUNT_SID: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN: str = os.getenv("TWILIO_AUTH_TOKEN", "")
    TWILIO_FROM: str = os.getenv("TWILIO_FROM", "")
    # WhatsApp (OTP de réinitialisation) : webhook dédié ; à défaut, repli sur le fournisseur SMS.
    WHATSAPP_WEBHOOK_URL: str = os.getenv("WHATSAPP_WEBHOOK_URL", "")
    WHATSAPP_WEBHOOK_TOKEN: str = os.getenv("WHATSAPP_WEBHOOK_TOKEN", "")
    # Session client : durée de vie du jeton, cookie HttpOnly, et présence du jeton dans le corps des réponses.
    CUSTOMER_SESSION_TTL_DAYS: int = int(os.getenv("CUSTOMER_SESSION_TTL_DAYS", "30"))
    CUSTOMER_COOKIE_NAME: str = os.getenv("CUSTOMER_COOKIE_NAME", "gs_customer")
    CUSTOMER_COOKIE_SAMESITE: str = os.getenv("CUSTOMER_COOKIE_SAMESITE", "Lax")  # "None" si l'API est sur un autre site
    CUSTOMER_COOKIE_SECURE: bool = os.getenv("CUSTOMER_COOKIE_SECURE", "false" if os.getenv("APP_ENV", "dev") == "dev" else "true").lower() in ("true", "1", "yes")
    # false (défaut) = le jeton n'est JAMAIS renvoyé au JavaScript (cookie HttpOnly seul). true = compat. ancien frontend.
    CUSTOMER_TOKEN_IN_BODY: bool = os.getenv("CUSTOMER_TOKEN_IN_BODY", "false").lower() in ("true", "1", "yes")
    PASSWORD_RESET_OTP_TTL_MINUTES: int = int(os.getenv("PASSWORD_RESET_OTP_TTL_MINUTES", "10"))
    WALLET_COMMISSION_RATE: float = float(os.getenv("WALLET_COMMISSION_RATE", "0.0"))
    
    # Supabase Integration (PostgreSQL + Cloud Storage for Vercel Serverless)
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "") or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    SUPABASE_BUCKET: str = os.getenv("SUPABASE_BUCKET", "media")


settings = Settings()


if "sqlite" not in settings.DATABASE_URL:
    for _name in ("OTP_SECRET", "CARD_SIGNING_KEY"):
        if not os.getenv(_name):
            print(f"[Config] ATTENTION : {_name} non défini en production — définissez-le dans l'environnement.")
