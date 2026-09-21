import hashlib
import hmac
import secrets
import re
from typing import Tuple, List, Optional

ITERATIONS = 120000

def hash_password(password: str, salt: Optional[str] = None) -> Tuple[str, str]:
    """Hashes a password using PBKDF2-HMAC-SHA256 with a unique cryptographic salt."""
    if not salt:
        salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        ITERATIONS
    )
    return key.hex(), salt

def verify_password(password: str, password_hash: str, salt: str) -> bool:
    """Verifies a password against the stored hash in constant time."""
    if not password or not password_hash or not salt:
        return False
    computed_hash, _ = hash_password(password, salt)
    return hmac.compare_digest(computed_hash, password_hash)

def validate_strong_password(password: str) -> Tuple[bool, List[str]]:
    """
    Validates password against mandatory security rules:
    - Minimum 8 characters
    - Zero spaces
    - At least 1 uppercase letter
    - At least 1 lowercase letter
    - At least 1 digit
    - At least 1 special character
    - No consecutive repeated characters
    """
    errors = []
    
    if len(password) < 8:
        errors.append("Le mot de passe doit comporter au moins 8 caractères.")
        
    if re.search(r"\s", password):
        errors.append("Le mot de passe ne doit contenir aucun espace.")
        
    if not re.search(r"[A-Z]", password):
        errors.append("Le mot de passe doit contenir au moins une lettre majuscule.")
        
    if not re.search(r"[a-z]", password):
        errors.append("Le mot de passe doit contenir au moins une lettre minuscule.")
        
    if not re.search(r"[0-9]", password):
        errors.append("Le mot de passe doit contenir au moins un chiffre.")
        
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>\-_+=\[\]\\/;~`]", password):
        errors.append("Le mot de passe doit contenir au moins un caractère spécial.")
        
    # Check for consecutive repeating characters (e.g., 'aa', '11', '%%')
    if re.search(r"(.)\1", password):
        errors.append("Le mot de passe ne doit pas contenir de caractères consécutifs qui se répètent.")
        
    return len(errors) == 0, errors

def generate_session_token() -> str:
    """Generates a high-entropy URL-safe session token."""
    return secrets.token_urlsafe(32)
