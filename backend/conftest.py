"""Isolation de TOUTE la suite pytest (tests/ et anciens scripts backend/test_*.py) dans une copie jetable de la base.

Sans cela, les anciens scripts écrivaient directement dans conversastore.db (voir AUDIT_GOTOSHOP.md, C4 et §4 quater-5).
Ce fichier est chargé avant tout import de l'application : DATABASE_URL pointe donc sur la copie dès le départ."""
import os
import shutil
import tempfile

if not os.environ.get("GOTOSHOP_TEST_ISOLATED"):
    _src = os.path.join(os.path.dirname(__file__), "conversastore.db")
    _tmp = os.path.join(tempfile.mkdtemp(prefix="gotoshop_test_"), "test.db")
    if os.path.exists(_src):
        shutil.copy2(_src, _tmp)
    os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}"
    os.environ.pop("SUPABASE_DB_URL", None)
    os.environ["GOTOSHOP_TEST_ISOLATED"] = "1"

# Le défaut de production est REQUIRE_LOGIN_OTP=true ; les scénarios historiques (connexion par téléphone seul)
# le désactivent explicitement. Les tests OTP l'activent via monkeypatch.
os.environ.setdefault("REQUIRE_LOGIN_OTP", "false")
# Les scénarios historiques lisent access_token dans le corps ; le mode cookie seul est couvert par tests/test_customer_cookie_session.py.
os.environ.setdefault("CUSTOMER_TOKEN_IN_BODY", "true")


# --- Anciens tests : jeton super-admin injecté sur les routes désormais protégées (audit 30/09/2026) -------------
# Les scénarios historiques appelaient ces routes sans authentification. On leur fournit un jeton valide, sans
# toucher aux autres routes (les tests qui vérifient un 401 restent valides). tests/test_audit_auth_fixes.py
# n'est PAS concerné : il vérifie justement le refus sans jeton.
import re as _re
import pytest as _pytest

_PROTECTED = _re.compile(
    r"^(/api)?/(intents/(feed|pending-followup|discrepancies)|intents/[^/]+/(confirm|archive|resolve-discrepancy)"
    r"|intents/[^/]+$|notifications|conversations|calls|analytics/overview|orders/[^/]+$)"
)
_LEGACY_TOKEN = "legacy-tests-superadmin-token"


def _ensure_legacy_superadmin():
    from app.database import SessionLocal
    from app.models.super_admin import SuperAdmin
    from app.core.security import lookup_hash, hash_password
    db = SessionLocal()
    try:
        sa = db.query(SuperAdmin).filter(SuperAdmin.email == "legacy-tests@example.test").first()
        if not sa:
            h, salt = hash_password("Legacy#Tests1!")
            sa = SuperAdmin(email="legacy-tests@example.test", password_hash=h, password_salt=salt)
            db.add(sa)
        sa.session_token = lookup_hash(_LEGACY_TOKEN)
        db.commit()
    finally:
        db.close()


@_pytest.fixture(autouse=True)
def _legacy_auto_auth(request, monkeypatch):
    if "test_audit_auth_fixes" in request.node.module.__name__:
        yield
        return
    from fastapi.testclient import TestClient
    _ensure_legacy_superadmin()
    original = TestClient.request

    def patched(self, method, url, **kwargs):
        path = str(url).split("?")[0]
        headers = dict(kwargs.get("headers") or {})
        if (
            _PROTECTED.match(path)
            and not any(k.lower() == "authorization" for k in headers)
            and not (_re.match(r"^(/api)?/orders/[^/]+$", path) and method.upper() != "GET")
        ):
            headers["Authorization"] = f"Bearer {_LEGACY_TOKEN}"
        kwargs["headers"] = headers
        return original(self, method, url, **kwargs)

    monkeypatch.setattr(TestClient, "request", patched)
    yield
