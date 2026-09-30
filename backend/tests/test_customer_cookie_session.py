"""Session client : cookie HttpOnly, jeton haché en base, expiration, révocation (mode par défaut : jeton absent du corps)."""
import os
from datetime import timedelta

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_cookie.db")
from fastapi.testclient import TestClient  # noqa: E402

from app.config import settings  # noqa: E402
from app.core.clock import utcnow  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.models.customer import Customer  # noqa: E402
from app.models.store import Store  # noqa: E402

client = TestClient(app)


def _login(phone):
    with SessionLocal() as db:
        sid = db.query(Store).first().id
    return client.post("/api/customer/quick-register", json={"name": "Cookie Test", "phone": phone, "store_id": sid})


def test_cookie_httponly_hash_en_base_et_pas_de_jeton_dans_le_corps(monkeypatch):
    monkeypatch.setattr(settings, "CUSTOMER_TOKEN_IN_BODY", False)
    client.cookies.clear()
    r = _login("+22670991001")
    assert r.status_code == 200, r.text
    assert r.json()["access_token"] is None
    sc = r.headers["set-cookie"]
    assert "HttpOnly" in sc and "SameSite=Lax" in sc and sc.startswith(settings.CUSTOMER_COOKIE_NAME + "=")
    raw = client.cookies.get(settings.CUSTOMER_COOKIE_NAME)
    with SessionLocal() as db:
        c = db.query(Customer).filter(Customer.phone == "+22670991001").first()
        assert c.session_token.startswith("h1$") and c.session_token != raw and c.session_expires_at > utcnow()
    assert client.get("/api/customer/me").status_code == 200  # authentifié par le cookie seul


def test_expiration_et_deconnexion(monkeypatch):
    monkeypatch.setattr(settings, "CUSTOMER_TOKEN_IN_BODY", False)
    client.cookies.clear()
    _login("+22670991002")
    with SessionLocal() as db:
        c = db.query(Customer).filter(Customer.phone == "+22670991002").first()
        c.session_expires_at = utcnow() - timedelta(minutes=1)
        db.commit()
    assert client.get("/api/customer/me").status_code == 401  # expirée
    client.cookies.clear()
    _login("+22670991003")
    assert client.post("/api/customer/logout").status_code == 200
    assert client.get("/api/customer/me").status_code == 401
    with SessionLocal() as db:
        assert db.query(Customer).filter(Customer.phone == "+22670991003").first().session_token is None


def test_en_tete_explicite_prioritaire_et_empreinte_refusee(monkeypatch):
    monkeypatch.setattr(settings, "CUSTOMER_TOKEN_IN_BODY", True)
    client.cookies.clear()
    tok = _login("+22670991004").json()["access_token"]
    client.cookies.clear()
    assert client.get("/api/customer/me", headers={"Authorization": f"Bearer {tok}"}).status_code == 200
    with SessionLocal() as db:
        h = db.query(Customer).filter(Customer.phone == "+22670991004").first().session_token
    # présenter l'empreinte stockée (fuite de base) ne doit JAMAIS ouvrir une session
    assert client.get("/api/customer/me", headers={"Authorization": f"Bearer {h}"}).status_code == 401


def test_marqueur_cookie_remplace_par_le_jeton_httponly(monkeypatch):
    monkeypatch.setattr(settings, "CUSTOMER_TOKEN_IN_BODY", False)
    client.cookies.clear()
    _login("+22670991005")
    # le JavaScript n'a que le marqueur ; le serveur le remplace par le cookie
    assert client.get("/api/customer/me", headers={"Authorization": "Bearer __cookie__"}).status_code == 200
    client.cookies.clear()  # sans cookie, le marqueur n'ouvre rien
    assert client.get("/api/customer/me", headers={"Authorization": "Bearer __cookie__"}).status_code == 401
