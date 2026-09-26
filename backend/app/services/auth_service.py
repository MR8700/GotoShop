from datetime import datetime, timedelta
from typing import Optional, Tuple, List, Dict
import re
from sqlalchemy.orm import Session
from app.models.store import Owner, Store
from app.core.security import hash_password, verify_password, validate_strong_password, generate_session_token
from app.schemas.auth import LoginRequest, ChangePasswordRequest, LoginResponse, PasswordCheckDetail

DEFAULT_ADMIN_EMAIL = "awa@chictech.bf"
DEFAULT_ADMIN_TEMP_PASSWORD = "AwaChic2026!"
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15

class AuthService:
    @classmethod
    def ensure_default_owner_credentials(cls, db: Session, owner: Owner) -> None:
        """Ensures the owner has the initial predefined temporary password if not set."""
        if not owner.password_hash:
            cls.reset_to_default_credentials(db, owner)

    @classmethod
    def reset_to_default_credentials(cls, db: Session, owner: Owner) -> None:
        """Resets the owner to the initial predefined temporary password and sets must_change_password=True."""
        pwd_hash, salt = hash_password(DEFAULT_ADMIN_TEMP_PASSWORD)
        owner.password_hash = pwd_hash
        owner.password_salt = salt
        owner.must_change_password = True
        owner.failed_login_attempts = 0
        owner.locked_until = None
        db.commit()

    @classmethod
    def get_password_checks_breakdown(cls, password: str) -> List[PasswordCheckDetail]:
        """Returns visual status breakdown for each required password rule."""
        p = password or ""
        return [
            PasswordCheckDetail(
                key="length",
                label="Au moins 8 caractères",
                passed=len(p) >= 8
            ),
            PasswordCheckDetail(
                key="no_space",
                label="Aucun espace (zéro espace)",
                passed=(not bool(re.search(r"\s", p))) and len(p) > 0
            ),
            PasswordCheckDetail(
                key="uppercase",
                label="Au moins une lettre majuscule (A-Z)",
                passed=bool(re.search(r"[A-Z]", p))
            ),
            PasswordCheckDetail(
                key="lowercase",
                label="Au moins une lettre minuscule (a-z)",
                passed=bool(re.search(r"[a-z]", p))
            ),
            PasswordCheckDetail(
                key="number",
                label="Au moins un chiffre (0-9)",
                passed=bool(re.search(r"[0-9]", p))
            ),
            PasswordCheckDetail(
                key="special",
                label="Au moins un caractère spécial (!@#$%^&*...)",
                passed=bool(re.search(r"[!@#$%^&*(),.?\":{}|<>\-_+=\[\]\\/;~`]", p))
            ),
            PasswordCheckDetail(
                key="no_repeat",
                label="Aucun caractère consécutif répété (pas de 'aa', '11')",
                passed=(not bool(re.search(r"(.)\1", p))) and len(p) > 0
            )
        ]

    @classmethod
    def authenticate(cls, db: Session, req: LoginRequest) -> Tuple[Owner, str]:
        ident = req.identifier.strip().lower()
        
        # 1. Search directly by email, full_name, or phone_number
        owner = db.query(Owner).filter(
            (Owner.email.ilike(ident)) | (Owner.full_name.ilike(ident)) | (Owner.phone_number == ident)
        ).first()

        # 2. Search by Store slug or Store name
        if not owner:
            target_store = db.query(Store).filter(
                (Store.slug.ilike(ident)) | (Store.name.ilike(ident))
            ).first()
            if target_store and target_store.owner:
                owner = target_store.owner

        # 3. Flexible Demo Aliases fallback
        if not owner and ident in ["demo", "test", "admin", "awa@chictech.bf", "awa", "demo_admin", "mariam"]:
            owner = db.query(Owner).first()

        if not owner:
            raise ValueError("Identifiants incorrects. Veuillez vérifier votre adresse email ou mot de passe.")

        # Ensure default temporary password if first time
        cls.ensure_default_owner_credentials(db, owner)

        # Master demo passwords bypass
        DEMO_PASSWORDS = [
            DEFAULT_ADMIN_TEMP_PASSWORD,
            "FasoDanfani2026!",
            "OuagaTech2026!",
            "SyaBio2026!",
            "SuperAdmin2026!",
            "GotoShop!2026",
            "demo123",
            "admin123"
        ]
        is_demo_pwd = req.password in DEMO_PASSWORDS

        # Check account lockout (demo passwords bypass lockout and unlock)
        if not is_demo_pwd and owner.locked_until and owner.locked_until > datetime.utcnow():
            remaining = int((owner.locked_until - datetime.utcnow()).total_seconds() // 60) + 1
            raise ValueError(f"Compte temporairement verrouillé suite à trop d'échecs. Réessayez dans {remaining} minutes ou cliquez sur 'Réinitialiser'.")

        # Verify password
        is_valid = is_demo_pwd or verify_password(req.password, owner.password_hash, owner.password_salt)
        if not is_valid:
            owner.failed_login_attempts = (owner.failed_login_attempts or 0) + 1
            if owner.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
                owner.locked_until = datetime.utcnow() + timedelta(minutes=LOCKOUT_MINUTES)
                db.commit()
                raise ValueError(f"Mot de passe incorrect. Compte verrouillé pendant {LOCKOUT_MINUTES} minutes.")
            db.commit()
            remaining_tries = MAX_FAILED_ATTEMPTS - owner.failed_login_attempts
            raise ValueError(f"Identifiants incorrects. {remaining_tries} tentative(s) restante(s).")

        # Success: reset failed attempts
        owner.failed_login_attempts = 0
        owner.locked_until = None
        owner.last_login_at = datetime.utcnow()
        token = generate_session_token()
        owner.session_token = token
        db.commit()
        db.refresh(owner)

        return owner, token

    @classmethod
    def demo_login(cls, db: Session, target_slug: Optional[str] = None) -> Tuple[Owner, str]:
        """Instant demo login shortcut bypassing credential forms for test admin and demo merchants."""
        owner = None
        if target_slug:
            target_store = db.query(Store).filter(Store.slug == target_slug).first()
            if target_store and target_store.owner:
                owner = target_store.owner

        if not owner:
            owner = db.query(Owner).first()

        if not owner:
            from app.seed.seeder import seed_database
            seed_database()
            owner = db.query(Owner).first()

        if not owner:
            raise ValueError("Aucun compte commerçant de démonstration trouvé en base.")

        token = generate_session_token()
        owner.session_token = token
        owner.failed_login_attempts = 0
        owner.locked_until = None
        owner.last_login_at = datetime.utcnow()
        db.commit()
        db.refresh(owner)
        return owner, token

    @classmethod
    def change_password(cls, db: Session, token: str, req: ChangePasswordRequest) -> Owner:
        owner = db.query(Owner).filter(Owner.session_token == token).first()
        if not owner:
            raise ValueError("Session invalide ou expirée. Veuillez vous reconnecter.")

        # Verify current password
        if not verify_password(req.current_password, owner.password_hash, owner.password_salt):
            raise ValueError("Le mot de passe actuel est incorrect.")

        if req.new_password != req.confirm_password:
            raise ValueError("Le nouveau mot de passe et sa confirmation ne correspondent pas.")

        # Strict validation
        is_strong, errors = validate_strong_password(req.new_password)
        if not is_strong:
            raise ValueError(errors[0])

        # Ensure new password is not identical to current
        if verify_password(req.new_password, owner.password_hash, owner.password_salt):
            raise ValueError("Le nouveau mot de passe doit être différent de l'ancien.")

        # Save new strong password with fresh cryptographic salt
        new_hash, new_salt = hash_password(req.new_password)
        owner.password_hash = new_hash
        owner.password_salt = new_salt
        owner.must_change_password = False
        owner.session_token = generate_session_token() # rotate token
        db.commit()
        db.refresh(owner)

        return owner

    @classmethod
    def get_owner_by_token(cls, db: Session, token: Optional[str]) -> Optional[Owner]:
        if not token:
            return None
        return db.query(Owner).filter(Owner.session_token == token).first()
