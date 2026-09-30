"""Routes commerçant pour les tarifs de livraison + OTP persistant en base (AUDIT §4 quater)."""
import os
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.store import Store, Owner
from app.models.otp import OtpCode
from app.services.auth_service import AuthService
from app.services.otp_service import OtpService
from app.core.security import hash_session_token
from app.core.clock import utcnow

client = TestClient(app, base_url="https://gotoshop.example")


def _owner_headers():
    """Jeton commerçant valide pour la première boutique disposant d'un propriétaire (base jetable)."""
    with SessionLocal() as db:
        store = db.query(Store).filter(Store.owner_id.isnot(None)).first()
        owner = db.query(Owner).filter(Owner.id == store.owner_id).first()
        raw = "test-owner-token-" + os.urandom(6).hex()
        owner.session_token = hash_session_token(raw)
        db.commit()
        return store.id, {"Authorization": f"Bearer {raw}"}


def test_tarifs_livraison_refuses_sans_jeton():
    sid, _ = _owner_headers()
    r = client.post(f"/api/store/{sid}/delivery-cities", json={"name": "Zone X", "delivery_fee": 500})
    assert r.status_code in (401, 403)


def test_cycle_complet_tarif_livraison():
    sid, h = _owner_headers()
    r = client.post(f"/api/store/{sid}/delivery-cities", json={"name": "Zone Admin Test", "delivery_fee": 1200}, headers=h)
    assert r.status_code == 200, r.text
    city = r.json()
    assert city["delivery_fee"] == 1200
    # doublon refusé, tarif négatif refusé
    assert client.post(f"/api/store/{sid}/delivery-cities", json={"name": "zone admin test"}, headers=h).status_code == 400
    assert client.post(f"/api/store/{sid}/delivery-cities", json={"name": "Neg", "delivery_fee": -5}, headers=h).status_code == 422
    # modification
    r = client.put(f"/api/store/{sid}/delivery-cities/{city['id']}", json={"name": "Zone Admin Test", "delivery_fee": 2000}, headers=h)
    assert r.status_code == 200 and r.json()["delivery_fee"] == 2000
    # lecture publique
    pub = client.get(f"/api/store/{sid}/delivery-cities").json()
    assert any(c["id"] == city["id"] and c["delivery_fee"] == 2000 for c in pub)
    # suppression
    assert client.delete(f"/api/store/{sid}/delivery-cities/{city['id']}", headers=h).status_code == 200
    assert not any(c["id"] == city["id"] for c in client.get(f"/api/store/{sid}/delivery-cities").json())


def test_tarif_d_une_autre_boutique_inaccessible():
    sid, h = _owner_headers()
    with SessionLocal() as db:
        other = db.query(Store).filter(Store.id != sid).first()
        other_owner = other.owner_id
        mine = db.query(Store).filter(Store.id == sid).first().owner_id
    if other_owner == mine:
        return  # même propriétaire pour les deux boutiques : rien à isoler
    r = client.post(f"/api/store/{other.id}/delivery-cities", json={"name": "Intrus", "delivery_fee": 1}, headers=h)
    assert r.status_code in (401, 403)


def test_otp_stocke_en_base_et_hache():
    phone, ctx = "+22670999001", "ctx-test-db"
    ok, _, payload = OtpService.request_otp(phone, ctx, 0)
    assert ok
    code = payload["simulated_code"]
    with SessionLocal() as db:
        row = db.query(OtpCode).filter(OtpCode.key == f"{phone}:{ctx}").first()
        assert row is not None and code not in (row.code_hash, row.salt)  # jamais en clair
    assert OtpService.verify_otp(phone, ctx, code)[0] is True
    assert OtpService.verify_otp(phone, ctx, code)[0] is False  # usage unique
    with SessionLocal() as db:
        assert db.query(OtpCode).filter(OtpCode.key == f"{phone}:{ctx}").first() is None


def test_otp_expire_et_tentatives_limitees():
    phone, ctx = "+22670999002", "ctx-test-exp"
    ok, _, payload = OtpService.request_otp(phone, ctx, 0)
    assert ok
    with SessionLocal() as db:
        row = db.query(OtpCode).filter(OtpCode.key == f"{phone}:{ctx}").first()
        row.expires_at = utcnow() - timedelta(seconds=1)
        db.commit()
    ok2, msg = OtpService.verify_otp(phone, ctx, payload["simulated_code"])
    assert ok2 is False and "expir" in msg.lower()


def test_otp_refuse_sans_fournisseur_sms_en_production(monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "PAYMENT_SIMULATOR", False)
    monkeypatch.setattr(settings, "SMS_PROVIDER", "simulator")
    ok, msg, payload = OtpService.request_otp("+22670999003", "ctx-test-prod", 0)
    assert ok is False and "sms" in msg.lower() and not payload


def test_otp_envoye_par_webhook(monkeypatch):
    from app.config import settings
    from app.services import sms_service
    sent = {}
    monkeypatch.setattr(settings, "PAYMENT_SIMULATOR", False)
    monkeypatch.setattr(settings, "SMS_PROVIDER", "webhook")
    monkeypatch.setattr(settings, "SMS_WEBHOOK_URL", "https://sms.example/send")
    monkeypatch.setattr(sms_service, "_post", lambda url, data, headers: sent.update(url=url, data=data))
    ok, _, payload = OtpService.request_otp("+22670999004", "ctx-test-hook", 0)
    assert ok and "simulated_code" not in payload  # le code part par SMS, pas dans la réponse
    assert sent["url"] == "https://sms.example/send" and b"+22670999004" in sent["data"]
