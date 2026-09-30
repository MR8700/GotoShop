"""Correctifs de l'audit du 30/09/2026 : tout appel sans jeton sur une route sensible -> 401/403."""
import io
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.commerce import OrderIntent
from app.models.chat import Conversation
from app.models.store import Store

client = TestClient(app, base_url="https://gotoshop.example")
db = SessionLocal()


def _denied(r):
    return r.status_code in (401, 403)


def test_intents_sans_jeton():
    it = db.query(OrderIntent).first()
    if it:
        assert _denied(client.post(f"/api/intents/{it.id}/confirm", json={"is_sold": True}))
        assert _denied(client.post(f"/api/intents/{it.id}/archive"))
        assert _denied(client.delete(f"/api/intents/{it.id}"))
        assert db.query(OrderIntent).filter(OrderIntent.id == it.id).first() is not None
    assert _denied(client.get("/api/intents/feed"))
    assert _denied(client.get("/api/intents/discrepancies"))


def test_notifications_sans_jeton():
    store = db.query(Store).first()
    assert _denied(client.get(f"/api/notifications?store_id={store.id}"))
    assert _denied(client.post("/api/notifications/read-all"))
    assert _denied(client.post("/api/notifications/x/read"))
    assert _denied(client.delete("/api/notifications/x"))


def test_conversations_et_appels_sans_jeton():
    assert _denied(client.get("/api/conversations"))
    conv = db.query(Conversation).first()
    if conv:
        assert _denied(client.get(f"/api/conversations/{conv.id}"))
        assert _denied(client.get(f"/api/conversations/{conv.id}/messages"))
        assert _denied(client.post(f"/api/conversations/{conv.id}/messages",
                                   json={"sender_type": "CUSTOMER", "sender_name": "x", "content": "hi"}))
        assert _denied(client.post("/api/calls", json={"conversation_id": conv.id, "caller_name": "x"}))
    assert _denied(client.get("/api/calls/history"))


def test_analytics_overview_protege():
    assert _denied(client.get("/api/analytics/overview"))


def test_fiche_commande_protegee():
    from app.models.order import Order
    o = db.query(Order).first()
    if o:
        assert _denied(client.get(f"/api/orders/{o.id}"))


def test_quick_login_limite_de_debit():
    codes = [client.post("/api/customer/quick-login", json={"phone": "+22670000000", "store_id": "x"}).status_code
             for _ in range(12)]
    assert 429 in codes


def test_api_inconnue_renvoie_404_json():
    r = client.get("/api/route-qui-n-existe-pas")
    assert r.status_code == 404
    assert "text/html" not in r.headers.get("content-type", "")


def test_extension_derivee_du_type_valide():
    from app.services.media_service import MIME_TO_EXT, _magic_ok
    assert MIME_TO_EXT["image/png"] == ".png"
    assert not _magic_ok("image/png", b"<html><script>alert(1)</script>")
    assert _magic_ok("image/png", b"\x89PNG\r\n\x1a\n" + b"0" * 20)
